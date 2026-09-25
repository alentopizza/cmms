# Roadmap


## Recently completed internationalization foundation

- shared Country catalog with calling codes, time zones, Company tax-identification types and personal document types;
- dependent Country → City selectors in Company and Site creation/editing;
- Country-aware User/Technician document identity and phone prefix;
- server-side supported-value validation for migrated Country/identification flows;
- platform and tenant **Idioma y región** settings with persisted Locale/default Country;
- regional defaults applied to new Company and Location forms;
- migration 026 for locale/region and User identity persistence;
- Supplier Country/tax identity and Lead Country-aware phone capture through migration 027.

### Next internationalization work

- expand Country/City coverage according to commercial rollout markets;
- introduce translation dictionaries and progressively replace hard-coded interface strings;
- localize dates, numeric formats, currencies and generated report labels using the effective Locale.

This roadmap is directional and should be updated as priorities change.

## Foundation — implemented

- PostgreSQL database and migrations
- Docker/Easypanel deployment
- health endpoint
- multi-company schema
- sites
- asset model
- work-order model
- preventive maintenance schema
- meter schema
- inventory schema
- suppliers
- audit log
- bootstrap login
- initial dashboard
- visual login experience
- company detail and editing
- multiple site creation and editing
- company and site activation states
- visual company directory with logo and cover images
- popup-based company creation
- database-backed user login and password hashing
- signed identity sessions
- role-based navigation and server authorization
- tenant-scoped operational queries
- user and role administration module
- company administrator settings with resource-capacity health
- SaaS plan catalog and organization subscriptions
- 15-day trial lifecycle and expiration gate
- public landing and simulated checkout/provisioning flow
- advisor lead capture from the landing and Superadmin lead inbox
- Pro organization white-label foundation
- repository continuity documentation for AI/developer handoff
- Docker Compose self-hosted installation foundation
- public /downloads information page
- versioned private self-hosted ZIP/TAR packaging workflow
- retractable per-user dashboard sidebar with persisted module ordering and collapsed state
- role-aware mobile navigation foundation: drawer for broad roles and bottom navigation for field roles
- role-aware dashboard filters and executive exports in Excel (.xlsx), CSV and branded PDF
- optional field attendance with 1:1 facial verification, geofencing and execution correlation
- Reaction live-operations foundation with connected-technician tracking, recent routes, Company/Site markers, search, scoped filters and pending-activity alerts
- flexible seven-day Company/Site operating schedules consumed by Reaction open/closed state
- country-aware Company/Site/User phone capture with call and WhatsApp shortcuts
- reversible Company-document archive/restore with authenticated inline PDF/image preview
- reusable Company/Site/Sub-location/User-Technician **in-page** profile workspace with breadcrumbs, stable identity rail, statistics, quick actions and independent content tabs
- record-level Hoja de vida exports for Companies, Sites, Sub-locations and Users/Technicians in PDF, XLSX and Word-compatible DOC
- top-right authenticated account/configuration/help controls with stored User avatar support

## Implemented operational dependency foundation

- mandatory company → site → sublocation → supplier dependency;
- supplier types for materials, services or both;
- provider and external-collaborator access roles;
- crew creation with internal/external members and a leader;
- supplier + sublocation relationship on new assets and inventory items;
- activity assignment to a person, crew or service supplier;
- external/provider work visibility restricted to assigned execution scope.

## Next functional priorities

### Attendance operational track

- **Phase 1 — implemented:** explicit Company context for Platform Owner/Superadmin in Attendance, server-scoped policy/biometric administration, and User → Attendance contextual deep-link. The later biometric enhancement adds employee-initiated mobile requests with one-time human approval and keeps assisted enrollment as recovery.
- **Phase 2 — implemented:** versioned individual work schedules by person with day-specific hours, effective dates, base Site, timezone snapshot and controlled copy from Company/Site schedules. Started history is immutable and schedule planning does not block real attendance.
- **Phase 3 — implemented:** consolidated per-user attendance dossier across schedule planning, real shifts, biometric lifecycle, contingencies and administrative timeline, with Organization/Site-scoped read authorization and biometric data minimization.
- **Phase 4 — implemented:** ordered multi-Site Site/Travel segments inside one attendance shift, explicit departure/arrival evidence, optional destination Activity, final checkout Site, current-Site Activity linkage and optional Reaction route correlation.
- **Phase 5 — implemented:** scoped scheduled-vs-actual reporting with person/Site/period filters, on-Site vs Travel duration, origin/final Sites, Activity/contingency/Reaction evidence and XLSX/CSV/PDF exports from the same authorized dataset.

