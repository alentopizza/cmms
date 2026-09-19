import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { pool } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return new NextResponse("Unauthorized", { status: 401 });

  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const siteName = String(form.get("site_name") || "").trim();
  const city = String(form.get("city") || "").trim();

  if (!name || !siteName) {
    return new NextResponse("Empresa y sede son obligatorias", { status: 400 });
  }

  const client = await pool.connect();
  let organizationId = "";

  try {
    await client.query("BEGIN");
    let slug = slugify(name) || "empresa";
    const exists = await client.query("SELECT 1 FROM organizations WHERE slug=$1", [slug]);
    if (exists.rowCount) slug = `${slug}-${Date.now().toString().slice(-6)}`;

    const organization = await client.query<{ id: string }>(
      "INSERT INTO organizations(name,slug) VALUES($1,$2) RETURNING id",
      [name, slug],
    );
    organizationId = organization.rows[0].id;

    await client.query(
      "INSERT INTO sites(organization_id,name,code,city) VALUES($1,$2,$3,$4)",
      [organizationId, siteName, "MAIN", city || null],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return NextResponse.redirect(publicUrl(`/dashboard/companies/${organizationId}?created=company`, request.url), 303);
}
