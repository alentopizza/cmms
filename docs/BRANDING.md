# Desweb branding

## Brand name

Primary brand: **DESWEB**  
Product: **Desweb CMMS**  
Tagline: **Desarrollo de Soluciones**

Never use the misspelling “Deswel”.

## Official palette — DESWEB V2

The canonical product palette is:

| Role | Hex |
|---|---|
| Primary / highlighted actions | `#72F1DC` |
| Secondary / structural teal | `#2C8780` |
| Dark / titles/sidebar | `#1D1D2C` |
| Surface | `#FFFFFF` |
| Product background | `#F4F8F9` |

Full ramps, semantic colors, gradients and functional module colors live in `docs/DESIGN_SYSTEM.md`.

The previous CMMS palette (`#293644`, `#38B2A9`, `#79CAC4`, `#BAE3E0`) is **legacy implementation only**. Existing screens may still contain it until they are migrated, but new visual work must not treat it as the current brand system.

## Logo variants

Desweb CMMS distinguishes two logo roles:

- **Logo on light:** dark-wordmark variant for white/light backgrounds.
- **Logo on dark:** white/light-wordmark variant for dark backgrounds and dark theme.

The application includes a fallback repository asset. Platform-wide DESWEB assets continue to be managed from the existing **Personalización** surface, while a customer Organization on Plan Pro manages its own white-label identity from **Personalización de marca** in the user menu.

Configured logo files are stored in the existing PostgreSQL branding/organization asset model and delivered through application asset routes. Tenant branding does not introduce a second external file store.

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

Two scopes are intentionally separate:

- **Platform Personalización** (`/dashboard/personalization`) owns DESWEB-wide assets such as the canonical light/dark logos and favicon.
- **Organization Personalización de marca · PRO** (`/dashboard/brand`) owns tenant identity stored in the existing `organization_branding` record.

Organization Pro scope includes:
- predefined or custom principal, secondary and accent colors;
- generated brand/navigation tokens;
- tenant logo overrides with the existing company logo as a reusable fallback;
- organization default interface appearance and density;
- real-time unsaved preview before persistence.

Tenant colors may style navigation, primary actions, active controls, focus and structural highlights. They must not replace the semantic success, warning, danger or information palettes.

Future work should extend these existing scopes and storage models rather than hardcoding per-screen branding or introducing a parallel theme service.


## Technology-forward expression

The Desweb CMMS identity should express technology through the V2 DESWEB palette instead of introducing a separate blue/cyan brand.

Preferred hierarchy:

- dark `#1D1D2C` as structural anchor;
- secondary teal `#2C8780` for navigation and primary operational actions;
- primary mint `#72F1DC` for highlighted actions, focus and active indicators;
- neutral white/off-white surfaces for enterprise readability;
- functional colors only when they communicate module/state meaning.

Dark marketing surfaces may use the Navy scale and approved gradients while preserving the same DESWEB signature.


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


## Organization Pro upload constraints

The Organization brand editor accepts PNG, JPG/JPEG and WebP logos up to 2 MB. The server validates the declared type against image bytes, extracts non-zero dimensions and rejects malformed or implausibly large images. Logo presentation always preserves aspect ratio with contained rendering; the editor does not stretch a tenant mark.

Removing a tenant logo override returns to the existing Organization logo when available, otherwise to the DESWEB fallback. This does not delete the company's canonical Organization record or create a new image-storage system.
