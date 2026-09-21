# Project context

## Product identity

**Desweb CMMS** is a commercial, multi-tenant Computerized Maintenance Management System (CMMS) for managing companies, physical locations, assets, maintenance work, preventive plans, inventory and maintenance teams.

Primary hosted environment:

`https://cmms.desweb.cloud`

Repository:

`alentopizza/cmms`

Primary deployment:

Easypanel + Docker + PostgreSQL.

The project is also being prepared for a licensed, downloadable/self-hosted distribution using Docker Compose.

## Product direction

Desweb CMMS is not being built as a one-off internal application. The product direction is a reusable SaaS platform with:

- isolated customer organizations;
- role- and site-scoped access;
- monthly commercial subscriptions;
- Trial, Básico, Medio and Pro tiers;
- server-enforced resource entitlements;
- a 15-day trial experience;
- future payment-provider integration through verified webhooks;
- advisor-assisted sales through the Superadministrator;
- self-service acquisition through a public landing;
- Pro organization white-label customization;
- eventual downloadable/self-hosted licensed distribution.

The repository documentation is intentionally maintained as the source of truth so future AI agents and developers can resume without reconstructing decisions from conversations.

## Current architecture

Core stack:

- Next.js 16
- React 19
- TypeScript
- PostgreSQL
- direct SQL through `pg`
- ordered immutable SQL migrations
- Docker
- Easypanel in the primary hosted environment

The application runs pending migrations before starting the production server.

## Implemented product foundation

### Multi-tenancy and companies

- organizations are the tenant boundary;
- companies can be created, edited, activated/deactivated and deleted according to protected lifecycle rules;
- companies support persistent logo and cover images;
- each organization may have multiple principal sites;
- principal sites contain recursive sublocations;
- operational queries are tenant scoped.

### Authentication and roles

Authentication supports:

- an environment-configured bootstrap Superadministrator for emergency/developer access;
- database-backed application users with scrypt password hashing;
- signed HTTP-only session cookies.

Active organization roles:

- Administrador de empresa;
- Manager / Supervisor;
- Técnico;
- Solicitante;
- Consulta.

The redundant `owner` role was removed. Administrador de empresa is the highest organization-level role.

### User administration

The user-management module supports:

- modal creation/editing;
- inline validation without losing entered data;
- organization assignment;
- role assignment;
- all-site or explicit multi-site scope;
- account activation/deactivation;
- permanent deletion only when operational history does not require retention;
- server-side tenant and site authorization.

### Operational modules

Current foundations exist for:

- dashboard summary;
- locations;
- assets/equipment;
- work orders;
- preventive maintenance;
- inventory;
- suppliers/data model;
- meters/readings;
- attachments;
- audit records.

The operational modules are still being expanded; see `docs/ROADMAP.md`.

## SaaS commercial model

The current catalog contains four plans.

### Trial

- 15 days;
- 1 principal site;
- 10 sublocations;
- 25 assets;
- 25 inventory items;
- 2 technicians;
- Desweb branding.

When the trial expires, tenant data is retained but operational dashboard access is blocked until a paid plan is activated.

### Básico

- 3 principal sites;
- 50 sublocations;
- 150 assets;
- 250 inventory items;
- 5 technicians.

### Medio

- 10 principal sites;
- 250 sublocations;
- 750 assets;
- 1,000 inventory items;
- 20 technicians.

### Pro

- 30 principal sites;
- 1,000 sublocations;
- 3,000 assets;
- 5,000 inventory items;
- 75 technicians;
- organization white label.

Prices are not finalized and must not be invented in implementation.

Commercial details live in `docs/COMMERCIAL_MODEL.md`.

## Subscription model

Implemented subscription states:

- `trialing`
- `trial_expired`
- `active`
- `past_due`
- `suspended`
- `canceled`

Paid plans are intended to renew monthly.

Current public checkout is explicitly a **test/simulated checkout** for validating provisioning and upgrade flows. It does not process real payments.

Future real payments must use a payment provider's hosted checkout and verified server-side webhooks.

## Resource entitlements

Plan defaults live in `billing_plans`.

Current subscription state lives in `organization_subscriptions`.

Effective operational limits live in `organization_limits`.

This separation is deliberate:

