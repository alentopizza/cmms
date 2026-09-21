import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool } from "@/lib/db";
import { gateFor, getSetupState } from "@/lib/setup-sequence";
import { publicUrl } from "@/lib/urls";

const STATUSES=new Set(["pending","in_progress","completed","cancelled"]);

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  const session=await getSession();
  if(!session) return new NextResponse("Unauthorized",{status:401});

  const {id:workOrderId}=await params;
  const form=await request.formData();
  const intent=String(form.get("intent")||"create");
  const target=(suffix:string)=>publicUrl("/dashboard/work-orders/"+workOrderId+suffix,request.url);

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const order=await client.query<{organization_id:string;site_id:string}>("SELECT organization_id,site_id FROM work_orders WHERE id=$1",[workOrderId]);
    if(!order.rowCount){await client.query("ROLLBACK");return new NextResponse("Orden no encontrada",{status:404});}
    const {organization_id:organizationId,site_id:siteId}=order.rows[0];

    if(session.platformRole!=="superadmin" && (session.organizationId!==organizationId || !canAccessSite(session,siteId))){
      await client.query("ROLLBACK");return new NextResponse("Forbidden",{status:403});
    }

    if(intent==="create"){
      if(!can(session,"activities.manage")){await client.query("ROLLBACK");return new NextResponse("Forbidden",{status:403});}
      const gate=gateFor(await getSetupState(organizationId,client),"activity");
      if(!gate.ready){await client.query("ROLLBACK");return NextResponse.redirect(target("?error=sequence"),303);}

      const description=String(form.get("description")||"").trim();
      const assignedTo=String(form.get("assigned_to")||"");
      const crewId=String(form.get("crew_id")||"");
      const supplierId=String(form.get("service_supplier_id")||"");
      const notes=String(form.get("notes")||"").trim();
      const selected=[assignedTo,crewId,supplierId].filter(Boolean);
      if(!description || selected.length!==1){await client.query("ROLLBACK");return NextResponse.redirect(target("?error=executor"),303);}

      if(assignedTo){
        const user=await client.query("SELECT 1 FROM organization_members om JOIN users u ON u.id=om.user_id WHERE om.organization_id=$1 AND u.id=$2 AND u.active=true AND om.role IN ('technician','external')",[organizationId,assignedTo]);
        if(!user.rowCount){await client.query("ROLLBACK");return NextResponse.redirect(target("?error=executor"),303);}
      }
      if(crewId){
        const crew=await client.query("SELECT 1 FROM crews WHERE id=$1 AND organization_id=$2 AND active=true",[crewId,organizationId]);
        if(!crew.rowCount){await client.query("ROLLBACK");return NextResponse.redirect(target("?error=executor"),303);}
      }
      if(supplierId){
        const supplier=await client.query("SELECT 1 FROM suppliers WHERE id=$1 AND organization_id=$2 AND active=true AND supplier_type IN ('services','both')",[supplierId,organizationId]);
        if(!supplier.rowCount){await client.query("ROLLBACK");return NextResponse.redirect(target("?error=executor"),303);}
      }

      const sort=await client.query<{next:number}>("SELECT COALESCE(max(sort_order),-1)+1 AS next FROM work_order_tasks WHERE work_order_id=$1",[workOrderId]);
      await client.query(
        `INSERT INTO work_order_tasks(organization_id,work_order_id,description,sort_order,assigned_to,crew_id,service_supplier_id,status,notes)
         VALUES($1,$2,$3,$4,$5,$6,$7,'pending',$8)`,
        [organizationId,workOrderId,description,sort.rows[0].next,assignedTo||null,crewId||null,supplierId||null,notes||null],
      );
      await client.query("COMMIT");
      return NextResponse.redirect(target("?created=1"),303);
    }

    if(!can(session,"activities.execute")){await client.query("ROLLBACK");return new NextResponse("Forbidden",{status:403});}
    const activityId=String(form.get("activity_id")||"");
    const status=String(form.get("status")||"");
    const notes=String(form.get("notes")||"").trim();
    if(!activityId||!STATUSES.has(status)){await client.query("ROLLBACK");return NextResponse.redirect(target("?error=activity"),303);}

    const activity=await client.query<{assigned_to:string|null;crew_id:string|null;service_supplier_id:string|null}>(
      "SELECT assigned_to,crew_id,service_supplier_id FROM work_order_tasks WHERE id=$1 AND work_order_id=$2 AND organization_id=$3",
      [activityId,workOrderId,organizationId],
    );
    if(!activity.rowCount){await client.query("ROLLBACK");return new NextResponse("Actividad no encontrada",{status:404});}

    if(session.platformRole!=="superadmin" && !can(session,"activities.manage")){
      const row=activity.rows[0];
      const direct=row.assigned_to===session.userId;
      const supplier=Boolean(row.service_supplier_id && session.externalSupplierId===row.service_supplier_id);
      const crew=row.crew_id && session.userId
        ? await client.query("SELECT 1 FROM crew_members WHERE crew_id=$1 AND user_id=$2",[row.crew_id,session.userId])
        : {rowCount:0};
      if(!direct&&!supplier&&!crew.rowCount){await client.query("ROLLBACK");return new NextResponse("Esta actividad no está asignada a tu cuenta",{status:403});}
    }

    await client.query(
      `UPDATE work_order_tasks SET status=$1,completed=($1='completed'),
         started_at=CASE WHEN $1='in_progress' AND started_at IS NULL THEN now() ELSE started_at END,
         completed_at=CASE WHEN $1='completed' THEN now() WHEN $1<>'completed' THEN NULL ELSE completed_at END,
         notes=$2
       WHERE id=$3`,
      [status,notes||null,activityId],
    );

    await client.query("COMMIT");
    return NextResponse.redirect(target("?updated=1"),303);
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }
}
