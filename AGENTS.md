# Desweb CMMS — AI / contributor context

This repository is the source of truth for **Desweb CMMS**, deployed at `https://cmms.desweb.cloud`.

Before making changes, read:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/DECISIONS.md`
4. `docs/BRANDING.md`
5. `docs/DESIGN_SYSTEM.md`
6. `docs/CHANGELOG.md`
7. `docs/ROADMAP.md`

## Working rules

- Preserve multi-company data isolation.
- PostgreSQL is the system of record.
- Database changes require new immutable migrations under `db/migrations/`.
- Production deploys from `main` using the repository Dockerfile.
- Keep `/api/health` functional.
- Preserve PostgreSQL startup retries and `0.0.0.0:3000` binding safeguards.
- Do not commit production secrets.
- Brand spelling is **Desweb**.
- New UI must follow branding/design-system documentation.
- Global visual branding must flow through the **Personalización** module where supported.
- Do not hardcode replacement logos or favicons in individual screens.
- Light/dark theme behavior must remain functional after UI changes.

## Customization architecture

Global branding assets are stored in PostgreSQL table `app_customization`.

Current customizable assets:
- logo on light backgrounds;
- logo on dark backgrounds;
- favicon.

Future visual settings should extend this architecture.

## Documentation requirement

Meaningful implementation changes must update `docs/CHANGELOG.md` and any relevant architecture, branding or design-system documents.
