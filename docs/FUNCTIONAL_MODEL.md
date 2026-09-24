# Functional model and implementation order

This document preserves the product flow agreed with the project owner. Reference screenshots describe behavior and information density; they are not a visual template to copy.

## Roles

### Super administrator

- creates and activates/deactivates companies;
- assigns resource limits;
- sees platform-level metrics;
- does not operate the daily maintenance records of customer companies.

### Company administrator

- works only inside their organization;
- creates principal locations and nested sublocations;
- manages suppliers, assets, inventory, technicians and crews;
- creates routines, work orders and preventive maintenance plans.

The active access model now includes:

- **Company administrator:** users, locations and operational modules inside one organization. User access can cover all active sites or an explicit subset of sites. This is the highest organization-level role.
- **Manager / supervisor:** locations, assets, work orders, preventive maintenance and inventory for one organization.
- **Technician:** asset visibility, work-order operation, preventive visibility and inventory consultation.
- **Requester:** creates maintenance requests/work orders and sees only requests created by that account in the current foundation.
- **Viewer:** read-only visibility of assets, work orders, preventive maintenance and inventory.
- **Super administrator:** platform-wide access including companies, global personalization and cross-company user creation.

Permissions are enforced both in navigation and server-side routes. Tenant users derive their `organization_id` from the signed-in session; browser-supplied identifiers are never sufficient authorization.

User lifecycle rules:
- creation is available to authorized account administrators within their permitted scope;
- a Company Administrator with `users.manage` may create, edit, activate and deactivate ordinary users in the same organization, but cannot manage Platform Owner/Superadministrator authority or move accounts across organizations;
- Platform Owner retains the exceptional protected permanent-delete capability; routine tenant/user lifecycle should prefer deactivation where traceability matters;
- users with operational history should remain deactivated rather than being destructively removed so work-order, meter, comment and audit traceability is preserved unless the governed Platform Owner purge path is explicitly used;
- changing the organization/global scope of an account with recorded activity is blocked, while permitted role changes inside the same organization remain possible;
- organization users can be granted **all-site access** or **specific-site access**; specific assignments are stored independently and applied to operational reads/writes for locations, assets, work orders, preventive maintenance and site-scoped inventory.

## Resource entitlements

Initial controlled resources:

- principal locations (`sites`);
- sublocations (`locations`, all depths count toward one entitlement);
- assets;
- inventory articles;
- technicians.

Only the **Super administrator** can assign or change these resource entitlements. Company administrators can view assigned capacity, current consumption and proximity alerts from their own **Configuración de empresa**, but cannot edit contractual/platform limits.

Creating a record at the limit must fail on the server with a clear message. Deactivation preserves history and does not normally release an entitlement; only permanent deletion does. This rule prevents plans from being bypassed by repeatedly deactivating records.

## Operational creation flow

1. Super administrator creates a company and assigns its plan limits.
2. Company administrator creates a principal location, such as a hospital.
3. They create its hierarchy: floor, department, room, area or any required nested space.
4. They create suppliers.
5. They register assets or inventory articles and associate the supplier when applicable.
6. They place each asset/article in a principal location and optionally in an exact sublocation.
7. They create technicians and crews, selecting one crew leader.
8. They create routines, work orders and preventive maintenance linked to the physical location and assets.
9. Inventory parts may be assigned/consumed by maintenance activity, producing traceable stock movements.

## Entity distinction

- **Asset:** individually identifiable equipment or furniture; can receive work orders, preventive plans and history.
- **Inventory article:** quantity-controlled material with receipts, issues, returns and adjustments.
- **Spare part:** an inventory article consumed or reserved by a maintenance activity.
- **Supplier:** commercial party related to supplied assets/articles; it is not their physical owner or location.
- **Crew:** a temporary or stable group of technicians with one leader.

## Interaction rules

