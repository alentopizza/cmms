# Project context

## Product identity

**Desweb CMMS** is a commercial, multi-tenant Computerized Maintenance Management System (CMMS) for managing companies, physical locations, assets, maintenance work, preventive plans, inventory and maintenance teams.

Primary hosted environment:

`https://cmms.desweb.cloud`

Repository:

`alentopizza/cmms`

Primary deployment:

Easypanel + Docker + PostgreSQL.

The project is also being prepared for a licensed, downloadable/self-hosted distribution using Docker Compose.

## Product direction

Desweb CMMS is not being built as a one-off internal application. The product direction is a reusable SaaS platform with:

- isolated customer organizations;
- role- and site-scoped access;
- monthly commercial subscriptions;
- Trial, Básico, Medio and Pro tiers;
- server-enforced resource entitlements;
- a 15-day trial experience;
- future payment-provider integration through verified webhooks;
- advisor-assisted sales through the Superadministrator;
- self-service acquisition through a public landing;
- Pro organization white-label customization;
- eventual downloadable/self-hosted licensed distribution.

The repository documentation is intentionally maintained as the source of truth so future AI agents and developers can resume without reconstructing decisions from conversations.

## Current architecture

Core stack:

- Next.js 16
- React 19
- TypeScript
- PostgreSQL
- direct SQL through `pg`
- ordered immutable SQL migrations
- Docker
- Easypanel in the primary hosted environment

The application runs pending migrations before starting the production server.

## Implemented product foundation

### Multi-tenancy and companies

- organizations are the tenant boundary;
- companies can be created, edited, activated/deactivated and deleted according to protected lifecycle rules;
- companies support persistent logo and cover images;
- each organization may have multiple principal sites;
- principal sites contain recursive sublocations;
- operational queries are tenant scoped.

### Authentication and roles

Authentication supports:

- an environment-configured bootstrap **Propietario Desweb / Platform Owner** for emergency/developer access;
- database-backed application users with scrypt password hashing;
- signed HTTP-only session cookies.

Active organization roles:

- Administrador de empresa;
- Manager / Supervisor;
- Técnico;
- Solicitante;
- Consulta;
- Proveedor de servicios;
- Colaborador externo.

The redundant `owner` role was removed. Administrador de empresa is the highest organization-level role.

The platform-governance hierarchy is being implemented incrementally. **Platform Owner is now active**; sales/distribution roles remain pending:

- **Propietario Desweb / Platform Owner** — implemented maximum platform authority; the current project-owner account is `admin@dominio.com`, and it is the only role allowed to create/revoke Superadministrators;
- **Superadministrador** — trusted Desweb platform operator that provisions/supports customers but cannot create peers or the Platform Owner;
- **Comercial Desweb** — internal sales/advisor role with commercial scope rather than unrestricted maintenance administration;
- **Partner / Distribuidor** — external distribution role restricted to its authorized portfolio;
- customer-side roles continue below the tenant boundary, with **Administrador de empresa** as the highest customer role.

The detailed target permission model, user-creation matrix, role descriptions and destructive-operation rules are maintained in `docs/ROLE_MODEL.md`. During development, Platform Owner bypasses normal RBAC permission restrictions across modules. Database referential integrity and explicit lifecycle safeguards remain separate from RBAC until controlled destructive workflows are implemented.

### User administration

The user-management module supports:

- modal creation/editing;
- inline validation without losing entered data;
- organization assignment;
- role assignment;
- all-site or explicit multi-site scope;
- account activation/deactivation;
- permanent deletion only when operational history does not require retention;
- server-side tenant and site authorization.

### Operational modules

Current foundations exist for:

- dashboard summary;
- locations and recursive sublocations;
- supplier directory with materials/services/both classification;
- internal technicians, provider accounts and external collaborators;
- crews with a leader and mixed internal/external membership;
- assets/equipment with required supplier + sublocation relation on new records;
- inventory with required supplier + sublocation relation on new records;
- work orders;
- work-order activities with person/crew/service-supplier assignment and execution state;
- preventive maintenance;
- meters/readings;
- attachments;
- audit records.

