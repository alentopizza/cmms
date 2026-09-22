import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";

type NominatimItem = {
  display_name?: string;
  lat?: string;
  lon?: string;
};

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!can(session, "locations.manage") && !can(session, "companies.manage")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim();
  if (q.length < 4 || q.length > 240) {
    return NextResponse.json({ message: "Escribe una dirección válida." }, { status: 422 });
  }

  try {
    const endpoint = new URL("https://nominatim.openstreetmap.org/search");
    endpoint.searchParams.set("q", q);
    endpoint.searchParams.set("format", "jsonv2");
    endpoint.searchParams.set("limit", "5");
    endpoint.searchParams.set("addressdetails", "1");

    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "es",
        "User-Agent": "Desweb-CMMS/0.1 geocoder",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ message: "El servicio de validación de direcciones no está disponible en este momento." }, { status: 502 });
    }

    const data = await response.json() as NominatimItem[];
    const results = data
      .map(item => ({
        display_name: String(item.display_name || "").trim(),
        lat: Number(item.lat),
        lon: Number(item.lon),
      }))
      .filter(item => item.display_name && Number.isFinite(item.lat) && Number.isFinite(item.lon))
      .slice(0, 5);

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ message: "No fue posible validar la dirección." }, { status: 502 });
  }
}
