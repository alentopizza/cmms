# Desweb CMMS design system

## Core brand tokens

```css
:root {
  --brand-dark: #293644;
  --brand-white: #FCFCFC;
  --brand-mint-light: #BAE3E0;
  --brand-mint: #79CAC4;
  --brand-teal: #38B2A9;
  --brand-teal-hover: #2F9D95;
}
```

## Theme implementation

Two themes are implemented.

### Light

- light workspace;
- white/light surfaces;
- institutional dark text;
- Desweb teal primary actions;
- dark logo variant.

### Dark

- dark workspace;
- darker elevated surfaces;
- light text;
- teal and mint accents;
- light/white logo variant.

Mechanism:

- `data-theme="light"` or `data-theme="dark"` on `<html>`;
- preference persisted in `localStorage` under `desweb-theme`;
- supported preferences: `light`, `dark` and `system`;
- first visit and the `system` option honor `prefers-color-scheme`;
- appearance is configured from **Dashboard → Configuración → Apariencia**, not from the operational header.

Do not duplicate complete component styles per theme. Prefer semantic CSS variables and targeted overrides.

## Personalization module

Visual branding is controlled through **Dashboard → Personalización**.

Current editable assets:

- logo for light backgrounds;
- logo for dark backgrounds;
- favicon.

Guidelines:

- transparent PNG, WebP or SVG for logos;
- SVG or square PNG preferred for favicon;
- maximum upload size: 2 MB per asset;
- preserve original logo aspect ratio;
- do not apply arbitrary recoloring to uploaded logos.

The module is designed to expand later with color, typography and other visual settings.

## Application shell

- desktop uses a persistent institutional sidebar and a compact floating workspace header;
- the workspace header is contextual only: it identifies the current module and optional organization, but does not duplicate the sidebar navigation;
- the sidebar is the single desktop navigation source and clearly marks the active module;
- authenticated account actions live in a compact bottom-of-sidebar account menu that opens upward;
- global settings are accessed from that account menu rather than occupying permanent navigation space;
- the authenticated workspace uses the available viewport width up to a large enterprise content ceiling instead of a narrow centered column;
- surfaces use restrained elevation, subtle gradients and teal accents to communicate a modern technology product without overdecorating the maintenance UI.

## Components

### Cards
- subtle border;
- restrained shadow;
- 14px radius.

Company directory cards use a horizontal point-of-reference cover, a centered circular logo, location metadata and compact operational metrics. Missing legacy images use branded fallbacks.

Card details open in a modal with read-only fields by default. Editing must be explicitly enabled, saving requires confirmation, and destructive deletion requires a separate irreversible-action confirmation.

### User administration
- user creation and editing use an in-app modal instead of a permanently visible form;
- empty directories show a clear empty state with one primary creation action;
- role selection must show a plain-language explanation of the permissions being granted;
- validation errors stay inside the modal and preserve all entered values until the user explicitly cancels;
- user cards expose status, role, company, site and last access;
- destructive account actions require branded confirmation and preserve operational history.

### Confirmation dialogs
- application confirmations must use the branded in-app dialog instead of browser-native `window.confirm()`;
- default confirmations use Desweb teal/mint accents;
- irreversible actions use the semantic danger treatment and explicit action labels;
- dialogs must support Escape, backdrop cancellation, keyboard focus, light/dark themes and reduced-motion preferences;
- confirmation copy should explain the consequence rather than rely on generic “Aceptar” wording.

### Buttons
Primary: Desweb teal with white label.  
Secondary: neutral surface with theme-aware text.

### Inputs
- visible labels;
- semantic surface/background;
- teal focus state;
- 9px radius.

### Tables
- semantic surface;
- soft row borders;
- theme-aware header background.

### Status
Semantic red/amber/green remain available where operational meaning requires them.

## Accessibility

- sufficient contrast in both themes;
- visible focus state;
- no status conveyed through color only;
- avoid tiny essential text;
- uploaded branding must not compromise readability.


## Public marketing surfaces

The public landing and self-hosted/download pages are commercial product surfaces, not internal admin screens.

Required principles:

- retain the Desweb palette and product identity;
- use a professional technology/SaaS visual language with strong hierarchy and generous spacing;
- communicate product value before implementation details;
- show the CMMS through illustrative product UI rather than generic decoration;
- landing navigation must expose solution, workflow, plans, login and self-hosted entry points;
- plan cards must communicate capacity clearly without inventing unapproved prices;
- technical-beta notices must be visually secondary to the product proposition;
- `/downloads` and `/descargas` must resolve to the same self-hosted information experience during beta.


## Login public navigation

The login screen remains authentication-first and must not duplicate the full marketing landing.

Public navigation allowed from login:

- **Inicio**;
- **Ver planes**;
- **Self-hosted**;
- clickable Desweb logo returning to Home;
- a compact post-form CTA to start the 15-day Trial.

Do not expose operational modules before authentication. Do not show password-recovery affordances until a real recovery flow exists.


## Global visual direction

Desweb CMMS should consistently feel **fresh, modern and technological** across public and authenticated surfaces.

For public/commercial pages, the preferred visual language is:

- dark control-center backgrounds;
- subtle technical grids and circuit-like separators;
- Desweb teal/mint as the primary glow/accent family;
- restrained glass/translucent surfaces;
- data visualization and operational telemetry as decoration with product relevance;
- compact, high-contrast typography and strong information hierarchy;
- premium SaaS feel without copying third-party layouts or brand identities.

The landing reference direction is inspiration only. Do not reproduce third-party artwork, logos, exact compositions or proprietary visual assets.

Avoid:
- generic neon-blue cyberpunk styling that ignores Desweb colors;
- oversized decorative gradients without product meaning;
- generic stock illustrations;
- fake customer logos, testimonials or performance claims;
- excessive animation that harms readability.

Authenticated product surfaces should stay calmer than the public landing while preserving the same technological DNA.


## Public landing conversion architecture

The public landing is not only a product brochure. It is a commercial acquisition surface with two conversion paths:

1. self-service Trial/plan checkout;
2. advisor-assisted lead capture.

Header requirements:
- always use the configured Desweb logo rather than a text-only substitute;
- preserve logo legibility in both light and dark themes;
- include a compact light/dark switch;
- keep navigation focused on Solution, Workflow, Plans, FAQ, Contact and Self-hosted;
- keep Login/Dashboard and Trial CTA visually distinct.

Footer requirements:
- repeat the configured Desweb identity at a larger, legible size;
- group links by Product and Start/Conversion;
- include a direct advisor CTA;
- retain a compact legal/copyright strip.

The landing supports both light and dark appearance using the same `desweb-theme` preference used elsewhere in the product.


## Landing header and theme policy

The public CMMS landing is intentionally **dark-only**. The authenticated application may continue to support light/dark/system themes independently.

Header:
- use a floating, compact white navigation surface over the dark landing background;
- use the configured Desweb logo for light backgrounds;
- preserve generous horizontal breathing room around the logo;
- navigation should remain visually light, with one prominent conversion CTA;
- mobile reduces navigation to brand + primary CTA.

Footer:
- remains dark and uses the dark-background/negative logo variant when available;
- groups Product, Start and advisor-conversion links;
- may use restrained geometric brand accents derived from the Desweb identity system.
