# Architecture

## Runtime architecture

```text
Browser
  |
  | HTTPS
  v
Easypanel reverse proxy
  |
  | HTTP :3000
  v
Desweb CMMS / Next.js
  |
  | DATABASE_URL
  v
PostgreSQL
```

The application container applies pending SQL migrations and then launches the Next.js standalone server.

## Technology stack

- Next.js 16
- React 19
- TypeScript
- PostgreSQL
- node-postgres (`pg`)
- Docker
- Easypanel

No ORM is currently used. SQL is explicit and versioned under `db/migrations/`.

## Source structure

- `app/` — Next.js routes, pages and API handlers.
- `app/login/` — login UI and illustrative CMMS preview.
- `app/dashboard/` — authenticated operational UI.
- `app/dashboard/companies/CompanyDirectory.tsx` — Company directory plus approved in-page profile workspace, protected edit mode and destructive-action confirmation.
- `app/dashboard/companies/[id]/` — full company and site administration.
- `app/dashboard/locations/[id]/` — recursive physical hierarchy below a principal site.
- `app/api/organizations/[id]/` — company updates, status changes, visual assets and site creation.
- `app/api/organizations/[id]/assets/[asset]/` — authenticated company logo and cover delivery.
- `lib/organization-assets.ts` — company image validation and conversion.
- `components/BusinessHoursFields.tsx` — reusable seven-day Company/Site operating-schedule editor.
- `lib/business-hours.ts` — rich schedule normalization, legacy compatibility and open/closed evaluation.
- `components/CompanyDocumentWorkspace.tsx` — current/archived company-document workspace, preview and lifecycle actions.
- `components/PhoneField.tsx` — country-aware national-number capture with visible calling prefix.
- `lib/country-calling-codes.ts` — calling-code lookup plus normalized E.164-like composition/parsing.
- `app/api/sites/[id]/` — site updates and status changes.
- `app/dashboard/settings/` — role-aware settings: global platform settings for superadministrators and read-only organization capacity/information for company administrators.
- `app/dashboard/personalization/` — global visual branding resources, linked from settings.
- `app/api/customization/` — branding upload and asset delivery routes.
- `components/ThemePreferences.tsx` — persisted light/dark/system appearance preferences.
- `components/DashboardNavigation.tsx` — permission-filtered active sidebar/header navigation.
- `components/EntityProfileWorkspace.tsx` — reusable two-column identity/statistics + tabbed-content profile surface used by Sites, Sub-locations and Users/Technicians.
- `components/ProfileExportMenu.tsx` — entity Hoja de vida format selector.
- `app/api/profile-export/route.ts` — authenticated/scoped Company, Site, Sub-location and User/Technician Hoja de vida generation in PDF, XLSX and Word-compatible DOC.
- `lib/customization.ts` — customization lookup and logo selection helpers.
- `lib/db.ts` — shared PostgreSQL pool/query helper.
- `lib/auth.ts` — signed identity-aware sessions for bootstrap and database users.
- `lib/passwords.ts` — password hashing and verification.
- `lib/permissions.ts` — central role/permission matrix.
- `app/dashboard/users/` — user and role administration.
- `app/api/users/` — protected account creation.
- `lib/urls.ts` — public URL helper for proxy-safe redirects.
- `db/migrations/` — ordered SQL migrations.
- `scripts/migrate.mjs` — migration runner.
- `Dockerfile` — production container build.

## Tenant and physical-location model

- `organizations` is the tenant boundary.
- `organization_limits` stores the resource entitlement assigned by the super administrator.
- `sites` represents principal locations such as a hospital, clinic, warehouse or office.
- `locations` represents every subordinate physical space and is recursive through `parent_id`.
- assets, work orders and inventory items may point to a precise `location_id` while retaining their principal `site_id`.

Every operational query and mutation must validate `organization_id`; an identifier supplied by the browser is never sufficient tenant authorization by itself.

## Authentication and authorization

Migration `005_user_auth_and_roles.sql` extends the original user model with password credentials and a platform-level role.

Authentication supports two account sources:

1. the environment-configured bootstrap superadministrator (`APP_ADMIN_EMAIL` / `APP_ADMIN_PASSWORD`) kept as an emergency/developer path;
2. PostgreSQL-backed users created from **Usuarios y roles**.

User passwords are derived with Node.js `scrypt` using a random per-user salt. Session cookies are HTTP-only signed payloads protected by `AUTH_SECRET`; user identity is resolved from PostgreSQL on each authenticated request.

Authorization is centralized in `lib/permissions.ts`. The navigation hides unavailable modules, while pages and mutation routes independently re-check permissions and tenant ownership. UI hiding is not considered a security boundary.

The organization role `owner` was retired by migration `007_remove_owner_role.sql`; existing owners are migrated to `admin`. `admin` is now the highest organization-level role. Company administrators receive `settings.view`, which exposes tenant information and entitlement consumption without granting `company_resources.manage`.

## Global customization

