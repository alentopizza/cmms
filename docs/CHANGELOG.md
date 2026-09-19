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

### Documentation continuity

- Added `AGENTS.md` as the entry point for future AI agents and contributors.
- Added project context, architecture, decisions, roadmap and changelog under `docs/`.
- Established a rule that meaningful changes must update the changelog and relevant technical documentation.
