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


## Dimensional glass visual language

Desweb CMMS uses a restrained dimensional-glass visual language for interactive surfaces.

The reference direction is modern liquid-glass UI, adapted to a professional CMMS rather than copied literally.

### Principles

- Preserve Desweb brand colors as the primary visual identity.
- Use depth, translucency and luminous edges to make controls feel interactive.
- Keep the resting state calm; stronger glow belongs to hover, focus and selected states.
- Avoid decorative neon that competes with data readability.
- Do not reduce contrast for labels, tables, metrics or operational status information.
- Light and dark themes must remain equally usable.
- Mobile variants must preserve the same interaction hierarchy with lower visual density.

### Buttons

Primary buttons use:
- teal dimensional gradient;
- subtle highlight rim;
- inner highlight;
- soft elevation shadow;
- slightly stronger hover glow.

Secondary buttons use:
- translucent neutral surface;
- visible border;
- mild depth;
- teal-accent hover.

### Inputs and selects

Text fields, search boxes and selects use:
- subtle inset surface;
- dimensional border;
- calm resting shadow;
- stronger teal focus ring and depth when active.

### Cards and module surfaces

Headers, cards and analytical panels may use:
- semi-translucent surfaces;
- controlled backdrop blur;
- soft gradient highlights;
- one clear elevation level.

Visual directory cards such as Companies, Locations and Users receive stronger hover elevation while retaining predictable card geometry.

### Tabs and selectable controls

Active tabs, checkbox cards and segmented controls use a glass-capsule selected state with:
- brand edge;
- light elevation;
- subtle luminous accent;
- no exaggerated glow.

### Modals and popovers

Modals, menus and popovers are the highest visual layer:
- stronger blur;
- deeper shadow;
- bright surface rim;
- clear separation from the backdrop.

The backdrop itself remains darkened and blurred without obscuring context completely.

### Accessibility

- Focus-visible states must remain obvious.
- Do not rely on glow/color alone to communicate state.
- Preserve text labels and status text.
- Respect `prefers-reduced-motion`.
- Maintain sufficient hit areas on mobile.


## Reference-grid component standard

The supplied UI guide is now a canonical geometry and hierarchy reference for Desweb CMMS. It is adapted to the Desweb identity rather than copied literally.

### Core scales

Use these shared scales across authenticated modules, public/conversion pages and future mobile/PWA surfaces:

- **Elevation:** Base, Raised, Inset and Deep.
- **Visual priority:** Level 1 Important through Level 5 Optional.
- **Border thickness:** 1 px fine, 2 px standard/selected and 4 px strong semantic accent.
- **Radius scale:** 4, 8, 12, 16 and 24 px.
- **Icon scale:** 16, 20 and 24 px. Icon strokes should visually approximate 2 px where vector icons are used.
- **Spacing rhythm:** 16 px for normal component spacing and 24 px for larger content/feedback separation.
- **Control height:** approximately 42 px desktop and 44 px mobile for primary interactive controls.

These values are exposed in `app/globals.css` through the `--ui-*` design tokens and should be reused instead of inventing local geometry.

### Elevation rules

**Base** is the default card/container level. Use a restrained shadow and fine border.

**Raised** is for hover, selected navigation, featured cards and interactive emphasis. It should be visibly above Base without becoming decorative.

**Inset** is for input wells, pressed controls and selected/toggle interiors. It should communicate physical depth without lowering contrast.

**Deep** is reserved for modals, popovers, checkout/login hero containers and decision layers. Do not use Deep elevation for ordinary directory cards.

### Buttons and controls

- Primary actions are priority level 1 and use Desweb teal with dimensional depth.
- Secondary actions use a neutral raised surface and visible border.
- Pressed states use inset depth rather than only a color change.
- Disabled controls reduce saturation/elevation and must keep a clear disabled cursor/state.
- Inputs, selects and textareas use inset wells with an explicit Desweb teal focus ring.
- Native checkbox, radio and range controls use the Desweb accent color while retaining browser semantics and accessibility.
- Compact icon actions use the 36 px tier; normal primary controls use the 42/44 px tier.

### Navigation

Tabs and segmented navigation remain visually calm at rest. The active item uses a raised state with a clear text/state cue. Mobile bottom navigation follows the same geometry and must not introduce a separate visual language.

### Data display

