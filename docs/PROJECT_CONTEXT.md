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


### Upload acknowledgement after persistence

The shared upload UX distinguishes local selection from server persistence. A selected file shows its filename, size and **100% · listo para guardar** state. Server-backed flows should only show **guardado correctamente** / success confirmation after the mutation returns successfully. Company quick edit now lives inside the in-page Company profile; after a successful save it switches back to protected/read-only mode, refreshes server data without a hard page reload and cache-busts newly uploaded logo/cover previews.

### Unified upload and internal-code UX

File selection is standardized through `components/FileDropzone.tsx` across all current photo/document upload flows. It keeps native multipart form semantics while presenting drag-and-drop, file metadata, image preview and UI-side type/size feedback. Backend validation remains authoritative and displayed limits must mirror each route's actual contract.

The Site `code` field remains useful as an optional internal short identifier. User-facing forms must explain its purpose (OT, reports and integrations) instead of presenting an unexplained generic “Código” field.

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


### Approved Company / Location / Sub-location / Technician in-page profile workspace

Company, Site, Sub-location and User/Technician directory records now use the shared profile geometry from the approved reference **inside the current module page**. These records do not open detail modals.

- Breadcrumbs sit above the entity title and carry Inicio → Module → Parent (when applicable) → Current record.
- The entity heading uses the approved **Type / Name** hierarchy and keeps quick actions/export on the right.
- The left column keeps entity identity visible with Company/Site/reference cover, Company logo or User photo, state, compact statistics and quick actions.
- The right panel has independent tabs; changing Information, Statistics, Locations/Sub-locations/Services/Activity, Attendance, Documents, Technicians or Hoja de vida changes the panel body without extending the profile downward.
- Site profiles include geofence/map, contact, flexible schedule summary, Zone/Locality, responsible person/title, notes, Sub-locations and maintenance-service context.
- Site and Sub-location **Técnicos** tabs do not maintain their own assignment relation. They derive Technician visibility from Work Order Activity executors (direct Technician assignment or Crew membership), so future Activity creation/assignment automatically updates the profile view.
- Sub-location profiles include hierarchy, Assets/direct Work Order statistics, edit/contextual child creation and Hoja de vida.
- User/Technician profiles include role/Site scope, active Work Orders, pending/completed activity evidence, Attendance hours/shift state, biometric state and Reaction live state.
- A Site quick action can start Technician creation with Company + Site + Technician role preselected; Users server rules remain authoritative.
- Company, Site, Sub-location and User/Technician record-level Hoja de vida export supports PDF, native XLSX and Word-compatible DOC and is generated by an authenticated server route that repeats tenant/Site authorization.

Desktop account/configuration/help/logout controls were moved from the lower-left sidebar to the far-right contextual header. A stored User profile photo appears there when available; bootstrap/legacy identities fall back to initials. Field-mobile **Más** remains the mobile account/system surface.


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

### Attendance administration context

Attendance administration is tenant-scoped even for global platform identities. Tenant Admin/Manager sessions continue to derive the organization from authenticated membership. Platform Owner/Superadmin must explicitly select an active customer organization in `/dashboard/attendance` before policy, geofence, contingency, report or supervised-biometric administration becomes active.

The selected organization is orchestration context only. Policy and biometric mutations revalidate the organization, target user and Site server-side. The Users profile can deep-link to Attendance with organization + user focus so the supervisor does not need to search again. Bootstrap Platform Owner enrollment/revocation events preserve actor platform role/email in audit metadata when no persistent actor user row exists.

This is **Asistencia operativa — Fase 1**. Individual work schedules/jornada assignment and multi-Site travel segments are intentionally deferred to later functional phases; the current attendance shift model remains unchanged in this checkpoint.


### Mobile field shell phase 4A

Field mobile navigation now reserves four primary operational destinations (Dashboard, Orders, Attendance and Assets). **Más** is a bottom sheet for secondary authorized modules and account/system actions instead of reopening the full duplicate navigation drawer. The shell reserves safe-area-aware bottom space, and the Assets directory switches from the wide desktop table to compact mobile cards.


### Attendance contingency phase 4B

Attendance now includes an audited exceptional path for operational failures after supervised biometric enrollment. A field user can request contingency for check-in/check-out; an authorized attendance manager reviews it, and approval creates a 30-minute, one-time authorization. Using the authorization creates/closes the shift with verification mode `contingency`, preserving available GPS evidence and an explicit link to the reviewed request. The workflow cannot establish identity and therefore cannot be used by users without active supervised biometric enrollment.