The planned Attendance operational track (Phases 1–5) is complete. Future Attendance changes are incremental enhancements, not an automatic Phase 6.

Implemented incremental enhancement: scalable biometric onboarding with versioned consent, active liveness challenge, one-time identity approval, exception-based coverage monitoring and audit history.

Attendance and Reaction remain separate authorities: Attendance proves presence, current Site and working-time movement events; Reaction supplies live operational route telemetry when the field session is connected.

### Current foundation slice

- organization resource limits;
- principal-location quota enforcement;
- recursive sublocation hierarchy;
- precise location references prepared for assets, work orders and inventory.

1. Suppliers and asset management
   - full asset detail;
   - category management;
   - asset hierarchy;
   - serial/model/manufacturer;
   - documents/photos;
   - status changes;
   - complete maintenance history.

2. Work orders
   - detail page;
   - assignment;
   - status workflow;
   - tasks/checklist;
   - comments;
   - attachments;
   - labor/time tracking;
   - parts consumption;
   - cost calculation;
   - completion workflow.

3. Preventive maintenance
   - plan builder;
   - recurrence;
   - meter trigger;
   - checklist templates;
   - automatic work-order generation.

4. Users and authorization
   - real user login — foundation implemented;
   - password hashing — implemented;
   - organization membership — implemented;
   - role-based authorization — foundation implemented;
   - account editing, deactivation and password reset;
   - invitations;
   - multi-site assignment and site-level operational restrictions — implemented foundation;
   - extend site scope to future suppliers, teams and remaining operational detail routes;
   - technician profile/account linkage.

5. Inventory
   - part creation/editing;
   - stock movements;
   - minimum stock alerts;
   - work-order issue/return;
   - supplier association.

6. Reporting and KPIs
   - MTTR;
   - MTBF;
   - availability;
   - preventive compliance;
   - downtime;
   - maintenance costs;
   - work-order backlog.

## Later capabilities

- notifications;
- email;
- full PWA/offline/mobile-native hardening beyond the implemented responsive role-aware shell;
- QR codes for assets;
- work requests from operators;
- recurring background jobs;
- module-wide, scheduled and additional-domain exports beyond the implemented Dashboard Excel/CSV/PDF exports;
- richer audit trails;
- external API/integrations.


## Commercialization path

1. Validate Trial/Básico/Medio/Pro provisioning with the simulated checkout.
2. Finalize monthly prices and commercial copy.
3. Integrate the selected payment provider through hosted checkout + signed webhooks.
4. Replace simulated paid activation with verified payment events.
5. Add renewal, past-due and cancellation webhook handling.
6. Finalize the public marketing landing and conversion analytics.
7. Add lead assignment, notifications, anti-spam/rate limiting and source/campaign attribution.


## Distribution and protection path

1. Stabilize a versioned release process and release notes.
2. Add automated backup/restore verification for self-hosted deployments.
3. Decide commercial self-hosted license terms before external distribution.
4. Produce signed/versioned downloadable release artifacts or container images.
5. Prepare software-authorship registration materials and trademark searches/filings.
6. Evaluate patent protection only if a specific technical invention is identified and before public disclosure of that invention.


## Recently completed company-management slice

- enterprise company profile with legal/admin/contact information;
- explicit separation between enterprise address and operational sites;
- corporate document dossier with requirement level and expiry metadata;
- authenticated document upload/download, inline preview, reversible archive and restore flow;
- country-aware Company/Site contact numbers and call/WhatsApp convenience actions;
- flexible per-day Company/Site attention schedules, including distinct weekend/closed-day behavior;
- profile-completeness and document-health indicators in the company workspace and directory.


## Recently completed rich information slice