The operational modules are still being expanded; see `docs/ROADMAP.md`.

Operational creation now follows a mandatory dependency chain: company → principal location → sublocation → suppliers → executable workforce/crews → assets/inventory → work orders/activities. The same prerequisites are checked in the UI and server-side mutation routes.

## SaaS commercial model

The current catalog contains four plans.

### Trial

- 15 days;
- 1 principal site;
- 10 sublocations;
- 25 assets;
- 25 inventory items;
- 2 technicians;
- Desweb branding.

When the trial expires, tenant data is retained but operational dashboard access is blocked until a paid plan is activated.

### Básico

- 3 principal sites;
- 50 sublocations;
- 150 assets;
- 250 inventory items;
- 5 technicians.

### Medio

- 10 principal sites;
- 250 sublocations;
- 750 assets;
- 1,000 inventory items;
- 20 technicians.

### Pro

- 30 principal sites;
- 1,000 sublocations;
- 3,000 assets;
- 5,000 inventory items;
- 75 technicians;
- organization white label.

Prices are not finalized and must not be invented in implementation.

Commercial details live in `docs/COMMERCIAL_MODEL.md`.

## Subscription model

Implemented subscription states:

- `trialing`
- `trial_expired`
- `active`
- `past_due`
- `suspended`
- `canceled`

Paid plans are intended to renew monthly.

Current public checkout is explicitly a **test/simulated checkout** for validating provisioning and upgrade flows. It does not process real payments.

Future real payments must use a payment provider's hosted checkout and verified server-side webhooks.

## Resource entitlements

Plan defaults live in `billing_plans`.

Current subscription state lives in `organization_subscriptions`.

Effective operational limits live in `organization_limits`.

This separation is deliberate:

- plans define reusable defaults;
- effective limits are what server-side creation guards enforce;
- Superadministrators can negotiate company-specific overrides without modifying the shared plan.

Company administrators can see their assigned capacity and consumption but cannot modify contractual limits.

Consumption health:

- below 80% = normal;
- 80–94% = warning;
- 95%+ = critical;
- creation at capacity must fail server-side.

## Settings and customization

### Superadministrator

Global settings include platform appearance and global Desweb branding. The Superadministrator branding editor is directly embedded in Configuración and exposes the light-background logo, dark-background logo and favicon with previews, accepted formats, file-size limits and recommended dimensions.

### Company administrator

Company settings include:

- company information;
- current plan/subscription;
- subscription start and end/renewal dates;
- resource consumption and remaining capacity;
- capacity warning/critical states;
- a **Mejorar plan** action that returns to public plan selection and updates the effective subscription after checkout;
- links to tenant user/location administration.

### Pro white label

Pro company administrators may configure tenant-specific:

- platform/app name;
- primary color;
- secondary color;
- light-background logo;
- dark-background logo;
- visibility of the Desweb footer signature.

Non-Pro tenants use the global Desweb branding.

## Navigation/UI direction

The public landing follows a premium dark control-center visual direction with Desweb teal/mint telemetry accents, technical grid treatments and product-relevant dashboard visualization. The landing itself is dark-only; the authenticated product may still support light/dark/system appearance. The public header uses a floating light navigation surface with the principal Desweb logo and no adjacent CMMS label, while the footer remains dark and uses the appropriate dark-background logo variant. Public commercial wording uses **Instalación propia** instead of the less familiar term **Self-hosted**; technical documentation may still use self-hosted where precise.

The public login intentionally includes only lightweight navigation back to Home, Plans and Self-hosted, plus a 15-day Trial CTA. It does not expose operational modules before authentication.

The authenticated desktop interface uses:

- one persistent sidebar as the primary module navigation;
- a contextual floating header that identifies the current area rather than duplicating navigation;
- account/settings actions at the bottom of the sidebar;
- light/dark/system appearance preferences under Configuración;
- modern technology-oriented surfaces while retaining Desweb brand tokens.

UI conventions are documented in `docs/DESIGN_SYSTEM.md`.


### Reference-grid UI standard

