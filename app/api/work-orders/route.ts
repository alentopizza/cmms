import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { canAccessOrganization } from "@/lib/organization-scope";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { getCreationGateForScope } from "@/lib/setup-sequence";

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
  const status = requester ? "open" : String(form.get("status") || "open");
  const workType = requester ? "" : String(form.get("work_type") || "").trim();
  const cause = requester ? "" : String(form.get("cause") || "").trim();
  const assignedTo = requester ? "" : String(form.get("assigned_to") || "");
  const crewId = requester ? "" : String(form.get("crew_id") || "");
  const supplierId = requester ? "" : String(form.get("service_supplier_id") || "");

  const asset = session.platformRole !== "user"
    ? await query<{organization_id:string;site_id:string}>("SELECT organization_id,site_id FROM assets WHERE id=$1", [assetId])
    : await query<{organization_id:string;site_id:string}>("SELECT organization_id,site_id FROM assets WHERE id=$1 AND organization_id=$2", [assetId, session.organizationId]);

  if (!asset.rowCount || !title) return new NextResponse("Equipo o título inválido", { status: 400 });
  const organizationId=asset.rows[0].organization_id;
  if(!canAccessOrganization(session,organizationId)) return new NextResponse("Forbidden",{status:403});
  if (session.platformRole==="user"&&!canAccessSite(session, asset.rows[0].site_id)) return new NextResponse("Forbidden", { status: 403 });
  const gate=await getCreationGateForScope("work_order",organizationId,false);
  if(!gate.ready) {
    return NextResponse.redirect(publicUrl("/dashboard/work-orders?error=sequence",request.url),303);
  }

  const selected=[assignedTo,crewId,supplierId].filter(Boolean);
  if(selected.length>1){
    return NextResponse.redirect(publicUrl("/dashboard/work-orders?error=executor",request.url),303);
  }

  if(assignedTo){
    const worker=await query(
      `SELECT 1
       FROM organization_members om
       JOIN users u ON u.id=om.user_id
       WHERE om.organization_id=$1 AND u.id=$2 AND u.active=true
         AND om.role IN ('technician','external')
         AND (
           COALESCE(om.access_all_sites,true)=true
           OR EXISTS(
             SELECT 1 FROM organization_member_sites oms
             WHERE oms.organization_id=om.organization_id
               AND oms.user_id=om.user_id
               AND oms.site_id=$3
           )
         )`,
      [organizationId,assignedTo,asset.rows[0].site_id],
    );
    if(!worker.rowCount) return NextResponse.redirect(publicUrl("/dashboard/work-orders?error=executor",request.url),303);
  }

  if(crewId){
    const crew=await query(
      "SELECT 1 FROM crews WHERE id=$1 AND organization_id=$2 AND active=true AND (site_id IS NULL OR site_id=$3)",
      [crewId,organizationId,asset.rows[0].site_id],
    );
    if(!crew.rowCount) return NextResponse.redirect(publicUrl("/dashboard/work-orders?error=executor",request.url),303);
  }

  if(supplierId){
    const supplier=await query(
      "SELECT 1 FROM suppliers WHERE id=$1 AND organization_id=$2 AND active=true AND supplier_type IN ('services','both')",
      [supplierId,organizationId],
    );
    if(!supplier.rowCount) return NextResponse.redirect(publicUrl("/dashboard/work-orders?error=executor",request.url),303);
  }

  const effectiveStatus=selected.length&&status==="open"?"assigned":status;

  await query(
    `INSERT INTO work_orders(
       organization_id,site_id,asset_id,title,type,priority,status,work_type,cause,requested_by,assigned_to,crew_id,service_supplier_id
     )
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      organizationId,asset.rows[0].site_id,assetId,title,type,priority,effectiveStatus,workType||null,cause||null,
      session.userId,assignedTo||null,crewId||null,supplierId||null,
    ],
  );
  return NextResponse.redirect(publicUrl("/dashboard/work-orders", request.url), 303);
}
