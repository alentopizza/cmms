import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool, query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  const session=await getSession();
  if(!session || !can(session,"leads.manage")) return new NextResponse("Forbidden",{status:403});

  const {id}=await params;
  const form=await request.formData();
  const status=String(form.get("status")||"");
  const allowed=await query(
    "SELECT 1 FROM configurable_catalog_options WHERE catalog_key='lead_statuses' AND organization_id IS NULL AND active=true AND code=$1 LIMIT 1",
    [status],
  );
  if(!allowed.rowCount) return new NextResponse("Invalid status",{status:422});

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const current=await client.query<{status:string}>(
      "SELECT status FROM sales_leads WHERE id=$1 FOR UPDATE",
      [id],
    );
    if(!current.rowCount){
      await client.query("ROLLBACK");
      return new NextResponse("Lead not found",{status:404});
    }
    const previous=current.rows[0].status;
    if(previous!==status){
      await client.query("UPDATE sales_leads SET status=$1,updated_at=now() WHERE id=$2",[status,id]);
      await client.query(
        `INSERT INTO sales_lead_activities(lead_id,activity_type,from_status,to_status,created_by)
         VALUES($1,'status',$2,$3,$4)`,
        [id,previous,status,session.userId||null],
      );
    }
    await client.query("COMMIT");
  }catch(error){
    try{await client.query("ROLLBACK");}catch{}
    throw error;
  }finally{
    client.release();
  }
  return NextResponse.redirect(publicUrl("/dashboard/leads",request.url),303);
}
