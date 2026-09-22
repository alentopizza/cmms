# Changelog

## 2026-09-21 — Dimensional glass UI system

### Changed

- Evolved the shared CMMS UI away from flat controls toward a restrained dimensional-glass visual language.
- Updated primary and secondary buttons with depth, inner highlights and restrained luminous hover states.
- Updated inputs, selects, search controls and date-range controls with inset surfaces and stronger focus states.
- Added consistent depth to module headers, cards, dashboards, user cards, company cards and location cards.
- Updated tabs, selectable cards and checkbox controls with dimensional selected states.
- Updated modals, dropdowns and popovers with stronger layered separation and backdrop blur.
- Preserved Desweb teal/dark identity instead of copying reference cyan/purple colors.
- Added dark-theme equivalents, keyboard focus-visible treatment and reduced-motion behavior.
- Kept the visual treatment responsive so future mobile/PWA work inherits the same component language.


## 2026-09-21 — Consolidated Dashboard exports

### Changed

- Replaced separate PDF and Power BI buttons with one **Exportar** dropdown.
- Added native Excel (.xlsx) dashboard export.
- Kept CSV as the interoperable Power BI / Power Query export.
- Preserved PDF as the executive graphical report.
- Reworked Desweb PDF stationery to follow the supplied A4 landscape letterhead composition: centered brand identity, pale body watermark, footer slogan and page number.
- Pro white-label organizations continue to substitute their own report branding while retaining the same report hierarchy.
- Excel export includes Resumen, Datos and Metadatos sheets with branded styling and the same dashboard filters/permissions.


## 2026-09-21 — Dashboard single-header cleanup

### Changed

- Removed the redundant secondary Dashboard introduction panel.
- Kept Dashboard aligned with the shared module header structure used by Empresas, Ubicaciones and other directories.
- The primary header now carries the relevant company/role context.
- Date range, filters, PDF/Power BI actions and KPIs remain directly below the single header.
- Removed obsolete Dashboard intro/period styling.


## 2026-09-21 — Role-aware mobile navigation

### Added

- Added a documented mobile-first rule for dashboard UI changes.
- Preserved hamburger / drawer navigation for roles with broad module access.
- Added a dedicated Technician / External collaborator bottom navigation inspired by native field-service applications.
- Field navigation prioritizes Dashboard, Orders, Attendance and Assets.
- Added a **More** destination that opens the full permission-filtered module drawer.
- Added safe-area-aware bottom spacing so mobile navigation does not cover page actions.
- Reused the same authorized navigation item source across desktop, drawer and mobile bottom navigation.

### Mobile architecture

This responsive shell is the baseline for a future PWA/native application. Module screens should continue to be adapted responsively as they are changed so a later app shell requires minimal rework.


## 2026-09-21 — Visual locations and company-level users/suppliers

### Business rules

- Users now create directly under a company and no longer require a site/sub-location.
- Suppliers now create directly under a company and no longer require a site/sub-location.
- Site assignment remains an optional user access scope, not ownership.
- Provider-role accounts continue to require a same-company service supplier.

### Locations

- Added three-column visual site cards with cover images and company-logo overlap.
- Added site photos and contact fields.
- Added rich site information popup with edit, copy and WhatsApp actions.
- Added visual sub-location cards, search/filtering, inline detail/edit and photo upload.
- Added maintenance-service/work-order browsing inside the site popup.
- Added protected site and sub-location image endpoints.

### Users

- Added profile photo storage and protected avatar endpoint.
- Added profile-photo input to user creation/editing.
- User cards display avatar photography when available.

### Database

- Added migration 016 for site imagery/contact information, sub-location imagery and user avatars.


## 2026-09-21 — Modern date picker and enterprise PDF reports

### Changed

- Replaced separate Month / From / To dashboard date inputs with a single modern Spanish date-range picker.
- Added dual calendars, quick ranges and explicit Apply behavior.
- Reworked Dashboard PDF export into a branded executive report.
- Added KPI summary cards and graphical status/type distributions to PDF reports.
- Added report letterhead, executive interpretation block, detailed paginated records and branded footer.
- Added Pro white-label report branding using organization name, configured colors and organization logos.
- Preserved Desweb branding for platform reports and non-Pro plans.
- PDF export continues to preserve the exact dashboard role, tenant/site scope and filters.


