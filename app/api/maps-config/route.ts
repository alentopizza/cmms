import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// ── Runtime browser-map configuration ───────────────────────────────────────
// NEXT_PUBLIC values are intentionally read on the server at request time so
// container platforms do not need to inject them during the Docker build.
// The browser Maps key is public by design and must be protected with Google
// HTTP-referrer + API restrictions. Server Geocoding credentials are never
// returned by this endpoint.

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const apiKey = String(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();
  const mapId = String(process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "").trim();

  return NextResponse.json({
    enabled: Boolean(apiKey),
    apiKey,
    mapId,
  }, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