The application now uses a sitewide component geometry system derived from the approved style reference. Shared CSS tokens define elevation, radius, border, icon-size, control-height and spacing scales, and they apply across authenticated modules, the responsive/mobile shell, public landing, login and checkout surfaces. Desweb color identity, dark/light behavior and tenant white-label rules remain authoritative over reference-image colors.

## Sales flows

### Self-service

Target flow:

```text
Landing
 -> choose plan
 -> payment provider hosted checkout
 -> verified webhook
 -> provision organization
 -> create company administrator
 -> activate subscription
 -> immediate access
```

The current landing implements the same provisioning concept with a simulated checkout. The public landing is intended to be a professional commercial surface, even during beta; technical checkout limitations are disclosed without dominating the value proposition.

The landing also has an advisor-assisted conversion path. Public contact/demo requests are stored in `sales_leads` and surfaced only to the Superadministrator through the **Leads** module.

### Advisor/direct sale

A Superadministrator creates the organization and selects its plan.

Plan defaults are assigned automatically, with later Superadministrator overrides available for negotiated contracts.

## Installation/distribution direction

Public product entry points during the current beta are:

- `/` — public landing and plan comparison;
- `/login` — application login;
- `/downloads` — self-hosted/download information;
- `/descargas` — Spanish alias for the same self-hosted information page;
- `/dashboard` — authenticated application.

The first portable installation format is Docker Compose:

- Next.js application;
- PostgreSQL;
- persistent database volume;
- automatic migrations;
- health checks.

See `docs/INSTALLATION.md`.

Do not create a separate desktop application merely to make the product "downloadable"; the intended downloadable edition is the same web platform packaged for self-hosting.

During beta, the production build also generates a direct downloadable `.tar.gz` runtime package available from the public **Instalación propia** page. It contains the compiled standalone runtime, Docker Compose, PostgreSQL configuration, migrations and installer, so beta testers do not need repository access. GitHub Actions packaging remains useful for internal/versioned testing. Broad commercial distribution still requires licensing, signed releases and update controls.

## Intellectual-property direction

The product owner intends to commercially protect and exploit the project.

Keep separate:

- software copyright/authorship evidence;
- trademark protection for commercial names/logos;
- patent evaluation only for specific technical inventions, not the application as a whole;
- commercial licensing for self-hosted distribution.

See `docs/IP_AND_DISTRIBUTION.md`.

No open-source license has been approved.

## Security invariants

- PostgreSQL is the system of record.
- Browser-supplied tenant/site identifiers are never sufficient authorization.
- Permissions must be checked server-side.
- Subscription capacity must be checked server-side.
- Paid-plan activation must eventually come from verified payment-provider webhooks.
- Secrets must never be committed.
- Production redirects must use `publicUrl()`.
- Existing applied migrations are immutable.
- Operational history should be preserved instead of destructively removed when traceability matters.

## Documentation continuity rule

Before modifying the project, future contributors/AI agents must read:

1. `AGENTS.md`
2. this file
3. `docs/ARCHITECTURE.md`
4. `docs/FUNCTIONAL_MODEL.md`
5. `docs/COMMERCIAL_MODEL.md`
6. `docs/DECISIONS.md`
7. `docs/DESIGN_SYSTEM.md`
8. `docs/BRANDING.md`
9. `docs/ROADMAP.md`
10. `docs/CHANGELOG.md`
11. `docs/INSTALLATION.md`
12. `docs/IP_AND_DISTRIBUTION.md`
13. `docs/ROLE_MODEL.md`

Meaningful implementation work is incomplete until the relevant documentation is updated.


### Contextual creation pattern

The UI now supports parent-aware creation popups in addition to global module creation. A known parent is carried into the form instead of asking the operator to select it again. Examples include creating a site from a company, a user from a company, an asset from a sublocation, and a routine from an asset. Mutation routes accept a safe dashboard-only return path so successful creation returns to the originating context.


### Personalized dashboard navigation

The authenticated shell now uses a retractable Desweb technology sidebar. Its visible module order is user configurable through drag-and-drop or accessible up/down controls. Database-backed users persist both module order and collapsed state in `user_dashboard_preferences`; the bootstrap developer account uses local browser persistence because it has no database user identity. Permissions are evaluated before preferences, so navigation customization cannot reveal unauthorized modules.