Tables use a 16 px outer radius, fine border and Base elevation. Status labels remain pill-shaped and combine text with semantic color. Directory cards may rise one level on hover but should preserve stable geometry.

### Feedback and empty states

- Success/error notices use Base/Raised surfaces with a 4 px semantic edge accent where appropriate.
- Confirmation dialogs use Deep elevation and a 24 px radius.
- Empty/prerequisite states use a bounded 16 px container; dashed borders are acceptable when communicating absence rather than an error.
- Loading and future skeleton components should use the same radius/spacing scale rather than bespoke shapes.

### Public and conversion surfaces

The same geometry applies to landing, login, checkout and lead forms, but color rules remain context-specific. In particular, the public landing remains intentionally dark-only; the reference guide does not override that product decision.

### Implementation rule

When creating or redesigning a component, select values from the shared `--ui-*` scales first. A new radius, shadow, icon size or spacing value should only be introduced when the existing scale cannot satisfy a documented functional need.


### Landing account access control

The public landing header uses a compact icon-only account control instead of text such as **Ir al panel** or **Iniciar sesión**. The destination is session-aware: unauthenticated visitors go to `/login`, while authenticated users go directly to `/dashboard`.

The control follows the shared reference-grid rules: 20 px user icon, 42 px desktop control height, 38–40 px compact mobile size, 12 px radius tier, Base elevation at rest, Raised on hover and Inset on press. It must remain visible on mobile next to the trial CTA.

### Export popover stacking rule

Dropdowns that visually escape a dashboard toolbar must elevate the toolbar's stacking context while open. Raising only the child popover is insufficient when later content participates in another stacking context. Dashboard export therefore marks the filter bar as open, keeps overflow visible and raises the parent plus popover above following panels.


### Mobile dashboard header and drawer

The dashboard mobile menu is part of the contextual header, not a floating control detached from it. A dedicated mobile navigation slot keeps the hamburger aligned with the current module identity.

For drawer-mode roles below 900 px:

- the hamburger uses the compact 40 px control tier inside the contextual header;
- opening navigation locks page scroll;
- the drawer is a fixed, full-height mobile layer above the overlay;
- the overlay uses dark translucency without backdrop blur so it cannot visually obscure or wash out the drawer;
- the drawer explicitly overrides legacy generic `.sidebar{display:none}` mobile rules;
- the open drawer remains interactive and visible through explicit visibility, opacity and pointer-event states;
- the sidebar collapse control becomes a close control while the mobile drawer is open;
- navigation closes on route change, Escape, overlay tap or module selection.

Field-role bottom navigation continues to hide the header hamburger and uses **Más** to open the same authorized drawer.

### Landing account icon contrast

The compact landing account button uses a stronger mint surface, darker icon color and thicker 20–22 px user-icon stroke so the action remains visible against the white floating landing header on mobile.


### Mobile contextual-header alignment

On drawer-mode mobile layouts, the hamburger remains anchored on the left side of the contextual header. The current-module identity is aligned to the right: the module icon sits at the far-right edge and the eyebrow/title/context copy sits immediately to its left with right-aligned text. This preserves a clear left navigation affordance while visually separating it from the current module identity.


### Opaque decision-layer rule

Glass/translucent surfaces are not used for components where the user must read, choose or confirm information. Popovers, dropdown panels, date pickers, account menus, contextual action panels and modals use an opaque surface so underlying page text cannot remain visible through the component.

The rule is:

- ordinary cards and contextual surfaces may retain restrained glass/depth treatment;
- reading and decision layers use solid `--overlay-surface` / `--overlay-surface-soft` tokens;
- shadows and borders provide depth instead of background transparency;
- sticky modal headers/action bars use the same opaque surface as the modal body;
- dark mode uses an equally opaque dark surface;
- backdrop blur may remain on the page backdrop where useful, but never as a substitute for an opaque popup body.


### Sticky module-header contrast

The shared contextual header must remain visually distinct from scrolling module content. It uses a dedicated opaque module-header surface rather than the same white/card surface used by directories and panels.

- Light mode uses a restrained mint/blue-gray surface with a stronger lower elevation shadow.
- Dark mode uses a deeper blue-gray surface than the normal content cards.
- A subtle Desweb teal lower accent reinforces the separation without becoming decorative.
- The header remains opaque and does not depend on backdrop blur for readability.
- This rule applies to every authenticated module that uses the shared `.context-header` shell, including mobile.


