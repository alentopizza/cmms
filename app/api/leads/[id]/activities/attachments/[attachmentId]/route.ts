import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request:Request,{params}:{params:Promise<{id:string;attachmentId:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"leads.manage"))return new NextResponse("Forbidden",{status:403});
  const {id,attachmentId}=await params;
  if(!UUID.test(id)||!UUID.test(attachmentId))return new NextResponse("Adjunto inválido",{status:400});

  const result=await query<{file_name:string;file_mime_type:string;file_data:Buffer}>(
    `SELECT file_name,file_mime_type,file_data
     FROM sales_lead_activity_attachments
     WHERE id=$1 AND lead_id=$2`,
    [attachmentId,id],
  );
  const file=result.rows[0];
  if(!file)return new NextResponse("Adjunto no encontrado",{status:404});
  const safe=file.file_name.replace(/[\r\n"]/g,"_");
  return new NextResponse(new Uint8Array(file.file_data),{headers:{
    "Content-Type":file.file_mime_type,
    "Content-Length":String(file.file_data.length),
    "Content-Disposition":`attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`,
    "Cache-Control":"private, no-store",
    "X-Content-Type-Options":"nosniff",
  }});
}