- Directory information uses modern cards with search and filters.
- Creation actions normally open modal dialogs when they would otherwise consume permanent directory space.
- **Company, Site, Sub-location and User/Technician detail does not open a modal**: selecting a record changes the current module body to the approved in-page profile workspace with breadcrumbs.
- Detail profiles start read-only to prevent accidental changes.
- Edit mode must be explicitly enabled.
- Saving and deleting require contextual confirmation.
- Destructive operations explain impact before confirmation.
- Image inputs state accepted formats, maximum size and recommended pixels.
- Motion is short and functional: hover lift, pressed button state, modal transition and clear success/error feedback.
- Sound is optional, subtle, disabled by default and must respect reduced-motion/accessibility preferences where relevant.
- Site, Sub-location and User/Technician detail uses one profile-workspace pattern: stable identity/statistics/actions on the left and an independent tabbed information panel on the right.
- Changing profile tabs replaces the right-panel content in place; it must not create a new long vertical stack for every information category.
- Hoja de vida export is a record-level action and must be generated only from data the authenticated actor may already read.

## Entity profile and Hoja de vida flow

Every profile starts with visible breadcrumbs. Company/Site/User directory selection changes the current module view instead of layering a popup. A Sub-location selected from a Site profile adds the Site as the parent breadcrumb so the operator can return one level without losing module context.

For **Empresa**, the identity column uses Company cover/logo and shows Locations, Assets, Technicians and Documents. The right panel exposes general identity, resource statistics, principal-location/map context, documentation, technicians and Hoja de vida.

For **Ubicación principal**, the identity column uses the Site image/Company logo and shows Sub-locations, Assets, active Work Orders and Technician count. The approved general-information panel includes name/code, Company, address, Zone/Locality, city/country, flexible operating hours, responsible person/title, map, contact, geofence and additional notes.

The **Técnicos** tab is a read-only projection of real Activity assignments. A Technician appears when a Work Order activity in that Site/Sub-location is assigned directly to that Technician or to a Crew that contains the Technician. No separate operational Site↔Technician assignment is created. This keeps Activity execution as the source of truth and prevents duplicated/stale assignments.

The right panel exposes general/contact/map/geofence data, statistics, Sub-locations, maintenance services, Technicians and Hoja de vida export.

Location geofence editing supports four complementary ways to resolve a point: address search/autocomplete, device GPS, map click/drag, and direct Latitude/Longitude entry. Direct coordinates are intentionally supported for remote facilities, rural assets or locations without reliable street addressing; server validation still enforces valid latitude/longitude ranges and the configured geofence radius.

For **Sububicación**, the same profile geometry uses the Sub-location reference image plus Company identity. Statistics focus on child spaces, Assets and directly related Work Orders. Editing and contextual child creation remain inside the authorized Site hierarchy.

For **Técnico/Usuario**, the identity column uses the profile photo and Company/role scope. The right panel may show identity/access information, descriptive execution statistics, Attendance/biometric state and Reaction connection context. These statistics are operational evidence only and must not become automatic worker ranking or employment decisions.

The User **Estadísticas** tab projects current CMMS evidence into one operational dashboard:

- active assigned Work Orders;
- pending Activities and Activity completions;
- seven-day and 30-day Attendance hours;
- current/open Attendance shift;
- biometric enrollment state and live Reaction connection;
- overdue Activities;
- upcoming assigned Activities with Work Order and Site context.

The dashboard may calculate presentation ratios from those facts (for example completed vs currently pending Activity counts), but those ratios are explanatory UI aids, not persisted worker ratings or automated HR decisions.

The record export menu currently offers:
- PDF — executive/printable Hoja de vida;
- Excel — native XLSX structured record;
- Word — editable Word-compatible DOC.

The export endpoint repeats authorization independently of the browser UI.

## Implementation order

1. Tenant limits and location hierarchy.
2. Suppliers.
3. Assets and asset hierarchy.
4. Inventory and stock movements.
5. Technicians and authorization (authentication/RBAC foundation already implemented; technician operational profiles continue here).
6. Crews and leadership.
7. Routines/checklists.
8. Work-order lifecycle.
9. Preventive maintenance generation and scheduling.
10. Metrics, notifications and final visual refinement.


## Commercial plans

The SaaS catalog has four active tiers:

- **Prueba:** 15 days, 1 principal location, 10 sublocations, 25 assets, 25 inventory items and 2 technicians.
- **Básico:** 3 principal locations, 50 sublocations, 150 assets, 250 inventory items and 5 technicians.
- **Medio:** 10 principal locations, 250 sublocations, 750 assets, 1,000 inventory items and 20 technicians.
- **Pro:** 30 principal locations, 1,000 sublocations, 3,000 assets, 5,000 inventory items, 75 technicians and organization white-label branding.

Paid tiers are modeled as monthly subscriptions. Pricing remains commercially configurable and is not hard-coded into product behavior.

A trial expires 15 days after activation. After expiry, the organization data is preserved but tenant users are redirected to the subscription screen and cannot operate the CMMS until a paid plan is activated.


## Mandatory operational setup sequence

The product enforces the following dependency order in both UI and mutation routes:

1. **Company** exists and is active.
2. At least one **principal location/site** exists.
3. At least one active **sublocation** exists inside the company structure.
4. **Suppliers** may now be registered.
5. **Internal technicians**, **service-provider accounts** and **external collaborators** may now be created.
6. **Crews** may be formed only after at least one executable person exists.
7. **Assets** and **inventory articles** may be created only after at least one supplier exists, and new records must reference both a supplier and a physical sublocation.
8. **Work orders** require a previously registered asset.
9. **Activities** inside a work order require an executable resource and exactly one executor: a person, a crew or a service supplier.

When a prerequisite is missing, the UI must explain the pending step and provide a direct route to the module that resolves it. Server-side routes independently enforce the same dependency; hiding or disabling a form is not considered sufficient validation.

### Outsourced-service model

Suppliers have one commercial type:

- **Materials / supplies** — supplies assets, materials or inventory;
- **Services** — performs outsourced maintenance/services;
- **Materials + services** — can participate in both relationships.

Execution identities are distinct:

- **Técnico** — internal maintenance worker belonging to the tenant.
- **Proveedor de servicios** — authenticated account representing a registered supplier whose type includes services. This account must be linked to that supplier and may only view/execute work assigned to the supplier.
- **Colaborador externo** — authenticated individual supporting specific work. A supplier relationship is optional; this user only sees/executes activities directly assigned to the person or to a crew containing that person.
- **Cuadrilla** — stable or temporary group composed of internal technicians and external collaborators, with one leader. Provider-representative accounts are not crew members.

A work activity may be assigned to exactly one of:

- an internal technician or external collaborator;
- a crew;
- a service supplier.

The assignment is traceable through the activity lifecycle: pending, in progress, completed or cancelled, with start/end timestamps and execution notes.


## Context-aware creation

Operational entities may be created from their global module or from an already-known parent context. Contextual creation is intended to reduce redundant selections without weakening authorization or dependency rules.

Current shortcuts:

- company → principal location;
- company → user;
- locations module → principal location or sublocation;
- site → sublocation;
- sublocation → asset;
- assets module → asset;
- asset → preventive routine;
- routines module → preventive routine.

When the parent context is already known, the corresponding relationship is preselected and hidden from redundant user input. The server still validates the relationship and permission independently. After a successful contextual creation, the user returns to the originating screen with success feedback.


## Field attendance, facial verification and geofencing

The CMMS includes an optional tenant-level attendance control for field personnel.

### Attendance policy

Each organization can independently enable the feature and define:

- which organization roles must register attendance;
- whether facial verification is mandatory;
- whether precise geolocation is mandatory;
- maximum accepted GPS accuracy;
- facial-similarity threshold;
- liveness / anti-spoof threshold.

Default intended field roles are **Técnico**, **Colaborador externo** and **Proveedor de servicios**. Administrators and Managers may also be included when the organization wants them to clock field attendance.

### Facial verification

Facial verification is 1:1 verification against the authenticated user's enrolled template; it is not a search across all employees.

Enrollment:
1. the authenticated user grants explicit consent in the UI;
2. the browser captures multiple live camera readings;
3. face description, liveness and anti-spoof checks run in the browser;
4. only the numeric face embedding is sent to the server;
5. the server encrypts the embedding with AES-256-GCM before database persistence;
6. the application does not persist the enrollment photograph.