## 2026-09-21 — Dashboard filters and exports

### Added

- Month filter on every role-aware dashboard.
- Explicit From / To date range filters.
- Company active/inactive filter for Platform Owner and Superadministrator.
- Subscription status filter for platform dashboards.
- Work-order status filters for Company Administrator, Manager, Viewer and Requester dashboards.
- Activity status filters for Technician, External collaborator and Provider dashboards.
- Filter-aware KPI, distribution and recent-record queries.
- PDF dashboard export generated server-side.
- Power BI-compatible UTF-8 CSV export.
- Exported datasets preserve the authenticated role, tenant/site scope and selected filters.

### Export semantics

- PDF provides a portable filtered dashboard report.
- Power BI export is CSV for direct import into Power BI / Power Query; the application does not fabricate proprietary PBIX files.


## 2026-09-21 — Role-aware Dashboard

### Changed

- Renamed the former **Resumen** navigation item to **Dashboard**.
- Replaced the generic operational summary with role-specific KPIs and analytical panels.
- Added Platform Owner business KPIs: paid active plans, estimated MRR, active companies and lead conversion.
- Added Superadministrator customer/subscription and global operational KPIs.
- Added Company Administrator and Manager maintenance, cost, downtime, inventory and workload analytics.
- Added Technician / External productivity, assigned activity and attendance metrics.
- Added Service Provider workload metrics.
- Added Requester request-resolution metrics.
- Added Viewer read-only operational metrics.
- Added plan-distribution, lead-funnel, work-order-distribution and recent-activity tables.
- Added responsive light/dark dashboard styling inspired by the supplied dashboard reference.

### Data semantics

- Revenue is labeled **MRR estimado** because it is calculated from active subscriptions and configured plan prices.
- It is not represented as collected cash until a payment ledger / provider reconciliation model is implemented.


## 2026-09-21 — Guided creation hierarchy

### Changed

- Added a shared prerequisite-state component matching the Users empty-state design.
- Creation now routes users to the earliest missing dependency with explicit copy and one CTA.
- Added hierarchy-aware guidance to Locations/Sub-locations, Suppliers, Crews, Assets, Inventory, Work Orders and Maintenance Routines.
- Company prerequisite CTAs open the Company creation popup directly.
- Location and Sub-location prerequisite CTAs open the Location popup at the required hierarchy level.
- Suppressed duplicate generic empty states while a prerequisite blocker is active.
- Centralized hierarchy resolution in `lib/setup-sequence.ts`.
- Fixed sub-location authorization so `platform_owner` is not incorrectly treated as a tenant user while tenant scoping remains enforced for normal users.

### Hierarchy

Company → Principal location → Sub-location → Supplier / Workforce → Asset / Inventory / Crew → Work Order / Routine.


## 2026-09-21 — Unified module directories and popup creation

### Design system

- Added a shared module header with keyword search, contextual filter and one entity-specific **Agregar** action.
- Removed the Users-only **Roles en uso** band from the general directory pattern.
- Standardized wide responsive creation popups.
- Improved form placeholders with realistic examples and clearer data-entry guidance.
- Added client-side search/filtering over already-authorized server result sets.

### Modules updated

- Companies
- Users
- Locations / Sub-locations
- Suppliers
- Crews
- Assets
- Work Orders / Requests
- Maintenance Routines
- Inventory
- Leads

### Companies

- Updated company cards toward the supplied visual reference: cover image, overlapping circular logo, centered identity/status and resource progress.
- Resource denominators are shown only where the product has a real enforced limit.
- Suppliers display as unlimited rather than implying an unenforced plan cap.

### Creation flows

- Moved supplier, crew, inventory and work-order creation out of inline page forms and into popups.
- Added a single Locations **Agregar** popup with choice between principal location and sub-location.
- Added manual Lead creation while retaining landing-page lead capture.
- Existing contextual create modals for companies, users, assets and routines now use the wider popup treatment.


## 2026-09-21 — Platform Owner contextual edit/delete controls

### Changed