Migration `002_app_customization.sql` creates a singleton `app_customization` row.

It currently stores:

- logo for light backgrounds;
- MIME type and original filename;
- logo for dark backgrounds;
- MIME type and original filename;
- favicon;
- MIME type and original filename;
- last update timestamp.

Binary branding assets are stored as PostgreSQL `bytea`. This is intentional for the current phase because it keeps configuration durable across Easypanel redeploys without requiring a persistent application filesystem.

The customization is installation-wide, not organization-specific.

Future personalization settings such as colors, application title or login background should extend this same module rather than creating unrelated configuration stores.

## Theme behavior

The root HTML element receives `data-theme="light"` or `data-theme="dark"`.

Theme selection priority:

1. explicit user choice in `localStorage`;
2. operating-system `prefers-color-scheme`;
3. light fallback.

Theme-specific styling must use semantic CSS variables and documented overrides.

## Deployment behavior

Required environment variables:

```env
DATABASE_URL=...
APP_ADMIN_EMAIL=...
APP_ADMIN_PASSWORD=...
AUTH_SECRET=...
NEXT_PUBLIC_APP_NAME=Desweb CMMS
NEXT_PUBLIC_APP_URL=https://cmms.desweb.cloud
```

Internal application port: `3000`

Health check: `/api/health`

## Migration ordering invariant

Application startup runs all pending SQL migrations before starting Next.js. Migration filenames therefore define a strict dependency order. A migration must never alter or reference a table that is introduced only by a later or missing migration. Reaction currently depends on `020_technician_location_samples.sql` running before `021_reaction_tracking_sessions.sql`.

## Startup resilience

Easypanel redeploys can create a short window where PostgreSQL is not immediately reachable.

To avoid a crash-loop:

- `scripts/migrate.mjs` retries PostgreSQL connectivity.
- default: 30 attempts, 2 seconds apart;
- optional: `DB_CONNECT_RETRIES`, `DB_CONNECT_RETRY_MS`;
- production sets `HOSTNAME=0.0.0.0`;
- Next.js remains reachable on port `3000`.

These safeguards must be preserved.

## Proxy redirects

Never construct browser redirects solely from `request.url` behind Easypanel. Use `publicUrl()` from `lib/urls.ts`.


## Multi-site user scope

Migration `006_multi_site_user_access.sql` adds explicit site scope to organization memberships.

- `organization_members.access_all_sites=true` means the account can access every active site in its organization, including sites created later.
- `organization_member_sites` stores the explicit site list when `access_all_sites=false`.
- The legacy `organization_members.site_id` column remains for schema compatibility but is no longer the source of truth for authorization.
- Auth sessions resolve both `accessAllSites` and `siteIds`.
- Server routes must verify site scope with the authenticated session; UI filtering alone is not sufficient.


## SaaS plans and subscriptions

Migration `008_saas_plans_and_subscriptions.sql` introduces the commercial SaaS layer.

- `billing_plans` stores Trial, Básico, Medio and Pro definitions and their default entitlements.
- `organization_subscriptions` stores one effective subscription per organization, including status, trial dates, monthly period dates, source and whether limits were commercially overridden.
- `subscription_events` records plan lifecycle events.
- effective operational limits continue to live in `organization_limits`; assigning or changing a plan copies the plan defaults there, allowing later per-customer overrides without mutating the catalog plan.
- expired/suspended/canceled tenant subscriptions are blocked from the authenticated dashboard while their data remains intact.
- the public test checkout is intentionally a provisioning simulator, not a payment processor. It can be disabled with `TEST_CHECKOUT_ENABLED=false`.

Migration `009_organization_branding.sql` adds per-organization white-label branding. Only an active Pro company administrator may change tenant branding. The dashboard shell applies the organization name/colors/logos after authentication; global Desweb branding remains the fallback.



## Dashboard shell, exports and field attendance

The authenticated dashboard shell is shared across desktop and mobile and is permission filtered before any user customization is applied.

- `components/DashboardSidebar.tsx` implements the retractable desktop sidebar, per-user module ordering, drag-and-drop plus accessible reorder controls, persisted collapsed state, the responsive drawer, and the field-role mobile navigation mode.
- Database-backed users persist sidebar preferences through `user_dashboard_preferences` created by migration `012_user_dashboard_preferences.sql`; the bootstrap developer identity uses browser-local fallback preferences because it has no database user row.
- Technician and External collaborator mobile layouts prioritize Dashboard, Orders, Attendance and Assets while preserving access to every authorized module through the full drawer.
- Desktop account controls are anchored in the contextual header's top-right area. The authenticated user's photo is resolved only when a stored avatar exists; Help, permitted Settings and the account dropdown no longer occupy the bottom of the sidebar.
- The module tool/search portal remains between the contextual module identity and the account controls so the account identity is the final right-edge control.