Users can delete their biometric template from the attendance workspace. Deletion removes the stored template rather than only hiding it.

### Geofencing

Sites can store:
- latitude;
- longitude;
- permitted geofence radius in meters.

When geolocation is required, a clock-in/out request is accepted only when:
- browser location is available;
- reported GPS accuracy is within the organization threshold;
- the selected site belongs to the authenticated user's allowed scope;
- the measured distance is inside the site's configured radius.

### Site configuration workflow

Before a principal site can participate in geofenced attendance, its physical point is configured through the site map editor:

1. enter the postal/physical address;
2. validate/search the address and choose the appropriate result, or use the current device location when physically present;
3. adjust the marker on the map when required;
4. define the permitted radius between 20 and 5000 metres;
5. save address, latitude, longitude and radius together.

New principal sites and the initial site created during company onboarding require this configuration. Legacy sites without coordinates may still be viewed, but must be completed on their next edit. The browser map is an administrative configuration aid; attendance acceptance is always recalculated server-side from the device GPS coordinates and stored site geofence.


### Supervised biometric enrollment

Before facial attendance can be used for an account:

1. the user record exists and has a profile photo for human identity checking;
2. an authorized attendance manager selects the user and an authorized site;
3. the subject is physically present;
4. the supervisor confirms that the present person matches the selected account;
5. the subject gives biometric consent;
6. the camera captures multiple live samples and passes liveness/anti-spoof checks;
7. the server stores an encrypted template and supervisor/site/method/time metadata;
8. the user becomes eligible for 1:1 attendance verification.

Self-enrollment and self-revocation are not valid identity-establishment paths. Legacy self-enrolled templates require supervised reenrollment.

### Presence before assignment

A field user does **not** need an assigned maintenance activity in order to register presence. A valid attendance start means:

- the authenticated user is allowed to use self-attendance;
- the organization policy applies to the user's role;
- the selected/derived site is authorized and has a configured geofence when location is required;
- device GPS is available with acceptable accuracy and lies inside the permitted radius;
- live facial verification succeeds when facial verification is required.

After these checks the user is considered **in site / available**. Activities may be assigned later. Any subsequent execution events can reference the open attendance shift and record whether the work occurred during a validated presence session.


### Attendance contingency

Contingency is available only after the user has a valid supervised biometric identity.

1. Normal attendance fails or cannot be completed for an operational reason.
2. The user selects the affected check-in/check-out event, site and reason, and describes the incident.
3. The system captures available technical/GPS evidence without requiring it to succeed.
4. An authorized attendance manager reviews the request.
5. Approval creates a one-time authorization valid for 30 minutes by default.
6. The authenticated user consumes that authorization to open/close the attendance shift.
7. The shift event is permanently marked as `contingency` and linked to the reviewed request.
8. Reports expose contingency use separately for human review.

Contingency cannot replace initial biometric enrollment, cannot be reused, cannot silently convert into standard verification and must preserve the supervisor decision trail.

### Attendance shift

A field shift contains:
- user;
- organization;
- site;
- check-in/check-out timestamps;
- GPS coordinates and accuracy;
- distance from the configured site point;
- facial verification confidence;
- liveness and anti-spoof confidence.

Only one open shift per user is allowed.

### Activity/attendance correlation

Activity status changes create execution events. For authenticated executors, the event records whether an open attendance shift existed for that organization and site at execution time.

The reporting workspace shows descriptive operational measures such as:
- field hours;
- number of shifts;
- activities completed during an open shift;
- activities completed outside an open shift;
- average activity duration.

These are descriptive operational statistics only. They are not an automated employee ranking, disciplinary score, hiring/firing signal or other automated employment decision.


## Company enterprise record

The company module has two distinct information layers:

1. **Enterprise identity** — legal/commercial identity, tax identifier, administrative/fiscal address, communication channels and primary contact.
2. **Operational structure** — principal sites and recursive sublocations where assets, inventory and maintenance work exist.

Never reuse a site's physical address as the company's legal/administrative address unless the user explicitly enters the same value in both places.

