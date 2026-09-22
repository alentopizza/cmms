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


## Public wording for downloadable deployment

Use **Instalación propia** in customer-facing navigation and marketing instead of the technical term **Self-hosted**.

The technical documentation may continue to use `self-hosted` when discussing architecture, Docker or deployment internals, but public CTAs, menus and sales copy should prefer terminology a non-technical buyer can understand.


## Global branding editor

Superadministrator global branding must be directly visible inside **Configuración**, not hidden only behind a secondary module link.

The editor uses three visual asset cards:

- logo for light backgrounds;
- logo for dark backgrounds;
- favicon.

Each card must show:
- current preview;
- intended usage;
- accepted formats;
- maximum file size;
- recommended pixel dimensions;
- file input.

Current constraints:

| Asset | Accepted formats | Maximum | Recommended |
| --- | --- | ---: | --- |
| Light-background logo | PNG, JPG, WebP, SVG | 2 MB | transparent, approximately 1200×320 px |
| Dark-background logo | PNG, JPG, WebP, SVG | 2 MB | transparent, approximately 1200×320 px |
| Favicon | ICO, PNG, WebP, SVG | 2 MB | square, 64×64 or 128×128 px |

The legacy dedicated personalization route may remain available, but **Configuración** is the primary Superadministrator entry point.


## Retractable personalized sidebar

The authenticated dashboard uses a technology-oriented dark sidebar with a vertical teal/cyan accent rail inspired by compact smart-control interfaces.

Behavior:
- expanded mode shows icon + module label;
- collapsed mode shows the module icon rail;
- desktop users can collapse/expand the sidebar;
- mobile uses an overlay drawer;
- active modules use a high-contrast teal capsule/icon treatment;
- the account/configuration control remains anchored at the bottom.

### User-defined module order

Visible modules can be reorganized per user.

- Use **Organizar** to enter reorder mode.
- Desktop supports drag and drop.
- Up/down controls provide an accessible and touch-friendly alternative.
- **Restaurar** returns to the permission-filtered default module order.
- A user can only reorder modules they are authorized to see; reordering never grants access to hidden modules.
- Real database-backed users persist order and collapsed state in `user_dashboard_preferences`.
- The environment bootstrap Superadministrator has no user row, so its preference uses browser-local storage as a fallback.

Navigation preference is presentation state only. Authorization and routing continue to come from the server-side permission model.


## Company Profile v2 visual pattern

The full company page is a structured enterprise profile, not a long CRUD form.

Visual hierarchy:

- cover image and logo establish organization identity;
- status + plan + profile-completeness summary are visible in the hero;
- sticky local navigation links to Summary, Information, Documents, Sites and Resources;
- legal/administrative information uses calm card surfaces and clear field groups;
- operational sites remain visually and semantically separate from the enterprise address;
- corporate documents use compact dossier cards with visible status, dates, file metadata and actions.

Document states must use both text and color:

- Vigente;
- Próximo a vencer;
- Vencido;
- Pendiente;
- Sin archivo;
- No aplica.

The directory company card may show plan, profile completion and documentation health, but it should stay scan-friendly. The existing modal remains a quick-view/quick-edit surface; the full enterprise page is the canonical detailed workspace.


## Unified module directory pattern

All primary CMMS directory modules should use the shared module-directory visual language.

### Header

Use a clean header with:

- module eyebrow/category;
- module title;
- short operational description;
- keyword search;
- contextual filter;
- one primary **Agregar** action with an icon that represents the entity.

Avoid secondary information bands between the header and directory unless they communicate an actual operational prerequisite or warning. In particular, the former **Roles en uso** summary band is not part of the general pattern.

### Creation

Creation from a directory must open a modal/popup instead of permanently occupying page space.

Modal rules:

- use the shared wide modal treatment;
- target approximately 1040 px maximum width on desktop;
- reflow to one column on narrow screens;
- preserve the same server-side validation and authorization as the previous inline form;
- use useful example placeholders, not generic labels repeated as placeholders;
- keep contextual creation preselection when entering from a parent record.

Examples:

- `Carrera 15 # 93-47, Bogotá`
- `HVAC-001`
- `Servicios Técnicos Andinos S.A.S.`
- `Almacén técnico · Estante A-03`

### Search and filter

