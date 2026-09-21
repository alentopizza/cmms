import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { gateFor, getSetupState } from "@/lib/setup-sequence";
import { publicUrl } from "@/lib/urls";

const TYPES=new Set(["materials","services","both"]);

export async function POST(request:Request) {
  const session=await getSession();
  if(!session) return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"suppliers.manage")) return new NextResponse("Forbidden",{status:403});

  const form=await request.formData();
  let organizationId=String(form.get("organization_id")||"");
  if(session.platformRole==="user") organizationId=session.organizationId || "";

  const name=String(form.get("name")||"").trim();
  const supplierType=String(form.get("supplier_type")||"materials");
  const taxId=String(form.get("tax_id")||"").trim();
  const serviceCategory=String(form.get("service_category")||"").trim();
  const contactName=String(form.get("contact_name")||"").trim();
  const email=String(form.get("email")||"").trim().toLowerCase();
  const phone=String(form.get("phone")||"").trim();
  const notes=String(form.get("notes")||"").trim();

  const target=(suffix:string)=>publicUrl(`/dashboard/suppliers${suffix}`,request.url);
  if(!organizationId || !name || !TYPES.has(supplierType)) return NextResponse.redirect(target("?error=required"),303);

  const org=await query("SELECT 1 FROM organizations WHERE id=$1 AND active=true",[organizationId]);
  if(!org.rowCount) return new NextResponse("Empresa no disponible",{status:404});

  const gate=gateFor(await getSetupState(organizationId),"supplier");
  if(!gate.ready) return NextResponse.redirect(target("?error=sequence"),303);

  await query(
    `INSERT INTO suppliers(organization_id,name,tax_id,contact_name,email,phone,notes,supplier_type,service_category)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [organizationId,name,taxId||null,contactName||null,email||null,phone||null,notes||null,supplierType,serviceCategory||null],
  );

  return NextResponse.redirect(target("?created=1"),303);
}