### Corporate document dossier

A company document is classified as:

- **Required** — expected for that tenant and contributes to the documentation-completeness signal;
- **Optional** — useful but not mandatory;
- **Not applicable** — explicitly records that the requirement does not apply to that tenant.

The platform does not assume that Colombia-specific records such as RUT or chamber-of-commerce certificates are universally required. Categories provide common templates, while requirement level is set per company.

Document metadata may include issue date, expiry date, external reference and notes. Expired required documents are treated as pending for the company profile. Documents approaching expiry within 30 days receive an early visual warning.

Archiving removes a document from the current dossier without conflating it with permanent deletion. The Company workspace separates **Vigentes** and **Archivados**; authorized users can preview/download archived PDF/image files and restore them to the current dossier. Archive keeps file bytes, metadata and audit attribution. Permanent deletion remains a separate protected Platform Owner action and must retain the existing confirmation safeguards.

### Company/Site operating schedules

Companies and principal Sites use a seven-day operating schedule. Each day can be independently enabled or closed and every active day may use its own opening/closing range, so Saturday/Sunday or other non-habitual schedules are represented directly instead of forcing one shared weekly range.

The rich schedule is the functional source of truth for Reaction open/closed state. Legacy shared-day/shared-time fields remain compatibility data and must not be treated as a reason to flatten a variable schedule back to one range.

### Country-aware contact numbers

When a Company/Site country is known, phone forms show the international prefix derived from that country and ask the user only for the remaining national number. The persisted value is normalized for consistent display and actions. Company, Site and Technician contact surfaces may expose telephone and WhatsApp shortcuts with explanatory hover/focus tooltips; these links are convenience actions and do not send messages from the CMMS or bypass authorization.


## Platform role hierarchy — Platform Owner implemented

Desweb platform roles and customer/tenant roles are separate security domains. The **Platform Owner** layer is now implemented in authentication/RBAC; Comercial Desweb and Partner / Distribuidor remain future work.

Platform hierarchy:

```text
Propietario Desweb / Platform Owner
├── Superadministrador
├── Comercial Desweb
└── Partner / Distribuidor
```

Tenant hierarchy remains independent:

```text
Administrador de empresa
├── Manager / Supervisor
├── Técnico
├── Solicitante
├── Consulta
├── Proveedor de servicios
└── Colaborador externo
```

Core rules:

- Platform Owner is the maximum authority and the only role that may create/revoke Superadministrators.
- Superadministrators manage customer organizations and onboarding but cannot create other Superadministrators or the Platform Owner.
- Commercial and Partner accounts exist for sales/distribution and must not receive unrestricted maintenance/customer-data administration merely because they are above a customer commercially.
- Company Administrator remains the maximum role inside one tenant.
- Role level does not bypass retention, audit or destructive-action controls.
- Every user creation/edit experience must show an explanation of the selected role, scope, key permissions, restrictions and which lower roles it may create/manage.

The canonical matrix and per-role explanatory copy live in `docs/ROLE_MODEL.md`.


## Role-aware Dashboard

The former generic **Resumen** entry is now **Dashboard** and adapts its KPIs and analytical blocks to the signed-in role.

### Platform Owner

Focus:
- active paid subscriptions / plans sold;
- estimated MRR based on configured monthly plan prices;
- active customer organizations;
- lead funnel and conversion;
- plan distribution;
- recent subscription status.

Important: estimated MRR is not presented as collected revenue because the current billing model does not yet maintain a payment ledger or reconciliation table.

### Superadministrator

Focus:
- active companies;
- active trials;
- payment/subscription alerts;
- global open work orders and stopped assets;
- plan distribution and customer subscription state.

### Company Administrator

Focus:
- assets;
- open/overdue work orders;
- work completed in the month;
- technical workforce;
- low-stock alerts;
- operational costs, downtime and recent work.

### Manager / Supervisor

Focus:
- visible assets;
- work-order backlog;
- completed work;
- maintenance cost and downtime;
- 90-day work-order distribution;
- recent operational activity.

### Technician / External collaborator

