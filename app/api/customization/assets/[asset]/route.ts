import { NextResponse } from "next/server";
import { query } from "@/lib/db";

type AssetRow = {
  data: Buffer | null;
  mime_type: string | null;
};

const assetMap = {
  "logo-on-light": ["logo_on_light", "logo_on_light_mime"],
  "logo-on-dark": ["logo_on_dark", "logo_on_dark_mime"],
  favicon: ["favicon", "favicon_mime"],
} as const;

function fallbackFavicon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="14" fill="#293644"/>
    <path d="M17 17h14c10 0 17 6 17 15s-7 15-17 15H17V17Zm13 22c6 0 9-2 9-7s-3-7-9-7h-4v14h4Z" fill="#38B2A9"/>
  </svg>`;
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ asset: string }> }
) {
  const { asset } = await context.params;
  const columns = assetMap[asset as keyof typeof assetMap];

  if (!columns) return new NextResponse("Not found", { status: 404 });

  const [dataColumn, mimeColumn] = columns;
  const result = await query<AssetRow>(
    `SELECT ${dataColumn} AS data, ${mimeColumn} AS mime_type FROM app_customization WHERE id=1`
  );
  const row = result.rows[0];

  if (!row?.data || !row.mime_type) {
    if (asset === "favicon") return fallbackFavicon();
    return new NextResponse("Not configured", { status: 404 });
  }

  return new NextResponse(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mime_type,
      "Cache-Control": "public, max-age=300",
      "Content-Length": String(row.data.length),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
