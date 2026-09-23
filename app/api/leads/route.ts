import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { isSupportedCountry } from "@/lib/international-catalog";

const INTERESTS=new Set(["demo","trial","basic","medium","pro","self_hosted","other"]);

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
  const interest=String(form.get("interest")||"demo");
  const message=String(form.get("message")||"").trim();

  const target=(suffix:string)=>publicUrl("/dashboard/leads"+suffix,request.url);
  if(!fullName||!companyName||!email||!isSupportedCountry(countryCode)||!INTERESTS.has(interest)) {
    return NextResponse.redirect(target("?error=required"),303);
  }

  await query(
    `INSERT INTO sales_leads(full_name,company_name,email,phone,country_code,interest,message,source)
     VALUES($1,$2,$3,$4,$5,$6,$7,'manual')`,
    [fullName,companyName,email,phone||null,countryCode,interest,message||null],
  );

  return NextResponse.redirect(target("?created=1"),303);
}