### Field attendance and biometric verification

The dashboard now includes **Asistencia** for optional field-work traceability. Tenant administrators/managers configure which roles are subject to attendance control, whether facial verification/geolocation are required and the accepted thresholds.

Facial authentication is implemented as one-to-one verification for the already authenticated account. Browser-side Human 3.3.6 models generate face embeddings plus liveness/anti-spoof signals. Model files are packaged locally under `public/biometric-models` so SaaS and self-hosted runtime do not depend on a model CDN.

The server stores only an AES-256-GCM encrypted numeric template, not the camera photograph. Production should define a separate `BIOMETRIC_ENCRYPTION_KEY`.

Sites now support latitude, longitude and a geofence radius. Attendance events persist check-in/out time, location accuracy, distance to site and verification confidence. Activity execution is correlated to an open field shift for descriptive 30-day operational statistics.

Do not convert these statistics into automatic employment rankings or employment decisions. Human review is required for any personnel-management interpretation.


### Company Profile v2

The Superadministrator company workspace now treats each organization as a governed enterprise record rather than only a tenant name plus sites.

The full company page includes:

- commercial/legal identity and tax-identification type;
- administrative/fiscal address kept separate from operational sites;
- administrative, billing and primary-contact channels;
- internal administrative notes;
- visual identity;
- current plan and operational-resource summaries;
- profile-completeness guidance;
- a corporate document dossier with required/optional/not-applicable classification, issue/expiry dates and visual expiry alerts.

Corporate documents are stored in `organization_documents` with metadata and durable PostgreSQL file bytes. They are intentionally separate from company logo/cover assets and from maintenance-operation attachments.


### Platform Owner contextual development actions

The Platform Owner receives contextual **Editar / Eliminar** controls directly inside the normal CMMS modules. There is intentionally no standalone deletion workspace or sidebar module.

When the owner deletes a record, the backend can remove dependent development history transactionally using PostgreSQL foreign-key metadata. Owner-only direct edits use an allow-listed update endpoint.

Superadministrators and tenant users retain their existing hierarchy, creation flows and traceability restrictions. The Platform Owner identity itself remains protected from deletion.


### Unified module UI

Primary directory modules now share a reusable header with keyword search, contextual filters and a single Add action.

Creation is popup-first across Companies, Users, Locations/Sub-locations, Suppliers, Crews, Assets, Work Orders, Maintenance Routines, Inventory and manual Leads. Existing authorization, setup-sequence and contextual-parent rules remain unchanged.

The Users-specific “Roles en uso” information band was intentionally removed from the reusable visual pattern.

Company directory cards were aligned to the supplied visual reference with cover/logo identity and resource-progress rows. Progress denominators are shown only for actual enforced limits; suppliers are shown as unlimited because the current plan model does not enforce a supplier cap.


### Creation hierarchy guidance

Creation prerequisites are now represented as a shared guided state instead of compact setup banners or disabled forms.

The hierarchy used by operational modules is:

**Company → Principal location → Sub-location → Supplier / Workforce → Asset / Inventory / Crew → Work Order / Routine**

The exact branch depends on the entity being created. The UI resolves the earliest missing prerequisite and directs the user there with a clear message and CTA. Company and Location CTAs can open the required creation popup directly through query parameters.

Server-side gates remain authoritative; this UI guidance does not replace RBAC, tenant/site validation or route-level prerequisite checks.


### Dashboard by role

The navigation item previously called **Resumen** is now **Dashboard**.

The Dashboard is role-aware:
- Platform Owner: subscriptions, estimated MRR, plan mix, active companies and lead funnel;
- Superadministrator: customer/subscription health and global maintenance alerts;
- Company Administrator / Manager: maintenance operations, costs, downtime, inventory and recent work;
- Technician / External: assigned activity execution, attendance hours and productivity;
- Provider: supplier-assigned execution workload;
- Requester: own maintenance requests and resolution performance;
- Viewer: read-only operational KPIs.

