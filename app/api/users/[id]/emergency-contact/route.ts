import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RELATIONSHIPS=new Set(["parent","spouse_partner","child","sibling","relative","friend","other"]);

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"users.manage"))return new NextResponse("Forbidden",{status:403});
  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Usuario inválido",{status:400});
  const target=await query<{organization_id:string}>(
    "SELECT om.organization_id FROM organization_members om WHERE om.user_id=$1 ORDER BY om.created_at ASC LIMIT 1",[id],
  );
  const row=target.rows[0];
  if(!row)return NextResponse.json({contact:null});
  if(session.platformRole==="user"&&session.organizationId!==row.organization_id)return new NextResponse("Forbidden",{status:403});
  const result=await query<{
    user_id:string;organization_id:string;full_name:string;relationship_code:string;phone:string;email:string|null;notes:string|null;
  }>(
    `SELECT user_id,organization_id,full_name,relationship_code,phone,email,notes
     FROM user_emergency_contacts
     WHERE user_id=$1 AND organization_id=$2
     LIMIT 1`,
    [id,row.organization_id],
  );
  return NextResponse.json({contact:result.rows[0]||null});
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"users.manage"))return new NextResponse("Forbidden",{status:403});
  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Usuario inválido",{status:400});
  const target=await query<{organization_id:string}>(
    "SELECT om.organization_id FROM organization_members om WHERE om.user_id=$1 ORDER BY om.created_at ASC LIMIT 1",[id],
  );
  const row=target.rows[0];
  if(!row)return new NextResponse("Usuario sin empresa",{status:422});
  if(session.platformRole==="user"&&session.organizationId!==row.organization_id)return new NextResponse("Forbidden",{status:403});
  const form=await request.formData();
  const fullName=String(form.get("full_name")||"").trim();
  const relationship=String(form.get("relationship_code")||"").trim();
  const phone=String(form.get("phone")||"").trim();
  const email=String(form.get("email")||"").trim().toLowerCase();
  const notes=String(form.get("notes")||"").trim();
  if(!fullName||!phone||!RELATIONSHIPS.has(relationship)){
    return NextResponse.redirect(publicUrl(`/dashboard/users?user=${id}&tab=emergency&error=emergency-required`,request.url),303);
  }
  await query(
    `INSERT INTO user_emergency_contacts(user_id,organization_id,full_name,relationship_code,phone,email,notes,updated_by,updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,now())
     ON CONFLICT(user_id) DO UPDATE SET
       organization_id=EXCLUDED.organization_id,full_name=EXCLUDED.full_name,relationship_code=EXCLUDED.relationship_code,
       phone=EXCLUDED.phone,email=EXCLUDED.email,notes=EXCLUDED.notes,updated_by=EXCLUDED.updated_by,updated_at=now()`,
    [id,row.organization_id,fullName,relationship,phone,email||null,notes||null,session.userId||null],
  );
  return NextResponse.redirect(publicUrl(`/dashboard/users?user=${id}&tab=emergency&saved=emergency`,request.url),303);
}
