import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!can(session, "work_orders.write")) return new NextResponse("Forbidden", { status: 403 });

  const form = await request.formData();
  const assetId = String(form.get("asset_id") || "");
  const title = String(form.get("title") || "").trim();
  const requester = session.role === "requester";
  const type = requester ? "corrective" : String(form.get("type") || "corrective");
  const priority = requester ? "medium" : String(form.get("priority") || "medium");

  const asset = session.platformRole !== "user"
    ? await query<{organization_id:string;site_id:string}>("SELECT organization_id,site_id FROM assets WHERE id=$1", [assetId])
    : await query<{organization_id:string;site_id:string}>("SELECT organization_id,site_id FROM assets WHERE id=$1 AND organization_id=$2", [assetId, session.organizationId]);

  if (!asset.rowCount || !title) return new NextResponse("Equipo o título inválido", { status: 400 });
  if (!canAccessSite(session, asset.rows[0].site_id)) return new NextResponse("Forbidden", { status: 403 });

  await query(
    `INSERT INTO work_orders(organization_id,site_id,asset_id,title,type,priority,requested_by)
     VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [asset.rows[0].organization_id,asset.rows[0].site_id,assetId,title,type,priority,session.userId],
  );
  return NextResponse.redirect(publicUrl("/dashboard/work-orders", request.url), 303);
}
