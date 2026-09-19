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