The commercial dashboard deliberately labels recurring revenue as **MRR estimado** until real payment/reconciliation data exists.


### Per-company creation hierarchy

Creation hierarchy checks are company-specific.

For platform-level roles, the system must never combine prerequisites from different companies when deciding whether a module can create a record. A company with a site but no sub-location is still incomplete even if another company has sub-locations.

The guided blocker always points to the first missing prerequisite for a viable company path:
Company → Principal location → Sub-location → Supplier / Workforce → Asset / Inventory / Crew → Work Order / Routine.

Work-order and routine creation also enforce this hierarchy server-side using the organization resolved from the selected asset.


### Mobile-first dashboard shell

The responsive dashboard shell now uses role-aware navigation.

- Roles with many modules use the existing hamburger / slide-out navigation below 900px.
- Technician and External collaborator roles use a persistent bottom navigation for Dashboard, Orders, Attendance and Assets, plus **More** to expose every other authorized module in the drawer.

The same permission-filtered navigation list is reused across desktop, drawer and bottom navigation. This is the intended foundation for a future mobile/PWA application; new module UI should therefore be designed responsively in the same implementation rather than postponed to a separate mobile rewrite.


### Landing account access and export overlay behavior

The landing header now always exposes a compact user-icon account action on desktop and mobile. Its route resolves to Login without a session and Dashboard when already authenticated. Dashboard export menus raise their containing filter bar while open so Excel/CSV/PDF choices render above subsequent panels instead of being visually clipped.


### Mobile dashboard drawer stabilization

The responsive dashboard now integrates the drawer trigger directly into the contextual header. The mobile drawer explicitly renders above a non-blurred overlay and overrides legacy generic sidebar hiding rules, resolving the previous state where the page dimmed/blurred but authorized navigation modules were not visible. Landing account access also uses increased icon contrast for compact screens.


### Opaque popup readability

Emergent reading/decision surfaces now use opaque theme-aware backgrounds. Dashboard date-range and export popovers, account menus, action panels, confirmation dialogs and application modals no longer allow underlying page text to show through their bodies. The dimensional visual language is preserved through borders, solid tonal gradients and elevation shadows instead of transparency.


### Persistent module-header distinction

All authenticated modules now use a dedicated opaque contextual-header surface that is visually distinct from the cards and panels scrolling underneath it. The shared header uses theme-aware module-header tokens, stronger lower elevation and a restrained teal lower accent so its sticky position remains obvious during navigation and long-directory scrolling.


### Compact company and location directories

Company and location directories now prioritize scan density. Desktop layouts target four compact cards per row. Company resource consumption is represented by icon actions that show used/assigned capacity and navigate directly to the associated module, while the main card interaction remains dedicated to opening entity detail. Principal-location cards use the same compact visual language with shortcuts to sublocations and assets.

Company creation now requires a logo at both client and server level. The logo is the canonical circular identity image used by company/location cards; cover imagery is optional.


### Company profile redesign phase 1

The company quick-detail experience was rebuilt as a modern structured profile: a non-overlapping hero/identity area, quick module actions, executive summary cards and collapsible information sections. The primary-site section is explicitly prepared for the next map/geofence phase so location validation can be added without another structural redesign.

User creation now requires a profile photo at client and server level. The profile photo is identity/UI data only; facial attendance uses the existing separate live-camera enrollment pipeline with liveness checks and encrypted facial templates.


### Geofence configuration phase 2

Principal-site creation and editing now require a validated physical point. Company onboarding, contextual site creation, the Locations module and the company primary-site profile share one map/geofence control. It stores the existing `sites.latitude`, `sites.longitude` and `sites.geofence_radius_m` fields and exposes address search, manual map adjustment, current-device location and a visible radius circle.

Existing sites without coordinates remain readable but are marked pending; editing them requires completing address, coordinates and radius. Attendance already consumes these same site fields, so the configured map directly governs whether field users are inside the permitted biometric attendance area.


### Field presence phase 3

Field attendance now distinguishes site presence from assigned maintenance work. Technicians/external field users may open a biometric attendance shift with no assigned activities; the shift records that the authenticated person is physically present and available at an authorized site. Later task execution events can correlate against the already-open shift.