### Hybrid role-aware user manual

The product now has one shared user-manual content source rendered in two contexts: public `/manual` for general product understanding and authenticated `/dashboard/help` for role-prioritized guidance. Users may switch to **Toda la plataforma** to understand broader product scope, while actual panel visibility/actions remain controlled by normal RBAC. Field mobile navigation exposes Manual/Ayuda from **Más**.


### Current location provider

Site/geofence UI now prefers Google Maps Platform for cartography and address validation. GPS continues to come from the user's device, and attendance/enrollment geofence decisions continue to be recalculated server-side. Facial verification remains the existing supervised 1:1 Human-based pipeline; it is deliberately independent from the map provider.


### Company quick-edit contact persistence

The Company-directory quick-edit persists primary contact and administrative email with a fixed parameterized PostgreSQL UPDATE; do not dynamically construct positional placeholders for these fields. Administrative email is optional, but when present must pass email-format validation. User-facing save failures should return an actionable reason where possible; unknown database failures use the safe reference `ORG-SAVE` while the server log records the underlying database/error code and message.

Contacto principal and Correo administrativo belong to the standard Company information form grid, not to a separate summary-strip layout.

### Protected Company quick edit

Opening a Company card remains read-only by default. The **Editar empresa** action must first show an explicit confirmation dialog; only after confirmation are protected fields unlocked. The Company quick-edit contact summary transforms into editable primary-contact and administrative-email fields in edit mode. Cancelling edit resets unsaved DOM form values, and successful quick-edit mutations persist only the fields intentionally submitted by that flow.

### Edit persistence behavior

Mutation-driven edit flows must not report success before PostgreSQL confirms the update. Company-directory and Users edits use explicit API responses, keep validation failures visible, and reload authoritative server data after a successful mutation. Platform Owner contextual record editors likewise reload after confirmed persistence. Company profile updates only modify resource entitlements when the corresponding limit fields are actually present in the submitted form.


### Business-hours mutation failures

Schedule validation is part of the mutation boundary. Invalid opening/closing combinations must return controlled form feedback and must never bubble out as an HTTP 500. PostgreSQL schedule constraint failures are also translated into the same user-facing validation path.

### Company quick-edit schedule and geofence layout

The Company directory in-page edit uses one visible business-hours editor. Saving that Company-level schedule from the directory also synchronizes the primary Site schedule, avoiding duplicate schedule controls in the same profile. Site-specific schedule exceptions remain available from the Site/Locations workflow. The primary-Site coverage editor is map-first: full-width geofence map, then compact geofence metrics and Site identity/location subcontainers below it.

### Company and site business hours

Companies and principal Sites now store editable seven-day attention schedules with an independent enabled/closed state and opening/closing range for each day. New companies capture both a general corporate schedule and a separate schedule for the initial Site. Existing data is backfilled with Monday–Friday 08:00–18:00 and can be updated immediately, including weekend or other non-habitual ranges. Reaction uses these schedules to distinguish open/closed Companies and Sites without changing attendance or work-order authorization.

### Reaction in-place entity exploration

Reaction is designed to remain the operator's persistent control surface. Global search covers Company, Site and connected-Technician identity/contact/location fields. Company selection scopes both the map and Site selector. Clicking a Company, Site, Technician or pending-activity card opens a modal over Reaction rather than navigating away. Entity modals list all currently pending/in-progress activities related to that entity, while the right-side alert panel keeps its independent date filter. Activity detail identifies direct technician, crew or service-provider assignment and can correlate connected technicians through crew membership. Navigation to the full Work Order is an explicit secondary action.

### Reaction activity alerts

The Reaction workspace now combines live map telemetry with maintenance alerts. A unified top filter bar controls map layers and Company/Site scope. Clicking a Company or Site marker also sets that scope. The right-side panel lists pending/in-progress work-order activities, defaults to **Today and overdue**, and can filter by date. New activities receive their own commitment date through `work_order_tasks.due_date`; older activity records fall back to Work Order `due_at` and then request date so legacy data remains visible.

Company/Site operating-state markers use high-contrast green for open and red for closed while preserving the original logo image without opacity/grayscale degradation.

### Reaction operations

