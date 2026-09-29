import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { canAccessOrganization } from "@/lib/organization-scope";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Not found",{status:404});
  const result=await query<{organization_id:string;data:Buffer|null;mime:string|null}>(
    "SELECT organization_id,logo_data data,logo_mime_type mime FROM suppliers WHERE id=$1",[id],
  );
  const row=result.rows[0];
  if(!row)return new NextResponse("Not found",{status:404});
  if(!canAccessOrganization(session,row.organization_id))return new NextResponse("Forbidden",{status:403});
  if(!row.data||!row.mime)return new NextResponse("Not found",{status:404});
  return new NextResponse(new Uint8Array(row.data),{headers:{
    "Content-Type":row.mime,
    "Content-Length":String(row.data.length),
    "Cache-Control":"private, max-age=300",
    "X-Content-Type-Options":"nosniff",
  }});
}