- Removed the standalone destructive workspace, sidebar item and Settings card.
- Added contextual **Editar / Eliminar** actions directly to records in the normal CMMS modules for Platform Owner.
- Added owner actions to Leads, Empresas, Ubicaciones/Sububicaciones, Usuarios, Activos, OT/actividades, Rutinas, Inventario, Proveedores and Cuadrillas.
- Kept the PostgreSQL FK-driven recursive delete engine as an internal backend service only.
- Removed table/record discovery from the forced-delete API.
- Added an allow-listed owner-only update endpoint for modules that did not already expose full editing.
- Reserved definitive user and company deletion to Platform Owner.
- Kept existing edit permissions, hierarchy, creation flows and restrictions unchanged for all other roles.
- Forced updates and deletes remain server-authorized and audited.
- Platform Owner self-deletion remains blocked.

## 2026-09-21 — Platform Owner access foundation

### Added / changed

- Added persistent platform role `platform_owner` through migration `015_platform_owner_role.sql`.
- The environment bootstrap account configured by `APP_ADMIN_EMAIL` now resolves as **Propietario Desweb** instead of Developer/Superadministrator.
- Migration 015 promotes the existing database account `admin@dominio.com` to Platform Owner when present and removes tenant memberships from that platform identity.
- Platform Owner receives unrestricted RBAC access to every current permission and global module scope during the development phase.
- Updated dashboard, assets, work orders, routines, inventory, locations, suppliers, crews and attendance global scoping so Platform Owner is treated as a platform-level identity.
- Reserved Superadministrator creation and assignment exclusively to Platform Owner.
- Superadministrators can continue managing tenant users but cannot edit another platform account or the Platform Owner.
- Protected the Platform Owner account from accidental deactivation/deletion/demotion through the normal user directory.
- Updated role labels/descriptions so the sidebar/account menu identifies the owner as **Propietario Desweb**.
- Updated the role model and project documentation to distinguish implemented Platform Owner behavior from pending Commercial/Partner roles.

### Development safety boundary

- Platform Owner bypasses application RBAC restrictions.
- PostgreSQL referential integrity and explicit historical/lifecycle safeguards are not globally disabled; irreversible purge/reset operations will receive the previously designed controlled workflow before commercial release.


## 2026-09-21 — Approved platform-owner, sales and distribution role model

### Product decision

- Approved **Propietario Desweb / Platform Owner** as the future maximum platform role.
- Reserved Superadministrator creation/revocation exclusively to Platform Owner.
- Defined Superadministrator as a trusted platform operator rather than the final authority.
- Approved future **Comercial Desweb** and **Partner / Distribuidor** roles so sales/distribution do not require global technical administration.
- Preserved **Administrador de empresa** as the highest customer/tenant role.
- Defined platform/commercial hierarchy and tenant operational hierarchy as separate authorization domains.
- Defined a target server-enforced "who may create whom" matrix.
- Required every user-creation/edit interface to explain role scope, permissions, restrictions and creation authority.
- Required exceptional destructive operations to use a governed reauthentication/validation/audit process instead of normal CRUD deletion.
- Added `docs/ROLE_MODEL.md` as the canonical source of truth.

### Implementation status

- Documentation/product model only.
- No production RBAC behavior changed in this entry.


## 2026-09-21 — Company Profile v2 and corporate document dossier

### Added

- Added migration `014_company_profile_documents.sql`.
- Expanded company records with tax-ID type, legal/administrative address, phone, website, administrative/billing emails, primary-contact information and internal notes.
- Redesigned the full company page into a visual enterprise profile with cover/logo hero, plan, status, profile completion and local section navigation.
- Added a corporate document dossier with configurable Required / Optional / Not applicable classification.
- Added document categories for tax, legal, commercial contract, privacy/data treatment, insurance, certifications and other corporate records.
- Added issue date, expiry date, reference, notes, uploader and file metadata.
- Added authenticated PDF/image download and archive/update flows.
- Added document states for current, expiring within 30 days, expired, pending, optional without file and not applicable.
- Added profile-completeness and documentation-health indicators to company directory cards and quick detail.
- Kept administrative/fiscal addresses explicitly separate from operational sites.

### Security / data handling

- Corporate documents remain organization scoped.
- Downloads require the same company-management authorization as the current company workspace.
- Files are limited to PDF, PNG, JPEG or WebP up to 10 MB and are served with private/no-store and nosniff headers.


## 2026-09-21 — Facial attendance, geofencing and field execution analytics

### Added