### Compact directory-card pattern

Company and principal-location directories use a compact card pattern optimized for dense operational browsing.

- Desktop target is four cards per row when workspace width allows it; responsive breakpoints reduce to three, two and one columns.
- Cover imagery is shallow and identity circles are smaller than the previous directory cards.
- The main card body is a dedicated click target for opening detail; resource shortcuts are separate interactive links so nested-button/link markup is never used.
- Resource shortcuts use icon + `used/assigned` for company entitlements, with a tooltip naming the resource on hover/focus.
- Each resource shortcut navigates to its associated module: locations/sublocations → Locations, assets → Assets, inventory → Inventory, technicians → Users.
- Location cards use the same compact pattern and expose direct shortcuts for their sublocations and assets.
- Tooltip information must also be available through `title`/accessible labels so mouse and keyboard users receive equivalent context.

### Company logo creation rule

A company logo is mandatory when a company is created. The requirement is enforced both by the browser form and the server endpoint. The logo is the default identity image shown inside the circular company mark throughout company and location directory cards. A company cover/reference image is optional and must never replace the logo as the circular identity asset.


### Company profile detail pattern

The company quick-detail modal uses a structured profile layout instead of a tall free-form form.

- A shallow hero/cover is separated from the identity block so the company name never overlaps or disappears over imagery.
- Logo, status, plan, legal identity and primary-site context form one clear identity region.
- Quick actions provide direct access to Locations, Assets, Users and the full company record.
- Executive summary cards expose profile completion, locations, assets and documentation state.
- Long-form content is organized into accessible native `details/summary` accordions: General information, Primary site and coverage, Resources and consumption, Documentation/compliance and Visual identity.
- The primary-site coverage accordion is the insertion point for interactive map/geofence controls in the next phase.
- Mobile reduces the hero height, stacks actions and accordions, and keeps the entity name readable above all secondary metadata.

### User photo versus biometric enrollment

A profile photo is mandatory when a user account is created and is used for human-readable identity in directories/cards. It is **not** the biometric reference used for attendance verification.

Biometric enrollment remains a separate live-camera flow with liveness/anti-spoof checks. Attendance-controlled users must enroll a live facial template before field biometric verification can succeed. The encrypted facial template is distinct from the stored profile photo.


### Site geofence map pattern

Principal sites use an interactive map/geofence component wherever their physical position is created or edited.

- The administrator enters a human-readable address and explicitly validates it.
- Address validation returns candidate results; choosing one sets latitude/longitude.
- The marker can then be adjusted manually by selecting a point on the map.
- **Use my location** requests browser geolocation and may be used when the administrator is physically at the site.
- A visible circular overlay represents the permitted geofence radius.
- Radius is configurable between 20 and 5000 metres and is shown together with the exact stored coordinates.
- Read-only company/location detail surfaces show the same map and radius without editing controls.
- Map bodies are operational/reading layers and therefore follow the opaque-surface rule around their surrounding UI.
- Mobile keeps the map touch-safe, stacks coordinates/radius vertically and preserves the same validation semantics.

The map is not decorative: the saved latitude, longitude and radius are the same site values consumed by attendance verification.


### Field presence start workflow

The mobile attendance experience is modeled as **presence in site**, not as an assigned-task prerequisite.

- A field user may start a biometric shift even when zero work activities are assigned.
- The UI communicates this as **En sitio y disponible** rather than implying that a task is already in progress.
- Geolocation is validated before opening the camera, avoiding unnecessary facial capture when GPS permission, accuracy or geofence conditions fail.
- When multiple authorized sites exist, the nearest configured site inside its geofence may be selected automatically from the current GPS fix; the server remains authoritative.
- The presence workflow presents GPS, geofence and facial verification as explicit sequential steps.
- The main mobile action is **Iniciar actividades** / **Finalizar actividades**; these actions open/close the attendance shift, not a work-order task.
- A compact map can show the configured site point, radius and current-device marker during presence validation.
- Camera UI is only surfaced during live enrollment or verification.


### Supervised biometric enrollment pattern

The Attendance module provides a dedicated administrator/manager enrollment surface.

- Person and enrollment site are explicit selections.
- The selected user's profile photo is shown as a human verification aid.
- Users without a profile photo are visibly ineligible until their profile is completed.
- Identity-verification and consent confirmations are separate controls.
- The camera remains off until the supervisor starts enrollment.
- Statuses distinguish **Verified**, **Requires reenrollment**, **Revoked** and **No biometric**.
- Field users with no verified supervised template see a blocked explanatory state rather than a self-enrollment button.
- Enrollment/revocation updates remain visually distinct from normal attendance check-in/out.


