# Architecture and product decisions

## ADR-001 — PostgreSQL as system of record

Status: accepted.

PostgreSQL is used for all core CMMS operational data. This supports relational integrity among companies, sites, assets, plans, work orders and inventory.

## ADR-002 — Explicit SQL migrations instead of ORM

Status: accepted for current phase.

The project uses SQL migrations and `pg` directly. This keeps database behavior explicit and avoids introducing an ORM during the first product iterations.

Migration files are immutable after they have been applied in production. Schema changes require a new migration.

## ADR-003 — Multi-company from the first schema

Status: accepted.

Multi-tenancy is not a later add-on. Operational records carry `organization_id`, with sites providing additional local segmentation.

## ADR-004 — Easypanel + Docker deployment

Status: accepted.

Production deployment is from GitHub branch `main`, using `Dockerfile`, with PostgreSQL as a separate persistent service.

## ADR-005 — Bootstrap admin authentication

Status: retained as fallback.

The environment-configured administrator remains available as an emergency/developer superadministrator. Normal application users authenticate from PostgreSQL and receive role/tenant-aware sessions.

## ADR-006 — Public URL based redirects

Status: accepted.

Because Easypanel proxies requests to an internal container hostname, HTTP redirects must use `NEXT_PUBLIC_APP_URL` via `lib/urls.ts`. Using `request.url` directly caused browsers to be redirected to the internal Docker hostname.

## ADR-007 — Login dashboard preview uses illustrative data

Status: accepted.

The login page displays representative CMMS metrics to communicate the application's purpose before authentication. These values are static illustrative examples, not live customer metrics, and the UI must make this distinction clear.

The preview focuses on:
- asset availability;
- open work orders;
- preventive maintenance compliance;
- asset criticality.


## ADR-008 — Company visual assets in PostgreSQL

Status: accepted.

Each company can store a logo and a point-of-reference cover image. The binary files and their MIME metadata live on the `organizations` record and are delivered through authenticated asset routes.

This follows the existing durable PostgreSQL asset strategy and avoids relying on the ephemeral application filesystem during Easypanel redeploys. Uploads are limited to PNG, JPEG or WebP, with separate size limits for logos and covers.

## ADR-009 — Sites as principal locations and recursive sublocations

Status: accepted.

The existing `sites` table represents the top-level operational location (for example a hospital). Subordinate spaces use one recursive `locations` table instead of separate tables for floors, rooms and areas. This supports unlimited practical depth and preserves one consistent relation for assets, inventory and maintenance activity.

## ADR-010 — Server-enforced tenant resource entitlements

Status: accepted.

The super administrator assigns creation limits in `organization_limits`. Limits must be checked by server-side mutations and never only by disabled UI controls. Current entitlements cover principal locations, sublocations, assets, inventory items and technicians; more resources can be added without changing the tenant model.


## ADR-011 — Database users, signed sessions and centralized RBAC

Status: accepted.

Application accounts use the existing `users` and `organization_members` domain model. Passwords are stored only as scrypt-derived hashes with random salts. Session cookies contain signed identity references rather than trusting browser-supplied organization or role values.

A platform role distinguishes superadministrators from organization users. Organization roles are `owner`, `admin`, `manager`, `technician`, `requester` and `viewer`. The permission matrix is centralized in `lib/permissions.ts`.

Authorization is defense-in-depth: navigation is filtered for usability, pages reject unauthorized direct access, API mutations re-check permissions, and tenant data queries are scoped by the organization resolved from the authenticated session.


## ADR-012 — Resource entitlements are platform-admin controls

Status: accepted.

Organization resource limits are commercial/platform entitlements rather than daily maintenance configuration. Only a platform superadministrator may assign or change them. Company administrators and other organization roles consume those limits but do not receive entitlement-management permission.

The company detail editor surfaces both current usage and configured capacity to authorized platform administrators, and entitlement changes are protected independently at the server route.
