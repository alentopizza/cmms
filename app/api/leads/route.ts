import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { isSupportedCountry } from "@/lib/international-catalog";

export async function POST(request:Request) {
  const session=await getSession();
  if(!session) return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"leads.manage")) return new NextResponse("Forbidden",{status:403});

  const form=await request.formData();
  const fullName=String(form.get("full_name")||"").trim();
  const companyName=String(form.get("company_name")||"").trim();
  const email=String(form.get("email")||"").trim().toLowerCase();
  const phone=String(form.get("phone")||"").trim();
  const countryCode=String(form.get("country_code")||"").trim().toUpperCase();
  const source=String(form.get("source")||"manual");
  const interest=String(form.get("interest")||"demo");
  const status=String(form.get("status")||"new");
  const followupType=String(form.get("followup_type")||"").trim();
  const message=String(form.get("message")||"").trim();

  const target=(suffix:string)=>publicUrl("/dashboard/leads"+suffix,request.url);
  if(!fullName||!companyName||!email||!isSupportedCountry(countryCode)) {
    return NextResponse.redirect(target("?error=required"),303);
  }
  const classifications=await query<{catalog_key:string;code:string}>(
    `SELECT catalog_key,code FROM configurable_catalog_options
     WHERE organization_id IS NULL AND active=true
       AND ((catalog_key='lead_sources' AND code=$1)
         OR (catalog_key='lead_interests' AND code=$2)
         OR (catalog_key='lead_statuses' AND code=$3)
         OR (catalog_key='lead_followups' AND code=$4))`,
    [source,interest,status,followupType],
  );
  const allowed=new Set(classifications.rows.map(row=>row.catalog_key+":"+row.code));
  if(!allowed.has("lead_sources:"+source)||!allowed.has("lead_interests:"+interest)||!allowed.has("lead_statuses:"+status)||(followupType&&!allowed.has("lead_followups:"+followupType))){
    return NextResponse.redirect(target("?error=required"),303);
  }

  await query(
    `INSERT INTO sales_leads(full_name,company_name,email,phone,country_code,interest,message,source,status,followup_type)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [fullName,companyName,email,phone||null,countryCode,interest,message||null,source,status,followupType||null],
  );

  return NextResponse.redirect(target("?created=1"),303);
}
