import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { isSupportedCountry, isSupportedLocale } from "@/lib/international-catalog";
import { publicUrl } from "@/lib/urls";

export async function POST(request:Request){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  const form=await request.formData();
  const scope=String(form.get("scope")||"organization");
  const locale=String(form.get("locale")||"es-CO");
  const country=String(form.get("country")||"CO").toUpperCase();

  if(!isSupportedLocale(locale)||!isSupportedCountry(country)){
    return new NextResponse("Idioma o país no soportado",{status:422});
  }

  if(scope==="platform"){
    if(!can(session,"personalization.manage"))return new NextResponse("Forbidden",{status:403});
    await query("UPDATE app_customization SET default_locale=$1,default_country=$2,updated_at=now() WHERE id=1",[locale,country]);
  }else{
    if(!session.organizationId||!can(session,"settings.view"))return new NextResponse("Forbidden",{status:403});
    await query("UPDATE organizations SET preferred_locale=$1,default_country=$2,updated_at=now() WHERE id=$3",[locale,country,session.organizationId]);
  }

  return NextResponse.redirect(publicUrl("/dashboard/settings?locale_saved=1",request.url),303);
}