Focus:
- assigned activities completed, pending and in progress;
- productivity validated inside an attendance shift;
- worked hours from attendance shifts;
- current open shift;
- recent assigned activities.

### Service provider

Focus:
- assigned supplier activity workload;
- completed, pending and in-progress activities;
- recent supplier work.

### Requester

Focus:
- own open requests;
- own requests completed in the month;
- average resolution time;
- recent request history.

### Viewer

Focus:
- read-only operational KPIs such as visible assets, work-order load and low-stock items.

All dashboard queries must preserve organization/site scope and role permissions.


## Dashboard filters and exports

Role-aware dashboards support analytical filtering without changing the user's authorization scope.

Common filters:
- month;
- explicit date range (from / to).

Platform filters:
- company active/inactive state;
- subscription state.

Operational filters:
- work-order state.

Field-worker/provider filters:
- activity/task state.

Requester filters:
- own work-order/request state.

Exports preserve the selected dashboard filters.

### PDF export

The Dashboard can generate a server-side PDF report containing the authorized filtered dataset and filter context.

### Power BI export

The Power BI action exports UTF-8 CSV with a stable tabular schema suitable for Power BI Desktop / Power Query import.

The product does not generate proprietary `.pbix` files. CSV is the supported interoperable data export.


## Modern date range and branded PDF reports

Dashboard date filtering uses one Spanish range picker instead of separate month/from/to controls.

The picker provides:
- two-calendar desktop view;
- single-calendar responsive mobile view;
- direct From / To inputs;
- quick ranges: Hoy, Últimos 7 días, Últimos 30 días, Este mes and Mes anterior;
- explicit Apply action;
- the same query-string filters used by dashboard metrics and exports.

### Enterprise PDF report

PDF export is an executive business report, not a raw table.

It includes:
- branded letterhead;
- report owner and period;
- KPI summary cards;
- status distribution chart;
- record-type distribution chart;
- executive interpretation block;
- detailed paginated table;
- branded footer and pagination.

### Pro white-label reports

When the authenticated organization is on the Pro plan with white-label enabled:
- organization branding name is used;
- configured primary / secondary colors are used;
- organization light-background logo is preferred;
- organization visual logo is used as fallback;
- Desweb attribution follows the organization's `show_desweb_branding` setting.

For non-Pro organizations and platform reports, Desweb branding is used.

PDF-lib currently embeds configured PNG and JPEG logos directly. Other image formats retain the report colors/name and fall back gracefully when the raster logo cannot be embedded.


## Company-level ownership: users and suppliers

Users and suppliers belong directly to an organization.

They do **not** require:
- a principal site;
- a sub-location.

Sites can later restrict a user's operational access, but this is an authorization scope, not ownership. New user creation defaults to organization-level access; site restrictions can be configured afterward.

Provider-role users must still reference an active service supplier from the same organization.

### Physical hierarchy

The physical branch remains:

**Company → Principal location → Sub-location → Assets / maintenance context**

This is independent from company-level Users and Suppliers.

## Visual location directory

Principal locations use a three-column visual card directory on wide screens.

Each card includes:
- site cover image;
- circular company logo;
- site name;
- country, city and address;
- sub-location count;
- asset count.

Selecting a site opens a rich information popup with:
- site identity and contact information;
- copy-data actions;
- WhatsApp action when a phone is available;
- edit action;
- sub-location creation;
- sub-location search and status filtering;
- visual sub-location cards with optional images;
- inline sub-location information/editing;
- maintenance-service / work-order search and status filtering.

Site and sub-location image uploads accept PNG/JPG/WEBP up to 5 MB.

## User visual identity

Users can store a profile photograph. User directory cards display the image when available and fall back to initials otherwise.


## International Country, City and identity selection

Country, City, telephone calling code and identification types are one related form domain.