- Added migration `013_biometric_attendance_geolocation.sql`.
- Added organization attendance policies with role scope, facial verification, geolocation and configurable accuracy/confidence thresholds.
- Added site latitude, longitude and geofence radius configuration.
- Added the **Asistencia** workspace and permission-aware navigation.
- Added browser camera enrollment with face description, liveness and anti-spoof validation using Human 3.3.6.
- Added local packaging of biometric ML model files for SaaS/self-hosted runtime.
- Added AES-256-GCM encryption for persisted facial templates; enrollment photographs are not stored.
- Added self-service biometric template deletion.
- Added geofence-validated field clock-in and clock-out with one-open-shift-per-user enforcement.
- Added activity execution events correlated with open attendance shifts.
- Added descriptive 30-day field statistics for hours, shifts and activity timing without automated employee rankings.
- Added self-hosted `BIOMETRIC_ENCRYPTION_KEY` deployment requirement and biometric/privacy guidance.


## 2026-09-20 — Retractable and user-orderable dashboard sidebar

### Added

- Redesigned the authenticated sidebar into a compact dark technology rail with Desweb teal/cyan accents.
- Added expanded and collapsed desktop navigation states.
- Added responsive mobile drawer navigation.
- Added per-user module ordering with drag-and-drop.
- Added accessible **Subir / Bajar** reorder controls for keyboard/touch workflows.
- Added **Restaurar** to return modules to the default permission-filtered order.
- Added migration `012_user_dashboard_preferences.sql` for persistent sidebar order and collapsed state.
- Added authenticated preferences API; module IDs are allow-listed before persistence.
- Database-backed users keep preferences across browsers/devices.
- The bootstrap developer account falls back to browser-local persistence because it has no user row.
- Updated context-header labels for Leads, Proveedores, Cuadrillas and Rutinas.


## 2026-09-20 — Context-aware creation popups

### Added

- Added reusable contextual creation popups for locations, sublocations, assets, routines and company-scoped users.
- Company detail now exposes **Nueva ubicación** and **Nuevo usuario** without asking for the company again.
- Locations module now creates both principal locations and sublocations from popups.
- Site detail now creates sublocations with the site preselected.
- Sublocation administration now offers **Crear activo aquí**, preserving company, site and exact sublocation.
- Assets module now creates assets from a popup and links into a new asset detail workspace.
- Asset detail now exposes **Nueva rutina** with the asset already selected.
- Preventive maintenance navigation is labeled **Rutinas**, and the module can create routines by selecting an asset.
- Contextual mutation routes return to the originating dashboard screen while re-validating all server-side relationships and permissions.


## 2026-09-20 — Operational setup sequence and outsourced maintenance

### Added

- Added migration `011_operational_sequence_external_services.sql`.
- Added mandatory setup gates for company → principal location → sublocation → supplier → workforce/crews → assets/inventory → activities.
- Added the **Proveedores** module with Materials, Services and Materials + services classifications.
- Added **Proveedor de servicios** and **Colaborador externo** organization roles with distinct access semantics.
- Provider accounts must be linked to a service-capable supplier; external collaborators may optionally be linked to one.
- Added **Cuadrillas** with leader and membership made of internal technicians and external collaborators.
- New assets now require an exact sublocation and supplier relationship.
- Added inventory-item creation with required sublocation and supplier relationship.
- Added work-order activity planning and execution with exactly one executor: person, crew or service supplier.
- Added activity lifecycle states, execution notes and timestamps.
- Provider accounts only see work assigned to their supplier; external collaborators only see work assigned directly or through their crew.
- Extended user-history protection to activity assignments and crew membership so traceable users cannot be permanently removed.
- Added modern setup-progress messages that explain missing prerequisites and route users to the correct previous step.


## 2026-09-20 — Direct installation download and restored branding editor

### Added

- Simplified **Instalación propia** into a short, focused beta landing with a primary direct-download CTA.
- Added automatic production-build packaging through `scripts/package-runtime.sh`.
- The direct `.tar.gz` package contains the compiled Next.js standalone runtime, Dockerfile, Docker Compose, PostgreSQL migration assets, environment template and installation helper.
- Restored global logo/favicon administration directly inside Superadministrator **Configuración**.
- Added modern previews and clear upload guidance for light-background logo, dark-background logo and favicon.
- Documented accepted image formats, 2 MB maximum file size and recommended dimensions.
- Branding uploads made from Configuración now return to the same module with success/error feedback.


