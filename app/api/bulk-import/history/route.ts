import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";

type Batch={
  id:string;import_number:string;entity:string;file_name:string;status:string;total_rows:number;imported_rows:number;omitted_rows:number;error_rows:number;warning_rows:number;
  origin:"global"|"supplier";commit_scope:"all"|"context_only";context_supplier_name:string|null;
  summary:Record<string,unknown>|null;created_at:string;committed_at:string|null;user_name:string|null;
};

export async function GET(request:Request){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"No autorizado"},{status:401});
  const url=new URL(request.url);
  const entity=url.searchParams.get("entity")==="assets"?"assets":"inventory";
  const supplierId=url.searchParams.get("supplier")||"";

  if(entity==="inventory"&&!can(session,"inventory.write"))return NextResponse.json({error:"Forbidden"},{status:403});
  if(entity==="assets"&&!can(session,"assets.write"))return NextResponse.json({error:"Forbidden"},{status:403});

  let organizationId=session.organizationId;
  if(supplierId){
    const supplier=await query<{organization_id:string}>("SELECT organization_id FROM suppliers WHERE id=$1",[supplierId]);
    if(!supplier.rowCount)return NextResponse.json({error:"Proveedor no disponible"},{status:404});
    if(session.platformRole==="user"&&supplier.rows[0].organization_id!==session.organizationId)return NextResponse.json({error:"Forbidden"},{status:403});
    organizationId=supplier.rows[0].organization_id;
  }
  if(!organizationId)return NextResponse.json({batches:[]});

  const result=await query<Batch>(
    `SELECT b.id,b.import_number::text,b.entity,b.file_name,b.status,b.total_rows,b.imported_rows,b.omitted_rows,b.error_rows,b.warning_rows,
            b.origin,b.commit_scope,context_supplier.name context_supplier_name,b.summary,
            b.created_at::text,b.committed_at::text,u.full_name user_name
     FROM bulk_import_batches b
     LEFT JOIN users u ON u.id=b.user_id
     LEFT JOIN suppliers context_supplier ON context_supplier.id=b.context_supplier_id
     WHERE b.organization_id=$1 AND b.entity=$2
     ORDER BY b.created_at DESC
     LIMIT 12`,
    [organizationId,entity],
  );
  return NextResponse.json({batches:result.rows});
}
