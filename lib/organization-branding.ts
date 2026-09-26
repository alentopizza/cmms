import { cache } from "react";
import { query } from "@/lib/db";
import { DEFAULT_BRAND_SCHEME, type BrandSchemeKey } from "@/lib/brand-theme";

export type OrganizationBrandingSummary = {
  appName: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  schemeKey: BrandSchemeKey;
  autoPalette: boolean;
  interfaceStyle: "light"|"dark"|"system";
  interfaceDensity: "compact"|"normal"|"comfortable";
  hasLogoOnLight: boolean;
  hasLogoOnDark: boolean;
  hasOrganizationLogo: boolean;
  showDeswebBranding: boolean;
};

async function resolveOrganizationBranding(organizationId: string): Promise<OrganizationBrandingSummary> {
  const result = await query<{
    app_name: string | null;
    primary_color: string | null;
    secondary_color: string | null;
    accent_color: string | null;
    scheme_key: BrandSchemeKey | null;
    auto_palette: boolean | null;
    interface_style: "light"|"dark"|"system"|null;
    interface_density: "compact"|"normal"|"comfortable"|null;
    logo_on_light_mime: string | null;
    logo_on_dark_mime: string | null;
    show_desweb_branding: boolean | null;
    organization_has_logo: boolean;
  }>(
    `SELECT ob.app_name,ob.primary_color,ob.secondary_color,ob.accent_color,ob.scheme_key,ob.auto_palette,
            ob.interface_style,ob.interface_density,ob.logo_on_light_mime,ob.logo_on_dark_mime,ob.show_desweb_branding,
            (o.logo_data IS NOT NULL) organization_has_logo
     FROM organizations o
     LEFT JOIN organization_branding ob ON ob.organization_id=o.id
     WHERE o.id=$1`,
    [organizationId],
  );
  const row=result.rows[0];
  return {
    appName: row?.app_name || null,
    primaryColor: row?.primary_color || DEFAULT_BRAND_SCHEME.primary,
    secondaryColor: row?.secondary_color || DEFAULT_BRAND_SCHEME.secondary,
    accentColor: row?.accent_color || DEFAULT_BRAND_SCHEME.accent,
    schemeKey: row?.scheme_key || "default",
    autoPalette: row?.auto_palette ?? true,
    interfaceStyle: row?.interface_style || "light",
    interfaceDensity: row?.interface_density || "normal",
    hasLogoOnLight: Boolean(row?.logo_on_light_mime),
    hasLogoOnDark: Boolean(row?.logo_on_dark_mime),
    hasOrganizationLogo: Boolean(row?.organization_has_logo),
    showDeswebBranding: row?.show_desweb_branding ?? false,
  };
}

export const getOrganizationBranding = cache(resolveOrganizationBranding);

export function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}
