import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { canAccessOrganization } from "@/lib/organization-scope";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { appendFeedback, safeDashboardReturn } from "@/lib/return-to";
import { readImageUpload, imageUploadMessage } from "@/lib/image-upload";
import { isSupportedCountry } from "@/lib/international-catalog";
import { BusinessHoursValidationError, normalizeBusinessHoursRow, readBusinessHours } from "@/lib/business-hours";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function targetUrl(organizationId: string, requestUrl: string, returnTo: string, queryString = "") {
  const fallback = `/dashboard/companies/${organizationId}`;
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
  const form = await request.formData();
  const organizationId = String(form.get("organization_id") || "");
  const intent = String(form.get("intent") || "update");
  const returnTo = String(form.get("return_to") || "");

  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(organizationId)) {
    return new NextResponse("Sede inválida", { status: 400 });
  }
  if(!canAccessOrganization(session,organizationId)) return new NextResponse("Forbidden",{status:403});
  if (session.platformRole === "user" && !canAccessSite(session, id)) return new NextResponse("Forbidden", { status: 403 });

  const site = await query<{
    active:boolean; latitude:number|null; longitude:number|null; geofence_radius_m:number;
    locality:string|null; contact_name:string|null; contact_title:string|null; contact_phone:string|null; contact_email:string|null; notes:string|null;
    business_days:number[]; business_open_time:string; business_close_time:string; business_schedule:unknown;
  }>(
    `SELECT active,latitude,longitude,geofence_radius_m,locality,contact_name,contact_title,contact_phone,contact_email,notes,
            business_days,business_open_time::text,business_close_time::text,business_schedule
     FROM sites WHERE id=$1 AND organization_id=$2`,
    [id, organizationId],
  );
  if (!site.rowCount) return new NextResponse("Sede no encontrada", { status: 404 });

  if (intent === "toggle") {
    await query(
      "UPDATE sites SET active = NOT active WHERE id=$1 AND organization_id=$2",
      [id, organizationId],
    );
    return NextResponse.redirect(targetUrl(organizationId, request.url, returnTo, "?saved=site-status"), 303);
  }

  const name = String(form.get("name") || "").trim();
  const code = String(form.get("code") || "").trim().toUpperCase();
  const address = String(form.get("address") || "").trim();
  const city = String(form.get("city") || "").trim();
  const locality = form.has("locality") ? String(form.get("locality") || "").trim() : (site.rows[0].locality||"");
  const country = String(form.get("country") || "").trim().toUpperCase();
  const latitudeRaw = String(form.get("latitude") || "").trim();
  const longitudeRaw = String(form.get("longitude") || "").trim();
  const radiusRaw = String(form.get("geofence_radius_m") || "").trim();
  const contactName = form.has("contact_name") ? String(form.get("contact_name") || "").trim() : (site.rows[0].contact_name||"");
  const contactTitle = form.has("contact_title") ? String(form.get("contact_title") || "").trim() : (site.rows[0].contact_title||"");
  const contactPhone = form.has("contact_phone") ? String(form.get("contact_phone") || "").trim() : (site.rows[0].contact_phone||"");
  const contactEmail = form.has("contact_email") ? String(form.get("contact_email") || "").trim().toLowerCase() : (site.rows[0].contact_email||"");
  const notes = form.has("notes") ? String(form.get("notes") || "").trim() : (site.rows[0].notes||"");
  const currentHours = normalizeBusinessHoursRow(site.rows[0]);
  let businessHours = currentHours;
  try {
    businessHours = readBusinessHours(form, "business_", currentHours);
  } catch (error) {
    if (error instanceof BusinessHoursValidationError) {
      return NextResponse.redirect(
        targetUrl(organizationId, request.url, returnTo, `?error=${error.code}`),
        303,
      );
    }
    throw error;
  }
  let image=null;
  try { image=await readImageUpload(form,"image"); }
  catch(error) {
    return NextResponse.redirect(targetUrl(organizationId,request.url,returnTo,imageUploadMessage(error).includes("5 MB")?"?error=site-image-size":"?error=site-image-type"),303);
  }
  const latitude = form.has("latitude") ? (latitudeRaw ? Number(latitudeRaw) : null) : site.rows[0].latitude;
  const longitude = form.has("longitude") ? (longitudeRaw ? Number(longitudeRaw) : null) : site.rows[0].longitude;
  const geofenceRadius = form.has("geofence_radius_m") ? (radiusRaw ? Number.parseInt(radiusRaw,10) : 250) : site.rows[0].geofence_radius_m;

  if ((latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
      (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) ||
      !Number.isFinite(geofenceRadius) || geofenceRadius < 20 || geofenceRadius > 5000) {
    return NextResponse.redirect(targetUrl(organizationId, request.url, returnTo, "?error=site-geofence"), 303);
  }

  if (!name || !address || !city || !country || !isSupportedCountry(country) || latitude === null || longitude === null) {
    return NextResponse.redirect(targetUrl(organizationId, request.url, returnTo, "?error=site-required"), 303);
  }

  try {
    await query(
      `UPDATE sites
       SET name=$1,code=$2,address=$3,city=$4,locality=$5,country=$6,
           latitude=$7,longitude=$8,geofence_radius_m=$9,
           contact_name=$10,contact_title=$11,contact_phone=$12,contact_email=$13,notes=$14,
           business_days=$15,business_open_time=$16,business_close_time=$17,business_schedule=$18::jsonb,
           image_data=COALESCE($19,image_data),
           image_mime_type=CASE WHEN $19 IS NULL THEN image_mime_type ELSE $20 END
       WHERE id=$21 AND organization_id=$22`,
      [
        name,code||null,address||null,city||null,locality||null,country,
        latitude,longitude,geofenceRadius,
        contactName||null,contactTitle||null,contactPhone||null,contactEmail||null,notes||null,
        businessHours.days,businessHours.openTime,businessHours.closeTime,JSON.stringify(businessHours.schedule),
        image?.data||null,image?.mime||null,id,organizationId,
      ],
    );
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.redirect(targetUrl(organizationId, request.url, returnTo, "?error=site-code"), 303);
    }
    if ((error as { code?: string }).code === "23514") {
      return NextResponse.redirect(targetUrl(organizationId, request.url, returnTo, "?error=business-hours"), 303);
    }
    throw error;
  }

  return NextResponse.redirect(targetUrl(organizationId, request.url, returnTo, "?saved=site"), 303);
}