Company, Site, Sub-location and User/Technician directory drill-downs use `EntityProfileWorkspace` as an **in-page module view**, not as a modal. Selecting a record hides the directory body and renders the profile in the same authenticated workspace below the persistent module header. Breadcrumbs are part of the profile contract and expose Home/module/parent/current hierarchy. The left column is stable identity context (photo/logo, entity status, statistics and quick actions); the right column switches independent tabs in place. Returning through a breadcrumb restores the parent directory or parent Site profile without dismissing an overlay.

Site and Sub-location profiles are fed only with already-authorized directory data. User/Technician profile aggregates are computed by server-scoped User queries. Company profiles preserve protected edit confirmation, geofence/site context, resource entitlements and full-record navigation while adopting the same visual shell.

Location/Sub-location Technician lists are not persisted as a separate relation. The Locations server page projects them from `work_order_tasks`: direct `assigned_to` users and members of an assigned Crew are normalized into distinct Activity/User assignments, then filtered by the authenticated organization/Site scope. This keeps Work Order Activities authoritative and allows Location profiles to update automatically as assignments change.

`/api/profile-export` is a separate report boundary from Dashboard exports. It accepts only allow-listed entity types and formats, validates UUID identifiers, re-checks module permission and organization/Site scope on the server, and then generates one-record Hoja de vida output. PDF uses `pdf-lib`, Excel uses a real `exceljs` XLSX workbook, and the Word option currently emits a Word-compatible `.doc` HTML document.

Dashboard reporting keeps one authorization/filter scope across interactive metrics and exports.

- `components/DashboardControls.tsx` exposes one **Exportar** menu for Excel (.xlsx), CSV and PDF.
- The dashboard export API generates native Excel workbooks with `exceljs`, interoperable CSV, and executive PDF reports with `pdf-lib`.
- PDF reports use the Desweb letterhead composition by default and respect tenant white-label branding where the subscription permits it.

Field attendance is optional per organization and is implemented as explicit event-based verification rather than continuous tracking.

- Migration `013_biometric_attendance_geolocation.sql` adds attendance policy, site coordinates/geofence radius, biometric templates, attendance shifts and activity execution evidence.
- `components/AttendanceCapture.tsx` performs browser camera capture and local Human 3.3.6 face description, liveness and anti-spoof inference using model files packaged under `public/biometric-models`.
- Facial verification is 1:1 against the already authenticated user. Enrollment photographs are not persisted; the numeric template is encrypted at rest by the server.
- Precise geolocation is requested only for attendance events when policy requires it. Server-side validation applies GPS accuracy, tenant/site scope and geofence distance rules.
- Attendance/productivity reporting is descriptive operational evidence and must not become an automatic personnel ranking or employment-decision engine.

## Company enterprise profile and documents

Migration `014_company_profile_documents.sql` extends `organizations` with legal/administrative/contact profile fields. These fields describe the tenant as a business entity and must not be confused with `sites`, which remain physical operational locations.

`organization_documents` stores the current corporate-document dossier. Each record includes:

- organization scope;
- category;
- required / optional / not-applicable classification;
- display name and external reference;
- issue and expiry dates;
- notes;
- optional PDF/image file bytes and MIME metadata;
- uploader and timestamps;
- archival timestamp and archiving-user attribution.

Company-document reads remain organization scoped and pass through authenticated application routes with `no-store` and `nosniff` response controls. The workspace separates **Vigentes** from **Archivados**. PDF/image files may be served inline for in-place preview, while the same authorized endpoint can still return a normal attachment download. Current accepted files are PDF, PNG, JPEG and WebP up to 10 MB.

Archiving is a reversible lifecycle state: it preserves file bytes, metadata and audit attribution. Restoring clears archive metadata and returns the record to the current dossier. Permanent deletion is intentionally separate and remains limited to the protected Platform Owner destructive flow.

Corporate documents are not stored in the generic operational attachment relationship because their lifecycle, requirement state and expiry semantics belong to the enterprise profile rather than to work orders/assets.


### Interactive site geofence configuration

`components/GeofenceMapPicker.tsx` is the shared site-position editor/viewer. It renders OpenStreetMap raster tiles, performs explicit marker adjustment and serializes address, latitude, longitude and geofence radius into the parent form. Address search is proxied through authenticated `/api/geocode` rather than exposing an unrestricted geocoder endpoint.

No new location table was introduced: migration `013_biometric_attendance_geolocation.sql` already defines `sites.latitude`, `sites.longitude` and `sites.geofence_radius_m`. Site/company mutation routes now enforce coordinate bounds and the 20–5000 m database radius constraint before persistence.

The attendance clock endpoint remains the server authority for field validation: it checks site authorization, GPS accuracy, Haversine distance against the stored site point/radius, live facial verification and the enrolled encrypted template. Client-side map circles are configuration/feedback only and never substitute server validation.


### Field presence state machine

`AttendanceCapture.tsx` treats an open `attendance_shifts` row as a **presence/availability session** at a site. It does not require a work-order task to exist before check-in.

Client sequence for check-in/out is:

1. obtain a fresh high-accuracy GPS fix;
2. assess configured authorized sites and provide nearest-site guidance;
3. reject locally when accuracy/range clearly fail;
4. activate the front camera and run facial embedding + liveness/anti-spoof checks;
5. submit GPS and biometric evidence to `/api/attendance/clock`;
6. let the server independently repeat authorization, accuracy, Haversine/geofence and facial-threshold validation before opening/closing the shift.

This sequencing reduces unnecessary camera use while preserving server authority. Task assignment is deliberately absent from the check-in preconditions. Later `activity_execution_events` correlate work against the open shift when tasks are started/completed.


### Attendance policy defaults

`lib/attendance-policy.ts` is the shared source for fallback attendance policy behavior and role evaluation. Missing policy rows resolve to an enabled default instead of silently disabling the feature. Migration `017_attendance_policy_defaults.sql` backfills only organizations with no policy row, preserving explicit tenant choices. Organization creation also inserts the default policy transactionally.


### Supervised enrollment trust boundary

Migration `018_supervised_biometric_enrollment.sql` extends biometric profiles with supervisor/site/method/verification/revocation metadata and adds `biometric_enrollment_events`.

Browser responsibilities:
- `lib/client-biometric.ts` loads Human and creates normalized live embeddings;
- `SupervisedBiometricEnrollment.tsx` collects supervisor identity confirmation, subject consent and live camera evidence;
- `AttendanceCapture.tsx` only verifies already supervised users.

Server responsibilities:
- `/api/attendance/enrollment-supervised` rechecks attendance-management permission, tenant membership, controlled role, supervisor site access and liveness threshold before storing a template;
- Supervised enrollment also requires the supervisor device to provide a precise GPS fix inside the selected site's configured geofence;
- `/api/attendance/clock` accepts only active `supervised_camera` profiles with `identity_verified_at`;
- the legacy self-enrollment route rejects mutations.

The browser's liveness outputs are evidence generated by the approved client model but remain client-originated values. Production hardening should consider signed/native capture attestation or a server-mediated verification service if the threat model requires resistance to a malicious custom client.


### Attendance contingency trust boundary

Migration `019_attendance_contingency.sql` adds `attendance_contingency_requests` and explicit check-in/check-out verification-mode columns on attendance shifts.

Normal attendance remains the preferred path. Contingency is isolated into separate endpoints:

- `POST /api/attendance/contingency`: creates a pending exception request only for an authenticated user with active supervised biometric enrollment and a valid site/action context.
- `PATCH /api/attendance/contingency/[id]`: attendance manager approves/rejects a pending request, respecting supervisor site scope.
- `POST /api/attendance/contingency/use`: consumes an approved, unexpired request once and marks the resulting attendance event as `contingency`.

The contingency use endpoint rechecks user identity enrollment, organization/site scope, current shift state and authorization expiry. It records GPS evidence when available but does not pretend that missing biometric/GPS validation occurred. Reports therefore distinguish exceptional attendance from standard verification.


### Client attendance state synchronization

Normal attendance and contingency are separate client components but share one attendance page. Successful standard check-in/check-out emits the local `attendance:shift-changed` event so the contingency component immediately switches between check-in and check-out context without requiring a page reload. Server endpoints remain authoritative; this event only keeps the same-page UI coherent.


### User manual content architecture

`lib/user-manual.ts` is the shared structured content source for both manual surfaces. It contains role metadata, process articles and user-facing recent changes. `UserManual.tsx` performs client-side role switching/search only; it does not grant access to product modules.

`/dashboard/help` derives the initial manual role from the authenticated session. `/manual` starts in general scope and is intentionally public. Because both routes render the same structured content, documentation does not need to be duplicated between a public marketing manual and an authenticated help center.


### Maps, GPS and facial identity separation

The production location stack is intentionally separated into independent trust layers:

1. **Google Maps Platform** provides current cartography and address geocoding.
2. **Browser/device Geolocation API** provides the actual GPS position and reported accuracy of the field device.
3. **Server Haversine/geofence validation** decides whether that GPS position is inside the configured site radius.
4. **Human facial verification** performs 1:1 identity verification against the encrypted supervised template.

Google Maps is not used as proof of user location by itself, and the facial engine is not used to infer location. Attendance succeeds only when the configured policy's independent controls pass.

Environment:
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: browser key restricted by allowed HTTP referrers, Maps JavaScript API only.
- `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`: optional cloud-styled map identifier.
- `GOOGLE_MAPS_SERVER_API_KEY`: server-only key restricted to Geocoding API.

The map component falls back temporarily to OSM/Nominatim if Google is not configured or an operational request fails, so migration does not block site management.


### Docker build-time Maps variables

Next.js replaces `NEXT_PUBLIC_*` references during the production build. Therefore the Docker `builder` stage explicitly declares and exports `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` as build arguments. `GOOGLE_MAPS_SERVER_API_KEY` is intentionally excluded from the browser build and remains a runtime server secret.


