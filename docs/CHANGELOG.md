# Changelog

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