- **Country is selected, never typed** in the migrated Company/Site/User identity flows.
- **City is selected from the chosen Country**. Changing Country clears an incompatible City and presents the new Country's available catalog.
- **Company identification type** comes from the chosen legal Country (for example NIT, RUC, RFC, RUT, CNPJ or EIN according to the configured catalog).
- **Personal document type** comes from the User/Technician's chosen Country.
- **Telephone calling prefix** comes from the same Country selection; the operator enters the remaining national number and the system serializes an international E.164 value.
- Country-driven time-zone options are used in Company profile creation/editing.
- Platform and Company settings persist **Idioma / Locale** and a **País predeterminado**. These defaults initialize future forms but do not prevent selecting another supported Country for a specific record.
- Translation rollout is progressive: a stored locale is the preference source, but existing screens remain Spanish until their string dictionaries are implemented.

The catalog is centrally extensible. Adding another Country must update the shared catalog and its validation rather than introducing a one-off free-text exception in a module.


## Supplier profile and requisitions

Supplier is now an operational profile, not only a lookup record.

Supplier types remain:

- **materials** — materials / supplies;
- **services** — outsourced service execution;
- **both** — both operational roles.

The profile projects relationships from their authoritative modules:

- **Activities** come from `work_order_tasks.service_supplier_id`;
- **Inventory / supplies** come from `inventory_items.supplier_id`;
- **Requisitions** come from `supplier_requisitions.supplier_id`;
- **Documents** are supplier-owned records in `supplier_documents`.

New Suppliers require a logo because the Supplier directory and profile use it as their primary identity image.

### Requisition model

A requisition is supplier-scoped. `supplier_requisitions` stores one header per Supplier and `supplier_requisition_items` stores the requested Inventory items, quantities, unit snapshots, estimated unit cost and destination Site/Sub-location snapshots.

Two creation paths share the same generator:

1. **Supplier → Inventarios / suministros → Requisiciones**: the available items are already limited to that Supplier.
2. **Inventario → Generar requisiciones**: the user may select items from several Suppliers. The server groups them by Organization + Supplier and creates one independent requisition per group.

Lifecycle states are `draft`, `sent`, `approved`, `rejected`, `partial`, `fulfilled`, `closed`, and `cancelled`.

Requisitioning and receiving are separate business facts. Creating, sending or approving a requisition does not mutate Inventory. Physical receipt is recorded explicitly from the requisition detail: each received line inserts an Inventory `receipt` transaction linked by `requisition_id` / `requisition_item_id`, and the Kardex trigger is the only source of stock increases. `quantity_received` is reconciled in the same database transaction; partial delivery sets `partial`, and complete delivery sets `fulfilled` with `fulfilled_at`.


## Role dashboard KPI comparison model

The Dashboard is an analytical workspace tailored to the authenticated role.

Shared behavior:
- the selected date range is the current analytical period;
- KPI cards compare against the immediately preceding equivalent-length period by default;
- users may switch the comparison to the same period of the previous year;
- six-month trend charts use real operational/commercial records and do not fabricate missing values;
- tenant, field and requester roles may narrow data by authorized Site and Work Order Priority;
- screen and export filters preserve identical authorization boundaries.

Role emphasis:
- **Platform Owner:** paid-plan growth, new estimated MRR, new Companies and Leads/conversion.
- **Superadministrator:** Company onboarding, Trials, payment-attention state and global operational activity.
- **Company Administrator:** authorized asset footprint, open Work Orders, preventive compliance and workforce/inventory context.
- **Manager / Supervisor:** open/completed/overdue Work Orders, maintenance cost, downtime and operational distributions.
- **Viewer:** read-only asset, completion, preventive-compliance and cost overview.
- **Technician / External collaborator:** assigned Activity completion, pending workload, attendance hours and within-shift execution evidence.
- **Provider:** Supplier-assigned Activity completion and active service workload without exposing unrelated worker attendance.
- **Requester:** only the requester's own requests, resolution time, closure ratio, priority distribution and monthly request trend.

Field-person analytics remain descriptive evidence. KPI comparison must not be converted into automatic worker ranking, disciplinary scoring or employment decisions.


## Contextual directory filtering

Directory filtering follows a progressive-disclosure rule: **do not show a facet when it cannot reduce the current authorized dataset**.