### Runtime Maps configuration

Container platforms do not always forward service environment variables as Docker build arguments. To avoid coupling Maps availability to a platform-specific build configuration, the authenticated `/api/maps-config` endpoint reads the browser Maps key and Map ID at request time and returns only those public browser values. `GeofenceMapPicker` loads Google Maps after fetching that runtime configuration.

The server Geocoding key is not included in this endpoint and remains runtime-only.


### Google Places autocomplete

Interactive address entry uses the current Maps JavaScript `PlaceAutocompleteElement` from Places API (New). The browser Maps key must therefore allow both **Maps JavaScript API** and **Places API (New)**. Selection fetches only the fields required by the CMMS (formatted address, location, viewport, address components and display name), then updates the existing geofence state. Server Geocoding remains as a fallback validation path.


### Business-hours model

Migration `022_business_hours.sql` introduced the original active-weekdays plus shared opening/closing-time model. Migration `024_flexible_business_schedule_document_archive.sql` adds `business_schedule` as the canonical rich seven-day JSON schedule on both `organizations` and `sites`. Each weekday can be independently enabled/closed and can carry its own opening and closing times, so weekends and exceptional weekly patterns do not have to inherit the habitual weekday range.

The legacy `business_days`, `business_open_time` and `business_close_time` columns remain populated for backward compatibility. `lib/business-hours.ts` normalizes the rich schedule and falls back to the legacy representation for older rows. Organization schedules represent the company's general attention window; each Site can carry its own operating schedule. Reaction computes **open now** using the organization's IANA timezone and exposes variable schedules as **Horario variable** when active days do not share one range.

Business hours are operational metadata only. They do not automatically disable work orders, attendance, tracking or emergency dispatch; they are currently used for map state/filtering and user context.

### Country-aware phone model

When the Company or Site country is known, the UI derives the international calling prefix instead of asking the operator to type it manually. `components/PhoneField.tsx` presents the prefix separately and captures only the national-number portion; `lib/country-calling-codes.ts` composes/parses the persisted normalized E.164-like value. The pattern is reused for Company, Site and User contact capture and for Reaction contact projections.

WhatsApp and telephone shortcuts are convenience links over an already-authorized phone value. They do not send messages on behalf of the CMMS and do not broaden access. Icon actions must keep accessible labels/tooltips so their purpose is clear on hover, focus and assistive technology.

### Reaction client-session lifecycle

Reaction tracking treats explicit logout as the authoritative session-close event. Browser refresh, route remounts and OS background suspension must not emit a disconnect because those events do not mean the technician intentionally ended the operational session. The client reuses an active tracking session when GPS resumes. Live telemetry is defined as a sample within two minutes; the supervisory map may keep the last known position visible for up to 30 minutes with a paused state to absorb mobile-browser suspension. This grace period does not claim background GPS collection occurred.

### Reaction search and detail projection

The Reaction snapshot intentionally includes a limited operational projection of Company, Site and connected-Technician profile fields needed for search and in-place detail. The projection stays behind the existing `reaction.view` authorization and tenant/site scoping. The client performs accent-insensitive search across those already-authorized records and never broadens server scope. Activity records include assignment identifiers for direct users, crews and suppliers so the detail modal can relate pending work to connected technicians without another navigation round-trip.

The right-side date-filtered alert list and entity-detail pending lists have different semantics: the side panel obeys the operator's date filter, while an entity popup deliberately shows all pending/in-progress activities for that Company/Site/Technician.

### Reaction operational alert aggregation

`/api/reaction/snapshot` is the combined read model for the Reaction workspace. It returns authorized Companies, Sites, Technician telemetry and pending/in-progress work-order activities. Activity alert dates resolve in this order: activity `due_date`, Work Order `due_at`, then Work Order `requested_at`. Date-state comparison uses each organization's configured IANA timezone. Tenant/site scope is applied server-side before the client performs interactive Company/Site/date filtering.

Migration `023_work_order_task_due_date.sql` adds an optional activity-level commitment date. New UI-created activities require this date; legacy activities remain compatible through the fallback chain above.

### Reaction connected tracking

The **Reaction** module introduces operational technician tracking independent from Attendance.

- A user with `reaction.track` (currently Technician) must grant location access before using the authenticated operational workspace.
- The browser starts a `technician_tracking_sessions` record when the first valid GPS fix is obtained.
- High-accuracy browser geolocation is observed continuously while the web application remains active. Samples are persisted approximately every 10 seconds or after meaningful movement.
- Explicit logout closes the active tracking session.
- Supervisors with `reaction.view` (Admin/Manager and platform operators) can see configured sites, connected technicians and the recent route of each technician.
- Site markers use the organization logo; technician markers use the user profile photo.
- A technician is considered live on the Reaction map only when its tracking session has a fresh heartbeat/position.
- Attendance shifts remain independent but may be linked to location samples for later reporting.

