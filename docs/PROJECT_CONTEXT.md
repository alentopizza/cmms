# Project context

## Product

**Desweb CMMS** is a web-based Computerized Maintenance Management System intended to manage maintenance operations for multiple companies, their local sites and their equipment.

Primary production URL:

`https://cmms.desweb.cloud`

Repository:

`alentopizza/cmms`

Deployment:

Easypanel, using the repository Dockerfile and a separate PostgreSQL service.

## Product goals

The system is being built iteratively. The long-term product should support:

- multiple companies/tenants;
- multiple sites per company;
- asset/equipment registry;
- asset hierarchy;
- corrective, preventive, inspection, emergency and improvement work orders;
- technicians, requesters, managers and administrators;
- calendar-based and meter-based preventive maintenance;
- meter readings;
- spare parts and inventory;
- suppliers;
- work-order tasks and comments;
- attachments;
- labor, part and external maintenance costs;
- downtime tracking;
- maintenance history and auditability;
- operational dashboards and maintenance KPIs.

## Current implementation state

The first production-capable foundation exists and includes:

- Next.js application;
- PostgreSQL database;
- automatic SQL migrations on container startup;
- Docker deployment;
- Easypanel deployment configuration documented in the repository;
- initial admin login;
- multi-company and multi-site database model;
- company detail, editing and activation state;
- visual company cards with persistent logo and point-of-reference cover image;
- popup-based company creation with image uploads;
- multiple site creation, editing and activation state;
- super-administrator resource entitlements;
- recursive sublocations below each principal location;
- asset creation/listing;
- work-order creation/listing;
- preventive and inventory base screens;
- operational dashboard;
- health endpoint;
- login UI with an illustrative CMMS data preview;
- official Desweb branding applied to login and authenticated shell;
- official brand palette represented as CSS design tokens.

## Brand implementation

Official source palette:
- `#293644`
- `#FCFCFC`
- `#BAE3E0`
- `#79CAC4`
- `#38B2A9`

Brand documentation:
- `docs/BRANDING.md`
- `docs/DESIGN_SYSTEM.md`

Logo asset:
- `public/brand/desweb-logo-dark.webp`

## Authentication today

Bootstrap authentication currently uses environment variables:

- `APP_ADMIN_EMAIL`
- `APP_ADMIN_PASSWORD`
- `AUTH_SECRET`

This is temporary. The database already contains `users` and `organization_members` so authentication can later migrate to real user accounts and roles without rebuilding the whole domain model.

## Important product language

Brand: **Desweb CMMS**

Domain: `cmms.desweb.cloud`

Terminology used in UI:
- Empresa
- Sede
- Activo / Equipo
- Orden de trabajo (OT)
- Mantenimiento preventivo
- Inventario / Repuestos
- Proveedor
- Técnico

## Agreed operating model

The super administrator creates tenants and assigns their resource limits. Company administrators then build their own isolated operational structure in this order: principal locations, nested sublocations, suppliers, assets/inventory, technicians, crews, routines, work orders and preventive maintenance. `docs/FUNCTIONAL_MODEL.md` is the detailed source of truth for this flow.

## Collaboration model

The repository is continuously modified by an AI assistant while the project owner deploys each iteration in Easypanel and validates visually. Documentation is intentionally kept in-repository so another AI or developer can resume work without reconstructing context from scratch.
