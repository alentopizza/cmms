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

Status: accepted and foundation implemented.

`platform_owner` is the intended internal key for the maximum Desweb authority. The UI should use **Propietario Desweb** or **Propietario de plataforma**, not SeoAdmin as the canonical role name.

Only the Platform Owner may create or revoke Superadministrators. No ordinary account may promote itself to Platform Owner, and Superadministrators cannot create peers. Migration `015_platform_owner_role.sql` adds the persistent role and promotes `admin@dominio.com` when present; the environment bootstrap account also resolves as Platform Owner.

Exceptional destructive operations remain governed workflows requiring explicit validation, reauthentication, audit evidence and any configured backup/approval/cooling-off steps. Maximum role level is not a one-click bypass of lifecycle safeguards.

See `docs/ROLE_MODEL.md` for the approved target matrix.


## ADR-024 — Contextual forced edit/delete is exclusive to Platform Owner during development

Status: accepted and implemented.

The project owner requires unrestricted cleanup and correction of development data, but this capability must live inside the normal CMMS modules rather than in a separate destructive administration module.

Therefore:

- records expose contextual **Editar / Eliminar** actions to `platform_owner` only where an owner override is needed;
- no standalone purge workspace, sidebar module or table browser is exposed;
- Superadministrators and tenant roles retain their existing authorization hierarchy and normal traceability rules;
- forced deletion uses the PostgreSQL FK-driven transactional engine internally;
- forced owner updates use a server-side allow-list of tables and editable fields;
- Platform Owner self-deletion remains blocked;
- forced updates/deletes are recorded in `audit_log`.

Before commercial release, destructive owner behavior must be hardened with the previously approved reauthentication/MFA/approval/retention controls.


## ADR-029 — Supervised facial enrollment establishes biometric identity

Status: accepted.

A live facial template proves continuity with a previously enrolled face, but self-enrollment alone cannot prove that the first enrolled face belongs to the account holder. Therefore Desweb CMMS uses supervised initial enrollment.

Rules:
- an authorized company Admin or Manager selects the user and enrollment site;
- the person must be physically present;
- the supervisor uses the profile photo/account record only as a human identity aid;
- the supervisor explicitly confirms identity and consent;
- the browser captures a live face with liveness/anti-spoof checks;
- only the numeric embedding is persisted, encrypted at rest;
- the server records supervisor, site, method and timestamp;
- existing legacy self-enrolled templates are not trusted for attendance until supervised reenrollment;
- users cannot self-replace or self-revoke their biometric template;
- revocation removes the usable encrypted template while preserving non-biometric audit metadata.

This remains 1:1 verification of an authenticated account. It is not face search or company-wide biometric identification.


## Reaction tracking boundary

**Decision:** Reaction location tracking is tied to the Technician's connected operational session, not to the Attendance shift.

**Why:** emergency-response coordination needs to know where available technicians are before an OT or attendance event is necessarily opened. Attendance remains proof-of-presence/working-time evidence; Reaction is dispatch/location telemetry.

**Privacy/operational boundary:** location permission is explicit and mandatory for the Technician role, the UI displays an active-tracking indicator, the session ends on logout, stale sessions disappear from the live view, and only supervisory Reaction roles can view other technicians.

**Mobile constraint:** browser/PWA tracking is acceptable for the first phase, but continuous background tracking comparable to transport apps requires a native/mobile-container implementation with OS background-location permissions.


## ADR-030 — Business hours are day-specific but preserve legacy schedule columns

Status: accepted and implemented.

A single opening/closing pair is insufficient for real operating schedules because weekends and individual weekdays may differ or be closed. Companies and Sites therefore store `business_schedule` as the canonical rich seven-day JSON schedule.

The existing `business_days`, `business_open_time` and `business_close_time` columns remain synchronized as compatibility fields. New code that needs current open/closed state should normalize through `lib/business-hours.ts` instead of reading only the legacy pair.

## ADR-031 — Archiving Company documents is reversible retention, not deletion

Status: accepted and implemented.

Company dossier documents may leave the active compliance view without losing historical evidence. **Archive** therefore preserves file bytes, metadata and audit attribution; **Restore** returns the record to the active dossier. Permanent deletion is intentionally separate and remains restricted to the Platform Owner protected destructive workflow.

This distinction must be preserved in future document bulk actions, exports and compliance reporting.


## ADR-032 — Operational entity details use a stable identity rail plus independent content tabs

Status: accepted and implemented.

Companies, principal Sites, Sub-locations and User/Technician records use one shared profile-workspace geometry **inside the current module page**. Directory selection replaces the directory body instead of opening a modal. Breadcrumbs are mandatory and carry Home/module/parent/current context. Identity context remains visible while the operator changes information categories: the left rail contains the record image/logo/photo, entity state, compact operational statistics and quick actions; the right side contains independent tabs whose content changes in place.

This avoids both modal detail overlays and the previous pattern where every information category extended one long detail surface, while keeping the information hierarchy reusable for future entity profiles.

Desktop account/system actions are anchored at the far-right contextual header rather than a persistent lower-left account card. Mobile field roles keep the existing **Más** bottom sheet because it is better suited to touch/safe-area constraints.

Record-level **Hoja de vida** export is part of the profile action model for Company, Site, Sub-location and User/Technician. It is not a client-side dump: `/api/profile-export` independently revalidates authentication, module permission, organization ownership and Site scope before generating PDF, native XLSX or Word-compatible DOC output. Future entity types may join this endpoint only after defining their authorization and read model.


## ADR-033 — International form geography and identity use one central catalog

Status: accepted and implemented as foundation.

Desweb CMMS is intended for multi-country distribution. Country, City, telephone prefix, tax-identification type, personal identity-document type and Country-related time zone must therefore be modeled as related controlled data rather than independent free-text strings.

