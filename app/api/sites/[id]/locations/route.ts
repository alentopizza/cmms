import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool } from "@/lib/db";
import { canCreateLocation } from "@/lib/resource-limits";
import { publicUrl } from "@/lib/urls";
import { appendFeedback, safeDashboardReturn } from "@/lib/return-to";
import { readImageUpload, imageUploadMessage } from "@/lib/image-upload";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!can(session, "locations.manage")) return new NextResponse("Forbidden", { status: 403 });
  const { id: siteId } = await params;
  if (!UUID.test(siteId)) return new NextResponse("Ubicación inválida", { status: 400 });

  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const code = String(form.get("code") || "").trim().toUpperCase();
  const type = String(form.get("type") || "area").trim().toLowerCase();
  const description = String(form.get("description") || "").trim();
  const parentId = String(form.get("parent_id") || "").trim();
  const returnTo = String(form.get("return_to") || "");
  let image=null;
  try { image=await readImageUpload(form,"image"); }
  catch(error) {
    const code=imageUploadMessage(error).includes("5 MB")?"image-size":"image-type";
    return NextResponse.redirect(publicUrl(appendFeedback(safeDashboardReturn(returnTo,`/dashboard/locations/${siteId}`),"?error="+code),request.url),303);
  }
  const target = (suffix: string) => publicUrl(appendFeedback(safeDashboardReturn(returnTo, `/dashboard/locations/${siteId}`), suffix), request.url);
  if (!name || (parentId && !UUID.test(parentId))) return NextResponse.redirect(target("?error=required"), 303);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const site = await client.query<{ organization_id: string }>("SELECT organization_id FROM sites WHERE id=$1", [siteId]);
    if (!site.rowCount) {
      await client.query("ROLLBACK");
      return new NextResponse("Ubicación no encontrada", { status: 404 });
    }
    const organizationId = site.rows[0].organization_id;
    if (!canAccessSite(session, siteId)) {
      await client.query("ROLLBACK");
      return new NextResponse("Forbidden", { status: 403 });
    }
    if (session.platformRole === "user" && session.organizationId !== organizationId) {
      await client.query("ROLLBACK");
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (!(await canCreateLocation(client, organizationId))) {
      await client.query("ROLLBACK");
      return NextResponse.redirect(target("?error=limit"), 303);
    }
    if (parentId) {
      const parent = await client.query("SELECT 1 FROM locations WHERE id=$1 AND site_id=$2 AND organization_id=$3", [parentId, siteId, organizationId]);
      if (!parent.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.redirect(target("?error=parent"), 303);
      }
    }
    await client.query(
      `INSERT INTO locations(
         organization_id,site_id,parent_id,name,code,type,description,image_data,image_mime_type
       )
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        organizationId,siteId,parentId||null,name,code||null,type||"area",description||null,
        image?.data||null,image?.mime||null,
      ],
    );
    await client.query("COMMIT");
    return NextResponse.redirect(target("?created=location"), 303);
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") return NextResponse.redirect(target("?error=code"), 303);
    throw error;
  } finally {
    client.release();
  }
}
