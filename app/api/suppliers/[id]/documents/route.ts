import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { OrganizationDocumentUploadError, readOrganizationDocumentUpload } from "@/lib/organization-documents";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATEGORIES=new Set(["tax","legal","contract","insurance","certification","catalog","quote","other"]);

function target(id:string,url:string,suffix:string){
  return NextResponse.redirect(publicUrl(`/dashboard/suppliers?supplier=${encodeURIComponent(id)}&tab=documents&${suffix}`,url),303);
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"suppliers.manage"))return new NextResponse("Forbidden",{status:403});
  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Proveedor inválido",{status:400});
  const supplier=await query<{organization_id:string}>("SELECT organization_id FROM suppliers WHERE id=$1",[id]);
  if(!supplier.rowCount)return new NextResponse("Proveedor no encontrado",{status:404});
  if(session.platformRole==="user"&&session.organizationId!==supplier.rows[0].organization_id)return new NextResponse("Forbidden",{status:403});
  try{
    const form=await request.formData();
    const category=String(form.get("category")||"other");
    const displayName=String(form.get("display_name")||"").trim();
    const reference=String(form.get("reference")||"").trim();
    const expiresAt=String(form.get("expires_at")||"").trim();
    const notes=String(form.get("notes")||"").trim();
    if(!CATEGORIES.has(category)||!displayName)return target(id,request.url,"error=document-fields");
    const file=await readOrganizationDocumentUpload(form.get("file"));
    if(!file)return target(id,request.url,"error=document-file");
    await query(
      `INSERT INTO supplier_documents(
        organization_id,supplier_id,category,display_name,reference,expires_at,notes,
        file_data,file_mime_type,file_name,file_size_bytes,uploaded_by
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [supplier.rows[0].organization_id,id,category,displayName,reference||null,/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)?expiresAt:null,notes||null,
       file.bytes,file.mime,file.name,file.size,session.userId||null],
    );
    return target(id,request.url,"saved=document");
  }catch(error){
    if(error instanceof OrganizationDocumentUploadError)return target(id,request.url,"error="+error.code);
    throw error;
  }
}