### Field mobile navigation and directory pattern

Field-role mobile navigation is a persistent safe-area-aware bottom bar with four primary operational modules and a **Más** action. **Más** must not duplicate the primary items. It opens a bottom sheet containing only secondary authorized modules plus account/system actions such as Configuration and Sign out.

Mobile module directories must not force desktop tables into the viewport. Modules with dense columnar data should provide a compact card/list representation below 700 px while keeping the desktop table for larger widths. Orders and Assets are the first field-directory references. Both switch from desktop tables to compact cards on small screens while preserving the same search/filter data attributes.

The mobile workspace must reserve bottom padding equal to the navigation height plus device safe-area inset so content never hides behind the fixed navigation.


### Attendance contingency pattern

Biometric/geolocation contingency is an explicitly exceptional UI state, not a hidden bypass.

- Field users with a previously supervised biometric identity may submit a contingency request for check-in or check-out when camera, GPS, geofence, connectivity or device failures prevent the normal flow.
- The request captures site, action, reason, user explanation and whatever diagnostic/location evidence is available.
- Pending and approved states are visually distinct.
- Approval is temporary, single-use and displayed with its expiration time.
- Supervisor review cards show subject, role, site, affected event, reason, diagnostic accuracy and an optional review note.
- Reports expose contingency counts separately from ordinary attendance.
- Contingency styling uses warning/exception semantics and must never visually imply ordinary biometric verification.


### User manual / help-center pattern

The help center is hybrid rather than role-exclusive.

- Authenticated users land on content prioritized for their actual role.
- A **Toda la plataforma** option explains the overall workflow and how modules relate.
- Public `/manual` shows general platform guidance without private tenant context.
- Articles are collapsible process cards with module, purpose, ordered steps, notes and optional direct module action.
- Search operates over titles, summaries, keywords, steps and notes.
- **Qué cambió** highlights user-relevant product changes.
- Mobile uses one-column cards and full-width actions.


### Rutinas and Inventario mobile directory pattern

Rutinas and Inventario follow the same mobile directory rule used by Activos and Órdenes: desktop keeps the dense table, while screens at 700 px or less render compact cards.

- Rutinas cards prioritize routine name, asset, frequency and next due date.
- Inventario cards prioritize SKU, item, current stock, minimum, physical location and supplier.
- Low stock receives a distinct warning badge.
- The field workspace continues reserving bottom space for the fixed mobile navigation.

### Dark-mode form/dropdown contrast

Dark mode must explicitly style form controls inside modals/popovers. Native `select`, `option` and `optgroup` surfaces use a dark background and light text, and modal headers/actions remain on opaque theme surfaces. Never rely on browser-default white dropdown surfaces in dark mode.


### Google Maps geofence provider

Google Maps Platform is the preferred production cartography/geocoding provider.

- Google Maps JavaScript API renders the interactive map and geofence.
- The server Geocoding API validates/searches addresses.
- Browser/device GPS remains the source of the user's physical position.
- The server remains authoritative for geofence distance checks.
- OpenStreetMap remains a temporary operational fallback when Google credentials are missing or unavailable.
- A Google Map ID may be supplied for cloud-based light/dark styling without changing geofence logic.


### Branded geofence marker

Configured company/site maps use a branded center marker inspired by navigation apps: a circular company logo with white separation ring, subtle shadow and location tail. The geofence circle remains independent and visible around that marker. If no logo exists, the map falls back to initials/default pin.

In location edit mode only one interactive map is rendered. The previous read-only duplicate is replaced with a compact geofence summary; read-only/detail mode may still render the map for reference.

Google Places autocomplete must visually inherit the product theme: light surface by default and dark surface only when the user explicitly selected dark mode.


### Three geofence location methods

Editable site geofences provide three equivalent ways to establish the center point:

1. **Google Places autocomplete** for known addresses/places.
2. **Usar mi GPS** for the device's current physical location.
3. **Draggable map marker** for manual visual adjustment.

The branded Advanced Marker is draggable only in edit/create mode. Dropping it updates latitude/longitude and recenters the geofence; read-only maps keep the marker fixed.