The client validates GPS/geofence first, then activates live facial verification. The mobile workspace shows site map/radius, current-device location, GPS accuracy, range state, biometric enrollment and the primary **Iniciar actividades** action. The server-side attendance clock continues to repeat authorization, GPS accuracy, distance and facial checks before persistence.


### Attendance default availability

Attendance is operational by default for organizations that have never configured a policy. The default self-service role set is Admin, Manager, Technician, Provider and External collaborator, matching roles that have `attendance.self`. Explicitly disabled policies remain disabled. Existing organizations without a policy are backfilled by migration `017_attendance_policy_defaults.sql`; new organizations receive the policy during onboarding.


### Supervised biometric identity chain

Biometric identity now has a supervised chain of trust. Initial/renewed enrollment is performed by an attendance manager with the user physically present. Existing self-enrolled profiles are treated as legacy and cannot authorize attendance until reenrolled. The system records the supervising user, site, enrollment method and verification time. Revocation nulls the usable encrypted embedding and keeps an audit event/metadata record.


### Mobile field shell phase 4A

Field mobile navigation now reserves four primary operational destinations (Dashboard, Orders, Attendance and Assets). **Más** is a bottom sheet for secondary authorized modules and account/system actions instead of reopening the full duplicate navigation drawer. The shell reserves safe-area-aware bottom space, and the Assets directory switches from the wide desktop table to compact mobile cards.


### Attendance contingency phase 4B

Attendance now includes an audited exceptional path for operational failures after supervised biometric enrollment. A field user can request contingency for check-in/check-out; an authorized attendance manager reviews it, and approval creates a 30-minute, one-time authorization. Using the authorization creates/closes the shift with verification mode `contingency`, preserving available GPS evidence and an explicit link to the reviewed request. The workflow cannot establish identity and therefore cannot be used by users without active supervised biometric enrollment.


### Hybrid role-aware user manual

The product now has one shared user-manual content source rendered in two contexts: public `/manual` for general product understanding and authenticated `/dashboard/help` for role-prioritized guidance. Users may switch to **Toda la plataforma** to understand broader product scope, while actual panel visibility/actions remain controlled by normal RBAC. Field mobile navigation exposes Manual/Ayuda from **Más**.


### Current location provider

Site/geofence UI now prefers Google Maps Platform for cartography and address validation. GPS continues to come from the user's device, and attendance/enrollment geofence decisions continue to be recalculated server-side. Facial verification remains the existing supervised 1:1 Human-based pipeline; it is deliberately independent from the map provider.


### Edit persistence behavior

Mutation-driven edit flows must not report success before PostgreSQL confirms the update. Company-directory and Users edits use explicit API responses, keep validation failures visible, and reload authoritative server data after a successful mutation. Platform Owner contextual record editors likewise reload after confirmed persistence. Company profile updates only modify resource entitlements when the corresponding limit fields are actually present in the submitted form.


### Company and site business hours

Companies and principal Sites now store editable attention schedules (weekdays, opening and closing time). New companies capture both a general corporate schedule and a separate schedule for the initial Site. Existing data is backfilled with Monday–Friday 08:00–18:00 and can be updated immediately. Reaction uses these schedules to distinguish open/closed Companies and Sites without changing attendance or work-order authorization.

### Reaction operations

A provisional **Reacción** module now provides emergency-response map infrastructure.

- Admin, Manager and platform operators can open the global Reaction map.
- Configured sites are shown using the organization logo.
- Connected Technicians are shown using their profile photo.
- Technician route samples are retained during the connected tracking session and rendered as a recent path.
- Technician location permission is mandatory while using the authenticated operational panel; an on-screen indicator confirms that tracking is active.
- Explicit logout closes the tracking session; stale clients disappear from the live map after two minutes.
- The right-side Reaction panel is intentionally reserved for the next dispatch/contingency workflow.
- Current web/PWA implementation cannot guarantee transport-app-grade GPS while the OS suspends the browser in background; the data model is prepared for a later native mobile tracker.
