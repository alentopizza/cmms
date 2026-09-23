import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { ImageUploadError, readImageUpload } from "@/lib/organization-assets";
import { getPlanByCode } from "@/lib/billing";
import { readBusinessHours } from "@/lib/business-hours";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function creationError(requestUrl: string, code: string) {
  const url = publicUrl("/dashboard/companies", requestUrl);
  url.searchParams.set("create_error", code);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!can(session, "companies.manage")) return new NextResponse("Forbidden", { status: 403 });

  try {
    const form = await request.formData();
    const name = String(form.get("name") || "").trim();
    const legalName = String(form.get("legal_name") || "").trim();
    const taxId = String(form.get("tax_id") || "").trim();
    const timezone = String(form.get("timezone") || "America/Bogota").trim();
    const organizationHours = readBusinessHours(form, "business_");
    const siteHours = readBusinessHours(form, "site_business_");
    const siteName = String(form.get("site_name") || "").trim();
    const siteCode = String(form.get("site_code") || "MAIN").trim().toUpperCase();
    const address = String(form.get("address") || "").trim();
    const city = String(form.get("city") || "").trim();
    const country = String(form.get("country") || "CO").trim().toUpperCase();
    const latitudeRaw = String(form.get("latitude") || "").trim();
    const longitudeRaw = String(form.get("longitude") || "").trim();
    const radiusRaw = String(form.get("geofence_radius_m") || "250").trim();
    const latitude = latitudeRaw ? Number(latitudeRaw) : null;
    const longitude = longitudeRaw ? Number(longitudeRaw) : null;
    const geofenceRadius = Number.parseInt(radiusRaw, 10);
    const planCode = String(form.get("plan_code") || "medium");
    const planResult = await getPlanByCode(planCode);
    if (!planResult.rowCount) return creationError(request.url, "plan");
    const plan = planResult.rows[0];
    const limits = {
      max_sites: plan.max_sites,
      max_sublocations: plan.max_sublocations,
      max_assets: plan.max_assets,
      max_inventory_items: plan.max_inventory_items,
      max_technicians: plan.max_technicians,
    };

    if (!name || !siteName || !address || !city || !country) {
      return creationError(request.url, "required");
    }
    if (latitude === null || longitude === null ||
        !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
        !Number.isFinite(geofenceRadius) || geofenceRadius < 20 || geofenceRadius > 5000) {
      return creationError(request.url, "site-geofence");
    }

    const [logo, cover] = await Promise.all([
      readImageUpload(form.get("logo"), { required: true, maxBytes: 2 * 1024 * 1024, label: "el logo" }),
      readImageUpload(form.get("cover"), { required: false, maxBytes: 5 * 1024 * 1024, label: "la foto de portada" }),
    ]);

    if (!logo) return creationError(request.url, "image-required");

    const client = await pool.connect();
    let organizationId = "";

    try {
      await client.query("BEGIN");
      let slug = slugify(name) || "empresa";
      const exists = await client.query("SELECT 1 FROM organizations WHERE slug=$1", [slug]);
      if (exists.rowCount) slug = `${slug}-${Date.now().toString().slice(-6)}`;

      const organization = await client.query<{ id: string }>(
        `INSERT INTO organizations(
          name,slug,legal_name,tax_id,timezone,
          business_days,business_open_time,business_close_time,
          logo_data,logo_mime_type,logo_file_name,
          cover_data,cover_mime_type,cover_file_name
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING id`,
        [
          name, slug, legalName || null, taxId || null, timezone,
          organizationHours.days, organizationHours.openTime, organizationHours.closeTime,
          logo.bytes, logo.mime, logo.name,
          cover?.bytes || null, cover?.mime || null, cover?.name || null,
        ],
      );
      organizationId = organization.rows[0].id;

      await client.query(
        `INSERT INTO organization_limits(organization_id,max_sites,max_sublocations,max_assets,max_inventory_items,max_technicians)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [organizationId, limits.max_sites, limits.max_sublocations, limits.max_assets, limits.max_inventory_items, limits.max_technicians],
      );

      const isTrial = plan.code === "trial";
      await client.query(
        `INSERT INTO organization_subscriptions(
          organization_id,plan_id,status,source,trial_started_at,trial_ends_at,current_period_start,current_period_end,auto_renew,has_custom_limits
        ) VALUES(
          $1,$2,$3,'manual',
          CASE WHEN $3='trialing' THEN now() ELSE NULL END,
          CASE WHEN $3='trialing' THEN now() + ($4 || ' days')::interval ELSE NULL END,
          CASE WHEN $3='active' THEN now() ELSE NULL END,
          CASE WHEN $3='active' THEN now() + interval '1 month' ELSE NULL END,
          $5,false
        )`,
        [organizationId, plan.id, isTrial ? "trialing" : "active", plan.trial_days, !isTrial],
      );

      await client.query(
        `INSERT INTO sites(
           organization_id,name,code,address,city,country,latitude,longitude,geofence_radius_m,
           business_days,business_open_time,business_close_time
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          organizationId, siteName, siteCode || null, address, city, country, latitude, longitude, geofenceRadius,
          siteHours.days, siteHours.openTime, siteHours.closeTime,
        ],
      );

      await client.query(
        `INSERT INTO organization_attendance_policies(
           organization_id,enabled,enabled_roles,require_face,require_geolocation,
           max_location_accuracy_m,face_similarity_threshold,liveness_threshold,updated_at
         ) VALUES($1,true,ARRAY['admin','manager','technician','provider','external']::text[],true,true,120,0.55,0.60,now())`,
        [organizationId],
      );

      await client.query(
        `INSERT INTO subscription_events(organization_id,event_type,source,metadata)
         VALUES($1,$2,'manual',$3::jsonb)`,
        [organizationId, isTrial ? "trial_started" : "subscription_activated", JSON.stringify({ plan: plan.code })],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.redirect(
      publicUrl(`/dashboard/companies/${organizationId}?created=company`, request.url),
      303,
    );
  } catch (error) {
    if (error instanceof ImageUploadError) {
      return creationError(request.url, error.code);
    }
    throw error;
  }
}
