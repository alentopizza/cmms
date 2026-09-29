import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessOrganization } from "@/lib/organization-scope";
import { query } from "@/lib/db";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AssetRow = {
  data: Buffer | null;
  mime_type: string | null;
};

const assetMap = {
  logo: ["logo_data", "logo_mime_type"],
  cover: ["cover_data", "cover_mime_type"],
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; asset: string }> },
) {
  const session=await getSession();
  if(!session) return new NextResponse("Unauthorized",{status:401});

  const { id, asset } = await params;
  const columns = assetMap[asset as keyof typeof assetMap];

  if (!UUID_PATTERN.test(id) || !columns) {
    return new NextResponse("Not found", { status: 404 });
  }
  if(!canAccessOrganization(session,id)) return new NextResponse("Forbidden",{status:403});

  const [dataColumn, mimeColumn] = columns;
  const result = await query<AssetRow>(
    `SELECT ${dataColumn} AS data, ${mimeColumn} AS mime_type
     FROM organizations WHERE id=$1`,
    [id],
  );
  const row = result.rows[0];

  if (!row?.data || !row.mime_type) {
    return new NextResponse("Not configured", { status: 404 });
  }

  return new NextResponse(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mime_type,
      "Cache-Control": "private, max-age=300",
      "Content-Length": String(row.data.length),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