Directory records expose searchable text and a normalized status. Search/filtering is a presentation layer over the already-authorized result set and must never replace server-side authorization or tenant/site scoping.

### Company cards

Company cards use:

- wide cover image;
- circular logo overlapping the cover;
- centered company identity and status;
- plan indicator;
- operational resource rows and quota progress only where a real enforced quota exists;
- no fabricated quota for resources that are currently unlimited.

The layout should remain readable in two columns on wide screens and one column on narrow screens.


## Creation hierarchy blocker pattern

When a module cannot create its entity because a prerequisite is missing, do not leave a disabled form or a vague error.

Show the shared prerequisite state, visually aligned with the Users empty state:

- entity/process icon;
- eyebrow describing the creation hierarchy;
- explicit blocking title;
- one sentence explaining exactly what exists and what is still missing;
- one primary CTA that navigates to the earliest missing prerequisite.

Examples:

- no company → **Primero debes crear una empresa** → **Crear empresa**;
- company exists but no principal location → **Primero debes crear una ubicación principal** → **Crear ubicación**;
- location exists but no sub-location → **Primero debes crear una sububicación** → **Crear sububicación**;
- physical hierarchy exists but supplier is missing → **Primero debes registrar un proveedor**;
- crew without executable staff → **Primero debes crear personal ejecutor**;
- work order or routine without an asset → **Primero debes registrar un activo**.

The CTA must point to the earliest missing dependency, not merely the immediately previous module.

When the prerequisite state is visible, suppress duplicate generic empty-state copy such as “No records yet”.


## Mobile navigation strategy

Dashboard navigation adapts by role instead of forcing the desktop sidebar pattern onto every mobile user.

### Drawer navigation

Roles with broad/module-heavy access use a hamburger-triggered drawer on screens below 900px.

This applies to:
- Platform Owner;
- Superadministrator;
- Company Administrator;
- Manager / Supervisor;
- Requester;
- Viewer;
- Provider and other roles with broader module discovery needs.

The drawer reuses the same permission-filtered navigation items as desktop.

### Field bottom navigation

Technician and External collaborator roles use a mobile-first bottom navigation inspired by native field-service apps.

Priority destinations:
- Dashboard;
- Orders;
- Attendance;
- Assets;
- More.

The active destination lifts visually above the bar. **More** opens the full permission-filtered drawer for secondary modules.

The bottom navigation:
- must never become a separate authorization source;
- must use the same routes and permission-filtered items as desktop;
- must respect mobile safe-area insets;
- must leave enough bottom content padding so controls are not obscured;
- must remain compatible with light/dark and organization white-label colors.

This pattern is intentionally reusable for a future PWA/native shell so module screens require minimal visual restructuring.


## Dashboard single-header rule

The root Dashboard follows the same module-shell pattern as the rest of the authenticated application.

Do not render a second introductory hero/header below the global context header.

The first context header is the single source for:
- module name;
- module category/eyebrow;
- current company when available, otherwise authenticated role context.

Dashboard-specific controls belong below that header:
- date range;
- state filters;
- export actions;
- KPI cards.

Avoid repeating role, title, explanatory copy or period in a second large panel when those elements are already represented by the shared shell and filter controls.


## Dashboard export menu

Dashboard exports are consolidated under one **Exportar** control instead of separate format buttons.

The menu exposes:
- **Excel (.xlsx)**: styled workbook with executive summary, status/type distributions, detailed data and metadata;
- **CSV (.csv)**: flat UTF-8 dataset suitable for Power BI / Power Query and general interoperability;
- **PDF (.pdf)**: executive report with KPI cards, charts, detailed records and corporate letterhead styling.

### PDF letterhead

Desweb platform/non-Pro PDF reports follow the supplied A4 landscape letterhead language:
- centered Desweb identity at the top;
- large pale brand watermark in the document body;
- clean white business-report canvas;
- Desweb slogan centered near the footer;
- page number at the lower-right corner.

The report data overlays this stationery while preserving sufficient white space and legibility.

Pro white-label tenants retain the same report composition but substitute their own:
- name/logo;
- primary and secondary colors;
- watermark initial/brand treatment;
- Desweb attribution according to `show_desweb_branding`.

A future portrait/vertical stationery variant should plug into the same report renderer without changing export permissions, filtering or dataset semantics.