A provisional **Reacción** module now provides emergency-response map infrastructure.

- Admin, Manager and platform operators can open the global Reaction map.
- Configured sites are shown using the organization logo.
- Connected Technicians are shown using their profile photo.
- Technician route samples are retained during the connected tracking session and rendered as a recent path.
- Technician location permission is mandatory while using the authenticated operational panel; an on-screen indicator confirms that tracking is active.
- Explicit logout closes the tracking session. Refresh/navigation/background suspension do not close it.
- GPS telemetry is considered live for two minutes; a background-paused technician remains visible at the last known position for up to 30 minutes and is marked as paused rather than disconnected.
- The right-side Reaction panel currently lists pending/in-progress maintenance activities with date scoping; Company/Site/Technician exploration stays in-place through popups so the map remains the persistent control surface.
- Current web/PWA implementation cannot guarantee transport-app-grade GPS while the OS suspends the browser in background; the data model is prepared for a later native mobile tracker.


## Flexible operating schedules

Company and Site operating hours use a seven-row JSON schedule (`business_schedule`) as the rich source for day-specific availability. Each row contains the ISO-style weekday number (1 Monday through 7 Sunday), enabled state, opening time and closing time. Legacy `business_days`, `business_open_time` and `business_close_time` columns remain populated as compatibility fields for existing code and integrations.

Rules:
- at least one day must be enabled;
- every enabled day must close after it opens;
- different days may use different time ranges;
- closed days are represented explicitly instead of inferred;
- Reaction uses the Site/Company timezone plus the day-specific schedule to compute open/closed state.

## Company document lifecycle and preview

`organization_documents` treats **archive** and **permanent deletion** as different operations.

- Active documents appear under **Vigentes**.
- Archive sets `archived_at` and `archived_by` and removes the item from the current dossier without destroying its bytes or metadata.
- Archived documents remain previewable/downloadable by authorized users and can be restored.
- Restore clears archive metadata and returns the document to the current dossier.
- Permanent deletion remains a Platform Owner destructive action using the existing protected purge/confirmation path.
- PDF/image previews use the authenticated document endpoint with `?inline=1`; ordinary access keeps attachment/download disposition.

## Phone normalization and communication shortcuts

Phone capture is country-aware. When a Company or Site country is known, the UI shows the calling prefix separately and the user enters the national portion only. The submitted value is normalized with the country prefix for storage/use in links.

Current calling-code helpers cover the principal Latin American countries already represented by the product plus common North American/European codes. Unknown countries keep a safe international-entry fallback.

WhatsApp and telephone actions are convenience links only; they do not grant permissions or send messages from the CMMS. Reaction entity details use normalized Company, Site and Technician numbers for these shortcuts.


### Multi-country and language foundation

Desweb CMMS is being prepared for distribution across multiple countries. Country-dependent form data is no longer treated as unrelated text.

The current foundation centralizes Country, curated City options, calling codes, tax identifiers, personal document types and time zones in `lib/international-catalog.ts`. Companies, Sites, Suppliers, Leads and Users/Technicians consume the shared Country-aware form rules where regional data is captured. Phones derive the international prefix from the selected Country; Supplier tax identity and User personal document identity also depend on Country. Platform and tenant Settings persist a default Country and preferred Locale.

This is a locale-ready foundation, not a claim that the full UI has already been translated. Existing Spanish screens remain valid until translation dictionaries are introduced progressively. The Country/City catalog is intentionally extensible; the initial city sets cover common operating cities and can be expanded without changing each form independently.


### Supplier profiles and requisitions

Supplier is now a first-class operational profile. The directory requires Supplier identity/logo and the detail uses the approved in-page profile workspace.

Supplier data is intentionally projected from existing authoritative relations:

- service Activities: `work_order_tasks.service_supplier_id`;
- supplied Inventory: `inventory_items.supplier_id`;
- requisition history: `supplier_requisitions.supplier_id`;
- Supplier documents: `supplier_documents.supplier_id`.

Requisition creation has two approved entry points: Supplier profile and Inventory. Both call the same server generator. Inventory selections spanning several Suppliers are split automatically into independent Supplier requisitions.

A requisition represents demand to a Supplier, not stock receipt. Inventory quantity changes only through inventory receiving/transaction logic, keeping requested, approved and received quantities auditable as separate facts.


### Role dashboards with period comparison