Rules:

- normal user-facing Company/Site/User forms select Country from the shared catalog;
- City choices are dependent on Country;
- legal/tax identification types and personal document types are Country dependent;
- telephone calling codes are derived from the selected Country and phones are persisted internationally;
- mutation routes validate catalog membership server-side;
- platform and tenant configuration may define a default Country/Locale that initializes new records but does not hard-lock a tenant to one Country;
- module code must not maintain private Country lists or reintroduce editable Country codes.

The initial City lists are curated product data rather than an exhaustive global municipality authority. Expanding geographic coverage belongs in the shared catalog (or a future authoritative geographic-data service), not in individual forms.

Locale preference persistence is approved separately from full translation coverage: the platform can store a preferred locale before every UI string has been migrated to translation dictionaries.


## ADR-034 — Requisitions are independent per Supplier

Status: accepted and implemented.

A material requisition must have exactly one Supplier header. Users may start the process from a Supplier profile or from Inventory, but the resulting persistence rule is identical.

When a user selects Inventory items belonging to multiple Suppliers, the server groups by Organization + Supplier and creates an independent requisition for each Supplier. A mixed-Supplier requisition is not permitted.

Consequences:

- `supplier_requisitions.supplier_id` is mandatory and authoritative;
- `supplier_requisition_items` may only contain items validated for the same Supplier and Organization at creation;
- Supplier profile requisitions only expose that Supplier's Inventory items;
- Inventory may offer a multi-Supplier selection UI because the backend performs the split;
- requisition lifecycle changes never mutate Inventory stock;
- receiving and stock entry remain a separate operation/transaction;
- Supplier Activity and Inventory tabs remain projections from Work Orders and Inventory rather than duplicate assignment tables.


## ADR-035 — Role dashboards compare server-scoped periods

**Decision:** KPI comparisons and six-month dashboard trends are computed from the same server-authorized role scope as the visible current-period data.

**Rationale:**
- a dashboard comparison is only meaningful when both periods use identical tenant/Site/assignee/provider/requester boundaries;
- UI-only comparison arithmetic could accidentally compare different populations or expose unauthorized records;
- Site, Priority and status filters must narrow both current and comparison datasets consistently;
- export parity requires one shared filter contract rather than screen-only state.

**Consequences:**
- `lib/dashboard-filters.ts` derives the comparison period and validates filter inputs;
- current and comparison KPI aggregates are queried server-side;
- default comparison is the immediately previous equivalent period, with previous-year comparison as an explicit alternative;
- six-month chart series contain stored monthly values and zero-fill missing months;
- dashboard exports contain the selected current period and preserve the same role, Site, Priority and status scope;
- field-person comparisons remain descriptive evidence and must not become rankings or automated employment decisions.


## ADR-036 — Conditional facets and controlled multi-value catalogs

**Decision:** Reusable module filters are derived from the authorized record set and only rendered when they can meaningfully narrow it. Supplier type/specialty becomes a controlled multi-value catalog instead of new free-text entry.

**Why:**
- operators with one Company should not spend space on a Company filter that cannot change the result;
- platform operators need fast Company-first narrowing across shared directories;
- cascading choices reduce noise and prevent selecting a Site/Supplier unrelated to the active context;
- free-text Supplier categories create spelling/casing/synonym drift that damages spreadsheet imports, exports, reporting and future integrations;
- Suppliers legitimately span multiple commercial capabilities and specialties.

**Consequences:**
- `ModuleHeader` is allowed to read facet metadata only from server-authorized DOM records and may only hide/narrow those records;
- server authorization remains mandatory and independent of filters;
- Supplier capability/specialty codes live in PostgreSQL catalogs and junction tables;
- every submitted Supplier code is server validated;
- legacy `supplier_type` is derived for compatibility until existing domain consumers migrate;
- new governed classifications should prefer stable codes and catalog expansion over writable free text.

## ADR-037 — Personnel documents and Supplier payment data are separate protected dossiers

**Decision:** Personnel documents/emergency contacts and Supplier payment information are modeled separately from authentication, biometric templates and generic maintenance attachments.

**Why:**
- employment/administrative documents have different privacy and lifecycle requirements from operational attachments;
- emergency contacts should not become User login/profile identity fields used by authorization;
- Supplier banking/payment preparation data should not be mixed into public/commercial card metadata.

**Consequences:**
- User dossier files require `users.manage` and Organization scope;
- User document archive is reversible;
- emergency contact is one structured Organization-scoped record per User;
- Supplier financial data requires `suppliers.manage` and is masked in read summaries;
- neither dossier can independently grant access, verify biometric identity or execute a financial transaction.

## ADR — Requisition approval uses Company policy snapshots and a separate audit timeline

**Status:** Accepted — 2026-09-24.

### Decision

Procurement approval is configured at Company level, but the applicable rule is snapshotted onto each requisition at creation. Approval decisions are performed through a dedicated server-authoritative action and stored both as current requisition state and as append-style domain events.

### Why

Using only the live Company setting would make old requisitions change meaning after an administrator edits the policy. Using only a mutable status field would lose who approved/rejected, when, under which rule and whether the request changed afterward.

### Consequences

- existing requisitions are not retroactively opted into or out of approval when Company settings change;
- receipt routes must independently enforce current requisition approval state;
- approval permission is distinct from generic requisition write permission;
- requester self-approval is explicitly governed;
- quantity, estimated cost or required-date changes invalidate a previous decision and reopen approval;
- prior Inventory/Kardex receipt history remains immutable;
- `supplier_requisition_approval_events` is the domain timeline and `audit_log` remains the cross-cutting audit record.