Examples:
- Company appears only when the visible records belong to more than one Company.
- Site appears only when more than one relevant Site exists after the active Company/search/status filters.
- Supplier, Role, Category, Priority, Type and similar facets follow the same rule.
- Sublocation Type appears inside a Site only when multiple types are present.

Current domain facets:
- **Companies:** plan, Country, City.
- **Locations:** Company, Country, City; internal Sublocations add Type.
- **Users:** Company, Role, Site, linked service Supplier.
- **Suppliers:** Company, capability/type, specialty, Country.
- **Assets:** Company, Site, Criticality, Asset Category, Supplier.
- **Inventory:** stock state, Company, Site, Supplier.
- **Work Orders:** status, Company, Site, Priority, Work Order Type.
- **Preventive Maintenance:** Company, Site, frequency unit.
- **Crews:** Company, Site.
- **Requisitions:** status, Company, Supplier, requester.

These filters accelerate browsing but never change the authorized record population.

## Supplier standardized classification

A Supplier can have **multiple capabilities** and **multiple specialties**.

Capabilities represent the broad commercial relationship (materials, technical services, contractor/works, equipment rental, consulting/engineering, logistics, technology/software, general services).

Specialties represent normalized operational categories such as HVAC/refrigeration, electrical, mechanical, plumbing, civil works, fire protection, elevators, generators, automation, calibration, IT/networks, cleaning, pest control, spare parts, hardware/tools, PPE, environmental services and others in the central catalog.

Business rules that historically depend on `materials/services/both` continue using the derived compatibility field until those consumers are explicitly migrated.

## User administrative dossier

Authorized User profiles include:
- **Documents:** identity document, CV/résumé, ARL, EPS, pension, severance, compensation fund, parafiscal/PILA records, bank certificate/account evidence, contract, certifications and other controlled categories.
- **Emergency contact:** name, normalized relationship, phone, optional email and notes.

Document archive is reversible. These files are administrative evidence and do not alter attendance, biometric identity, RBAC or assignment logic.

## Supplier financial information

Supplier profiles include a separate Financial Information tab for payment preparation:
- bank;
- account type and account number;
- account holder and identification;
- currency;
- payment term in days;
- payment email;
- payment instructions/notes.

This information supports administrative payment preparation only. Desweb CMMS does not initiate or authorize a banking transaction from these fields.


## Crew composition and leadership

A Crew is a Site-scoped execution team. Eligible participants are:
- Technician;
- Manager / Supervisor;
- authorized External collaborator.

The **leader is selected explicitly** from the eligible people and is not inferred from role seniority. A Supervisor may lead Technicians, a Technician may lead a mixed team, and the selected leader is automatically part of the Crew.

Every selected person must:
- be active;
- belong to the same Organization as the Crew;
- have access to the selected Site (all-sites access or explicit Site membership).

The visual Crew directory emphasizes the leader's photo and contact actions, then shows operational counters and the remaining roster. These counters are workload/history summaries and are not employee ranking or performance scoring.

## Requisition approval functional model

A Company can configure one procurement approval rule:

- **none**: requisitions do not require a decision before receipt;
- **all**: every new requisition requires approval;
- **threshold**: approval is required when estimated requisition value is greater than or equal to the configured threshold.

The rule also defines the authorized role scope (`admin_only` or `admin_manager`) and whether requester self-approval is allowed. Self-approval is disabled by default.

Approval lifecycle:

1. creation snapshots the Company policy and places approval in `pending`;
2. the receipt action is unavailable and is also rejected server-side;
3. an eligible approver records **Approve** or **Reject** from the approval workspace;
4. rejection requires a reason;
5. approval enables receipt; rejection prevents receipt;
6. if a requisition initially below a stored threshold is amended until it reaches that threshold, it enters approval automatically;
7. once a requisition has required approval, lowering the amount does not remove that governance requirement;
8. a later change to requested quantity, estimated unit cost or required date after a decision reopens approval;
9. historical receipt/Kardex records remain untouched;
10. every approval transition remains visible in the requisition audit timeline.

`approved` and `rejected` are decision states, not ordinary status values that a user may assign from the generic lifecycle selector.