**Mobile background limitation:** a browser/PWA may be suspended by iOS/Android after the screen locks or the app moves to the background. A future native/mobile-container phase is required for transportation-app-grade continuous background GPS.


## International catalog and locale boundary

Multi-country form behavior is centralized instead of duplicated across modules.

- `lib/international-catalog.ts` is the application source of truth for supported Country codes, display names, calling codes, initial City lists, time zones, Company tax-identification types, personal identity-document types and default locales.
- `components/InternationalFields.tsx` provides reusable controlled selectors. Country→City and Country→identification relationships are resolved client-side from that catalog, while existing legacy values may be displayed as a compatibility option during migration.
- `components/PhoneField.tsx` receives the selected Country and persists E.164 phone values; the calling prefix is derived from the same catalog.
- Mutation routes that persist Country or identification-type values repeat validation server-side with catalog helpers. A handcrafted POST must not bypass the supported-value boundary.
- Migration `026_international_catalog_preferences.sql` adds `organizations.preferred_locale/default_country`, User identity-country/document fields and platform `app_customization.default_locale/default_country`.
- `/api/preferences/locale` persists the platform or tenant locale/region default after RBAC checks.
- Locale persistence is intentionally separate from translation dictionaries. The data model and settings are locale-ready; UI string translation can be rolled out module by module without changing Country/phone/document semantics.


## Supplier/requisition architecture

Supplier detail follows the shared `EntityProfileWorkspace` client pattern while its data is assembled server-side by `app/dashboard/suppliers/page.tsx`. The browser only switches the selected Supplier/tab and submits authorized mutations.

Authoritative relationships are intentionally reused:

- Service work: `work_order_tasks.service_supplier_id`;
- Supplied Inventory: `inventory_items.supplier_id`;
- Supplier documents: `supplier_documents.supplier_id`;
- Procurement request history: `supplier_requisitions.supplier_id`.

`/api/requisitions/generate` is the single requisition generator for both Supplier and Inventory entry points. It validates selected Inventory records server-side, checks tenant/Site access, groups rows by Organization + Supplier, creates one requisition header for each group and snapshots item quantity/unit/cost/destination data.

The requisition header is not an Inventory receipt. No stock mutation occurs in the requisition lifecycle endpoint. This separation preserves auditability between **requested**, **approved**, and **received** quantities.

Supplier logos are persisted on `suppliers` and served through an authenticated binary route. Supplier documents are binary records with archive/restore behavior analogous to governed Company documents.


## User statistics loading boundary

The Users directory must remain a lightweight, reliable management surface.

Base User rows include only summary counters that are cheap and required by the directory/profile shell. Higher-cost statistics such as seven-day attendance series, today's attendance duration, overdue Activities and upcoming Activity agenda are loaded on demand from `/api/users/[id]/statistics` after a User profile is opened.

This prevents a statistics/reporting query from becoming a hard dependency for loading the entire Users module. A failure in the detailed statistics endpoint must be contained inside the Statistics tab and must not prevent account administration.


## Role dashboard comparison architecture

The root `/dashboard` keeps one server-authoritative read model per role family rather than loading a universal cross-tenant dataset.

Dashboard filters now include:
- current date range;
- comparison mode: previous equivalent period or same period of the previous year;
- Work Order / Activity / Subscription status where applicable;
- authorized Site for tenant/field/requester roles;
- Work Order priority for operational records.

`lib/dashboard-filters.ts` parses and validates these values, derives the comparison range, and exposes SQL helpers for period, Site and Priority predicates. Site selection never replaces the session scope: tenant queries first enforce Organization/Site authorization and only then narrow to the selected Site.

Role-specific dashboard queries provide:
- current-period KPI aggregates;
- comparison-period aggregates using the identical authorization and contextual filters;
- six-month monthly series for the visual trend layer;
- authorized recent-detail rows and distributions.

`components/DashboardAnalytics.tsx` is presentation-only. It receives already-scoped aggregates and renders KPI deltas, evidence sparklines, monthly line charts, role context and summary tiles. It does not fetch or authorize data.

Dashboard exports remain a separate authenticated server route, but Site, Priority, status and period filters are parsed by the same filter module and re-applied to the same role scope. Comparison ranges are visual analytical context; exports contain the selected current-period dataset rather than duplicating both periods.


## Conditional directory facets and standardized dossier data

### Shared directory facet layer

`components/ModuleHeader.tsx` supports declarative facets through `facets=[{key,label,allLabel}]`. Directory records expose already-authorized values with:

- `data-filter-<key>`;
- `data-filter-<key>-label`;
- multiple facet values separated by `|`.

The client derives available facet choices from the records that were already returned by the server. A facet is rendered only when its current authorized/contextual dataset has more than one useful option. Facets cascade: selecting Company narrows the available Site/Supplier/etc. choices, while search and status filtering also participate in option derivation.

This layer is presentation-only. It **must never be used as authorization**. Server queries continue to enforce platform role, Organization, Site, assignee/provider/requester and permission scope before any facet metadata reaches the browser.

