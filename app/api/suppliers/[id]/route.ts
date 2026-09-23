import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { isSupportedCountry, isTaxIdTypeForCountry } from "@/lib/international-catalog";
import { readImageUpload, imageUploadMessage } from "@/lib/image-upload";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES=new Set(["materials","services","both"]);

function target(id:string,url:string,suffix:string){
  return publicUrl(`/dashboard/suppliers?supplier=${encodeURIComponent(id)}${suffix}`,url);
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"suppliers.manage"))return new NextResponse("Forbidden",{status:403});
  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Not found",{status:404});

  const supplier=await query<{organization_id:string}>("SELECT organization_id FROM suppliers WHERE id=$1",[id]);
  if(!supplier.rowCount)return new NextResponse("Proveedor no encontrado",{status:404});
  const organizationId=supplier.rows[0].organization_id;
  if(session.platformRole==="user"&&session.organizationId!==organizationId)return new NextResponse("Forbidden",{status:403});

  const form=await request.formData();
  const intent=String(form.get("intent")||"update");

  if(intent==="delete"){
    const deps=await query<{inventory_count:number;activity_count:number;requisition_count:number}>(
      `SELECT
        (SELECT count(*)::int FROM inventory_items WHERE supplier_id=$1) inventory_count,
        (SELECT count(*)::int FROM work_order_tasks WHERE service_supplier_id=$1) activity_count,
        (SELECT count(*)::int FROM supplier_requisitions WHERE supplier_id=$1) requisition_count`,
      [id],
    );
    const row=deps.rows[0];
    if((row.inventory_count||0)+(row.activity_count||0)+(row.requisition_count||0)>0){
      return NextResponse.redirect(target(id,request.url,"&error=history"),303);
    }
    await query("DELETE FROM suppliers WHERE id=$1 AND organization_id=$2",[id,organizationId]);
    return NextResponse.redirect(publicUrl("/dashboard/suppliers?deleted=1",request.url),303);
  }

  if(intent==="toggle"){
    const active=String(form.get("active")||"")==="true";
    await query("UPDATE suppliers SET active=$1,updated_at=now() WHERE id=$2 AND organization_id=$3",[active,id,organizationId]);
    return NextResponse.redirect(target(id,request.url,"&updated=1"),303);
  }

  const name=String(form.get("name")||"").trim();
  const legalName=String(form.get("legal_name")||"").trim();
  const supplierType=String(form.get("supplier_type")||"materials");
  const countryCode=String(form.get("country_code")||"").trim().toUpperCase();
  const city=String(form.get("city")||"").trim();
  const address=String(form.get("address")||"").trim();
  const taxIdType=String(form.get("tax_id_type")||"").trim();
  const taxId=String(form.get("tax_id")||"").trim();
  const serviceCategory=String(form.get("service_category")||"").trim();
  const website=String(form.get("website")||"").trim();
  const contactName=String(form.get("contact_name")||"").trim();
  const contactTitle=String(form.get("contact_title")||"").trim();
  const email=String(form.get("email")||"").trim().toLowerCase();
  const phone=String(form.get("phone")||"").trim();
  const notes=String(form.get("notes")||"").trim();
  const active=String(form.get("active")||"on")==="on";

  if(!name||!legalName||!city||!address||!TYPES.has(supplierType)||!isSupportedCountry(countryCode)){
    return NextResponse.redirect(target(id,request.url,"&error=required"),303);
  }
  if((taxId||taxIdType)&&(!taxId||!taxIdType||!isTaxIdTypeForCountry(countryCode,taxIdType))){
    return NextResponse.redirect(target(id,request.url,"&error=required"),303);
  }

  let logo=null;
  try{logo=await readImageUpload(form,"logo");}
  catch(error){return NextResponse.redirect(target(id,request.url,"&error="+encodeURIComponent(imageUploadMessage(error)||"logo")),303);}

  await query(
    `UPDATE suppliers SET
      name=$1,legal_name=$2,supplier_type=$3,country_code=$4,city=$5,address=$6,tax_id_type=$7,tax_id=$8,
      service_category=$9,website=$10,contact_name=$11,contact_title=$12,email=$13,phone=$14,notes=$15,active=$16,
      logo_data=COALESCE($17,logo_data),
      logo_mime_type=CASE WHEN $17 IS NULL THEN logo_mime_type ELSE $18 END,
      logo_file_name=CASE WHEN $17 IS NULL THEN logo_file_name ELSE $19 END,
      updated_at=now()
     WHERE id=$20 AND organization_id=$21`,
    [
      name,legalName,supplierType,countryCode,city,address,taxIdType||null,taxId||null,
      serviceCategory||null,website||null,contactName||null,contactTitle||null,email||null,phone||null,notes||null,active,
      logo?.data||null,logo?.mime||null,logo?"supplier-logo":null,id,organizationId,
    ],
  );

  return NextResponse.redirect(target(id,request.url,"&updated=1"),303);
}