The root Dashboard now follows the approved analytical admin composition while remaining role-specific and authorization-scoped.

Every role family receives KPI cards, current-vs-comparison variation and six-month trends relevant to its work. The default comparison is the immediately previous equivalent period; the operator may switch to the same period of the prior year.

Tenant/field/requester dashboards can additionally narrow Work Order/Activity data by authorized Site and Priority. These controls never broaden the session scope. Excel/CSV/PDF exports apply the same period, status, Site and Priority filters to the same server-authorized dataset.

The dashboard visual layer is reusable through `components/DashboardAnalytics.tsx`; data aggregation remains server-side in the dashboard page/API. Field-person statistics continue to be descriptive operational evidence rather than automated personnel rankings.


### Conditional filters and normalized administrative records

Primary directory modules now use conditional/cascading facets. Company, Site, Role, Supplier, Category, Priority and similar filters appear only when the currently authorized dataset contains multiple useful choices. The implementation remains client-side narrowing over server-authorized records, so a hidden or selected facet is never an access-control boundary.

Supplier classification is now multi-value and catalog driven. Stable capability/specialty codes replace new free-text entry while legacy Supplier type/category fields remain compatible with existing Inventory and service logic.

User profiles now include a tenant-private personnel document dossier and emergency contact. Supplier profiles include separate payment/financial information. Migration 029 is the schema checkpoint for these additions.

The product direction for bulk import/export is to prefer standardized codes/catalog values over free-text classifications whenever records must be exchanged with spreadsheets, databases or external systems.

### Procurement approval and audit — Phase 2

Procurement governance is now configurable per Company. A Company may require no approval, approval for every requisition, or approval only when the requisition estimated value reaches a configured threshold. It may also choose whether approval is limited to Company Administrators or includes Managers/Supervisors, and whether a requester with an approver role may approve their own request.

The Company policy is copied into each requisition at creation. This snapshot is deliberate: changing Company settings later does not rewrite the historical rule under which an existing requisition was created.

When approval is required, receipt into Inventory/Kardex is a server-enforced gate. The receiving route rejects the operation until the requisition has a current approved decision. Approvals and rejections are separate from ordinary requisition lifecycle editing and are recorded with actor, time, notes and audit metadata.

A requisition created below a snapshotted threshold is reevaluated when quantity/cost changes; if it reaches that stored threshold, it enters approval automatically. Once approval becomes required, later reductions do not remove the governance requirement. A material change to quantity, estimated cost or required date after a decision invalidates the previous approval/rejection and reopens the approval state. Existing receipt movements remain intact; only additional receipt of the outstanding balance is blocked until the new decision.

### Supplier commercial analytics — Phase 3

Supplier Statistics now derives procurement performance from requisition-linked physical receipt history. The default analytical window is 12 months and the UI explicitly displays sample sizes so missing history is not presented as zero performance.

The current indicators are average time to first receipt, weighted quantity fulfillment, complete-on-time rate and weighted receipt-cost variance. Complete-on-time only evaluates fully received requisitions that have `needed_by`. Cost variance compares actual receipt unit cost with the requisition estimated unit cost for exactly the quantities physically received.

`lib/supplier-analytics.ts` is the shared server model for the Supplier Statistics workspace and Supplier profile exports. It also exposes a six-month trend and recent requisition-level evidence so every KPI can be traced back to its operational source. These indicators are descriptive evidence and must not become automatic Supplier rankings or procurement decisions.

### Supplier returns — Phase 4

Procurement now supports physical returns to Suppliers from the requisition detail. A return must select an existing physical receipt as its source and records reason, expected resolution, reference/document, return date, user, quantity and outbound warehouse.

The return creates a dedicated `supplier_return` Kardex transaction that decreases stock. This is intentionally distinct from the pre-existing `return` movement, which represents material returning into Inventory and increases stock.

The original receipt remains immutable historical evidence: `quantity_received` is not decremented. DEV history records what was later sent back. Returns can therefore be registered after a requisition is fulfilled or closed without rewriting the procurement past.

Expected resolution is captured as replacement, credit note or other. It is not yet a financial/document-reconciliation workflow; that dependency is reserved for the next procurement phase.


### Procurement document reconciliation — Phase 5

The procurement lifecycle now includes commercial evidence reconciliation after approval, physical receiving and Supplier returns.

