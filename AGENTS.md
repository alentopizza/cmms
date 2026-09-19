# Desweb CMMS — AI / contributor context

This repository is the source of truth for **Desweb CMMS**, a multi-company maintenance management system deployed with Easypanel at `https://cmms.desweb.cloud`.

Before making changes, read:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/DECISIONS.md`
4. `docs/BRANDING.md`
5. `docs/DESIGN_SYSTEM.md`
6. `docs/CHANGELOG.md`
7. `docs/ROADMAP.md`

## Working rules

- Preserve multi-company data isolation: every operational record belongs to an `organization_id`.
- A company may have multiple sites. Assets, work orders, preventive plans and inventory must remain company/site aware.
- PostgreSQL is the system of record.
- Database changes must be added as new files under `db/migrations/`. Never edit an already-applied migration for production behavior.
- The application deploys from branch `main` through the repository `Dockerfile`.
- Production runs behind Easypanel reverse proxy on internal port `3000`.
- Public URL is `https://cmms.desweb.cloud`.
- Keep `/api/health` functional.
- Do not commit production secrets.
- Current bootstrap authentication uses `APP_ADMIN_EMAIL` + `APP_ADMIN_PASSWORD`; the data model already supports future per-user authentication.
- User-facing brand spelling is **Desweb**, never Deswel.
- New UI must follow `docs/BRANDING.md` and `docs/DESIGN_SYSTEM.md`.
- Prefer the official brand tokens already defined in `app/globals.css`; do not invent unrelated color palettes per screen.

## Documentation requirement

Any meaningful implementation change must also update `docs/CHANGELOG.md`. If the change affects architecture, deployment, data model, conventions, branding, design system or product scope, update the appropriate document in `docs/` as part of the same work.

## Current design direction

The product is anchored to the official Desweb palette:
- `#293644`
- `#FCFCFC`
- `#BAE3E0`
- `#79CAC4`
- `#38B2A9`

The login is intentionally a two-panel enterprise layout:
- left: official Desweb branding + authentication;
- right: illustrative CMMS cards representing asset availability, work orders, preventive compliance and asset criticality.

The preview data on the login is explicitly illustrative and must not be presented as live customer data.

The authenticated shell uses:
- official Desweb logo;
- institutional dark sidebar;
- light workspace;
- teal primary actions and KPI accents.