## 2026-09-20 — Principal logo and clearer installation terminology

### Changed

- Applied the supplied principal Desweb logo to the public landing header.
- Removed the redundant **CMMS** text from beside the header logo.
- Increased header navigation, login and Trial CTA typography for better readability.
- Replaced the public-facing term **Self-hosted** with **Instalación propia** across the landing and downloads experience.
- Kept `self-hosted` as an internal/technical term where deployment precision is useful.


## 2026-09-20 — Floating corporate landing header and dark-only policy

### Changed

- Replaced the full-width dark landing header with a floating white navigation surface inspired by the supplied Desweb web identity example.
- Enlarged and simplified logo presentation to improve legibility and breathing room.
- Kept the landing permanently dark while preserving theme support for the authenticated application.
- Removed the public landing theme switch.
- Refined the footer to use a larger brand lockup, contact details and restrained Desweb geometric accents.
- Documented production logo usage: isolated assets only, never crops from the composite identity board.


## 2026-09-20 — Landing branding, themes and advisor lead capture

### Changed

- Replaced the cramped text/initial landing identity with the configured Desweb logo in the public header and footer.
- Added responsive logo contrast handling when no dedicated dark-background logo exists.
- Added a light/dark appearance switch to the landing using the shared `desweb-theme` preference.
- Added a commercial FAQ section based on current product behavior and capabilities.
- Added an advisor-contact conversion section without reusing unverifiable legacy testimonials or outdated pricing.
- Added migration `010_sales_leads.sql`, public lead persistence and a Superadministrator-only **Leads** workspace with follow-up statuses.
- Redesigned the footer into a product/commercial navigation surface with a direct sales CTA.
- Documented the landing as a dual conversion surface: self-service checkout plus advisor-assisted lead generation.


## 2026-09-20 — Dark technology landing visual system

### Changed

- Reworked the public landing CSS into a dark technology/control-center aesthetic inspired by the supplied visual reference while preserving the Desweb identity.
- Added institutional dark backgrounds, teal/mint glow, technical grid treatments, darker product telemetry panels and premium SaaS surface styling.
- Refined hero and section copy toward a technology-first maintenance-control proposition.
- Extended the same visual language to the self-hosted/downloads page.
- Added global design-system guidance requiring future project surfaces to feel fresh, modern and technological without copying third-party branding or artwork.


## 2026-09-20 — Login public navigation

### Changed

- Added a lightweight public navigation bar to `/login` with **Inicio**, **Ver planes** and **Self-hosted**.
- Made the Desweb logo on login clickable and linked it back to Home.
- Added a compact post-form CTA for the 15-day Trial plus links to plan comparison and the self-hosted edition.
- Kept the login authentication-first and intentionally avoided operational navigation or a fake password-recovery action.


## 2026-09-20 — Resilient checkout and subscription settings

### Fixed

- Reworked the public checkout so validation errors no longer clear the user's entered data.
- Added inline field-level validation for company, administrator name, email, password, city and primary site.
- Added explicit duplicate-email feedback instead of a generic account-creation failure.
- Replaced Trial interval string concatenation with PostgreSQL `make_interval(days => ...)` for reliable 15-day provisioning.
- Added Home navigation to checkout flows.
- Successful self-service provisioning now lands on company settings, where the acquired plan and resources are immediately visible.
- Added subscription start/end dates and **Mejorar plan** to company settings.
- Simulated plan upgrades now return to settings with refreshed entitlements and confirmation feedback.


## 2026-09-20 — Professional public landing and downloads recovery

### Changed

- Rebuilt the public landing as a complete commercial SaaS experience with product hero, illustrative dashboard preview, benefits, workflow, plan comparison, self-hosted section and final conversion CTA.
- Kept plan prices intentionally undefined while commercial pricing remains pending.
- Redesigned the self-hosted downloads page with deployment architecture, package workflow, installation and licensing information.
- Added `/descargas` as a Spanish alias of `/downloads` to reduce path ambiguity while diagnosing stale production deployments.
- Documented public marketing surfaces in the design system and project context.


## 2026-09-20 — Public landing access and self-hosted package workflow

### Added