- plans define reusable defaults;
- effective limits are what server-side creation guards enforce;
- Superadministrators can negotiate company-specific overrides without modifying the shared plan.

Company administrators can see their assigned capacity and consumption but cannot modify contractual limits.

Consumption health:

- below 80% = normal;
- 80–94% = warning;
- 95%+ = critical;
- creation at capacity must fail server-side.

## Settings and customization

### Superadministrator

Global settings include platform appearance and global Desweb branding.

### Company administrator

Company settings include:

- company information;
- current plan/subscription;
- subscription start and end/renewal dates;
- resource consumption and remaining capacity;
- capacity warning/critical states;
- a **Mejorar plan** action that returns to public plan selection and updates the effective subscription after checkout;
- links to tenant user/location administration.

### Pro white label

Pro company administrators may configure tenant-specific:

- platform/app name;
- primary color;
- secondary color;
- light-background logo;
- dark-background logo;
- visibility of the Desweb footer signature.

Non-Pro tenants use the global Desweb branding.

## Navigation/UI direction

The authenticated desktop interface uses:

- one persistent sidebar as the primary module navigation;
- a contextual floating header that identifies the current area rather than duplicating navigation;
- account/settings actions at the bottom of the sidebar;
- light/dark/system appearance preferences under Configuración;
- modern technology-oriented surfaces while retaining Desweb brand tokens.

UI conventions are documented in `docs/DESIGN_SYSTEM.md`.

## Sales flows

### Self-service

Target flow:

```text
Landing
 -> choose plan
 -> payment provider hosted checkout
 -> verified webhook
 -> provision organization
 -> create company administrator
 -> activate subscription
 -> immediate access
```

The current landing implements the same provisioning concept with a simulated checkout. The public landing is intended to be a professional commercial surface, even during beta; technical checkout limitations are disclosed without dominating the value proposition.

### Advisor/direct sale

A Superadministrator creates the organization and selects its plan.

Plan defaults are assigned automatically, with later Superadministrator overrides available for negotiated contracts.

## Installation/distribution direction

Public product entry points during the current beta are:

- `/` — public landing and plan comparison;
- `/login` — application login;
- `/downloads` — self-hosted/download information;
- `/descargas` — Spanish alias for the same self-hosted information page;
- `/dashboard` — authenticated application.

The first portable installation format is Docker Compose:

- Next.js application;
- PostgreSQL;
- persistent database volume;
- automatic migrations;
- health checks.

See `docs/INSTALLATION.md`.

Do not create a separate desktop application merely to make the product "downloadable"; the intended downloadable edition is the same web platform packaged for self-hosting.

During beta, downloadable ZIP/TAR packages are generated privately by the GitHub Actions workflow **Package self-hosted**. Public anonymous package downloads should wait until commercial licensing and release controls are defined.

## Intellectual-property direction

The product owner intends to commercially protect and exploit the project.

Keep separate:

- software copyright/authorship evidence;
- trademark protection for commercial names/logos;
- patent evaluation only for specific technical inventions, not the application as a whole;
- commercial licensing for self-hosted distribution.

See `docs/IP_AND_DISTRIBUTION.md`.

No open-source license has been approved.

## Security invariants

- PostgreSQL is the system of record.
- Browser-supplied tenant/site identifiers are never sufficient authorization.
- Permissions must be checked server-side.
- Subscription capacity must be checked server-side.
- Paid-plan activation must eventually come from verified payment-provider webhooks.
- Secrets must never be committed.
- Production redirects must use `publicUrl()`.
- Existing applied migrations are immutable.
- Operational history should be preserved instead of destructively removed when traceability matters.

## Documentation continuity rule

Before modifying the project, future contributors/AI agents must read:

1. `AGENTS.md`
2. this file
3. `docs/ARCHITECTURE.md`
4. `docs/FUNCTIONAL_MODEL.md`
5. `docs/COMMERCIAL_MODEL.md`
6. `docs/DECISIONS.md`
7. `docs/DESIGN_SYSTEM.md`
8. `docs/BRANDING.md`
9. `docs/ROADMAP.md`
10. `docs/CHANGELOG.md`
11. `docs/INSTALLATION.md`
12. `docs/IP_AND_DISTRIBUTION.md`

Meaningful implementation work is incomplete until the relevant documentation is updated.