Supported evidence:
- purchase order;
- delivery note/remission;
- invoice;
- credit note;
- other informational procurement documents.

Physical receipts and Supplier returns remain authoritative for stock. The reconciliation layer stores immutable document files and line snapshots, links commercial documents to the physical receipt/DEV evidence they represent, and derives quantity/value differences without changing Kardex.

Automatic reconciliation and human review are intentionally separate. A document may calculate as `matched`, `difference`, `pending_evidence`, `informational` or `voided`; its review may separately be `pending`, `verified`, `exception_accepted` or `disputed`. Adding later evidence resets review to pending.

Phase 5 completes the planned procurement sequence started with bulk Inventory/Kardex import, requisition receiving, approval/audit, Supplier KPIs and Supplier returns. The next project step is the planned global logic/flow/visual review rather than another predefined procurement phase.


### Unified Inventory/Kardex master import — 2026-09-24

Inventory and Supplier profiles now share one import architecture.

The single workbook is `PLANTILLA_INVENTARIO_KARDEX_DESWEB.xlsx` with the same six sheets in every context: INSTRUCCIONES, INVENTARIO, KARDEX, PROVEEDORES, BODEGAS and CATALOGOS. Blank and current-data downloads are two data modes of the same schema, not separate templates.

The import can start in:
- **Global mode** from Inventory: each product resolves its own Supplier and multi-Supplier files are automatically distributed.
- **Contextual mode** from a Supplier: the opened Supplier may be inherited when rows omit Supplier identity. If the file contains other Suppliers, the operator explicitly chooses Context-only or Import-all. Import-all switches to true Global rules.

Supplier identity priority is internal ID → tax/NIT → internal Supplier code → exact name. Supplier code is now persisted on Supplier records and automatically generated when missing.

The preflight validates structure, Supplier identity, SKU uniqueness, Site/Sub-location scope, warehouses, quantities/costs, expiry, Kardex relationships, external movement IDs and simulated warehouse stock before confirmation. Services are detected and omitted from physical Inventory/Kardex.

Commit is still one PostgreSQL transaction and Kardex remains the stock authority. Import batches now carry `IMP-YEAR-######`, origin, contextual Supplier, commit scope and omitted-row counts.


## Strategic visual direction — DESWEB Design System V2 (2026-09-24)

The product owner approved a major ERP visual-system refactor. The goal is not a recolor: DESWEB CMMS will progressively move to a centralized Design System + UI Kit architecture so all modules feel like one enterprise product.

Canonical documents:

- `docs/DESIGN_SYSTEM.md`
- `docs/UI_KIT.md`
- `docs/DESIGN_MIGRATION_PLAN.md`

The approved visual DNA is:

- Primary `#72F1DC`;
- Secondary `#2C8780`;
- Dark `#1D1D2C`.

The existing CSS implementation still contains the previous palette and many local styles. Those are considered legacy migration targets, not new-development guidance.

Strategic frontend model:

`Design System → DESWEB UI Kit → UI Core / Business UI → ERP modules`.

Implementation is phased. Documentation/governance comes first, then foundations/tokens, primitives, global shell/navigation, shared data UI, ERP-specific components and finally module-by-module migration.

The migration is explicitly **visual/UX-first**. It must preserve APIs, data models, authentication, permissions, calculations, integrations and operational business rules. Functional defects discovered during visual work are documented and fixed separately when necessary.

The target component catalog includes reusable Buttons, form controls, Cards, Badges/Status, Modal/Drawer, Dropdown/Tooltip, Tabs/Breadcrumb/ModuleNavigation, DataTable/Pagination, KPI, Search/Filter, feedback/loading/empty states, Avatar/FileUpload and ERP business components such as AssetCard, InventoryCard, MaintenanceCard, WorkOrderCard, SupplierCard and LocationCard.

A live `/ui-kit` catalog is part of the target architecture and will become the official visual reference once implemented.


### DESWEB V2 Foundations implemented — 2026-09-24

The Design System program has moved from governance into runtime implementation.

Phase 1 establishes a canonical `app/design-tokens.css` layer after the existing global stylesheet, preserving current module behavior through compatibility aliases while making the V2 tokens available to all new UI.

The application now has:

- complete V2 brand/semantic/module/chart tokens;
- typography, spacing, radius, shadow and motion scales;
- light/dark semantic mappings and reduced-motion behavior;
- Organization white-label action-token bridge;
- typed token metadata;
- official `components/ui-kit` namespace;
- authenticated `/ui-kit` Foundations playground;
- CI validation for the foundation contract;
- a quantified legacy CSS audit.

