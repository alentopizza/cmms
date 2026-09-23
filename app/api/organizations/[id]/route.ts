import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can, isPlatformOwner } from "@/lib/permissions";
import { pool, query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { ImageUploadError, readImageUpload } from "@/lib/organization-assets";
import { BusinessHoursValidationError, businessHoursSubmitted, normalizeBusinessHoursRow, readBusinessHours } from "@/lib/business-hours";
import { DEFAULT_LIMITS, positiveLimit } from "@/lib/resource-limits";
import { forceDeleteRecord } from "@/lib/platform-owner-purge";
import { isSupportedCountry, isTaxIdTypeForCountry } from "@/lib/international-catalog";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function companyUrl(id: string, requestUrl: string, queryString = "") {
  return publicUrl(`/dashboard/companies/${id}${queryString}`, requestUrl);
}

function directoryUrl(requestUrl: string, queryString = "") {
  return publicUrl(`/dashboard/companies${queryString}`, requestUrl);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!can(session, "companies.manage")) return new NextResponse("Forbidden", { status: 403 });

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return new NextResponse("Empresa inválida", { status: 400 });
  if (session.platformRole === "user" && session.organizationId !== id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const form = await request.formData();
  const intent = String(form.get("intent") || "update");
  const wantsJson = request.headers.get("accept")?.includes("application/json") ?? false;
  const respond = (status: number, payload: { message: string; code?: string }, redirectUrl: URL) =>
    wantsJson ? NextResponse.json(payload, { status }) : NextResponse.redirect(redirectUrl, 303);

  if (intent === "delete") {
    if (!isPlatformOwner(session)) return new NextResponse("Forbidden", { status: 403 });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await forceDeleteRecord(client, "organizations", id, { userId: session.userId, email: session.email });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return respond(200, { message: "Empresa eliminada correctamente." }, directoryUrl(request.url, "?deleted=1"));
  }

  if (intent === "toggle") {
    const updated = await query<{ active: boolean }>(
      "UPDATE organizations SET active = NOT active, updated_at = now() WHERE id=$1 RETURNING active",
      [id],
    );
    if (!updated.rowCount) return new NextResponse("Empresa no encontrada", { status: 404 });
    return NextResponse.redirect(companyUrl(id, request.url, "?saved=status"), 303);
  }

  if (intent === "assets") {
    try {
      const [logo, cover] = await Promise.all([
        readImageUpload(form.get("logo"), { maxBytes: 2 * 1024 * 1024, label: "el logo" }),
        readImageUpload(form.get("cover"), { maxBytes: 5 * 1024 * 1024, label: "la foto de portada" }),
      ]);

      if (!logo && !cover) {
        return NextResponse.redirect(companyUrl(id, request.url, "?error=image-required"), 303);
      }

      if (logo) {
        await query(
          `UPDATE organizations
           SET logo_data=$1,logo_mime_type=$2,logo_file_name=$3,updated_at=now()
           WHERE id=$4`,
          [logo.bytes, logo.mime, logo.name, id],
        );
      }

      if (cover) {
        await query(
          `UPDATE organizations
           SET cover_data=$1,cover_mime_type=$2,cover_file_name=$3,updated_at=now()
           WHERE id=$4`,
          [cover.bytes, cover.mime, cover.name, id],
        );
      }

      return NextResponse.redirect(companyUrl(id, request.url, "?saved=assets"), 303);
    } catch (error) {
      if (error instanceof ImageUploadError) {
        return NextResponse.redirect(companyUrl(id, request.url, `?error=${error.code}`), 303);
      }
      throw error;
    }
  }

  if (intent === "limits") {
    if (!can(session, "company_resources.manage")) return new NextResponse("Forbidden", { status: 403 });
    const limits = [
      positiveLimit(form.get("max_sites"), DEFAULT_LIMITS.max_sites, 1),
      positiveLimit(form.get("max_sublocations"), DEFAULT_LIMITS.max_sublocations),
      positiveLimit(form.get("max_assets"), DEFAULT_LIMITS.max_assets),
      positiveLimit(form.get("max_inventory_items"), DEFAULT_LIMITS.max_inventory_items),
      positiveLimit(form.get("max_technicians"), DEFAULT_LIMITS.max_technicians),
    ];
    await query(
      `INSERT INTO organization_limits(organization_id,max_sites,max_sublocations,max_assets,max_inventory_items,max_technicians,updated_at)
       VALUES($1,$2,$3,$4,$5,$6,now())
       ON CONFLICT(organization_id) DO UPDATE SET max_sites=$2,max_sublocations=$3,max_assets=$4,max_inventory_items=$5,max_technicians=$6,updated_at=now()`,
      [id, ...limits],
    );
    return NextResponse.redirect(companyUrl(id, request.url, "?saved=limits"), 303);
  }

  const returnToDirectory = String(form.get("return_to") || "") === "directory";
  const name = String(form.get("name") || "").trim();
  const legalName = String(form.get("legal_name") || "").trim();
  const taxId = String(form.get("tax_id") || "").trim();
  const timezone = String(form.get("timezone") || "America/Bogota").trim();
  const slug = slugify(String(form.get("slug") || name)) || slugify(name);
  const profileV2 = form.get("profile_v2") === "1";
  const taxIdType = String(form.get("tax_id_type") || "").trim();
  const legalAddress = String(form.get("legal_address") || "").trim();
  const legalCity = String(form.get("legal_city") || "").trim();
  const legalCountry = String(form.get("legal_country") || "").trim().toUpperCase().slice(0, 2);
  const phone = String(form.get("phone") || "").trim();
  const adminEmail = String(form.get("admin_email") || "").trim().toLowerCase();
  const billingEmail = String(form.get("billing_email") || "").trim().toLowerCase();
  const website = String(form.get("website") || "").trim();
  const primaryContactName = String(form.get("primary_contact_name") || "").trim();
  const primaryContactTitle = String(form.get("primary_contact_title") || "").trim();
  const primaryContactPhone = String(form.get("primary_contact_phone") || "").trim();
  const primaryContactEmail = String(form.get("primary_contact_email") || "").trim().toLowerCase();
  const internalNotes = String(form.get("internal_notes") || "").trim();
  const currentOrganizationHoursResult = await query<{
    business_days:number[]; business_open_time:string; business_close_time:string; business_schedule:unknown;
  }>(
    "SELECT business_days,business_open_time::text,business_close_time::text,business_schedule FROM organizations WHERE id=$1",
    [id],
  );
  const currentOrganizationHours = normalizeBusinessHoursRow(currentOrganizationHoursResult.rows[0] || {});
  let organizationHours = currentOrganizationHours;
  try {
    if (businessHoursSubmitted(form, "business_")) {
      organizationHours = readBusinessHours(form, "business_", currentOrganizationHours);
    }
  } catch (error) {
    if (error instanceof BusinessHoursValidationError) {
      const target = returnToDirectory
        ? directoryUrl(request.url, `?error=${error.code}`)
        : companyUrl(id, request.url, `?error=${error.code}`);
      return respond(422, { message: error.message, code: error.code }, target);
    }
    throw error;
  }
  const primarySiteId = String(form.get("primary_site_id") || "");
  const siteName = String(form.get("site_name") || "").trim();
  const siteCode = String(form.get("site_code") || "").trim().toUpperCase();
  const address = String(form.get("address") || "").trim();
  const city = String(form.get("city") || "").trim();
  const country = String(form.get("country") || "").trim().toUpperCase();
  const siteLatitudeRaw = String(form.get("latitude") || "").trim();
  const siteLongitudeRaw = String(form.get("longitude") || "").trim();
  const siteRadiusRaw = String(form.get("geofence_radius_m") || "250").trim();
  const siteLatitude = siteLatitudeRaw ? Number(siteLatitudeRaw) : null;
  const siteLongitude = siteLongitudeRaw ? Number(siteLongitudeRaw) : null;
  const siteRadius = Number.parseInt(siteRadiusRaw, 10);
  const currentSiteHours = primarySiteId && UUID_PATTERN.test(primarySiteId)
    ? await query<{ business_days:number[]; business_open_time:string; business_close_time:string; business_schedule:unknown }>(
        "SELECT business_days,business_open_time::text,business_close_time::text,business_schedule FROM sites WHERE id=$1 AND organization_id=$2",
        [primarySiteId,id],
      )
    : null;
  let siteHours = normalizeBusinessHoursRow(currentSiteHours?.rows[0] || {});
  try {
    if (businessHoursSubmitted(form, "site_business_")) {
      siteHours = readBusinessHours(form, "site_business_", siteHours);
    } else if (returnToDirectory && businessHoursSubmitted(form, "business_")) {
      siteHours = organizationHours;
    }
  } catch (error) {
    if (error instanceof BusinessHoursValidationError) {
      const target = returnToDirectory
        ? directoryUrl(request.url, `?error=${error.code}`)
        : companyUrl(id, request.url, `?error=${error.code}`);
      return respond(422, { message: error.message, code: error.code }, target);
    }
    throw error;
  }
  const canManageResources = can(session, "company_resources.manage");
  const hasResourceLimitFields = ["max_sites","max_sublocations","max_assets","max_inventory_items","max_technicians"]
    .some(field => form.has(field));
  const resourceLimits = canManageResources && hasResourceLimitFields ? {
    max_sites: positiveLimit(form.get("max_sites"), DEFAULT_LIMITS.max_sites, 1),
    max_sublocations: positiveLimit(form.get("max_sublocations"), DEFAULT_LIMITS.max_sublocations),
    max_assets: positiveLimit(form.get("max_assets"), DEFAULT_LIMITS.max_assets),
    max_inventory_items: positiveLimit(form.get("max_inventory_items"), DEFAULT_LIMITS.max_inventory_items),
    max_technicians: positiveLimit(form.get("max_technicians"), DEFAULT_LIMITS.max_technicians),
  } : null;

  if (!name || !slug || !timezone) {
    const target = returnToDirectory ? directoryUrl(request.url, "?error=required") : companyUrl(id, request.url, "?error=required");
    return respond(422, { message: "Completa nombre, identificador y zona horaria.", code: "required" }, target);
  }
  if (profileV2 && (!legalCity || !isSupportedCountry(legalCountry) || !isTaxIdTypeForCountry(legalCountry,taxIdType))) {
    const target = returnToDirectory ? directoryUrl(request.url, "?error=required") : companyUrl(id, request.url, "?error=required");
    return respond(422, { message: "Selecciona un país y un tipo de identificación válidos del catálogo.", code: "required" }, target);
  }
  if (country && !isSupportedCountry(country)) {
    const target = returnToDirectory ? directoryUrl(request.url, "?error=required") : companyUrl(id, request.url, "?error=required");
    return respond(422, { message: "Selecciona un país válido para la sede principal.", code: "required" }, target);
  }

  if (adminEmail && !EMAIL_PATTERN.test(adminEmail)) {
    const target = returnToDirectory ? directoryUrl(request.url, "?error=invalid-email") : companyUrl(id, request.url, "?error=invalid-email");
    return respond(422, { message: "El correo administrativo no tiene un formato válido. Ejemplo: contacto@empresa.com.", code: "invalid-email" }, target);
  }

  try {
    const [logo, cover] = await Promise.all([
      readImageUpload(form.get("logo"), { maxBytes: 2 * 1024 * 1024, label: "el logo" }),
      readImageUpload(form.get("cover"), { maxBytes: 5 * 1024 * 1024, label: "la foto de portada" }),
    ]);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const updated = await client.query(
        `UPDATE organizations
         SET name=$1,slug=$2,legal_name=$3,tax_id=$4,timezone=$5,
             business_days=$6,business_open_time=$7,business_close_time=$8,business_schedule=$9::jsonb,updated_at=now()
         WHERE id=$10
         RETURNING id`,
        [name, slug, legalName || null, taxId || null, timezone,
         organizationHours.days,organizationHours.openTime,organizationHours.closeTime,JSON.stringify(organizationHours.schedule),id],
      );
      if (!updated.rowCount) throw new Error("Empresa no encontrada");

      if (profileV2) {
        await client.query(
          `UPDATE organizations SET
            tax_id_type=$1,legal_address=$2,legal_city=$3,legal_country=$4,phone=$5,
            admin_email=$6,billing_email=$7,website=$8,primary_contact_name=$9,
            primary_contact_title=$10,primary_contact_phone=$11,primary_contact_email=$12,
            internal_notes=$13,default_country=$4,updated_at=now()
           WHERE id=$14`,
          [
            taxIdType || null, legalAddress || null, legalCity || null, legalCountry || null, phone || null,
            adminEmail || null, billingEmail || null, website || null, primaryContactName || null,
            primaryContactTitle || null, primaryContactPhone || null, primaryContactEmail || null,
            internalNotes || null, id,
          ],
        );
      } else if (returnToDirectory) {
        const hasPrimaryContactName = form.has("primary_contact_name");
        const hasAdminEmail = form.has("admin_email");

        if (hasPrimaryContactName || hasAdminEmail) {
          await client.query(
            `UPDATE organizations
             SET primary_contact_name=CASE WHEN $1::boolean THEN $2 ELSE primary_contact_name END,
                 admin_email=CASE WHEN $3::boolean THEN $4 ELSE admin_email END,
                 updated_at=now()
             WHERE id=$5`,
            [
              hasPrimaryContactName,
              primaryContactName || null,
              hasAdminEmail,
              adminEmail || null,
              id,
            ],
          );
        }
      }

      if (primarySiteId && UUID_PATTERN.test(primarySiteId)) {
        if (!address || !city || !country || siteLatitude === null || siteLongitude === null ||
            !Number.isFinite(siteLatitude) || siteLatitude < -90 || siteLatitude > 90 ||
            !Number.isFinite(siteLongitude) || siteLongitude < -180 || siteLongitude > 180 ||
            !Number.isFinite(siteRadius) || siteRadius < 20 || siteRadius > 5000) {
          throw new Error("SITE_GEOFENCE_REQUIRED");
        }
        await client.query(
          `UPDATE sites
           SET name=$1,code=$2,address=$3,city=$4,country=$5,latitude=$6,longitude=$7,geofence_radius_m=$8,
               business_days=$9,business_open_time=$10,business_close_time=$11,business_schedule=$12::jsonb
           WHERE id=$13 AND organization_id=$14`,
          [
            siteName || "Sede principal", siteCode || null, address, city, country,
            siteLatitude, siteLongitude, siteRadius,
            siteHours.days,siteHours.openTime,siteHours.closeTime,JSON.stringify(siteHours.schedule),
            primarySiteId, id,
          ],
        );
      }

      if (resourceLimits) {
        await client.query(
          `INSERT INTO organization_limits(organization_id,max_sites,max_sublocations,max_assets,max_inventory_items,max_technicians,updated_at)
           VALUES($1,$2,$3,$4,$5,$6,now())
           ON CONFLICT(organization_id) DO UPDATE
           SET max_sites=EXCLUDED.max_sites,
               max_sublocations=EXCLUDED.max_sublocations,
               max_assets=EXCLUDED.max_assets,
               max_inventory_items=EXCLUDED.max_inventory_items,
               max_technicians=EXCLUDED.max_technicians,
               updated_at=now()`,
          [
            id,
            resourceLimits.max_sites,
            resourceLimits.max_sublocations,
            resourceLimits.max_assets,
            resourceLimits.max_inventory_items,
            resourceLimits.max_technicians,
          ],
        );
      }

      if (logo) {
        await client.query(
          `UPDATE organizations
           SET logo_data=$1,logo_mime_type=$2,logo_file_name=$3,updated_at=now()
           WHERE id=$4`,
          [logo.bytes, logo.mime, logo.name, id],
        );
      }

      if (cover) {
        await client.query(
          `UPDATE organizations
           SET cover_data=$1,cover_mime_type=$2,cover_file_name=$3,updated_at=now()
           WHERE id=$4`,
          [cover.bytes, cover.mime, cover.name, id],
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    const databaseCode = (error as { code?: string }).code;
    const errorCode = error instanceof ImageUploadError
      ? error.code
      : error instanceof Error && error.message === "SITE_GEOFENCE_REQUIRED" ? "site-geofence"
      : databaseCode === "23505" ? "duplicate"
      : databaseCode === "23514" ? "business-hours"
      : databaseCode === "23502" ? "missing-data"
      : databaseCode === "22001" ? "value-too-long"
      : databaseCode === "22P02" ? "invalid-data"
      : databaseCode === "23503" ? "related-data"
      : "save";

    console.error("[organizations:update] save failed", {
      organizationId: id,
      returnToDirectory,
      code: databaseCode || errorCode,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    const target = returnToDirectory
      ? directoryUrl(request.url, `?error=${errorCode}`)
      : companyUrl(id, request.url, `?error=${errorCode === "duplicate" ? "slug" : errorCode}`);
    const message = errorCode === "site-geofence"
      ? "Valida la dirección, coordenadas y radio de la sede principal antes de guardar."
      : errorCode === "business-hours"
        ? "Revisa el horario: selecciona días de atención y asegúrate de que el cierre sea posterior a la apertura."
      : errorCode === "duplicate"
        ? "El identificador de empresa ya está siendo usado."
      : errorCode === "missing-data"
        ? "Falta un dato obligatorio para guardar la empresa. Revisa los campos marcados y vuelve a intentarlo."
      : errorCode === "value-too-long"
        ? "Uno de los campos supera la longitud permitida. Reduce el texto e inténtalo nuevamente."
      : errorCode === "invalid-data"
        ? "Uno de los valores tiene un formato inválido. Revisa identificadores, coordenadas y campos numéricos."
      : errorCode === "related-data"
        ? "Hay una referencia relacionada que ya no es válida. Actualiza la empresa y vuelve a intentarlo."
        : error instanceof ImageUploadError
          ? error.message
          : "Ocurrió un error interno al guardar la empresa. Código de referencia: ORG-SAVE.";
    const status = errorCode === "duplicate" ? 409 : errorCode === "save" ? 500 : 422;
    return respond(status, { message, code: errorCode }, target);
  }

  const target = returnToDirectory
    ? directoryUrl(request.url, "?saved=company")
    : companyUrl(id, request.url, "?saved=company");
  return respond(200, { message: "Los cambios de la empresa se guardaron correctamente." }, target);
}
