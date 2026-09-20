import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool, query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { ImageUploadError, readImageUpload } from "@/lib/organization-assets";
import { DEFAULT_LIMITS, positiveLimit } from "@/lib/resource-limits";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  const form = await request.formData();
  const intent = String(form.get("intent") || "update");

  if (intent === "delete") {
    const deleted = await query("DELETE FROM organizations WHERE id=$1", [id]);
    if (!deleted.rowCount) return new NextResponse("Empresa no encontrada", { status: 404 });
    return NextResponse.redirect(directoryUrl(request.url, "?deleted=1"), 303);
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
  const primarySiteId = String(form.get("primary_site_id") || "");
  const siteName = String(form.get("site_name") || "").trim();
  const siteCode = String(form.get("site_code") || "").trim().toUpperCase();
  const address = String(form.get("address") || "").trim();
  const city = String(form.get("city") || "").trim();
  const country = String(form.get("country") || "CO").trim().toUpperCase();
  const canManageResources = can(session, "company_resources.manage");
  const resourceLimits = canManageResources ? {
    max_sites: positiveLimit(form.get("max_sites"), DEFAULT_LIMITS.max_sites, 1),
    max_sublocations: positiveLimit(form.get("max_sublocations"), DEFAULT_LIMITS.max_sublocations),
    max_assets: positiveLimit(form.get("max_assets"), DEFAULT_LIMITS.max_assets),
    max_inventory_items: positiveLimit(form.get("max_inventory_items"), DEFAULT_LIMITS.max_inventory_items),
    max_technicians: positiveLimit(form.get("max_technicians"), DEFAULT_LIMITS.max_technicians),
  } : null;

  if (!name || !slug || !timezone) {
    const target = returnToDirectory ? directoryUrl(request.url, "?error=required") : companyUrl(id, request.url, "?error=required");
    return NextResponse.redirect(target, 303);
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
         SET name=$1,slug=$2,legal_name=$3,tax_id=$4,timezone=$5,updated_at=now()
         WHERE id=$6`,
        [name, slug, legalName || null, taxId || null, timezone, id],
      );
      if (!updated.rowCount) throw new Error("Empresa no encontrada");

      if (primarySiteId && UUID_PATTERN.test(primarySiteId)) {
        await client.query(
          `UPDATE sites
           SET name=$1,code=$2,address=$3,city=$4,country=$5
           WHERE id=$6 AND organization_id=$7`,
          [siteName || "Sede principal", siteCode || null, address || null, city || null, country || "CO", primarySiteId, id],
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
    const errorCode = error instanceof ImageUploadError
      ? error.code
      : (error as { code?: string }).code === "23505" ? "duplicate" : "save";
    const target = returnToDirectory
      ? directoryUrl(request.url, `?error=${errorCode}`)
      : companyUrl(id, request.url, `?error=${errorCode === "duplicate" ? "slug" : errorCode}`);
    return NextResponse.redirect(target, 303);
  }

  const target = returnToDirectory
    ? directoryUrl(request.url, "?saved=company")
    : companyUrl(id, request.url, "?saved=company");
  return NextResponse.redirect(target, 303);
}
