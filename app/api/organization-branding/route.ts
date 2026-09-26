import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { isHexColor } from "@/lib/organization-branding";
import { readImageUpload, ImageUploadError } from "@/lib/organization-assets";
import { DEFAULT_BRAND_SCHEME, isBrandDensity, isBrandInterfaceStyle, isBrandSchemeKey } from "@/lib/brand-theme";
import { publicUrl } from "@/lib/urls";

function redirectTarget(request:Request,returnTo:string,queryString:string){
  const base=returnTo==="brand"?"/dashboard/brand":"/dashboard/settings";
  return NextResponse.redirect(publicUrl(base+queryString,request.url),303);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.organizationId) return new NextResponse("Unauthorized", { status: 401 });
  if (!session.whiteLabel || session.planCode !== "pro" || session.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let returnTo="settings";
  try {
    const form = await request.formData();
    returnTo=String(form.get("return_to")||"settings");
    const intent=String(form.get("intent")||"save");

    if(intent==="reset"){
      await query("DELETE FROM organization_branding WHERE organization_id=$1",[session.organizationId]);
      return redirectTarget(request,returnTo,"?branding_reset=1");
    }

    if(intent==="remove_logo"){
      await query(
        `UPDATE organization_branding
         SET logo_on_light=NULL,logo_on_light_mime=NULL,logo_on_light_name=NULL,
             logo_on_dark=NULL,logo_on_dark_mime=NULL,logo_on_dark_name=NULL,updated_at=now()
         WHERE organization_id=$1`,
        [session.organizationId],
      );
      return redirectTarget(request,returnTo,"?branding_saved=1");
    }

    const current=await query<{
      app_name:string|null;primary_color:string|null;secondary_color:string|null;accent_color:string|null;
      show_desweb_branding:boolean;scheme_key:string|null;auto_palette:boolean|null;
      interface_style:string|null;interface_density:string|null;
    }>(
      `SELECT app_name,primary_color,secondary_color,accent_color,show_desweb_branding,scheme_key,auto_palette,interface_style,interface_density
       FROM organization_branding WHERE organization_id=$1`,
      [session.organizationId],
    );
    const previous=current.rows[0];

    const appName = String(form.get("app_name") || previous?.app_name || session.organizationName || "CMMS").trim();
    const primaryColor = String(form.get("primary_color") || previous?.primary_color || DEFAULT_BRAND_SCHEME.primary).trim();
    const secondaryColor = String(form.get("secondary_color") || previous?.secondary_color || DEFAULT_BRAND_SCHEME.secondary).trim();
    const accentColor = String(form.get("accent_color") || previous?.accent_color || DEFAULT_BRAND_SCHEME.accent).trim();
    const schemeKey=String(form.get("scheme_key")||previous?.scheme_key||"default");
    const autoPalette=String(form.get("auto_palette")||"")!=="off";
    const interfaceStyle=String(form.get("interface_style")||previous?.interface_style||"light");
    const interfaceDensity=String(form.get("interface_density")||previous?.interface_density||"normal");
    const advanced=String(form.get("branding_form")||"")==="advanced";
    const removeLogo=String(form.get("remove_logo")||"")==="on";
    const showDeswebBranding=advanced
      ? (previous?.show_desweb_branding??false)
      : String(form.get("show_desweb_branding")||"")==="on";

    if (
      !appName || !isHexColor(primaryColor) || !isHexColor(secondaryColor) || !isHexColor(accentColor)
      || !isBrandSchemeKey(schemeKey) || !isBrandInterfaceStyle(interfaceStyle) || !isBrandDensity(interfaceDensity)
    ) {
      return redirectTarget(request,returnTo,"?branding_error=invalid");
    }

    const sharedLogo=await readImageUpload(form.get("logo"),{maxBytes:2*1024*1024,label:"el logo de la empresa"});
    const [logoOnLight, logoOnDark] = sharedLogo
      ? [sharedLogo,sharedLogo]
      : await Promise.all([
          readImageUpload(form.get("logo_on_light"), { maxBytes: 2 * 1024 * 1024, label: "el logo para fondo claro" }),
          readImageUpload(form.get("logo_on_dark"), { maxBytes: 2 * 1024 * 1024, label: "el logo para fondo oscuro" }),
        ]);

    await query(
      `INSERT INTO organization_branding(
        organization_id,app_name,primary_color,secondary_color,accent_color,scheme_key,auto_palette,interface_style,interface_density,
        logo_on_light,logo_on_light_mime,logo_on_light_name,
        logo_on_dark,logo_on_dark_mime,logo_on_dark_name,
        show_desweb_branding,updated_at
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,now())
      ON CONFLICT(organization_id) DO UPDATE SET
        app_name=EXCLUDED.app_name,
        primary_color=EXCLUDED.primary_color,
        secondary_color=EXCLUDED.secondary_color,
        accent_color=EXCLUDED.accent_color,
        scheme_key=EXCLUDED.scheme_key,
        auto_palette=EXCLUDED.auto_palette,
        interface_style=EXCLUDED.interface_style,
        interface_density=EXCLUDED.interface_density,
        logo_on_light=COALESCE(EXCLUDED.logo_on_light,organization_branding.logo_on_light),
        logo_on_light_mime=COALESCE(EXCLUDED.logo_on_light_mime,organization_branding.logo_on_light_mime),
        logo_on_light_name=COALESCE(EXCLUDED.logo_on_light_name,organization_branding.logo_on_light_name),
        logo_on_dark=COALESCE(EXCLUDED.logo_on_dark,organization_branding.logo_on_dark),
        logo_on_dark_mime=COALESCE(EXCLUDED.logo_on_dark_mime,organization_branding.logo_on_dark_mime),
        logo_on_dark_name=COALESCE(EXCLUDED.logo_on_dark_name,organization_branding.logo_on_dark_name),
        show_desweb_branding=EXCLUDED.show_desweb_branding,
        updated_at=now()`,
      [
        session.organizationId,appName,primaryColor,secondaryColor,accentColor,schemeKey,autoPalette,interfaceStyle,interfaceDensity,
        logoOnLight?.bytes||null,logoOnLight?.mime||null,logoOnLight?.name||null,
        logoOnDark?.bytes||null,logoOnDark?.mime||null,logoOnDark?.name||null,
        showDeswebBranding,
      ],
    );

    if(removeLogo&&!sharedLogo&&!logoOnLight&&!logoOnDark){
      await query(
        `UPDATE organization_branding
         SET logo_on_light=NULL,logo_on_light_mime=NULL,logo_on_light_name=NULL,
             logo_on_dark=NULL,logo_on_dark_mime=NULL,logo_on_dark_name=NULL,updated_at=now()
         WHERE organization_id=$1`,
        [session.organizationId],
      );
    }

    return redirectTarget(request,returnTo,"?branding_saved=1");
  } catch (error) {
    const code = error instanceof ImageUploadError ? error.code : "save";
    return redirectTarget(request,returnTo,`?branding_error=${code}`);
  }
}
