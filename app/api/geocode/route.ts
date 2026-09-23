import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";

type GoogleAddressComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

type GoogleGeocodeItem = {
  formatted_address?: string;
  place_id?: string;
  partial_match?: boolean;
  address_components?: GoogleAddressComponent[];
  geometry?: {
    location?: { lat?: number; lng?: number };
    location_type?: string;
  };
};

type NominatimItem = {
  display_name?: string;
  lat?: string;
  lon?: string;
};

// ── Authenticated geocoding provider boundary ───────────────────────────────

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!can(session, "locations.manage") && !can(session, "companies.manage")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim();
  const city = String(url.searchParams.get("city") || "").trim();
  const country = String(url.searchParams.get("country") || "CO").trim().toUpperCase();
  if (q.length < 4 || q.length > 240) {
    return NextResponse.json({ message: "Escribe una dirección válida." }, { status: 422 });
  }
  if (!city) {
    return NextResponse.json({ message: "Completa la ciudad antes de validar la dirección." }, { status: 422 });
  }

  const googleKey = String(process.env.GOOGLE_MAPS_SERVER_API_KEY || "").trim();

  if (googleKey) {
    try {
      const endpoint = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      endpoint.searchParams.set("address", [q,city,country].filter(Boolean).join(", "));
      endpoint.searchParams.set("key", googleKey);
      endpoint.searchParams.set("language", "es");
      endpoint.searchParams.set("region", country.toLowerCase());
      if(country.length===2) endpoint.searchParams.set("components", `country:${country}`);

      const response = await fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error("Google Geocoding request failed.");

      const data = await response.json() as { status?: string; results?: GoogleGeocodeItem[] };
      if (data.status && !["OK", "ZERO_RESULTS"].includes(data.status)) {
        throw new Error(`Google Geocoding status: ${data.status}`);
      }

      const component=(item:GoogleGeocodeItem,type:string)=>
        item.address_components?.find(part=>part.types?.includes(type))?.long_name || "";

      const results = (data.results || []).map(item => {
        const streetNumber=component(item,"street_number");
        const route=component(item,"route");
        const neighborhood=component(item,"neighborhood") || component(item,"sublocality_level_1") || component(item,"sublocality");
        const locality=component(item,"locality") || component(item,"administrative_area_level_2");
        const admin=component(item,"administrative_area_level_1");
        const postal=component(item,"postal_code");
        const primary=[route,streetNumber].filter(Boolean).join(" ").trim() || String(item.formatted_address || "").split(",")[0]?.trim();
        const secondary=[neighborhood,locality,admin,postal].filter(Boolean).join(" · ");
        return {
          display_name: String(item.formatted_address || "").trim(),
          primary_label: primary,
          secondary_label: secondary,
          lat: Number(item.geometry?.location?.lat),
          lon: Number(item.geometry?.location?.lng),
          place_id: String(item.place_id || ""),
          partial_match: Boolean(item.partial_match),
          provider: "google" as const,
        };
      }).filter(item => item.display_name && Number.isFinite(item.lat) && Number.isFinite(item.lon)).slice(0, 4);

      return NextResponse.json({ results, provider: "google" });
    } catch {
      // Temporary operational fallback below.
    }
  }

  try {
    const endpoint = new URL("https://nominatim.openstreetmap.org/search");
    endpoint.searchParams.set("q", [q,city,country].filter(Boolean).join(", "));
    endpoint.searchParams.set("format", "jsonv2");
    endpoint.searchParams.set("limit", "5");
    endpoint.searchParams.set("addressdetails", "1");

    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "es",
        "User-Agent": "Desweb-CMMS/0.1 (https://desweb.cloud)",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ message: "El servicio de validación de direcciones no está disponible en este momento." }, { status: 502 });
    }

    const data = await response.json() as NominatimItem[];
    const results = data.map(item => ({
      display_name: String(item.display_name || "").trim(),
      lat: Number(item.lat),
      lon: Number(item.lon),
      primary_label: String(item.display_name || "").split(",")[0]?.trim(),
      secondary_label: String(item.display_name || "").split(",").slice(1,4).map(value=>value.trim()).filter(Boolean).join(" · "),
      provider: "osm" as const,
    })).filter(item => item.display_name && Number.isFinite(item.lat) && Number.isFinite(item.lon)).slice(0, 5);

    return NextResponse.json({ results, provider: "osm" });
  } catch {
    return NextResponse.json({ message: "No fue posible validar la dirección." }, { status: 502 });
  }
}
