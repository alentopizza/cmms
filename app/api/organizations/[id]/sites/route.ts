import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { canCreateSite } from "@/lib/resource-limits";
import { appendFeedback, safeDashboardReturn } from "@/lib/return-to";
import { readImageUpload, imageUploadMessage } from "@/lib/image-upload";
import { isSupportedCountry } from "@/lib/international-catalog";
import { BusinessHoursValidationError, readBusinessHours } from "@/lib/business-hours";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function targetUrl(id: string, requestUrl: string, returnTo: string, queryString = "") {
  const fallback = `/dashboard/companies/${id}`;
  return publicUrl(appendFeedback(safeDashboardReturn(returnTo, fallback), queryString), requestUrl);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!can(session, "locations.manage")) return new NextResponse("Forbidden", { status: 403 });

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return new NextResponse("Empresa inválida", { status: 400 });
  if (session.platformRole === "user" && session.organizationId !== id) return new NextResponse("Forbidden", { status: 403 });
  if (session.platformRole === "user" && !session.accessAllSites) return new NextResponse("Forbidden", { status: 403 });

  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const code = String(form.get("code") || "").trim().toUpperCase();
  const address = String(form.get("address") || "").trim();
  const city = String(form.get("city") || "").trim();
  const locality = String(form.get("locality") || "").trim();
  const country = String(form.get("country") || "").trim().toUpperCase();
  const latitudeRaw = String(form.get("latitude") || "").trim();
  const longitudeRaw = String(form.get("longitude") || "").trim();
  const radiusRaw = String(form.get("geofence_radius_m") || "250").trim();
  const latitude = latitudeRaw ? Number(latitudeRaw) : null;
  const longitude = longitudeRaw ? Number(longitudeRaw) : null;
  const geofenceRadius = Number.parseInt(radiusRaw, 10);
  const contactName = String(form.get("contact_name") || "").trim();
  const contactTitle = String(form.get("contact_title") || "").trim();
  const contactPhone = String(form.get("contact_phone") || "").trim();
  const contactEmail = String(form.get("contact_email") || "").trim().toLowerCase();
  const notes = String(form.get("notes") || "").trim();
  const returnTo = String(form.get("return_to") || "");
  let businessHours;
  try {
    businessHours = readBusinessHours(form, "business_");
  } catch (error) {
    if (error instanceof BusinessHoursValidationError) {
      return NextResponse.redirect(targetUrl(id, request.url, returnTo, `?error=${error.code}`), 303);
    }
    throw error;
  }
  let image=null;
  try { image=await readImageUpload(form,"image"); }
  catch(error) {
    const message=imageUploadMessage(error);
    return NextResponse.redirect(targetUrl(id,request.url,returnTo,"?error="+(message.includes("5 MB")?"site-image-size":"site-image-type")),303);
  }

  if (!name || !address || !city || !country || !isSupportedCountry(country)) {
    return NextResponse.redirect(targetUrl(id, request.url, returnTo, "?error=site-required"), 303);
  }
  if (latitude === null || longitude === null ||
      !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
      !Number.isFinite(geofenceRadius) || geofenceRadius < 20 || geofenceRadius > 5000) {
    return NextResponse.redirect(targetUrl(id, request.url, returnTo, "?error=site-geofence"), 303);
  }

  const organization = await query("SELECT 1 FROM organizations WHERE id=$1", [id]);
  if (!organization.rowCount) return new NextResponse("Empresa no encontrada", { status: 404 });
  if (!(await canCreateSite(id))) {
    return NextResponse.redirect(targetUrl(id, request.url, returnTo, "?error=site-limit"), 303);
  }

  try {
    await query(
      `INSERT INTO sites(
         organization_id,name,code,address,city,locality,country,latitude,longitude,geofence_radius_m,
         contact_name,contact_title,contact_phone,contact_email,notes,
         business_days,business_open_time,business_close_time,business_schedule,
         image_data,image_mime_type
       )
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20,$21)`,
      [
        id,name,code||null,address,city,locality||null,country,latitude,longitude,geofenceRadius,
        contactName||null,contactTitle||null,contactPhone||null,contactEmail||null,notes||null,
        businessHours.days,businessHours.openTime,businessHours.closeTime,JSON.stringify(businessHours.schedule),
        image?.data||null,image?.mime||null,
      ],
    );
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.redirect(targetUrl(id, request.url, returnTo, "?error=site-code"), 303);
    }
    throw error;
  }

  return NextResponse.redirect(targetUrl(id, request.url, returnTo, "?created=site"), 303);
}
