# Architecture

## Runtime architecture

```text
Browser
  |
  | HTTPS
  v
Easypanel reverse proxy
  |
  | HTTP :3000
  v
Desweb CMMS / Next.js
  |
  | DATABASE_URL
  v
PostgreSQL
```

The application container applies pending SQL migrations and then launches the Next.js standalone server.

## Technology stack

- Next.js 16
- React 19
- TypeScript
- PostgreSQL
- node-postgres (`pg`)
- Docker
- Easypanel

No ORM is currently used. SQL is explicit and versioned under `db/migrations/`.

## Source structure

- `app/` — Next.js routes, pages and API handlers.
- `app/login/` — login UI and illustrative CMMS preview.
- `app/dashboard/` — authenticated operational UI.
- `app/dashboard/companies/CompanyDirectory.tsx` — protected directory detail popup, edit mode and destructive-action confirmation.
- `app/dashboard/companies/[id]/` — full company and site administration.
- `app/dashboard/locations/[id]/` — recursive physical hierarchy below a principal site.
- `app/api/organizations/[id]/` — company updates, status changes, visual assets and site creation.
- `app/api/organizations/[id]/assets/[asset]/` — authenticated company logo and cover delivery.
- `lib/organization-assets.ts` — company image validation and conversion.
- `app/api/sites/[id]/` — site updates and status changes.
- `app/dashboard/personalization/` — global visual personalization UI.
- `app/api/customization/` — branding upload and asset delivery routes.
- `components/ThemeToggle.tsx` — persisted light/dark appearance switch.
- `lib/customization.ts` — customization lookup and logo selection helpers.
- `lib/db.ts` — shared PostgreSQL pool/query helper.
- `lib/auth.ts` — bootstrap session logic.
- `lib/urls.ts` — public URL helper for proxy-safe redirects.
- `db/migrations/` — ordered SQL migrations.
- `scripts/migrate.mjs` — migration runner.
- `Dockerfile` — production container build.

## Tenant and physical-location model

- `organizations` is the tenant boundary.
- `organization_limits` stores the resource entitlement assigned by the super administrator.
- `sites` represents principal locations such as a hospital, clinic, warehouse or office.
- `locations` represents every subordinate physical space and is recursive through `parent_id`.
- assets, work orders and inventory items may point to a precise `location_id` while retaining their principal `site_id`.

Every operational query and mutation must validate `organization_id`; an identifier supplied by the browser is never sufficient tenant authorization by itself.

## Operational history safeguards (migration 005)

`deletion_locked` on organizations, sites and locations is sticky. BEFORE INSERT/UPDATE triggers on operational tables mark and lock their company and physical ancestors in the same transaction. BEFORE DELETE guards raise SQLSTATE `P2001` when history or protected dependencies exist, before destructive cascades can start. Foreign-key errors (`23503`) are also surfaced as protected-deletion feedback by the API. No historical customer data is removed by the migration.

Future operational tables must call `cmms_mark_record_history` (or a scope-aware equivalent) and add regression coverage. New physical movement features must mark old and new ancestor chains; status changes must never clear markers. The pre-existing bootstrap login is still global; role/tenant authorization remains separate work.

## Testing

`TEST_DATABASE_URL=postgresql://... npm run test:db` runs history-protection regression tests in a uniquely named schema and drops only that test schema afterward. Use a disposable database, never production. CI provisions PostgreSQL 16 and runs these tests before the Next.js build. For local environments without PostgreSQL, `CMMS_TEST_PGLITE_MODULE` can point to an installed PGlite module; only its unsupported pgcrypto extension declaration is omitted in that test mode. CI remains the native PostgreSQL check.

## Global customization

Migration `002_app_customization.sql` creates a singleton `app_customization` row.

It currently stores:

- logo for light backgrounds;
- MIME type and original filename;
- logo for dark backgrounds;
- MIME type and original filename;
- favicon;
- MIME type and original filename;
- last update timestamp.

Binary branding assets are stored as PostgreSQL `bytea`. This is intentional for the current phase because it keeps configuration durable across Easypanel redeploys without requiring a persistent application filesystem.

The customization is installation-wide, not organization-specific.

Future personalization settings such as colors, application title or login background should extend this same module rather than creating unrelated configuration stores.

## Theme behavior

The root HTML element receives `data-theme="light"` or `data-theme="dark"`.

Theme selection priority:

1. explicit user choice in `localStorage`;
2. operating-system `prefers-color-scheme`;
3. light fallback.

Theme-specific styling must use semantic CSS variables and documented overrides.

## Deployment behavior

Required environment variables:

```env
DATABASE_URL=...
APP_ADMIN_EMAIL=...
APP_ADMIN_PASSWORD=...
AUTH_SECRET=...
NEXT_PUBLIC_APP_NAME=Desweb CMMS
NEXT_PUBLIC_APP_URL=https://cmms.desweb.cloud
```

Internal application port: `3000`

Health check: `/api/health`

## Startup resilience

Easypanel redeploys can create a short window where PostgreSQL is not immediately reachable.

To avoid a crash-loop:

- `scripts/migrate.mjs` retries PostgreSQL connectivity.
- default: 30 attempts, 2 seconds apart;
- optional: `DB_CONNECT_RETRIES`, `DB_CONNECT_RETRY_MS`;
- production sets `HOSTNAME=0.0.0.0`;
- Next.js remains reachable on port `3000`.

These safeguards must be preserved.

## Proxy redirects

Never construct browser redirects solely from `request.url` behind Easypanel. Use `publicUrl()` from `lib/urls.ts`.
