import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { canAccessOrganization } from "@/lib/organization-scope";
import { query } from "@/lib/db";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"catalogs.manage"))return new NextResponse("Forbidden",{status:403});
  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Not found",{status:404});
  const current=await query<{organization_id:string|null;origin:"SYSTEM"|"CUSTOM";label:string}>(
    "SELECT organization_id,origin,label FROM configurable_catalog_options WHERE id=$1",[id]
  );
  if(!current.rowCount)return new NextResponse("Not found",{status:404});
  const row=current.rows[0];
  if(row.organization_id&&!canAccessOrganization(session,row.organization_id))return new NextResponse("Forbidden",{status:403});
  if(row.origin==="SYSTEM"&&session.platformRole!=="platform_owner")return new NextResponse("System options are protected",{status:403});

  const body=await request.json().catch(()=>null) as {label?:string;description?:string;active?:boolean}|null;
  if(!body)return NextResponse.json({error:"invalid"},{status:400});
  const label=body.label===undefined?undefined:String(body.label).trim().replace(/\s+/g," ");
  if(label!==undefined&&!label)return NextResponse.json({error:"required"},{status:400});

  try{
    const updated=await query(
      `UPDATE configurable_catalog_options
       SET label=COALESCE($2,label),
           description=CASE WHEN $3::boolean THEN $4 ELSE description END,
           active=COALESCE($5,active),
           updated_at=now()
       WHERE id=$1
       RETURNING id,catalog_key,organization_id,origin,code,label,description,active,sort_order`,
      [id,label??null,body.description!==undefined,body.description===undefined?null:String(body.description).trim()||null,body.active??null],
    );
    return NextResponse.json({option:updated.rows[0]});
  }catch(error){
    if((error as {code?:string}).code==="23505")return NextResponse.json({error:"duplicate"},{status:409});
    throw error;
  }
}
