import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { ImageUploadError, readImageUpload } from "@/lib/organization-assets";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthenticated())) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return new NextResponse("Empresa inválida", { status: 400 });

  const form = await request.formData();
  const intent = String(form.get("intent") || "update");

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

  const name = String(form.get("name") || "").trim();
  const legalName = String(form.get("legal_name") || "").trim();
  const taxId = String(form.get("tax_id") || "").trim();
  const timezone = String(form.get("timezone") || "America/Bogota").trim();
  const slug = slugify(String(form.get("slug") || name)) || slugify(name);

  if (!name || !slug || !timezone) {
    return NextResponse.redirect(companyUrl(id, request.url, "?error=required"), 303);
  }

  try {
    const updated = await query(
      `UPDATE organizations
       SET name=$1, slug=$2, legal_name=$3, tax_id=$4, timezone=$5, updated_at=now()
       WHERE id=$6`,
      [name, slug, legalName || null, taxId || null, timezone, id],
    );
    if (!updated.rowCount) return new NextResponse("Empresa no encontrada", { status: 404 });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.redirect(companyUrl(id, request.url, "?error=slug"), 303);
    }
    throw error;
  }

  return NextResponse.redirect(companyUrl(id, request.url, "?saved=company"), 303);
}
