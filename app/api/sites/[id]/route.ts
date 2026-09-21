import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { appendFeedback, safeDashboardReturn } from "@/lib/return-to";
import { readImageUpload, imageUploadMessage } from "@/lib/image-upload";

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
  if (session.platformRole === "user" && session.organizationId !== organizationId) return new NextResponse("Forbidden", { status: 403 });
  if (!canAccessSite(session, id)) return new NextResponse("Forbidden", { status: 403 });

  const site = await query<{
    active:boolean; latitude:number|null; longitude:number|null; geofence_radius_m:number;
    contact_name:string|null; contact_phone:string|null; contact_email:string|null;
  }>(
    "SELECT active,latitude,longitude,geofence_radius_m,contact_name,contact_phone,contact_email FROM sites WHERE id=$1 AND organization_id=$2",
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
  const country = String(form.get("country") || "CO").trim().toUpperCase();
  const latitudeRaw = String(form.get("latitude") || "").trim();
  const longitudeRaw = String(form.get("longitude") || "").trim();
  const radiusRaw = String(form.get("geofence_radius_m") || "").trim();
  const contactName = form.has("contact_name") ? String(form.get("contact_name") || "").trim() : (site.rows[0].contact_name||"");
  const contactPhone = form.has("contact_phone") ? String(form.get("contact_phone") || "").trim() : (site.rows[0].contact_phone||"");
  const contactEmail = form.has("contact_email") ? String(form.get("contact_email") || "").trim().toLowerCase() : (site.rows[0].contact_email||"");
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

  if (!name) {
    return NextResponse.redirect(targetUrl(organizationId, request.url, returnTo, "?error=site-required"), 303);
  }

  try {
    await query(
      `UPDATE sites
       SET name=$1,code=$2,address=$3,city=$4,country=$5,
           latitude=$6,longitude=$7,geofence_radius_m=$8,
           contact_name=$9,contact_phone=$10,contact_email=$11,
           image_data=COALESCE($12,image_data),
           image_mime_type=CASE WHEN $12 IS NULL THEN image_mime_type ELSE $13 END
       WHERE id=$14 AND organization_id=$15`,
      [
        name,code||null,address||null,city||null,country||"CO",
        latitude,longitude,geofenceRadius,
        contactName||null,contactPhone||null,contactEmail||null,
        image?.data||null,image?.mime||null,id,organizationId,
      ],
    );
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.redirect(targetUrl(organizationId, request.url, returnTo, "?error=site-code"), 303);
    }
    throw error;
  }

  return NextResponse.redirect(targetUrl(organizationId, request.url, returnTo, "?saved=site"), 303);
}
