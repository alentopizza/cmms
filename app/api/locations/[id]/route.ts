import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { readImageUpload, imageUploadMessage } from "@/lib/image-upload";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!can(session, "locations.manage")) return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;
  const form = await request.formData();
  const siteId = String(form.get("site_id") || "");
  if (!UUID.test(id) || !UUID.test(siteId)) return new NextResponse("Sububicación inválida", { status: 400 });
  const redirect = (suffix: string) => NextResponse.redirect(publicUrl(`/dashboard/locations/${siteId}${suffix}`, request.url), 303);

  const current = await query<{ organization_id: string }>("SELECT organization_id FROM locations WHERE id=$1 AND site_id=$2", [id, siteId]);
  if (!current.rowCount) return new NextResponse("Sububicación no encontrada", { status: 404 });
  if (session.platformRole === "user" && session.organizationId !== current.rows[0].organization_id) return new NextResponse("Forbidden", { status: 403 });
  if (!canAccessSite(session, siteId)) return new NextResponse("Forbidden", { status: 403 });
  const intent = String(form.get("intent") || "update");
  if (intent === "toggle") {
    await query("UPDATE locations SET active=NOT active,updated_at=now() WHERE id=$1 AND site_id=$2", [id, siteId]);
    return redirect("?saved=status");
  }

  const name = String(form.get("name") || "").trim();
  const code = String(form.get("code") || "").trim().toUpperCase();
  const type = String(form.get("type") || "area").trim().toLowerCase();
  const description = String(form.get("description") || "").trim();
  let image=null;
  try { image=await readImageUpload(form,"image"); }
  catch(error) { return redirect(imageUploadMessage(error).includes("5 MB")?"?error=image-size":"?error=image-type"); }
  if (!name) return redirect("?error=required");
  try {
    await query(
      `UPDATE locations
       SET name=$1,code=$2,type=$3,description=$4,
           image_data=COALESCE($5,image_data),
           image_mime_type=CASE WHEN $5 IS NULL THEN image_mime_type ELSE $6 END,
           updated_at=now()
       WHERE id=$7 AND site_id=$8`,
      [name,code||null,type,description||null,image?.data||null,image?.mime||null,id,siteId],
    );
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return redirect("?error=code");
    throw error;
  }
  return redirect("?saved=location");
}
