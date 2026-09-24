import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool, query } from "@/lib/db";
import { gateFor, getSetupState } from "@/lib/setup-sequence";
import { publicUrl } from "@/lib/urls";
import { isSupportedCountry, isTaxIdTypeForCountry } from "@/lib/international-catalog";
import { readImageUpload, imageUploadMessage } from "@/lib/image-upload";

function normalizedCodes(form:FormData,name:string){
  return [...new Set(form.getAll(name).map(value=>String(value).trim()).filter(Boolean))];
}
function legacySupplierType(capabilities:string[]){
  const materials=capabilities.includes("materials");
  const services=capabilities.some(code=>code!=="materials");
  if(materials&&services)return "both";
  return materials?"materials":"services";
}

export async function POST(request:Request) {
  const session=await getSession();
  if(!session) return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"suppliers.manage")) return new NextResponse("Forbidden",{status:403});

  const form=await request.formData();
  let organizationId=String(form.get("organization_id")||"");
  if(session.platformRole==="user") organizationId=session.organizationId || "";

  const name=String(form.get("name")||"").trim();
  const legalName=String(form.get("legal_name")||"").trim();
  const capabilityCodes=normalizedCodes(form,"capability_codes");
  const specialtyCodes=normalizedCodes(form,"specialty_codes");
  const taxId=String(form.get("tax_id")||"").trim();
  const taxIdType=String(form.get("tax_id_type")||"").trim();
  const countryCode=String(form.get("country_code")||"").trim().toUpperCase();
  const city=String(form.get("city")||"").trim();
  const address=String(form.get("address")||"").trim();
  const website=String(form.get("website")||"").trim();
  const contactName=String(form.get("contact_name")||"").trim();
  const contactTitle=String(form.get("contact_title")||"").trim();
  const email=String(form.get("email")||"").trim().toLowerCase();
  const phone=String(form.get("phone")||"").trim();
  const notes=String(form.get("notes")||"").trim();

  const target=(suffix:string)=>publicUrl(`/dashboard/suppliers${suffix}`,request.url);
  let logo=null;
  try{ logo=await readImageUpload(form,"logo"); }
  catch(error){ return NextResponse.redirect(target("?error="+encodeURIComponent(imageUploadMessage(error)||"logo")),303); }

  if(!organizationId||!name||!legalName||!city||!address||!capabilityCodes.length||!isSupportedCountry(countryCode)||!logo){
    return NextResponse.redirect(target("?error=required"),303);
  }
  if((taxId||taxIdType)&&(!taxId||!taxIdType||!isTaxIdTypeForCountry(countryCode,taxIdType))){
    return NextResponse.redirect(target("?error=required"),303);
  }

  const org=await query("SELECT 1 FROM organizations WHERE id=$1 AND active=true",[organizationId]);
  if(!org.rowCount) return new NextResponse("Empresa no disponible",{status:404});
  const gate=gateFor(await getSetupState(organizationId),"supplier");
  if(!gate.ready) return NextResponse.redirect(target("?error=sequence"),303);

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const validCapabilities=await client.query<{code:string;label:string}>(
      "SELECT code,label FROM supplier_capability_catalog WHERE active=true AND code=ANY($1::text[]) ORDER BY sort_order,label",
      [capabilityCodes],
    );
    if(validCapabilities.rowCount!==capabilityCodes.length){
      await client.query("ROLLBACK");
      return NextResponse.redirect(target("?error=required"),303);
    }
    const validSpecialties=specialtyCodes.length
      ?await client.query<{code:string;label:string}>(
        "SELECT code,label FROM supplier_specialty_catalog WHERE active=true AND code=ANY($1::text[]) ORDER BY sort_order,label",
        [specialtyCodes],
      )
      :{rows:[],rowCount:0};
    if(validSpecialties.rowCount!==specialtyCodes.length){
      await client.query("ROLLBACK");
      return NextResponse.redirect(target("?error=required"),303);
    }
    const supplierType=legacySupplierType(capabilityCodes);
    const serviceCategory=validSpecialties.rows.map(row=>row.label).join(", ")||null;
    const inserted=await client.query<{id:string}>(
      `INSERT INTO suppliers(
         organization_id,name,legal_name,tax_id,tax_id_type,country_code,city,address,website,
         contact_name,contact_title,email,phone,notes,supplier_type,service_category,
         logo_data,logo_mime_type,logo_file_name,updated_at
       )
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,now())
       RETURNING id`,
      [
        organizationId,name,legalName,taxId||null,taxIdType||null,countryCode,city,address,website||null,
        contactName||null,contactTitle||null,email||null,phone||null,notes||null,supplierType,serviceCategory,
        logo.data,logo.mime,"supplier-logo",
      ],
    );
    const supplierId=inserted.rows[0].id;
    for(const code of capabilityCodes){
      await client.query(
        "INSERT INTO supplier_capabilities(supplier_id,organization_id,capability_code) VALUES($1,$2,$3)",
        [supplierId,organizationId,code],
      );
    }
    for(const code of specialtyCodes){
      await client.query(
        "INSERT INTO supplier_specialties(supplier_id,organization_id,specialty_code) VALUES($1,$2,$3)",
        [supplierId,organizationId,code],
      );
    }
    await client.query("COMMIT");
  }catch(error){
    await client.query("ROLLBACK");
    throw error;
  }finally{
    client.release();
  }

  return NextResponse.redirect(target("?created=1"),303);
}
