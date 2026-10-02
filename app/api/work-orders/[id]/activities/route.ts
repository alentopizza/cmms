import { NextResponse } from "next/server";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { canAccessOrganization } from "@/lib/organization-scope";
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

    if(!canAccessOrganization(session,organizationId) || (session.platformRole==="user"&&!canAccessSite(session,siteId))){
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
      const dueDate=String(form.get("due_date")||"").trim();
      const selected=[assignedTo,crewId,supplierId].filter(Boolean);
      if(!description || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || selected.length!==1){await client.query("ROLLBACK");return NextResponse.redirect(target("?error=executor"),303);}

      if(assignedTo){
        const user=await client.query(
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
          [organizationId,assignedTo,siteId],
        );
        if(!user.rowCount){await client.query("ROLLBACK");return NextResponse.redirect(target("?error=executor"),303);}
      }
      if(crewId){
        const crew=await client.query(
          "SELECT 1 FROM crews WHERE id=$1 AND organization_id=$2 AND active=true AND (site_id IS NULL OR site_id=$3)",
          [crewId,organizationId,siteId],
        );
        if(!crew.rowCount){await client.query("ROLLBACK");return NextResponse.redirect(target("?error=executor"),303);}
      }
      if(supplierId){
        const supplier=await client.query("SELECT 1 FROM suppliers WHERE id=$1 AND organization_id=$2 AND active=true AND supplier_type IN ('services','both')",[supplierId,organizationId]);
        if(!supplier.rowCount){await client.query("ROLLBACK");return NextResponse.redirect(target("?error=executor"),303);}
      }

      const sort=await client.query<{next:number}>("SELECT COALESCE(max(sort_order),-1)+1 AS next FROM work_order_tasks WHERE work_order_id=$1",[workOrderId]);
      await client.query(
        `INSERT INTO work_order_tasks(
           organization_id,work_order_id,description,sort_order,assigned_to,crew_id,service_supplier_id,status,notes,due_date
         )
         VALUES($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9::date)`,
        [organizationId,workOrderId,description,sort.rows[0].next,assignedTo||null,crewId||null,supplierId||null,notes||null,dueDate],
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

    if(session.platformRole==="user" && !can(session,"activities.manage")){
      const row=activity.rows[0];
      const direct=row.assigned_to===session.userId;
      const supplier=session.role==="provider" && Boolean(row.service_supplier_id && session.externalSupplierId===row.service_supplier_id);
      const crew=row.crew_id && session.userId && session.role!=="provider"
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

    if(session.userId){
      const shift=await client.query<{id:string}>(
        `SELECT s.id
         FROM attendance_shifts s
         JOIN attendance_shift_segments segment
           ON segment.attendance_shift_id=s.id
          AND segment.ended_at IS NULL
          AND segment.segment_type='site'
          AND segment.site_id=$3
         WHERE s.user_id=$1 AND s.organization_id=$2 AND s.status='open'
           AND s.check_in_at<=now()
         ORDER BY s.check_in_at DESC
         LIMIT 1`,
        [session.userId,organizationId,siteId],
      );
      const eventType=status==="in_progress" ? "started" : status==="completed" ? "completed" : "status_update";
      await client.query(
        `INSERT INTO activity_execution_events(
           organization_id,work_order_id,task_id,user_id,attendance_shift_id,event_type,within_shift,within_site_geofence
         ) VALUES($1,$2,$3,$4,$5,$6,$7,NULL)`,
        [organizationId,workOrderId,activityId,session.userId,shift.rows[0]?.id||null,eventType,Boolean(shift.rowCount)],
      );
    }

    await client.query("COMMIT");
    return NextResponse.redirect(target("?updated=1"),303);
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }
}
