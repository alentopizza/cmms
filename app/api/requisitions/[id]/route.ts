import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES=new Set(["draft","sent","approved","rejected","partial","fulfilled","closed","cancelled"]);

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"requisitions.write"))return new NextResponse("Forbidden",{status:403});
  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Not found",{status:404});

  const existing=await query<{organization_id:string}>("SELECT organization_id FROM supplier_requisitions WHERE id=$1",[id]);
  if(!existing.rowCount)return new NextResponse("Requisición no encontrada",{status:404});
  if(session.platformRole==="user"&&session.organizationId!==existing.rows[0].organization_id)return new NextResponse("Forbidden",{status:403});

  const form=await request.formData();
  const status=String(form.get("status")||"");
  const notes=String(form.get("notes")||"").trim();
  const neededBy=String(form.get("needed_by")||"").trim();
  if(!STATUSES.has(status)|| (neededBy&&!/^\d{4}-\d{2}-\d{2}$/.test(neededBy))){
    return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?error=required",request.url),303);
  }

  await query(
    `UPDATE supplier_requisitions SET
       status=$1,notes=$2,needed_by=$3,
       sent_at=CASE WHEN $1='sent' AND sent_at IS NULL THEN now() ELSE sent_at END,
       approved_at=CASE WHEN $1='approved' AND approved_at IS NULL THEN now() ELSE approved_at END,
       fulfilled_at=CASE WHEN $1='fulfilled' AND fulfilled_at IS NULL THEN now() ELSE fulfilled_at END,
       updated_at=now()
     WHERE id=$4`,
    [status,notes||null,neededBy||null,id],
  );
  return NextResponse.redirect(publicUrl("/dashboard/requisitions/"+id+"?updated=1",request.url),303);
}
