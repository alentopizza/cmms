# Roadmap

This roadmap is directional and should be updated as priorities change.

## Foundation — implemented

- PostgreSQL database and migrations
- Docker/Easypanel deployment
- health endpoint
- multi-company schema
- sites
- asset model
- work-order model
- preventive maintenance schema
- meter schema
- inventory schema
- suppliers
- audit log
- bootstrap login
- initial dashboard
- visual login experience
- company detail and editing
- multiple site creation and editing
- company and site activation states
- visual company directory with logo and cover images
- popup-based company creation
- database-backed user login and password hashing
- signed identity sessions
- role-based navigation and server authorization
- tenant-scoped operational queries
- user and role administration module
- company administrator settings with resource-capacity health
- SaaS plan catalog and organization subscriptions
- 15-day trial lifecycle and expiration gate
- public landing and simulated checkout/provisioning flow
- advisor lead capture from the landing and Superadmin lead inbox
- Pro organization white-label foundation
- repository continuity documentation for AI/developer handoff
- Docker Compose self-hosted installation foundation
- public /downloads information page
- versioned private self-hosted ZIP/TAR packaging workflow

## Implemented operational dependency foundation

- mandatory company → site → sublocation → supplier dependency;
- supplier types for materials, services or both;
- provider and external-collaborator access roles;
- crew creation with internal/external members and a leader;
- supplier + sublocation relationship on new assets and inventory items;
- activity assignment to a person, crew or service supplier;
- external/provider work visibility restricted to assigned execution scope.

## Next functional priorities

### Current foundation slice

- organization resource limits;
- principal-location quota enforcement;
- recursive sublocation hierarchy;
- precise location references prepared for assets, work orders and inventory.

1. Suppliers and asset management
   - full asset detail;
   - category management;
   - asset hierarchy;
   - serial/model/manufacturer;
   - documents/photos;
   - status changes;
   - complete maintenance history.

2. Work orders
   - detail page;
   - assignment;
   - status workflow;
   - tasks/checklist;
   - comments;
   - attachments;
   - labor/time tracking;
   - parts consumption;
   - cost calculation;
   - completion workflow.

3. Preventive maintenance
   - plan builder;
   - recurrence;
   - meter trigger;
   - checklist templates;
   - automatic work-order generation.

4. Users and authorization
   - real user login — foundation implemented;
   - password hashing — implemented;
   - organization membership — implemented;
   - role-based authorization — foundation implemented;
   - account editing, deactivation and password reset;
   - invitations;
   - multi-site assignment and site-level operational restrictions — implemented foundation;
   - extend site scope to future suppliers, teams and remaining operational detail routes;
   - technician profile/account linkage.

5. Inventory
   - part creation/editing;
   - stock movements;
   - minimum stock alerts;
   - work-order issue/return;
   - supplier association.

6. Reporting and KPIs
   - MTTR;
   - MTBF;
   - availability;
   - preventive compliance;
   - downtime;
   - maintenance costs;
   - work-order backlog.

## Later capabilities

- notifications;
- email;
- mobile/PWA experience;
- QR codes for assets;
- work requests from operators;
- recurring background jobs;
- exports;
- richer audit trails;
- external API/integrations.


## Commercialization path

1. Validate Trial/Básico/Medio/Pro provisioning with the simulated checkout.
2. Finalize monthly prices and commercial copy.
3. Integrate the selected payment provider through hosted checkout + signed webhooks.
4. Replace simulated paid activation with verified payment events.
5. Add renewal, past-due and cancellation webhook handling.
6. Finalize the public marketing landing and conversion analytics.
7. Add lead assignment, notifications, anti-spam/rate limiting and source/campaign attribution.


## Distribution and protection path

1. Stabilize a versioned release process and release notes.
2. Add automated backup/restore verification for self-hosted deployments.
3. Decide commercial self-hosted license terms before external distribution.
4. Produce signed/versioned downloadable release artifacts or container images.
5. Prepare software-authorship registration materials and trademark searches/filings.
6. Evaluate patent protection only if a specific technical invention is identified and before public disclosure of that invention.


## Recently completed company-management slice

- enterprise company profile with legal/admin/contact information;
- explicit separation between enterprise address and operational sites;
- corporate document dossier with requirement level and expiry metadata;
- authenticated document upload/download/archive flow;
- profile-completeness and document-health indicators in the company workspace and directory.


## Planned platform governance and distribution roles

Implementation status:

- **completed:** add **Propietario Desweb / Platform Owner** as the final platform privilege ceiling;
- **completed:** reserve Superadministrator creation/assignment to Platform Owner;
- add **Comercial Desweb** for internal sales/advisor workflows;
- add **Partner / Distribuidor** with portfolio-scoped customer/commercial visibility;
- keep customer operational hierarchy separate, with Administrador de empresa as the highest tenant role;
- **partially completed:** server-enforced "who may create whom" rules for Platform Owner → Superadministrator; expand when Commercial/Partner roles are introduced;
- display role purpose, scope, permissions and restrictions inside every user create/edit flow;
- add privileged-action reauthentication/MFA/audit workflow before any exceptional irreversible operation;
- later connect commercial roles to lead attribution, customer portfolios, commissions, renewals, partner codes and approved discounts.

Canonical target behavior: `docs/ROLE_MODEL.md`.


## Completed development tooling

- Platform Owner-only universal deletion workspace;
- PostgreSQL FK-driven recursive deletion engine;
- transaction rollback on unresolved restrictive cycles;
- Platform Owner self-protection;
- audit entry for successful forced purges;
- existing user deletion integrated with forced deletion only when the actor is Platform Owner.

Before production hardening, replace/reinforce this development workflow with the approved reauthentication, MFA, retention, backup and final-approval process.