- approved rich Información general composition for Companies and principal Locations;
- Site Zone/Locality, responsible title and additional notes persisted through migration 025;
- Location/Sub-location Technician tabs derived from Activity assignments instead of a parallel assignment relation;
- Technician projection includes direct Activity assignees and members of assigned Crews;
- Hoja de vida exports include the richer profile fields and derived Technician counts.


## Recently completed profile-workspace slice

- standardized same-screen profile drill-down for Companies, principal Sites, Sub-locations and Users/Technicians;
- visible breadcrumbs and Type / Name entity heading instead of modal detail overlays;
- persistent left identity/statistics/quick-action rail with independently switching right-side tabs;
- Site profile map/geofence, contact, schedule, Sub-location and service context;
- Technician descriptive execution, Attendance, biometric and Reaction connection context;
- contextual Technician creation from a selected Site;
- authorized Hoja de vida export in PDF, native XLSX and Word-compatible DOC;
- desktop account/configuration/help/logout moved from the lower-left sidebar to the far-right contextual header.


## Recently completed Reaction slice

- supervisor map for configured Companies/Sites and connected Technicians;
- technician profile-photo markers, recent-route samples and paused/live telemetry states;
- global search plus Company, Site, Technician and date scoping without leaving the Reaction workspace;
- pending/in-progress activity alerts with commitment-date fallback for legacy records;
- in-place Company/Site/Technician/activity detail popups;
- Company/Site open/closed state driven by the flexible operating schedule;
- country-normalized contact actions for call and WhatsApp;
- current web/PWA limitation documented: mobile OS background suspension cannot guarantee transport-app-grade continuous GPS.


## Planned platform governance and distribution roles

Implementation status:

- **completed:** add **Propietario Desweb / Platform Owner** as the final platform privilege ceiling;
- **completed:** reserve Superadministrator creation/assignment to Platform Owner;
- add **Comercial Desweb** for internal sales/advisor workflows;
- add **Partner / Distribuidor** with portfolio-scoped customer/commercial visibility;
- keep customer operational hierarchy separate, with Administrador de empresa as the highest tenant role;
- **partially completed:** server-enforced "who may create whom" rules for Platform Owner → Superadministrator; expand when Commercial/Partner roles are introduced;
- display role purpose, scope, permissions and restrictions inside every user create/edit flow;
- add privileged-action reauthentication/MFA/audit workflow before any exceptional irreversible operation;
- later connect commercial roles to lead attribution, customer portfolios, commissions, renewals, partner codes and approved discounts.

Canonical target behavior: `docs/ROLE_MODEL.md`.


## Completed development tooling

- contextual owner-only Edit/Delete actions in the normal CMMS modules;
- no standalone destructive module or data browser;
- PostgreSQL FK-driven recursive deletion engine used internally;
- allow-listed Platform Owner direct-edit endpoint for modules that do not otherwise expose full editing;
- transaction rollback on unresolved restrictive cycles;
- Platform Owner self-protection;
- audit entries for forced updates and deletes;
- definitive user/company deletion reserved to Platform Owner.

Before production hardening, reinforce this development workflow with the approved reauthentication, MFA, retention, backup and final-approval process.


## Recently completed Supplier/requisition slice

- Supplier directory redesigned around logo-led profile cards and approved in-page entity detail navigation;
- Supplier profile with general data, statistics, documents, Activities, Inventory/supplies, requisitions and Hoja de vida;
- Supplier logo required for new Supplier creation;
- service Activity projection from Work Order tasks and supply projection from Inventory;
- Supplier document upload, archive, restore and download;
- Supplier-scoped requisition schema and lifecycle;
- requisition generation from Supplier profile and Inventory;
- automatic split into one requisition per Supplier when Inventory selections span several Suppliers;
- requisition PDF, Excel and Word-compatible export;
- dedicated Requisitions module and navigation;
- Inventory supplier validation restricted to material/mixed Suppliers;
- requisition receiving workflow that records delivered quantities as Inventory receipts while referencing the originating requisition;
- partial/complete receipt reconciliation against `quantity_received`, including automatic `partial` / `fulfilled` status transitions and Kardex traceability.

