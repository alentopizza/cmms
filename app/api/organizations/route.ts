import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { pool } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { ImageUploadError, readImageUpload } from "@/lib/organization-assets";

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
  if (!(await isAuthenticated())) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const form = await request.formData();
    const name = String(form.get("name") || "").trim();
    const legalName = String(form.get("legal_name") || "").trim();
    const taxId = String(form.get("tax_id") || "").trim();
    const timezone = String(form.get("timezone") || "America/Bogota").trim();
    const siteName = String(form.get("site_name") || "").trim();
    const siteCode = String(form.get("site_code") || "MAIN").trim().toUpperCase();
    const address = String(form.get("address") || "").trim();
    const city = String(form.get("city") || "").trim();
    const country = String(form.get("country") || "CO").trim().toUpperCase();

    if (!name || !siteName || !city || !country) {
      return creationError(request.url, "required");
    }

    const [logo, cover] = await Promise.all([
      readImageUpload(form.get("logo"), { required: true, maxBytes: 2 * 1024 * 1024, label: "el logo" }),
      readImageUpload(form.get("cover"), { required: true, maxBytes: 5 * 1024 * 1024, label: "la foto de portada" }),
    ]);

    if (!logo || !cover) return creationError(request.url, "image-required");

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
          logo_data,logo_mime_type,logo_file_name,
          cover_data,cover_mime_type,cover_file_name
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING id`,
        [
          name, slug, legalName || null, taxId || null, timezone,
          logo.bytes, logo.mime, logo.name,
          cover.bytes, cover.mime, cover.name,
        ],
      );
      organizationId = organization.rows[0].id;

      await client.query(
        `INSERT INTO sites(organization_id,name,code,address,city,country)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [organizationId, siteName, siteCode || null, address || null, city, country],
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
