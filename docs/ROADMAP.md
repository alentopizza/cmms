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
   - stronger site-level restrictions for operational records;
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