No module-specific redesign or business-flow change is part of this phase.

Next: Phase 2, where existing reusable interaction patterns are evaluated and promoted/absorbed into official UI Core primitives.


### DESWEB UI Core Phase 2 implemented — 2026-09-24

The ERP now has a reusable, token-driven UI Core on top of the V2 foundations.

Phase 2 adds the official primitives for actions, forms, selection controls, cards, status, overlays, navigation, feedback/loading, avatar and file upload. The live authenticated `/ui-kit` page renders those real components interactively.

High-value legacy components were converted to compatibility wrappers so existing modules gain the new core behavior without changing their calls. This includes focus-trapped confirmation/create overlays, the multi-select and file dropzone.

No application business logic, DB schema, API contract or authorization rule changes as part of this phase.

The next visual program step is Phase 3: migrate the global application shell/sidebar/header/mobile navigation to the V2 UI grammar while preserving user ordering, collapse preferences, RBAC, Personalization and theme behavior.


### DESWEB V2 global shell/navigation — Phase 3 implemented (2026-09-24)

The authenticated ERP shell has moved to the Design System V2 grammar without changing operational authorization or routing.

The V2 shell is a scoped compatibility layer in `app/shell-v2.css`, loaded after Design Tokens and UI Core. It normalizes desktop Sidebar, contextual Header/account controls, responsive drawer and field-role bottom navigation while legacy module interiors continue to migrate by phase.

Global module/navigation glyphs now use the canonical `UiIcon` SVG system. Sidebar order/collapse persistence, RBAC filtering, Organization white-label action tokens and light/dark/system preferences remain authoritative and unchanged. Requisitions now has an explicit contextual-header identity instead of falling back to the generic product title.

Next visual step: Phase 4 Shared Data UI.


### DESWEB V2 Shared Data UI — Phase 4 implemented (2026-09-24)

The UI Kit now includes the shared data-interaction layer required before module-by-module migration.

Search and filtering are centralized through Search + FilterPanel/FilterGroup. DataTable provides sorting, optional row selection, bulk actions, row action menus and Pagination for client-side datasets. KPI/metric composition, the chart token sequence, Timeline and progress primitives are also canonical.

`ModuleHeader` has been migrated as a compatibility wrapper: it still narrows only the records already rendered from server-authorized data and preserves its dynamic cascading facets, but its controls now come from Shared Data UI.

`DashboardAnalytics` similarly preserves the dashboard-facing API while delegating KPI/stat/chart presentation to the official Phase 4 primitives. This reduces duplication before Dashboard's full module migration in Phase 6.

No DB schema, API, RBAC or business-rule changes are part of Phase 4.

Next visual step: Phase 5 Business UI.


### DESWEB V2 Business UI — Phase 5 implemented (2026-09-24)

The reusable domain-card layer is now official.

`components/business-ui/BusinessCards.tsx` provides a shared BusinessCardShell plus AssetCard, InventoryCard, MaintenanceCard, WorkOrderCard, SupplierCard, LocationCard, UserCard and BusinessProfileStat. The objective is controlled reuse: shared spacing, states, token usage and accessibility without flattening the information architecture of each domain.

Current consumption:
- Assets directory → AssetCard;
- Inventory products → InventoryCard;
- Maintenance responsive directory → MaintenanceCard;
- Work Order responsive directory → WorkOrderCard;
- Supplier directory → SupplierCard;
- Location/Site directory → LocationCard;
- Users → UserCard shell;
- EntityProfileWorkspace → shared BusinessProfileStat.

Existing server-side access rules, contextual creation, record editing, requisitions, maps/geofences and module-specific actions remain unchanged.

Phase 6 is the first complete module migration block: Dashboard, Companies and Locations.


### DESWEB V2 first module block — Phase 6 implemented (2026-09-24)

Dashboard, Empresas and Ubicaciones are the first modules migrated end-to-end after Foundations, UI Core, Shared Data UI and Business UI.

Dashboard retains the existing role-specific SQL, comparison periods, filters and export semantics. Presentation now consumes official Card/Badge/Button/Select, ProgressBar, KPI/chart primitives and the new server-compatible StaticDataTable.