- Kept the public SaaS landing visible at `/` even when an authenticated session exists.
- Added a **Descargas** link from the landing and a public `/downloads` page explaining the self-hosted edition.
- Added the **Package self-hosted** GitHub Actions workflow to build versioned ZIP and TAR.GZ installation artifacts for private/internal beta distribution.
- Packaged artifacts include source commit/version metadata and exclude local secrets, Git history, dependencies and build output.
- Documented that anonymous commercial downloads remain deferred until licensing and release controls are defined.


## 2026-09-20 — Documentation continuity, self-hosting and IP strategy

### Added

- Made repository documentation an explicit required deliverable for meaningful product changes.
- Refreshed `docs/PROJECT_CONTEXT.md` so another AI/developer can reconstruct current product, SaaS, RBAC, subscription and UI direction without chat history.
- Added `docs/COMMERCIAL_MODEL.md` as the source of truth for Trial/Básico/Medio/Pro, subscription lifecycle and sales channels.
- Added `docs/INSTALLATION.md`, `compose.yaml` and `scripts/install.sh` for a portable Docker Compose/self-hosted installation.
- Added `docs/IP_AND_DISTRIBUTION.md` to separate software copyright, trademarks, patent evaluation and commercial licensing/distribution.
- Documented that no open-source license has been approved and that payment activation must ultimately rely on verified server-side webhooks.


## 2026-09-20 — SaaS plans, trial lifecycle and test landing

### Added

- Added Trial, Básico, Medio and Pro billing plans with resource defaults.
- Added organization subscriptions, monthly periods, subscription status and lifecycle events.
- Added a 15-day Trial plan and operational access blocking after trial expiration.
- Added a public product landing with plan comparison.
- Added a clearly labeled simulated checkout for provisioning tests without card processing.
- Added automatic creation of organization, limits, primary site, administrator and subscription from the test checkout.
- Added simulated paid-plan activation for existing expired tenants without creating a duplicate organization.
- Superadmin company creation now starts from a plan selection instead of arbitrary initial quotas.
- Added Pro-only organization white-label persistence for platform name, colors and light/dark logos.
- Added Pro white-label controls to company settings and applied tenant branding to the authenticated dashboard.
- Existing companies are backfilled as active Medium subscriptions with preserved custom limits.


## 2026-09-20 — Company administrator settings and role simplification

### Changed

- Removed the redundant **Propietario** organization role.
- Added migration `007_remove_owner_role.sql` to convert existing `owner` memberships to `admin` and tighten the database role constraint.
- **Administrador de empresa** is now the highest organization-level role.
- Added `settings.view` for company administrators without granting global personalization or resource-entitlement editing.
- Added a tenant-specific **Configuración de empresa** view with company information and resource consumption.
- Resource cards show assigned capacity, consumed capacity, remaining capacity and percentage used.
- Resource status changes from teal to warning at 80% and critical at 95% or above.
- Resource limits remain read-only for company administrators and editable only by Superadministrators.


## 2026-09-20 — Company resource entitlement editing

### Changed

- Added current usage and assigned resource limits to the company detail modal.
- Superadministrators can now edit principal-location, sublocation, asset, inventory and technician quotas from the same **Editar información** flow.
- Resource changes are saved transactionally with the company update.
- Added an explicit `company_resources.manage` authorization capability reserved to platform superadministrators.
- Company administrators remain unable to modify platform resource entitlements.


## 2026-09-19 — Users directory null-scope fix

### Fixed

- Normalized site access arrays for global/superadministrator accounts that do not have an organization membership row.
- Made the user directory and edit modal null-safe when rendering site assignments.
- Prevented `/dashboard/users` from failing when a global account is included in the directory.


## 2026-09-19 — Multi-site user access

### Added

- Added migration `006_multi_site_user_access.sql` with all-site or explicit multi-site membership scope.
- Replaced the single-site user selector with company-dependent **Todas las sedes / Sedes específicas** access controls.
- Added individual site checkboxes that only show active sites belonging to the selected company.
- Persisted selected sites in `organization_member_sites` and exposed them in authenticated sessions.
- Updated user cards to summarize all authorized sites.
- Scoped dashboard metrics, locations, assets, work orders, preventive plans and inventory by assigned sites.
- Added server-side site authorization to asset/work-order creation and location mutations.
- Restricted limited-scope administrators from granting sites outside their own authorized scope.