### Recently completed procurement approval phase

- Company-configurable requisition approval policy: disabled, all requisitions, or threshold by estimated amount;
- approver scope configurable between Company Administrator only or Administrator + Manager/Supervisor;
- requester self-approval disabled by default and explicitly configurable;
- policy snapshot stored on each requisition so later Company-setting changes do not rewrite historical meaning;
- server-authoritative approval/rejection route with tenant/Site/role validation;
- receipt-to-Kardex blocked while a required approval is not current;
- quantity, estimated-cost or required-date changes reopen a prior approval before additional receipt;
- approval events and general audit log preserve requested, amended, approved, rejected and reopened transitions;
- approval state exposed in Requisitions, Supplier profile and requisition exports;
- migration 034 and dedicated PostgreSQL smoke validation.

### Recently completed supplier commercial analytics phase

- 12-month Supplier procurement KPIs derived from physical requisition receipts rather than client-side counters;
- average lead time from sent/created timestamp to first physical receipt;
- weighted quantity fulfillment across requisitions with receipt history;
- complete-on-time rate using last receipt versus `needed_by` only when a fully received requisition has a required date;
- weighted receipt cost variance comparing actual receipt unit cost against the estimated unit cost for the same received quantities;
- six-month monthly trend plus recent requisition evidence behind each Supplier KPI;
- Supplier profile PDF/XLSX/Word export parity for the commercial indicators;
- PostgreSQL smoke regression added to CI.

### Recently completed supplier return phase

- receipt-linked Supplier returns created from the requisition workspace;
- dedicated `supplier_return` Kardex movement that decreases stock without changing the existing inbound `return` semantic;
- return quantity limited by the originating receipt balance and by physical warehouse stock;
- immutable DEV header/item history with reason, expected resolution, document, user and timestamp;
- traceability DEV → requisition → requisition item → source receipt → outbound Kardex movement;
- Supplier profile, requisition detail and Kardex surface/export parity;
- requisition PDF/XLSX/Word exports include returned quantities and DEV history;
- migration 035 and dedicated PostgreSQL smoke regression.

### Recently completed procurement document reconciliation phase

- immutable purchase-order, delivery-note/remission, invoice, credit-note and other procurement evidence linked to each requisition;
- document lines reconciled against requested quantities/estimated values, linked physical receipts or linked Supplier returns according to document type;
- separate automatic match state and human review state;
- append-only physical-evidence links that reopen review when new evidence arrives;
- verified, exception-accepted, disputed and voided audit paths without modifying Kardex;
- document status surfaced in Requisitions, Supplier profiles and exports;
- migration 036 and dedicated PostgreSQL smoke regression.

### Recently completed unified Inventory/Kardex import correction

- one master workbook `PLANTILLA_INVENTARIO_KARDEX_DESWEB.xlsx` shared by Inventory and Supplier contexts;
- Global and Contextual modes handled by the same import engine;
- deterministic Supplier resolution by internal ID, NIT/tax, internal code and exact name;
- explicit Context-only versus Import-all choice from Supplier profiles;
- Supplier inheritance from SKU in Kardex with blocking mismatch validation;
- services omitted from physical stock/Kardex;
- preflight stock simulation, structured row/field/value/suggestion errors and Supplier grouping;
- existing-SKU Compare/Update/Skip decision without rewriting historical Kardex;
- IMP folio, origin/context/scope/omitted-row audit metadata;
- migration 037 and dedicated PostgreSQL smoke regression.

### DESWEB Design System V2 migration program

The next cross-module program is the progressive visual/UX migration defined in `docs/DESIGN_MIGRATION_PLAN.md`.

