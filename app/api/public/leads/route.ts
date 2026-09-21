import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const EMAIL=/^\S+@\S+\.\S+$/;
const INTERESTS=new Set(["demo","trial","basic","medium","pro","self_hosted","other"]);

export async function POST(request: Request) {
  const form=await request.formData();
  const fullName=String(form.get("full_name")||"").trim();
  const companyName=String(form.get("company_name")||"").trim();
  const email=String(form.get("email")||"").trim().toLowerCase();
  const phone=String(form.get("phone")||"").trim();
  const interest=String(form.get("interest")||"").trim();
  const message=String(form.get("message")||"").trim();

  const fields:Record<string,string>={};
  if(!fullName) fields.full_name="Ingresa tu nombre.";
  if(!companyName) fields.company_name="Ingresa el nombre de la empresa.";
  if(!email) fields.email="Ingresa un correo.";
  else if(!EMAIL.test(email)) fields.email="Ingresa un correo válido.";
  if(!INTERESTS.has(interest)) fields.interest="Selecciona el tipo de interés.";
  if(phone.length>60) fields.phone="El teléfono es demasiado largo.";
  if(message.length>2000) fields.message="El mensaje no puede superar 2000 caracteres.";

  if(Object.keys(fields).length) {
    return NextResponse.json({message:"Revisa los campos marcados.",fields},{status:422});
  }

  await query(
    `INSERT INTO sales_leads(full_name,company_name,email,phone,interest,message,source)
     VALUES($1,$2,$3,$4,$5,$6,'landing')`,
    [fullName,companyName,email,phone||null,interest,message||null],
  );

  return NextResponse.json({ok:true});
}
