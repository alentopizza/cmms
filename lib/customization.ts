import { query } from "@/lib/db";

type CustomizationRow = {
  logo_on_light_mime: string | null;
  logo_on_light_name: string | null;
  logo_on_dark_mime: string | null;
  logo_on_dark_name: string | null;
  favicon_mime: string | null;
  favicon_name: string | null;
  logo_on_light_size: number;
  logo_on_dark_size: number;
  favicon_size: number;
  default_locale: string;
  default_country: string;
  updated_at: string;
};

export type CustomizationSummary = {
  hasLogoOnLight: boolean;
  hasLogoOnDark: boolean;
  hasFavicon: boolean;
  logoOnLightName: string | null;
  logoOnDarkName: string | null;
  faviconName: string | null;
  logoOnLightSize: number;
  logoOnDarkSize: number;
  faviconSize: number;
  defaultLocale: string;
  defaultCountry: string;
  updatedAt: string | null;
};

export async function getCustomizationSummary(): Promise<CustomizationSummary> {
  try {
    const result = await query<CustomizationRow>(`
      SELECT
        logo_on_light_mime,
        logo_on_light_name,
        logo_on_dark_mime,
        logo_on_dark_name,
        favicon_mime,
        favicon_name,
        COALESCE(octet_length(logo_on_light), 0)::int AS logo_on_light_size,
        COALESCE(octet_length(logo_on_dark), 0)::int AS logo_on_dark_size,
        COALESCE(octet_length(favicon), 0)::int AS favicon_size,
        COALESCE(default_locale,'es-CO') default_locale,
        COALESCE(default_country,'CO') default_country,
        updated_at::text
      FROM app_customization
      WHERE id = 1
    `);

    const row = result.rows[0];
    if (!row) throw new Error("Customization row not found");

    return {
      hasLogoOnLight: Boolean(row.logo_on_light_mime && row.logo_on_light_size),
      hasLogoOnDark: Boolean(row.logo_on_dark_mime && row.logo_on_dark_size),
      hasFavicon: Boolean(row.favicon_mime && row.favicon_size),
      logoOnLightName: row.logo_on_light_name,
      logoOnDarkName: row.logo_on_dark_name,
      faviconName: row.favicon_name,
      logoOnLightSize: row.logo_on_light_size,
      logoOnDarkSize: row.logo_on_dark_size,
      faviconSize: row.favicon_size,
      defaultLocale: row.default_locale || "es-CO",
      defaultCountry: row.default_country || "CO",
      updatedAt: row.updated_at,
    };
  } catch {
    return {
      hasLogoOnLight: false,
      hasLogoOnDark: false,
      hasFavicon: false,
      logoOnLightName: null,
      logoOnDarkName: null,
      faviconName: null,
      logoOnLightSize: 0,
      logoOnDarkSize: 0,
      faviconSize: 0,
      defaultLocale: "es-CO",
      defaultCountry: "CO",
      updatedAt: null,
    };
  }
}

export function logoOnLightSrc(summary: CustomizationSummary) {
  return summary.hasLogoOnLight
    ? "/api/customization/assets/logo-on-light"
    : "/brand/desweb-logo-dark.webp";
}

export function logoOnDarkSrc(summary: CustomizationSummary) {
  return summary.hasLogoOnDark
    ? "/api/customization/assets/logo-on-dark"
    : "/brand/desweb-logo-dark.webp";
}
