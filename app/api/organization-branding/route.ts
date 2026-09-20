import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { isHexColor } from "@/lib/organization-branding";
import { readImageUpload, ImageUploadError } from "@/lib/organization-assets";
import { publicUrl } from "@/lib/urls";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.organizationId) return new NextResponse("Unauthorized", { status: 401 });
  if (!session.whiteLabel || session.planCode !== "pro" || session.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const form = await request.formData();
    const appName = String(form.get("app_name") || "").trim();
    const primaryColor = String(form.get("primary_color") || "").trim();
    const secondaryColor = String(form.get("secondary_color") || "").trim();
    const showDeswebBranding = String(form.get("show_desweb_branding") || "") === "on";

    if (!appName || !isHexColor(primaryColor) || !isHexColor(secondaryColor)) {
      const url = publicUrl("/dashboard/settings?branding_error=1", request.url);
      return NextResponse.redirect(url, 303);
    }

    const [logoOnLight, logoOnDark] = await Promise.all([
      readImageUpload(form.get("logo_on_light"), { maxBytes: 2 * 1024 * 1024, label: "el logo para fondo claro" }),
      readImageUpload(form.get("logo_on_dark"), { maxBytes: 2 * 1024 * 1024, label: "el logo para fondo oscuro" }),
    ]);

    await query(
      `INSERT INTO organization_branding(
        organization_id,app_name,primary_color,secondary_color,
        logo_on_light,logo_on_light_mime,logo_on_light_name,
        logo_on_dark,logo_on_dark_mime,logo_on_dark_name,
        show_desweb_branding,updated_at
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
      ON CONFLICT(organization_id) DO UPDATE SET
        app_name=EXCLUDED.app_name,
        primary_color=EXCLUDED.primary_color,
        secondary_color=EXCLUDED.secondary_color,
        logo_on_light=COALESCE(EXCLUDED.logo_on_light,organization_branding.logo_on_light),
        logo_on_light_mime=COALESCE(EXCLUDED.logo_on_light_mime,organization_branding.logo_on_light_mime),
        logo_on_light_name=COALESCE(EXCLUDED.logo_on_light_name,organization_branding.logo_on_light_name),
        logo_on_dark=COALESCE(EXCLUDED.logo_on_dark,organization_branding.logo_on_dark),
        logo_on_dark_mime=COALESCE(EXCLUDED.logo_on_dark_mime,organization_branding.logo_on_dark_mime),
        logo_on_dark_name=COALESCE(EXCLUDED.logo_on_dark_name,organization_branding.logo_on_dark_name),
        show_desweb_branding=EXCLUDED.show_desweb_branding,
        updated_at=now()`,
      [
        session.organizationId, appName, primaryColor, secondaryColor,
        logoOnLight?.bytes || null, logoOnLight?.mime || null, logoOnLight?.name || null,
        logoOnDark?.bytes || null, logoOnDark?.mime || null, logoOnDark?.name || null,
        showDeswebBranding,
      ],
    );

    return NextResponse.redirect(publicUrl("/dashboard/settings?branding_saved=1", request.url), 303);
  } catch (error) {
    const code = error instanceof ImageUploadError ? error.code : "save";
    return NextResponse.redirect(publicUrl(`/dashboard/settings?branding_error=${code}`, request.url), 303);
  }
}