Current usage includes Companies, Locations, Users, Suppliers, Assets, Inventory, Work Orders, Maintenance, Crews and Requisitions.

### Supplier classification catalogs

Migration `029_supplier_catalog_user_dossier_financial.sql` adds:

- `supplier_capability_catalog`;
- `supplier_specialty_catalog`;
- `supplier_capabilities`;
- `supplier_specialties`.

Catalog tables use stable machine codes and human labels. Supplier forms submit repeated codes through the reusable `MultiSelectDropdown`; server routes validate every code against PostgreSQL before persisting the junction rows.

The legacy `suppliers.supplier_type` column remains a compatibility projection:
- Materials selected only → `materials`;
- one or more non-material capabilities and no Materials → `services`;
- Materials plus any non-material capability → `both`.

This preserves existing Inventory and service-assignment rules while new screens and future imports/exports use the normalized multi-value catalogs.

The old free-text `service_category` remains a compatibility/read fallback. When a Supplier is saved through the new form it is synchronized to the labels of the standardized specialties.

### User personnel dossier

`user_documents` stores organization-scoped personnel files with a controlled category code, lifecycle metadata, archive state and authenticated PostgreSQL file bytes. Access remains behind `users.manage`; tenant administrators cannot retrieve a document belonging to another Organization.

`user_emergency_contacts` stores one structured emergency/reference contact per User and Organization, including a controlled relationship code. This contact is an administrative record, not an authentication or authorization input.

### Supplier financial profile

`supplier_financial_profiles` stores Supplier payment-preparation information separately from the Supplier identity record. It includes bank/account fields, account holder, currency, payment terms and payment-contact notes.

Supplier financial data:
- is tenant scoped through the Supplier's Organization;
- requires `suppliers.manage`;
- is not used to execute bank transfers;
- is masked in the normal read summary while the authorized edit form can manage the stored value.


## Dashboard analytical failure isolation

The root Dashboard is an analytical read surface, so individual analytical query failures must not make operational navigation unavailable. `app/dashboard/page.tsx` wraps the role-specific analytical renderer after authenticated session resolution. Unexpected analytical exceptions are logged server-side and render a safe in-app recovery panel with authorized module shortcuts.

This is a resilience boundary, not an authorization fallback: the recovery view does not query or expose additional records.

## Crew eligibility and Site scope

Crew creation accepts Organization members with roles `manager`, `technician` or `external`. The creation UI filters candidates by Organization and Site access, and `POST /api/crews` independently validates the same rules server-side.

The leader is stored through `crews.leader_user_id`, remains a normal `crew_members` member, and may hold any of the eligible Crew roles. The directory reads the existing authenticated User avatar route for visual identity; it does not duplicate profile images into Crew storage.

## Procurement approval architecture

Migration `034_requisition_approval_policy.sql` adds three related layers:

1. `organization_procurement_policies` stores the current Company configuration.
2. `supplier_requisitions` stores a snapshot of the applicable policy plus the current approval state/decision.
3. `supplier_requisition_approval_events` stores the append-style decision history (`requested`, `amended`, `approved`, `rejected`, `reopened`).

The snapshot prevents mutable tenant configuration from changing the historical meaning of a requisition. The event table complements the general `audit_log`: the former is a domain-readable approval timeline while the latter remains the cross-system audit stream.

Authorization is server-authoritative. `app/api/requisitions/[id]/approval/route.ts` validates permission, Organization, configured approver scope, requester self-approval and Site scope. `app/api/requisitions/[id]/receive/route.ts` independently checks the approval gate before writing any Inventory transaction.

`app/api/requisitions/[id]/route.ts` locks the requisition and its items before applying approval-relevant amendments, preventing an approval decision from racing a changed amount/date. Quantity/cost amendments are re-evaluated against the stored threshold; a requisition that newly reaches the threshold enters approval and stays governed thereafter. Quantity, estimated unit cost and required-date changes reopen a prior decision or append an `amended` event while approval is still pending. Receipt transactions already persisted are never rolled back by reapproval.

## Supplier commercial analytics architecture

`lib/supplier-analytics.ts` centralizes the Phase 3 procurement calculations. It reads `supplier_requisitions`, `supplier_requisition_items` and requisition-linked `inventory_transactions` without adding a second analytical persistence model.

The query builds a requisition-level performance projection first, then derives:

- 12-month Supplier summary KPIs;
- six-month monthly trend grouped by first physical receipt month;
- up to 12 recent requisitions as evidence for the Supplier Statistics table.

The same shared function is consumed by the Supplier workspace and `/api/profile-export`, preventing formula drift between screen and exported Supplier records. Existing Supplier and requisition/transaction indexes provide the access path; Phase 3 does not require a schema migration.

Do not aggregate all Inventory transactions for Supplier cost analysis. Only receipt transactions carrying `requisition_id` and `requisition_item_id` are valid for these procurement KPIs.

