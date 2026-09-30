import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { canAccessOrganization } from "@/lib/organization-scope";
import { getCatalogDefinition, listCatalogOptions, normalizeCatalogCode } from "@/lib/configurable-catalogs";
import { query } from "@/lib/db";

function requestedOrganization(request:Request,sessionOrganizationId:string|null){
  const url=new URL(request.url);
  return url.searchParams.get("organization_id")||sessionOrganizationId;
}

export async function GET(request:Request,{params}:{params:Promise<{catalogKey:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"catalogs.read"))return new NextResponse("Forbidden",{status:403});
  const {catalogKey}=await params;
  const definition=await getCatalogDefinition(catalogKey);
  if(!definition)return new NextResponse("Catalog not found",{status:404});
  const organizationId=requestedOrganization(request,session.organizationId);
  if(organizationId&&!canAccessOrganization(session,organizationId))return new NextResponse("Forbidden",{status:403});
  const options=await listCatalogOptions(catalogKey,organizationId);
  const canManageCatalog=can(session,"catalogs.manage");
  return NextResponse.json({catalog:definition,options,canCreate:canManageCatalog&&definition.allowCustom,canManage:canManageCatalog});
}

export async function POST(request:Request,{params}:{params:Promise<{catalogKey:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"catalogs.manage"))return new NextResponse("Forbidden",{status:403});
  const {catalogKey}=await params;
  const definition=await getCatalogDefinition(catalogKey);
  if(!definition||!definition.allowCustom)return new NextResponse("Catalog does not allow custom options",{status:404});

  const body=await request.json().catch(()=>null) as {organizationId?:string;label?:string;description?:string}|null;
  const organizationId=body?.organizationId||session.organizationId;
  const label=String(body?.label||"").trim().replace(/\s+/g," ");
  const description=String(body?.description||"").trim()||null;
  if(!organizationId||!label)return NextResponse.json({error:"required"},{status:400});
  if(!canAccessOrganization(session,organizationId))return new NextResponse("Forbidden",{status:403});
  if(label.length>120)return NextResponse.json({error:"label_too_long"},{status:400});

  const duplicate=await query(
    `SELECT 1 FROM configurable_catalog_options
     WHERE catalog_key=$1
       AND (organization_id IS NULL OR organization_id=$2)
       AND lower(label)=lower($3)
     LIMIT 1`,
    [catalogKey,organizationId,label],
  );
  if(duplicate.rowCount)return NextResponse.json({error:"duplicate"},{status:409});

  const base=normalizeCatalogCode(label)||"option";
  const result=await query<{
    id:string;catalog_key:string;organization_id:string;origin:"CUSTOM";code:string;label:string;description:string|null;active:boolean;sort_order:number;
  }>(
    `INSERT INTO configurable_catalog_options(catalog_key,organization_id,origin,code,label,description,created_by)
     VALUES($1,$2,'CUSTOM',$3 || '-' || substr(md5(gen_random_uuid()::text),1,6),$4,$5,$6)
     RETURNING id,catalog_key,organization_id,origin,code,label,description,active,sort_order`,
    [catalogKey,organizationId,base,label,description,session.userId],
  );
  const row=result.rows[0];
  if(catalogKey==="supplier_types"){
    await query(
      "INSERT INTO supplier_capability_catalog(code,label,sort_order,active) VALUES($1,$2,1000,true) ON CONFLICT(code) DO UPDATE SET label=EXCLUDED.label,active=true",
      [row.code,row.label],
    );
  }
  if(catalogKey==="supplier_specialties"){
    await query(
      "INSERT INTO supplier_specialty_catalog(code,label,sort_order,active) VALUES($1,$2,1000,true) ON CONFLICT(code) DO UPDATE SET label=EXCLUDED.label,active=true",
      [row.code,row.label],
    );
  }
  return NextResponse.json({option:{
    id:row.id,catalogKey:row.catalog_key,organizationId:row.organization_id,origin:row.origin,code:row.code,
    label:row.label,description:row.description,active:row.active,sortOrder:row.sort_order,
  }},{status:201});
}
