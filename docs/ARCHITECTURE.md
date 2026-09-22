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
- `app/dashboard/companies/CompanyDirectory.tsx` — protected directory detail popup, edit mode and destructive-action confirmation.
- `app/dashboard/companies/[id]/` — full company and site administration.
- `app/dashboard/locations/[id]/` — recursive physical hierarchy below a principal site.
- `app/api/organizations/[id]/` — company updates, status changes, visual assets and site creation.
- `app/api/organizations/[id]/assets/[asset]/` — authenticated company logo and cover delivery.
- `lib/organization-assets.ts` — company image validation and conversion.
- `app/api/sites/[id]/` — site updates and status changes.
- `app/dashboard/settings/` — role-aware settings: global platform settings for superadministrators and read-only organization capacity/information for company administrators.
- `app/dashboard/personalization/` — global visual branding resources, linked from settings.
- `app/api/customization/` — branding upload and asset delivery routes.
- `components/ThemePreferences.tsx` — persisted light/dark/system appearance preferences.
- `components/DashboardNavigation.tsx` — permission-filtered active sidebar/header navigation.
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
- archival timestamp.

Active company documents are retrieved only within their organization and downloads pass through authenticated application routes with `no-store` and `nosniff` response controls. Current accepted files are PDF, PNG, JPEG and WebP up to 10 MB.

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
