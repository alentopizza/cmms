import { cache } from "react";
import { query } from "@/lib/db";

export type OrganizationBrandingSummary = {
  appName: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  hasLogoOnLight: boolean;
  hasLogoOnDark: boolean;
  showDeswebBranding: boolean;
};

async function resolveOrganizationBranding(organizationId: string): Promise<OrganizationBrandingSummary> {
  const result = await query<{
    app_name: string | null;
    primary_color: string | null;
    secondary_color: string | null;
    logo_on_light_mime: string | null;
    logo_on_dark_mime: string | null;
    show_desweb_branding: boolean;
  }>(
    `SELECT app_name,primary_color,secondary_color,logo_on_light_mime,logo_on_dark_mime,show_desweb_branding
     FROM organization_branding
     WHERE organization_id=$1`,
    [organizationId],
  );
  const row=result.rows[0];
  return {
    appName: row?.app_name || null,
    primaryColor: row?.primary_color || null,
    secondaryColor: row?.secondary_color || null,
    hasLogoOnLight: Boolean(row?.logo_on_light_mime),
    hasLogoOnDark: Boolean(row?.logo_on_dark_mime),
    showDeswebBranding: row?.show_desweb_branding ?? false,
  };
}

export const getOrganizationBranding = cache(resolveOrganizationBranding);

export function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}