- **Phase 0 — Governance/documentation:** completed.
- **Phase 1 — Foundations:** implemented — CSS tokens, semantic aliases, typography, spacing, radius, shadows, motion, icon-system decision, initial `/ui-kit` structure and CI smoke.
- **Phase 2 — UI Core primitives:** implemented — Button, forms, Select, Card, Badge/Status, Modal/Drawer, Tooltip/Dropdown, Tabs/Breadcrumb, Toast/Alert, Loading/Empty, Avatar/FileUpload, compatibility wrappers and live /ui-kit examples.
- **Phase 3 — Global shell/navigation:** implemented — token-driven shell, SVG navigation iconography, contextual header/account actions and responsive drawer/field navigation while preserving RBAC/preferences.
- **Phase 4 — Shared Data UI:** implemented — Search/FilterPanel, DataTable/Pagination, row/bulk actions, KPI/metric layouts, token chart palette, timeline/progress, ModuleHeader and DashboardAnalytics compatibility migration.
- **Phase 5 — Business UI:** implemented — shared BusinessCardShell plus AssetCard, InventoryCard, MaintenanceCard, WorkOrderCard, SupplierCard, LocationCard and UserCard/Profile metric consolidation while preserving distinct domain identities.
- **Phase 6 — Dashboard + Companies + Locations:** implemented end-to-end on V2, including SSR data tables, dashboard controls, CompanyCard, SubLocationCard, profile metrics, location filters and scoped module styling.
- **Phase 7 — Assets + Inventory:** implemented end-to-end, including approved secondary navigation, derived Asset catalogs, Inventory reports/settings, V2 KPI/status/table surfaces, Bulk Import integration and Kardex migration while preserving stock authority.
- **Phase 8 — Suppliers + Users + Crews + Attendance:** implemented end-to-end, including Supplier/User profile preservation, dedicated CrewCard, V2 operational user statistics and Attendance/biometric/geofence/contingency surfaces.
- **Phase 9 — Maintenance + Work Orders + Activities/Reaction:** implemented end-to-end with shared state/priority grammar, KPI, StaticDataTable, StepProgress/Progress/Timeline, Activity execution cards and Reaction Drawer/contextual-detail migration.
- **Phase 10 — Reports + Settings + final audit:** implemented — Reports Center, Settings/Personalization V2 migration, final hardcoded-color/component/accessibility/responsive/reduced-motion/icon audit and CI guardrails.

Each phase must remain deployable, preserve business logic, update documentation/manual as needed and merge only after CI/build/regressions pass.

### Design System V2 program status

**Phases 0–10 are implemented.**

The next work is no longer a numbered visual-migration phase. New product work must consume the established tokens/UI Kit/Shared Data UI/Business UI contracts, and legacy `globals.css` selectors should be retired opportunistically when their final consumer is migrated or removed. The final audit guardrails must remain green in CI.


## Recently completed role-dashboard analytics slice

- role-specific root dashboards for platform, tenant administration, supervision, read-only users, field workers, providers and requesters;
- KPI comparison against previous equivalent period or same period in the previous year;
- six-month real-data trend charts;
- Site and Priority filters for applicable tenant/field/requester views;
- operational distributions by Work Order status, type, Site and request priority;
- comparison-aware KPI cards and responsive analytical composition;
- Excel/CSV/PDF filter parity for Site, Priority, status and period;
- documentation/manual synchronization for the new dashboard workflow.

### Next dashboard analytics opportunities

- add historical inventory-value snapshots if a future stock-ledger model supports point-in-time valuation;
- add procurement/requisition trend panels now that receiving and partial-receipt reconciliation are available;
- add saved dashboard filter presets only if they remain presentation preferences and never authorization inputs.


## Recently completed filtering / master-data foundation

- conditional cascading directory facets that hide single-value filters;
- Company/Site contextual filtering across the major operational directories;
- entity-specific facets for role, provider, criticality, category, priority, work type, stock state, frequency and requester;
- standardized multi-select Supplier capability and specialty catalogs;
- User personnel document dossier and emergency contact;
- Supplier financial/payment-preparation profile;
- migration 029 and compatibility bridge for legacy Supplier `materials/services/both`.

### Follow-on data-management opportunities

- reusable spreadsheet import templates should expose the stable Supplier capability/specialty codes and reject unknown codes with row-level feedback;
- bulk User/Supplier import should reuse the same country/document/catalog validation paths as interactive forms;
- consider controlled master data for additional fields only when the business domain is sufficiently stable; avoid creating catalogs merely to replace genuinely record-specific text;
- add document-expiry operational alerts/reports when notification workflow requirements are defined.