## 2026-09-19 — Context header and account menu

### Changed

- Simplified the floating header so it only communicates the current section and organization context.
- Removed duplicate horizontal module navigation from the header; the sidebar is again the single desktop navigation surface.
- Removed **Configuración** from the permanent sidebar module list.
- Added a compact account control at the bottom of the sidebar with the signed-in user's name and role.
- Added a click-to-open account menu with access to **Configuración** and **Cerrar sesión**.
- Preserved active-module indication in the sidebar and dark-theme support for the new account menu.


## 2026-09-19 — Modern workspace shell and platform settings

### Changed

- Redesigned the authenticated shell with a denser technology-oriented workspace, larger usable content width and elevated surfaces.
- Added a compact floating application header with permission-aware horizontal tabs and an active-section indicator.
- Added active-state feedback to the persistent sidebar navigation.
- Removed the light/dark switch from the operational header.
- Added the global **Configuración** module with **Claro**, **Oscuro** and **Sistema** appearance preferences.
- Linked branding/personalization and user administration from the centralized settings module.
- Modernized the users workspace with a denser role summary, more compact empty state and three-column desktop directory where space allows.
- Preserved responsive navigation through the horizontal header tabs when the desktop sidebar is hidden.


## 2026-09-19 — User management modal and lifecycle protection

### Changed

- Redesigned **Usuarios y roles** around a role summary, user directory and empty state instead of a permanently visible creation form.
- Added a branded create/edit user modal with contextual role-permission explanations.
- Added inline field validation that preserves entered values until the user explicitly cancels.
- Added superadministrator-only editing, activation/deactivation and permanent deletion controls.
- Added operational-history checks before deletion; users referenced by work orders, meter readings, comments or audit records must be deactivated instead.
- Prevented moving accounts with recorded activity between organizations or between tenant/global access scopes.
- Added protected password replacement during user editing and retained technician quota enforcement.


## 2026-09-19 — Users, roles and tenant-aware authentication

### Added

- Added migration `005_user_auth_and_roles.sql` for password credentials, platform roles and login metadata.
- Added PostgreSQL-backed login while preserving the environment bootstrap account as a superadministrator fallback.
- Added scrypt password hashing with a unique random salt per account.
- Added signed HTTP-only identity sessions resolved against the database.
- Added a centralized permission matrix for superadmin, owner, admin, manager, technician, requester and viewer.
- Added the **Usuarios y roles** module for creating test/production accounts with company, optional site and role assignments.
- Added a tenant-scoped **Ubicaciones** workspace for company roles.
- Added role-filtered navigation and signed-in identity/role display.
- Added tenant scoping to dashboard, assets, work orders, preventive maintenance and inventory.
- Added read/write distinctions so viewer-like roles do not receive mutation forms.
- Added requester behavior that limits the work-order list to requests created by that account.
- Added server-side permission and tenant checks to core company, location, asset, work-order and personalization mutations.


## 2026-09-19 — Branded confirmation dialogs

### Changed

- Replaced native browser confirmation prompts in company save and permanent-delete flows with Desweb-styled in-app dialogs.
- Added a reusable confirmation dialog with default and destructive variants.
- Updated `ConfirmSubmitButton` so future confirmation-based form actions inherit the same branded interaction.
- Added keyboard Escape handling, focus restoration, light/dark theme support, responsive behavior and reduced-motion support.


## 2026-09-19 — Tenant limits and location hierarchy

### Added

- Added migration `004_tenant_limits_and_location_hierarchy.sql`.
- Added super-administrator resource assignments for locations, sublocations, assets, inventory and technicians.
- Added server-side enforcement for principal-location and sublocation creation.
- Added recursive sublocations with arbitrary practical depth.
- Added a dedicated location workspace with parent selection, hierarchy view, editing and activation state.
- Prepared assets, work orders and inventory articles for precise sublocation assignment.
- Added `docs/FUNCTIONAL_MODEL.md` with roles, entity definitions, workflow and implementation order.


## 2026-09-19 — Protected company detail popup

### Added

- Changed “Ver detalle” to open a modal without leaving the company directory.
- Added read-only company and primary-site information by default.
- Added an explicit edit mode that unlocks company, primary-site and optional image fields.
- Added a save confirmation before any modal edit is submitted.
- Added permanent company deletion with an irreversible-action confirmation.
- Added image guidance for accepted formats, recommended pixel dimensions and file-size limits.
- Kept the full company page available for multi-site administration.


