# Desweb branding

## Brand name

Primary brand: **DESWEB**  
Product: **Desweb CMMS**  
Tagline: **Desarrollo de Soluciones**

Never use the misspelling “Deswel”.

## Official palette

| Role | Hex |
|---|---|
| Institutional dark | `#293644` |
| White | `#FCFCFC` |
| Mint light | `#BAE3E0` |
| Mint medium | `#79CAC4` |
| Primary teal | `#38B2A9` |

## Logo variants

Desweb CMMS distinguishes two logo roles:

- **Logo on light:** dark-wordmark variant for white/light backgrounds.
- **Logo on dark:** white/light-wordmark variant for dark backgrounds and dark theme.

The application includes a fallback repository asset, but production branding should be managed from **Personalización**.

Configured logo files are stored in PostgreSQL and delivered through application asset routes.

## Favicon

The favicon is also managed from **Personalización**.

If no custom favicon exists, the application serves a generated Desweb fallback icon.

## Logo rules

- preserve aspect ratio;
- prefer transparent files;
- do not stretch;
- do not add decorative shadows directly to the wordmark;
- use the correct light/dark variant for contrast;
- retain comfortable clear space.

## Personalization direction

The personalization module is the canonical future home for visual brand settings.

Current scope:
- light-background logo;
- dark-background logo;
- favicon.

Future scope may include:
- brand colors;
- product name;
- login background;
- typography;
- email/report branding.

Future work should extend the existing module and storage model rather than hardcoding per-screen branding.


## Technology-forward expression

The Desweb CMMS commercial identity should express technology through the existing Desweb palette rather than adopting a separate blue/cyan brand.

Preferred hierarchy:

- institutional dark `#293644` as the structural anchor;
- teal `#38B2A9` for primary interactive/highlight states;
- mint `#79CAC4` and `#BAE3E0` for glow, telemetry, secondary emphasis and gradients;
- white/off-white for contrast and legibility.

Dark marketing surfaces may use deeper derived shades of the institutional dark while keeping teal/mint as the recognisable signature.


## Logo usage on public marketing

The supplied identity board establishes distinct brand-use contexts:
- principal/negative logo for dark backgrounds;
- alternative dark logo for light backgrounds;
- icon/isotype for compact applications and favicon;
- teal/mint geometric accents.

The marketing header should use the light-background logo variant on its floating white surface. The marketing footer should use the negative/dark-background variant where available.

Do not crop logos from a composite identity-board image for production. Use isolated PNG/WebP/SVG assets uploaded through the branding system.


## Principal marketing logo

The principal Desweb logo supplied on 2026-09-20 is the preferred asset for the light floating landing header. The header should display the logo as a complete lockup with **no additional “CMMS” label beside it**.

Navigation typography should be large enough to remain clearly readable at desktop widths and should not visually compete with the primary Trial CTA.


## Upload constraints

Global Desweb branding assets are persisted in PostgreSQL and survive redeploys.

- Logos: PNG, JPG/JPEG, WebP or SVG; maximum 2 MB per file.
- Favicon: ICO, PNG, WebP or SVG; maximum 2 MB.
- Logos should preferably use transparent backgrounds and a wide horizontal proportion near 1200×320 px.
- Favicons should be square; 64×64 or 128×128 px is recommended.

The Superadministrator edits these assets directly from Configuración, with previews for light, dark and browser-icon contexts.
