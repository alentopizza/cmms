# Architecture and product decisions

## ADR-001 — PostgreSQL as system of record

Status: accepted.

PostgreSQL is used for all core CMMS operational data. This supports relational integrity among companies, sites, assets, plans, work orders and inventory.

## ADR-002 — Explicit SQL migrations instead of ORM

Status: accepted for current phase.

The project uses SQL migrations and `pg` directly. This keeps database behavior explicit and avoids introducing an ORM during the first product iterations.

Migration files are immutable after they have been applied in production. Schema changes require a new migration.

## ADR-003 — Multi-company from the first schema

Status: accepted.

Multi-tenancy is not a later add-on. Operational records carry `organization_id`, with sites providing additional local segmentation.

## ADR-004 — Easypanel + Docker deployment

Status: accepted.

Production deployment is from GitHub branch `main`, using `Dockerfile`, with PostgreSQL as a separate persistent service.

## ADR-005 — Bootstrap admin authentication

Status: retained as fallback.

The environment-configured administrator remains available as an emergency/developer superadministrator. Normal application users authenticate from PostgreSQL and receive role/tenant-aware sessions.

## ADR-006 — Public URL based redirects

Status: accepted.

Because Easypanel proxies requests to an internal container hostname, HTTP redirects must use `NEXT_PUBLIC_APP_URL` via `lib/urls.ts`. Using `request.url` directly caused browsers to be redirected to the internal Docker hostname.

## ADR-007 — Login dashboard preview uses illustrative data

Status: accepted.

The login page displays representative CMMS metrics to communicate the application's purpose before authentication. These values are static illustrative examples, not live customer metrics, and the UI must make this distinction clear.

The preview focuses on:
- asset availability;
- open work orders;
- preventive maintenance compliance;
- asset criticality.


## ADR-008 — Company visual assets in PostgreSQL

Status: accepted.

Each company can store a logo and a point-of-reference cover image. The binary files and their MIME metadata live on the `organizations` record and are delivered through authenticated asset routes.

This follows the existing durable PostgreSQL asset strategy and avoids relying on the ephemeral application filesystem during Easypanel redeploys. Uploads are limited to PNG, JPEG or WebP, with separate size limits for logos and covers.

## ADR-009 — Sites as principal locations and recursive sublocations

Status: accepted.

The existing `sites` table represents the top-level operational location (for example a hospital). Subordinate spaces use one recursive `locations` table instead of separate tables for floors, rooms and areas. This supports unlimited practical depth and preserves one consistent relation for assets, inventory and maintenance activity.

## ADR-010 — Server-enforced tenant resource entitlements

Status: accepted.

The super administrator assigns creation limits in `organization_limits`. Limits must be checked by server-side mutations and never only by disabled UI controls. Current entitlements cover principal locations, sublocations, assets, inventory items and technicians; more resources can be added without changing the tenant model.


## ADR-011 — Database users, signed sessions and centralized RBAC

Status: accepted.

Application accounts use the existing `users` and `organization_members` domain model. Passwords are stored only as scrypt-derived hashes with random salts. Session cookies contain signed identity references rather than trusting browser-supplied organization or role values.

A platform role distinguishes superadministrators from organization users. Active organization roles are `admin`, `manager`, `technician`, `requester` and `viewer`. The redundant `owner` role was retired and migrated to `admin`. The permission matrix is centralized in `lib/permissions.ts`.

Authorization is defense-in-depth: navigation is filtered for usability, pages reject unauthorized direct access, API mutations re-check permissions, and tenant data queries are scoped by the organization resolved from the authenticated session.


## ADR-012 — Resource entitlements are platform-admin controls

Status: accepted.

Organization resource limits are commercial/platform entitlements rather than daily maintenance configuration. Only a platform superadministrator may assign or change them. Company administrators and other organization roles consume those limits but do not receive entitlement-management permission.

The company detail editor surfaces both current usage and configured capacity to authorized platform administrators, and entitlement changes are protected independently at the server route.


## ADR-013 — Company administrator settings are informational, not contractual

Status: accepted.

The company administrator is the highest organization-level role. It may access a tenant-specific settings view containing organization information, assigned resource capacity and current consumption.

Resource entitlement editing remains exclusive to the platform superadministrator. Company administrators receive a separate `settings.view` permission, while `company_resources.manage` remains platform-only.

Capacity health uses three visual states: normal below 80%, warning from 80% through 94%, and critical at 95% or above.


## ADR-014 — Plans define defaults; organization limits remain effective entitlements

Status: accepted.

Commercial plans define default capacity and product capabilities. Assigning a plan copies its capacity into `organization_limits`, which remains the effective enforcement source. This allows negotiated per-customer overrides without changing the shared plan catalog.

## ADR-015 — Trial expiration blocks operation without deleting tenant data

Status: accepted.

The Trial plan lasts 15 days. When it expires, tenant authentication may still identify the account, but operational dashboard access is blocked and the user is directed to select a paid plan. Tenant data is retained for recovery after purchase.

## ADR-016 — Pro enables organization white label

Status: accepted.

White-label branding is an entitlement of the Pro plan. Organization administrators on Pro may configure their panel name, primary/secondary colors and light/dark logos. Non-Pro tenants always use platform branding.


## ADR-017 — Documentation is part of the product deliverable

Status: accepted.

