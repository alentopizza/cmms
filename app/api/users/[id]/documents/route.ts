import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { OrganizationDocumentUploadError, readOrganizationDocumentUpload } from "@/lib/organization-documents";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATEGORIES=new Set([
  "identity","resume","occupational_risk","health_eps","pension","severance",
  "compensation_fund","payroll_contribution","bank_certificate","contract","certification","other",
]);

function target(id:string,url:string,suffix:string){
  return NextResponse.redirect(publicUrl(`/dashboard/users?user=${encodeURIComponent(id)}&tab=documents&${suffix}`,url),303);
}

async function targetUser(id:string,session:NonNullable<Awaited<ReturnType<typeof getSession>>>){
  const result=await query<{organization_id:string|null}>(
    `SELECT om.organization_id FROM users u
     LEFT JOIN organization_members om ON om.user_id=u.id
     WHERE u.id=$1 ORDER BY om.created_at ASC LIMIT 1`,[id],
  );
  const row=result.rows[0];
  if(!row?.organization_id)return null;
  if(session.platformRole==="user"&&session.organizationId!==row.organization_id)return null;
  return row;
}

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"users.manage"))return new NextResponse("Forbidden",{status:403});
  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Usuario inválido",{status:400});
  const user=await targetUser(id,session);
  if(!user)return new NextResponse("Usuario no disponible",{status:404});
  const result=await query<{
    id:string;organization_id:string;user_id:string;category:string;display_name:string;reference:string|null;
    issue_date:string|null;expires_at:string|null;file_name:string|null;file_mime_type:string|null;archived_at:string|null;created_at:string;
  }>(
    `SELECT id,organization_id,user_id,category,display_name,reference,issue_date::text,expires_at::text,
            file_name,file_mime_type,archived_at::text,created_at::text
     FROM user_documents
     WHERE organization_id=$1 AND user_id=$2
     ORDER BY created_at DESC`,
    [user.organization_id,id],
  );
  return NextResponse.json({documents:result.rows});
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"users.manage"))return new NextResponse("Forbidden",{status:403});
  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Usuario inválido",{status:400});
  const user=await targetUser(id,session);
  if(!user)return new NextResponse("Usuario no disponible",{status:404});
  try{
    const form=await request.formData();
    const category=String(form.get("category")||"other");
    const displayName=String(form.get("display_name")||"").trim();
    const reference=String(form.get("reference")||"").trim();
    const issueDate=String(form.get("issue_date")||"").trim();
    const expiresAt=String(form.get("expires_at")||"").trim();
    const notes=String(form.get("notes")||"").trim();
    if(!CATEGORIES.has(category)||!displayName)return target(id,request.url,"error=document-fields");
    const file=await readOrganizationDocumentUpload(form.get("file"));
    if(!file)return target(id,request.url,"error=document-file");
    await query(
      `INSERT INTO user_documents(
        organization_id,user_id,category,display_name,reference,issue_date,expires_at,notes,
        file_data,file_mime_type,file_name,file_size_bytes,uploaded_by
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        user.organization_id,id,category,displayName,reference||null,
        /^\d{4}-\d{2}-\d{2}$/.test(issueDate)?issueDate:null,
        /^\d{4}-\d{2}-\d{2}$/.test(expiresAt)?expiresAt:null,
        notes||null,file.bytes,file.mime,file.name,file.size,session.userId||null,
      ],
    );
    return target(id,request.url,"saved=document");
  }catch(error){
    if(error instanceof OrganizationDocumentUploadError)return target(id,request.url,"error="+error.code);
    throw error;
  }
}
