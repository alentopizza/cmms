import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";

const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request:Request,
  {params}:{params:Promise<{id:string;kind:string}>},
){
  const session=await getSession();
  if(!session) return new NextResponse("Unauthorized",{status:401});

  const {id,kind}=await params;
  if(!UUID_PATTERN.test(id) || (kind!=="logo" && kind!=="cover")) {
    return new NextResponse("Not found",{status:404});
  }

  const canView=can(session,"companies.manage") || session.organizationId===id || session.platformRole!=="user";
  if(!canView) return new NextResponse("Forbidden",{status:403});

  const result=await query<{data:Buffer|null;mime:string|null}>(
    kind==="logo"
      ? "SELECT logo_data data,logo_mime_type mime FROM organizations WHERE id=$1"
      : "SELECT cover_data data,cover_mime_type mime FROM organizations WHERE id=$1",
    [id],
  );

  const row=result.rows[0];
  if(!row?.data || !row.mime) return new NextResponse("Not found",{status:404});

  return new NextResponse(new Uint8Array(row.data),{
    headers:{
      "Content-Type":row.mime,
      "Content-Length":String(row.data.length),
      "Cache-Control":"private, max-age=300",
      "X-Content-Type-Options":"nosniff",
    },
  });
}