Repository documentation is the continuity mechanism for developers and AI agents. Meaningful changes are incomplete until the changelog and all affected source-of-truth documents are updated. Chat history must not be required to reconstruct product direction.

## ADR-018 — Downloadable edition uses the same web architecture

Status: accepted.

The first installable edition of Desweb CMMS is a Docker Compose/self-hosted package running the same Next.js application and PostgreSQL data model as the hosted service. A separate desktop application is not required for distribution.

## ADR-019 — Licensing and IP are separate concerns

Status: accepted.

Software copyright/authorship, trademarks, patents for any qualifying technical invention, and commercial self-hosted licensing are separate protection mechanisms. No open-source license will be added without explicit product-owner approval.


## ADR-014 — Operational entities are created in dependency order

Status: accepted.

The CMMS does not allow operational master data to be created in an arbitrary order. The required dependency chain is:

`organization → site → sublocation → supplier → workforce/crew → asset/inventory → work order/activity`

This order is a domain-integrity rule, not merely onboarding guidance. Mutation routes must reject creation when prerequisites do not exist, and affected screens must tell the user which previous step is missing and link to it.

New assets and inventory articles require a supplier and an exact sublocation. Activities require exactly one executable target: person, crew or service supplier.

## ADR-015 — Outsourced companies and external individuals are separate access concepts

Status: accepted.

A commercial **service supplier** and a human **external collaborator** are different domain concepts.

The organization role `provider` represents an authenticated account for a supplier that provides services. It must reference `organization_members.external_supplier_id`, and visibility/execution is restricted to work assigned to that supplier.

The organization role `external` represents an individual external collaborator. Supplier linkage is optional. This identity may execute only activities assigned directly to the user or to a crew containing that user.

Crews contain internal technicians and external collaborators. Provider-representative accounts are excluded from crew membership.

This separation avoids granting an entire supplier's scope to every external individual and preserves auditable responsibility for outsourced work.


## ADR-016 — Field attendance uses 1:1 facial verification, not employee identification

Status: accepted.

The attendance feature may verify that the already authenticated user matches that user's enrolled facial template. It must not scan the camera against a company-wide biometric gallery to determine identity.

The browser performs face embedding, liveness and anti-spoof inference. The server receives the numeric embedding for one-to-one comparison with the authenticated user's encrypted template.

Enrollment photographs are not persisted. Biometric templates are encrypted at rest and can be deleted by the enrolled user.

## ADR-017 — Attendance geolocation is event-based and site-scoped

Status: accepted.

The product records precise location only during explicit attendance events (check-in/check-out) rather than implementing continuous background location tracking.

Each site owns a geofence point and radius. Server-side validation checks GPS accuracy, tenant/site scope and distance to that geofence.

This minimizes location collection while still supporting field attendance evidence.

## ADR-018 — Productivity metrics are descriptive, not automated employment decisions

Status: accepted.

The CMMS may aggregate attendance and activity execution into descriptive metrics such as field hours, activity completion during a registered shift and average activity duration.

The platform must not automatically rank workers, assign disciplinary outcomes, make termination/hiring decisions or otherwise make high-impact employment decisions from biometric, location or productivity data. Such interpretation remains under accountable human review.


## ADR-020 — Enterprise profile is separate from operational sites

Status: accepted.

An organization is both a SaaS tenant and a business/legal entity. Its administrative/fiscal address and corporate contact data belong to the organization profile. Physical operating places continue to belong to `sites`.

The application must not infer or synchronize these addresses automatically because a legal/administrative office may differ from every maintenance site.

## ADR-021 — Corporate documents use a dedicated governed dossier

Status: accepted.

Corporate/legal/commercial documents require requirement level, issue/expiry dates, references and dossier-specific lifecycle semantics. They therefore use `organization_documents` instead of logo/cover columns or generic maintenance attachments.

The dossier is tenant scoped. Requirement classification is per company rather than globally hard-coded, so country-specific documents can be marked required, optional or not applicable. Current files are retained in PostgreSQL for the same durability reasons as other configuration assets, with a 10 MB per-document upload limit.


## ADR-022 — Platform governance and tenant authorization are separate hierarchies

Status: accepted for future implementation.

Desweb CMMS will separate platform/commercial identities from customer operational identities.

Platform roles:
- Propietario Desweb / Platform Owner;
- Superadministrador;
- Comercial Desweb;
- Partner / Distribuidor.

Tenant roles continue to be scoped to one customer organization, with Administrador de empresa as the highest tenant role.

A sales or partner relationship does not grant operational authority over customer maintenance records. Platform/commercial visibility and tenant permissions must be modeled independently.

## ADR-023 — Platform Owner is the final privilege ceiling

Status: accepted for future implementation.

`platform_owner` is the intended internal key for the maximum Desweb authority. The UI should use **Propietario Desweb** or **Propietario de plataforma**, not SeoAdmin as the canonical role name.

Only the Platform Owner may create or revoke Superadministrators. No ordinary account may promote itself to Platform Owner, and Superadministrators cannot create peers.

Exceptional destructive operations remain governed workflows requiring explicit validation, reauthentication, audit evidence and any configured backup/approval/cooling-off steps. Maximum role level is not a one-click bypass of lifecycle safeguards.

See `docs/ROLE_MODEL.md` for the approved target matrix.
