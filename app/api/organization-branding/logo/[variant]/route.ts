import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ variant: string }> },
) {
  const session = await getSession();
  if (!session || !session.organizationId || !session.whiteLabel) return new NextResponse("Not found", { status: 404 });

  const { variant } = await params;
  const dark = variant === "dark";
  const result = await query<{ data: Buffer | null; mime: string | null }>(
    dark
      ? "SELECT logo_on_dark data,logo_on_dark_mime mime FROM organization_branding WHERE organization_id=$1"
      : "SELECT logo_on_light data,logo_on_light_mime mime FROM organization_branding WHERE organization_id=$1",
    [session.organizationId],
  );
  const row=result.rows[0];
  if (!row?.data || !row.mime) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mime,
      "Cache-Control": "private, max-age=300",
    },
  });
}