Empresas retains organization CRUD, edit confirmations, resource limits, profile/document flows, primary Site/geofence and exports. Its directory now consumes CompanyCard and its profile metrics/feedback consume official V2 primitives.

Ubicaciones retains authorized Site/Sub-location queries, contextual creation, maps/geofences, service/technician associations and profile exports. Site and Sub-location directories plus their local filtering/status/metrics now consume Business UI and Shared Data UI.

The scoped `app/phase6-modules.css` layer prevents the migration from spilling into modules scheduled for later phases.

No DB schema, API, RBAC or tenant/site scope changes were introduced.

Next visual step: Phase 7 Assets + Inventory.


### DESWEB V2 operational master-data block — Phase 7 implemented (2026-09-24)

Assets and Inventory are now migrated end-to-end to the V2 presentation stack.

Assets retains the existing `assets`, `asset_categories`, maintenance plan, Work Order and attachment model. The Phase 7 catalog navigation deliberately derives Types, Brands and Models from existing authoritative fields rather than adding speculative schema. List/detail surfaces and derived catalogs now share V2 metrics, statuses, tables, feedback and Business UI.

Inventory retains Kardex as the stock authority and keeps the validated unified bulk-import service unchanged. Summary/detail, categories, warehouses and Kardex now share V2 primitives; Reports and Configuration are read-only operational views over existing stock/catalog data.

Supplier links, Requisition generation, receipt/return reconciliation, multi-warehouse stock levels and import batch audit remain intact.

No DB schema, API contract, RBAC or Site/Organization scoping change was introduced by Phase 7.

Next visual migration: Phase 8 Suppliers + Users + Crews + Attendance.


### DESWEB V2 Suppliers + People block — Phase 8 implemented (2026-09-24)

Suppliers, Users, Crews and Attendance are migrated end-to-end to V2 presentation without changing their domain boundaries.

Supplier and User remain intentionally different visual entities. Supplier is a commercial/operational third party connected to Inventory, Requisitions, Procurement evidence, returns, documents and finance. User is a person/account with role, Site scope, personnel dossier, emergency contact and optional external Supplier relationship.

Crews now consume a dedicated CrewCard while keeping actual member roles and explicit leader selection.

Attendance remains privacy-sensitive and server-authoritative. Existing biometric profiles, supervised enrollment, liveness checks, GPS accuracy, Site geofences, contingency approvals and attendance policies were not relaxed or moved into presentation logic. Reporting remains descriptive and is not an automated worker ranking.

No DB schema, API, RBAC, biometric threshold, geofence rule or tenant/Site scope changed.

Next visual migration: Phase 9 Maintenance + Work Orders + Activities/Reaction.


### DESWEB V2 maintenance-operation block — Phase 9 implemented (2026-09-24)

Maintenance, Work Orders, Activities and Reaction are migrated end-to-end to the V2 presentation stack.

Work Order and Activity states remain server-authoritative. Phase 9 adds a shared display grammar only; forms continue posting to the established APIs and no client component determines a valid transition.

Work Order detail now exposes descriptive process progression, completion ratio, due-date risk and event timeline from existing authoritative dates. No new SLA model or inferred business deadline was added.

Reaction now uses the official Drawer for contextual detail and shared filters/status patterns while retaining the current Google Maps snapshot/tracking architecture. Technician tracking sessions and route points are unchanged.

Provider/external Work Order queries now include organization/Site/type presentation metadata already inside their authorized result scope, fixing directory facets without widening access.

No DB schema, API, RBAC, assignment, task-state, tracking or tenant/Site scope change was introduced.

Next visual step: Phase 10 Reports + Settings + final V2 audit.


### DESWEB V2 final closure — Phase 10 implemented (2026-09-24)

The progressive Design System migration program is complete through Phase 10.

A Reports Center now exposes existing role-authorized exports from one navigation surface. It reuses Dashboard and module export endpoints and does not introduce a new reporting authority.

Settings and Personalization consume the final V2 interaction/state vocabulary while preserving global customization, organization white-label, light/dark/system preference, Locale/Country defaults and procurement approval configuration.

The final audit freezes `app/globals.css` at its measured legacy hardcoded-color baseline and requires all V2-owned stylesheets to remain token-only. New product work must be V2-native; legacy selectors should be retired only when their final consumer is removed.

See `docs/DESIGN_AUDIT_FINAL.md`.
