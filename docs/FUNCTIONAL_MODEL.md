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
- creation is available to authorized account administrators;
- editing, activation/deactivation and permanent deletion are reserved to the platform superadministrator in the current hierarchy;
- users with operational history are never permanently deleted; they must be deactivated so work-order, meter, comment and audit traceability remains intact;
- changing the organization/global scope of an account with recorded activity is blocked, while role changes inside the same organization remain possible;
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
- Creation and detail actions normally open modal dialogs.
- Detail dialogs start read-only to prevent accidental changes.
- Edit mode must be explicitly enabled.
- Saving and deleting require contextual confirmation.
- Destructive operations explain impact before confirmation.
- Image inputs state accepted formats, maximum size and recommended pixels.
- Motion is short and functional: hover lift, pressed button state, modal transition and clear success/error feedback.
- Sound is optional, subtle, disabled by default and must respect reduced-motion/accessibility preferences where relevant.

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

Archiving removes a document from the current dossier without rewriting historical migrations or conflating it with operational attachments.


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
