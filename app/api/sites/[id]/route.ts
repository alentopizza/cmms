import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function companyUrl(organizationId: string, requestUrl: string, queryString = "") {
  return publicUrl(`/dashboard/companies/${organizationId}${queryString}`, requestUrl);
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

  if (!UUID_PATTERN.test(id) || !UUID_PATTERN.test(organizationId)) {
    return new NextResponse("Sede inválida", { status: 400 });
  }
  if (session.platformRole !== "superadmin" && session.organizationId !== organizationId) return new NextResponse("Forbidden", { status: 403 });
  if (!canAccessSite(session, id)) return new NextResponse("Forbidden", { status: 403 });

  const site = await query<{ active: boolean }>(
    "SELECT active FROM sites WHERE id=$1 AND organization_id=$2",
    [id, organizationId],
  );
  if (!site.rowCount) return new NextResponse("Sede no encontrada", { status: 404 });

  if (intent === "toggle") {
    await query(
      "UPDATE sites SET active = NOT active WHERE id=$1 AND organization_id=$2",
      [id, organizationId],
    );
    return NextResponse.redirect(companyUrl(organizationId, request.url, "?saved=site-status"), 303);
  }

  const name = String(form.get("name") || "").trim();
  const code = String(form.get("code") || "").trim().toUpperCase();
  const address = String(form.get("address") || "").trim();
  const city = String(form.get("city") || "").trim();
  const country = String(form.get("country") || "CO").trim().toUpperCase();

  if (!name) {
    return NextResponse.redirect(companyUrl(organizationId, request.url, "?error=site-required"), 303);
  }

  try {
    await query(
      `UPDATE sites
       SET name=$1, code=$2, address=$3, city=$4, country=$5
       WHERE id=$6 AND organization_id=$7`,
      [name, code || null, address || null, city || null, country || "CO", id, organizationId],
    );
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.redirect(companyUrl(organizationId, request.url, "?error=site-code"), 303);
    }
    throw error;
  }

  return NextResponse.redirect(companyUrl(organizationId, request.url, "?saved=site"), 303);
}
