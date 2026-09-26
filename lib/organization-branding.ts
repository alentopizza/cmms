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
    show_desweb_branding: boolean;
  }>(
    `SELECT app_name,primary_color,secondary_color,accent_color,scheme_key,auto_palette,
            interface_style,interface_density,logo_on_light_mime,logo_on_dark_mime,show_desweb_branding
     FROM organization_branding
     WHERE organization_id=$1`,
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
    interfaceStyle: row?.interface_style || "system",
    interfaceDensity: row?.interface_density || "normal",
    hasLogoOnLight: Boolean(row?.logo_on_light_mime),
    hasLogoOnDark: Boolean(row?.logo_on_dark_mime),
    showDeswebBranding: row?.show_desweb_branding ?? false,
  };
}

export const getOrganizationBranding = cache(resolveOrganizationBranding);

export function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}
