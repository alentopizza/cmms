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

The application container starts by applying pending SQL migrations and then launches the Next.js standalone server.

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
- `app/api/` — authentication, health and write endpoints.
- `lib/db.ts` — shared PostgreSQL pool/query helper.
- `lib/auth.ts` — bootstrap session logic.
- `lib/urls.ts` — public URL helper for proxy-safe redirects.
- `db/migrations/` — ordered SQL migrations.
- `scripts/migrate.mjs` — migration runner.
- `Dockerfile` — production container build.
- `.github/workflows/ci.yml` — build validation.

## Domain model

### organizations

Represents a tenant/company.

### sites

Physical or logical locations belonging to an organization.

### users / organization_members

Users are global identities. Membership associates a user with an organization and role.

Defined roles:

- owner
- admin
- manager
- technician
- requester
- viewer

### assets / asset_categories

Maintainable equipment. Assets belong to an organization and site. Assets can optionally have categories and parent assets.

Asset status:

- operational
- maintenance
- down
- retired

Criticality:

- low
- medium
- high
- critical

### meters / meter_readings

Usage or operational counters associated with an asset, supporting meter-driven maintenance.

### maintenance_plans

Preventive plans triggered by calendar or meter thresholds.

### work_orders

Core maintenance execution record.

Types:

- corrective
- preventive
- inspection
- emergency
- improvement

Status:

- open
- assigned
- in_progress
- paused
- completed
- cancelled

Work orders can track downtime and cost components.

### inventory

`inventory_items` stores parts and supplies. `inventory_transactions` records receipts, issues, adjustments and returns.

### suppliers

Vendor registry per organization.

### audit_log

General-purpose audit history for future traceability.

## Multi-tenancy rule

Operational tables include `organization_id`. New queries and new features must preserve tenant isolation. Never infer tenancy only from a client-provided field when it can be derived from a trusted related record.

Example: asset creation receives a site ID; the server resolves the organization's ID from that site before inserting the asset.

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

## Proxy redirects

Never construct browser redirects solely from `request.url` behind Easypanel, because it may expose the internal container host. Use `publicUrl()` from `lib/urls.ts`.


## Startup resilience

Easypanel redeploys can create a short window where the application container starts before PostgreSQL is immediately reachable on the internal network.

To avoid a crash-loop:

- `scripts/migrate.mjs` retries PostgreSQL connectivity before applying migrations.
- The default retry policy is 30 attempts with a 2-second delay.
- Optional tuning:
  - `DB_CONNECT_RETRIES`
  - `DB_CONNECT_RETRY_MS`
- The production container sets `HOSTNAME=0.0.0.0`.
- Next.js must remain reachable on internal port `3000`.

These behaviors are deployment safeguards and should be preserved in future refactors.
