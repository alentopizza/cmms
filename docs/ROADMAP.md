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
- Pro organization white-label foundation
- repository continuity documentation for AI/developer handoff
- Docker Compose self-hosted installation foundation
- public /downloads information page
- versioned private self-hosted ZIP/TAR packaging workflow

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


## Distribution and protection path

1. Stabilize a versioned release process and release notes.
2. Add automated backup/restore verification for self-hosted deployments.
3. Decide commercial self-hosted license terms before external distribution.
4. Produce signed/versioned downloadable release artifacts or container images.
5. Prepare software-authorship registration materials and trademark searches/filings.
6. Evaluate patent protection only if a specific technical invention is identified and before public disclosure of that invention.
