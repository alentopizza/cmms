import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { canAccessOrganization } from "@/lib/organization-scope";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function target(id:string,url:string,suffix:string){
  return NextResponse.redirect(publicUrl(`/dashboard/users?user=${encodeURIComponent(id)}&tab=documents&${suffix}`,url),303);
}
async function access(id:string,documentId:string,session:NonNullable<Awaited<ReturnType<typeof getSession>>>){
  const result=await query<{organization_id:string;file_data:Buffer;file_mime_type:string;file_name:string}>(
    "SELECT organization_id,file_data,file_mime_type,file_name FROM user_documents WHERE id=$1 AND user_id=$2",
    [documentId,id],
  );
  const row=result.rows[0];
  if(!row)return null;
  if(!canAccessOrganization(session,row.organization_id))return null;
  return row;
}

export async function GET(_request:Request,{params}:{params:Promise<{id:string;documentId:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"users.manage"))return new NextResponse("Forbidden",{status:403});
  const {id,documentId}=await params;
  if(!UUID.test(id)||!UUID.test(documentId))return new NextResponse("Documento inválido",{status:400});
  const row=await access(id,documentId,session);
  if(!row)return new NextResponse("Documento no encontrado",{status:404});
  const safe=row.file_name.replace(/[\r\n"]/g,"_");
  return new NextResponse(new Uint8Array(row.file_data),{headers:{
    "Content-Type":row.file_mime_type,
    "Content-Disposition":`attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`,
    "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",
  }});
}

export async function POST(request:Request,{params}:{params:Promise<{id:string;documentId:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"users.manage"))return new NextResponse("Forbidden",{status:403});
  const {id,documentId}=await params;
  if(!UUID.test(id)||!UUID.test(documentId))return new NextResponse("Documento inválido",{status:400});
  const row=await access(id,documentId,session);
  if(!row)return new NextResponse("Documento no encontrado",{status:404});
  const form=await request.formData();
  const intent=String(form.get("intent")||"archive");
  if(intent==="restore"){
    await query("UPDATE user_documents SET archived_at=NULL,archived_by=NULL,updated_at=now() WHERE id=$1 AND user_id=$2",[documentId,id]);
    return target(id,request.url,"saved=document-restored");
  }
  if(intent==="delete"){
    await query("DELETE FROM user_documents WHERE id=$1 AND user_id=$2",[documentId,id]);
    return target(id,request.url,"saved=document-deleted");
  }
  await query("UPDATE user_documents SET archived_at=now(),archived_by=$1,updated_at=now() WHERE id=$2 AND user_id=$3",[session.userId||null,documentId,id]);
  return target(id,request.url,"saved=document-archived");
}