## Supplier return architecture

Migration `035_supplier_returns.sql` introduces:

- `supplier_returns`: immutable DEV header scoped to Organization, Supplier and requisition;
- `supplier_return_items`: lines linked to requisition item, source receipt transaction, inventory item and outbound warehouse;
- `inventory_transactions.supplier_return_id`, `supplier_return_item_id` and `source_transaction_id` for Kardex traceability;
- Kardex movement type `supplier_return`.

`cmms_apply_inventory_transaction()` treats `supplier_return` as an outbound delta and leaves the existing inbound `return` semantic unchanged. The return route inserts DEV header/lines and Kardex movements in one PostgreSQL transaction.

The server locks source receipt rows before calculating prior returned quantity. This serializes concurrent return attempts through the normal route and prevents two requests from consuming the same receipt balance. PostgreSQL also validates that a return line references a real receipt for the same Organization/requisition/item and rejects stock that would go negative.

DEV headers and lines are database-immutable. Requisition gross receiving totals remain unchanged; return history is queried separately for operational and export views.


## Procurement document reconciliation architecture

Migration `036_procurement_document_reconciliation.sql` adds an evidence layer that is deliberately separate from Inventory:

- `procurement_documents`: document header, file, review state and void metadata;
- `procurement_document_lines`: immutable SKU/quantity/cost snapshots for the document;
- `procurement_document_receipts`: append-only links to physical receipt transactions;
- `procurement_document_returns`: append-only links to Supplier-return DEV headers;
- `procurement_document_events`: append-only audit timeline.

`lib/procurement-reconciliation.ts` is the canonical server-side derivation layer used by requisition UI and exports. Tolerances are 0.001 quantity units and 0.01 currency units.

Document mutation boundaries:
- file/header/core line evidence cannot be edited or deleted;
- a wrong document is voided with reason, preserving history;
- receipt/DEV evidence may be appended later;
- evidence-link inserts reopen review to pending at the database layer;
- review decisions lock the document row transactionally before deriving the current match state;
- general `audit_log` and document-domain events preserve upload, evidence-link, review and void actions.

The reconciliation layer never invokes the Inventory balance trigger and never updates `quantity_received` or Supplier-return quantities.


## Unified Inventory/Kardex import architecture

The canonical entry point remains `POST /api/bulk-import`; there is no second Supplier-specific engine. `lib/inventory-import-service.ts` centralizes mode/context semantics, Supplier identity resolution, service detection and import-folio presentation.

Inventory import pipeline:

1. determine Organization from authenticated session or valid Supplier launch context;
2. choose effective scope: Global or Context-only;
3. parse BODEGAS before product validation so workbook-declared warehouses are known;
4. parse INVENTARIO and resolve Supplier by ID → NIT/tax → code → exact name;
5. omit non-inventoriable services;
6. parse/validate KARDEX, inheriting Supplier from SKU and rejecting explicit mismatches;
7. simulate the selected movement sequence against current warehouse stock plus new-item initial receipts;
8. return validation summary/issues/Supplier groups without writing;
9. on explicit confirmation, repeat the same deterministic selected scope and commit batch, warehouses, master data and Kardex in one PostgreSQL transaction.

Migration `037_unified_inventory_import.sql` adds:
- stable Supplier import code;
- Inventory master fields needed by the workbook (subcategory, brand, model, barcode, reference price, tax rate);
- external `inventory_transactions.source_movement_id` uniqueness;
- bulk-import folio/origin/context/scope/omitted metadata.

The template route `GET /api/bulk-import/template?entity=inventory` always emits the same master workbook. Optional `supplier=<uuid>` and `data=current` affect context/preloaded data only, never column/sheet structure.

Current-data template exports master Inventory only. It sets STOCK_INICIAL to zero and leaves KARDEX blank so downloading and reimporting current data cannot duplicate historical physical movements by default.


## DESWEB Design System V2 runtime architecture — Phase 1

Frontend foundation layers:

```text
app/design-system/tokens.css
        ↓
components/ui/*
        ↓
shared/business components
        ↓
ERP modules
```

Current implementation:

- `app/layout.tsx` imports V2 tokens before `app/globals.css`;
- `app/design-system/tokens.css` contains canonical runtime foundations;
- `app/globals.css` remains the legacy production stylesheet during progressive migration;
- `components/ui` is the canonical namespace for new UI Kit components;
- `components/ui/Icon.tsx` currently bridges the existing `UiIcon` SVG system;
- `lib/design-system.ts` contains token-name metadata for documentation, not duplicate values;
- `/ui-kit` renders the real Foundations catalog using the same CSS variables;
- `scripts/design-system-smoke.mjs` validates the foundation contract in CI.

Compatibility rule:

Do not globally remap legacy variables such as `--brand-teal`, `--brand-dark`, `--bg` or `--surface` to V2 values merely to make old screens look migrated. A component/module adopts V2 when its styles and interaction states are deliberately migrated and tested.
