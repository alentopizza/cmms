# Changelog

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

### Authentication

- Started with password-only bootstrap authentication.
- Upgraded bootstrap login to require both `APP_ADMIN_EMAIL` and `APP_ADMIN_PASSWORD`.

### Branding

- Corrected product naming from the early misspelling “Deswel” to **Desweb** throughout user-facing and documentation content.
- Adopted the official Desweb palette supplied by the project owner:
  - `#293644`
  - `#FCFCFC`
  - `#BAE3E0`
  - `#79CAC4`
  - `#38B2A9`
- Added optimized official logo asset at `public/brand/desweb-logo-dark.webp`.
- Added `docs/BRANDING.md`.
- Added `docs/DESIGN_SYSTEM.md`.
- Converted global styling to reusable brand tokens.
- Applied the official identity to login, sidebar, buttons, cards, tables and dashboard surfaces.

### Login design iterations

- Replaced the original minimal login with a modern branded layout.
- Explored an illustrative visual direction.
- Changed direction to an enterprise two-panel layout inspired by dashboard-oriented SaaS login experiences.
- Added `MaintenancePreview.tsx`, which shows illustrative maintenance metrics:
  - asset availability;
  - open work orders;
  - preventive compliance;
  - asset criticality.
- Explicitly labeled these login metrics as illustrative rather than live data.
- Updated the login to use the official Desweb logo and official brand colors.

### Dashboard visual system

- Redesigned the authenticated application shell with a Desweb dark sidebar.
- Added official logo branding to the sidebar.
- Restyled primary actions using Desweb teal.
- Added branded KPI cards and a clearer operational dashboard hierarchy.
- Added a branded informational panel for future maintenance KPIs.

### Documentation continuity

- Added `AGENTS.md` as the entry point for future AI agents and contributors.
- Added project context, architecture, decisions, roadmap and changelog under `docs/`.
- Established a rule that meaningful changes must update the changelog and relevant technical documentation.
- Added branding and design-system documents to the mandatory AI/contributor reading list.


### Logo asset correction

- Rebuilt the Desweb logo asset from the supplied source artwork.
- Cropped excess canvas space so the wordmark occupies the expected visual area.
- Converted the logo to a transparent, lossless WebP optimized for the application.
- Updated login sizing and sidebar treatment to guarantee readable contrast.
- Sidebar now places the dark wordmark on a light brand surface while preserving the institutional dark navigation background.