## 2026-09-19 — Visual company directory

### Added

- Replaced the company list with responsive visual cards.
- Added point-of-reference cover images and centered company logos.
- Added location, active-site and asset summaries to each card.
- Replaced the inline creation form with an accessible popup.
- Added logo and cover uploads to company creation.
- Added logo and cover replacement from the company detail page.
- Added migration `003_organization_visual_assets.sql`.
- Added authenticated routes for company visual assets.
- Added image type and size validation with durable PostgreSQL storage.


## 2026-09-19 — Company and site management

### Added

- Added a dedicated detail page for every company.
- Added company editing for commercial name, legal name, tax ID, identifier and timezone.
- Added activation and deactivation controls for companies.
- Added creation and management of multiple sites per company.
- Added site editing for name, code, address, city and country.
- Added activation and deactivation controls for sites.
- Added company and site operational summaries for assets and work orders.
- Updated the company directory with status, site counts and detail navigation.


## 2026-09-19 — Login branding alignment

### Changed

- Centered the login logo within the left column.
- Moved the `CMMS` product label below the logo to prevent horizontal visual displacement.
- Preserved configurable light/dark logo behavior and responsive layout.

This file records meaningful product and engineering changes so future developers and AI agents can reconstruct the project history.

## 2026-09-18 / 2026-09-19 — Initial CMMS foundation

### Added

- Initialized `alentopizza/cmms`.
- Created Next.js + TypeScript application.
- Added PostgreSQL support with `pg`.
- Added Dockerfile and Easypanel deployment structure.
- Added automatic SQL migration runner.
- Added health endpoint at `/api/health`.
- Added initial multi-company relational schema.
- Added organizations and sites.
- Added users and organization memberships/roles.
- Added asset categories and assets.
- Added meters and meter readings.
- Added preventive maintenance plans.
- Added work orders and work-order tasks/comments.
- Added suppliers.
- Added inventory and inventory transactions.
- Added attachments and audit log.
- Added dashboard summary.
- Added company creation.
- Added asset registration.
- Added work-order creation.
- Added preventive and inventory base screens.
- Added GitHub Actions build validation.

### Deployment fixes

- Configured deployment for Easypanel internal port `3000`.
- Corrected production domain from an early typo to `cmms.desweb.cloud`.
- Fixed redirects that previously exposed the internal Docker hostname after login by introducing `lib/urls.ts`.
- Added PostgreSQL startup retry logic so transient database readiness does not crash the container during redeploy.
- Explicitly bind Next.js to `0.0.0.0:3000`.

### Authentication

- Started with password-only bootstrap authentication.
- Upgraded bootstrap login to require both `APP_ADMIN_EMAIL` and `APP_ADMIN_PASSWORD`.

### Branding and UI

- Corrected product naming from “Deswel” to **Desweb**.
- Adopted official Desweb palette: `#293644`, `#FCFCFC`, `#BAE3E0`, `#79CAC4`, `#38B2A9`.
- Added official branding documentation and design-system guidance.
- Added enterprise two-panel login with illustrative CMMS metrics.
- Redesigned authenticated shell, sidebar and dashboard around Desweb branding.
- Corrected logo asset rendering and contrast behavior.

### Personalization module

- Added migration `002_app_customization.sql`.
- Added global `app_customization` settings row in PostgreSQL.
- Added **Personalización** module to the dashboard navigation.
- Added upload/replacement for:
  - logo for light backgrounds;
  - logo for dark backgrounds;
  - favicon.
- Custom branding files are stored in PostgreSQL so they survive application redeploys.
- Added dynamic asset endpoints for logos and favicon.
- Added dynamic favicon integration in the root layout.
- Added light/dark theme switcher.
- Theme preference is stored in browser local storage and initially honors the operating-system color scheme.
- Login and application shell choose the appropriate configured logo for their background/theme.
- Added contrast fallback behavior when a dark-background logo has not yet been configured.

### Documentation continuity

- Added `AGENTS.md` as the entry point for future AI agents and contributors.
- Added project context, architecture, decisions, branding, design system, roadmap and changelog under `docs/`.
- Meaningful implementation changes must update the changelog and relevant technical documentation.
