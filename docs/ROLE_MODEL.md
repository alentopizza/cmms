# Role and access model

This document is the source of truth for the approved Desweb CMMS role hierarchy and for the explanatory copy that must appear when administrators create users.

> Status: **Platform Owner foundation implemented; commercial roles still pending**.
>
> `platform_owner` is now active in authentication/RBAC. The bootstrap account configured by `APP_ADMIN_EMAIL` resolves as Platform Owner, and migration 015 promotes the database account `admin@dominio.com` when present. Superadministrator creation is reserved to Platform Owner. Comercial Desweb and Partner / Distribuidor remain approved future roles and are not yet active.

## Core principle: two separate hierarchies

Desweb CMMS must not model every account as one long permission ladder. There are two related but distinct security domains.

### Desweb platform hierarchy

```text
Propietario Desweb / Platform Owner
├── Superadministradores
├── Comerciales Desweb
└── Partners / Distribuidores
      └── cartera comercial autorizada
```

These roles operate the SaaS platform, commercial lifecycle, customer provisioning and platform governance.

### Customer / tenant hierarchy

```text
Administrador de empresa
├── Manager / Supervisor
├── Técnico
├── Solicitante
├── Consulta
├── Proveedor de servicios
└── Colaborador externo
```

These roles operate only inside the organization/tenant and within their assigned site scope.

A commercial relationship does **not** make a seller the operational superior of a customer's Administrator. Commercial ownership and tenant authorization remain separate.

---

## Canonical platform roles

### 1. Propietario Desweb / Platform Owner

Internal role key: `platform_owner`.

This is the maximum platform authority and the final ceiling of the hierarchy. The UI label should be **Propietario Desweb** or **Propietario de plataforma**. Avoid using `SeoAdmin` as the canonical product name because it can be confused with Search Engine Optimization.

Product rule:

- one primary active Platform Owner identity;
- current project-owner identity: `admin@dominio.com`;
- the environment bootstrap account (`APP_ADMIN_EMAIL`) resolves as Platform Owner;
- no normal role can promote itself to Platform Owner;
- no Superadministrator can create, edit the authority level of, suspend or delete the Platform Owner;
- only the Platform Owner can create or revoke Superadministrators;
- it is the final authority for exceptional irreversible platform operations after the required validation workflow;
- this account is not intended for routine daily administration.

Allowed scope:

- complete platform visibility across organizations;
- global platform configuration and branding;
- plan catalog and commercial configuration;
- user/role governance at every level;
- Superadministrator lifecycle;
- commercial-team and partner governance;
- platform-level audit review;
- emergency tenant recovery actions;
- final authorization/execution of controlled destructive operations.

Critical-operation rule:

Having the highest role does not mean a one-click destructive bypass. Permanent purge/reset operations must be implemented as a governed workflow that may require:

1. explicit reason;
2. reauthentication;
3. strong MFA;
4. dependency and legal/retention validation;
5. backup/snapshot or documented decision not to retain;
6. typed confirmation of the target;
7. optional cooling-off period;
8. final Platform Owner authorization;
9. immutable audit evidence outside the data being purged where technically possible.

Example user-creation help text:

**Propietario Desweb** — Máxima autoridad de la plataforma. Puede gobernar todos los niveles y es el único rol que puede crear o retirar Superadministradores y autorizar operaciones irreversibles críticas. No debe utilizarse como cuenta operativa cotidiana.

### 2. Superadministrador

Suggested internal role key: `superadmin`.

Purpose: trusted Desweb platform operator.

Allowed scope:

- create, configure, activate and support customer organizations;
- assign approved plans and effective resource limits;
- create the initial Administrador de empresa and manage customer onboarding;
- administer platform-level customer records and support workflows;
- manage leads/subscriptions within assigned platform capabilities;
- create lower-level platform users only when explicitly permitted by the future permission matrix;
- view cross-company operational information only where platform support/audit privileges permit it.

Hard limits:

- cannot create another Superadministrator;
- cannot create or modify the Platform Owner;
- cannot grant a role higher than its own;
- cannot perform final irreversible global/tenant destruction reserved to the Platform Owner;
- cannot silently bypass audit, retention or approval controls.

Example user-creation help text:

**Superadministrador** — Administra clientes y la operación global de Desweb. Puede crear empresas, asignar planes y crear Administradores de empresa, pero no puede crear otros Superadministradores ni ejecutar por sí solo eliminaciones irreversibles reservadas al Propietario Desweb.

### 3. Comercial Desweb

Suggested internal role key: `sales`.

Purpose: internal Desweb sales/advisor account.

Allowed scope:

- leads and opportunities assigned to the account/team;
- plan catalog and approved commercial information;
- proposals, demos, trial initiation and customer onboarding workflow;
- customer commercial status, subscription/renewal visibility as authorized;
- attribution of the sale to the commercial account;
- future commissions/goals/campaign tracking.

Provisioning rule:

A Commercial may initiate or prepare customer provisioning only through the approved sales workflow. Direct creation of privileged platform accounts or arbitrary tenant operations is not implied by this role.

Hard limits:

- no Superadministrator creation;
- no Platform Owner access;
- no unrestricted operational access to customer maintenance data;
- no deletion of tenant operational records;
- no arbitrary changes to contractual limits outside approved commercial rules;
- sees only commercial/customer scope assigned by policy.

Example user-creation help text:

**Comercial Desweb** — Gestiona prospectos, planes, demos, ventas y seguimiento comercial. Puede iniciar el proceso de alta de clientes según las reglas comerciales, pero no administra la operación de mantenimiento ni tiene permisos técnicos globales.

### 4. Partner / Distribuidor

Suggested internal role key: `partner`.

Purpose: authorized third party that sells/distributes Desweb CMMS.

Allowed scope:

- own assigned leads/opportunities;
- own attributed customer portfolio;
- approved plan/commercial information;
- initiate partner onboarding/provisioning requests;
- future partner commissions, renewals and sales attribution.

Hard limits:

- never sees the full Desweb customer base by default;
- no access to clients not assigned to that partner;
- no Superadministrator or Platform Owner management;
- no unrestricted customer operational data;
- no destructive tenant/platform controls;
- commercial discounts/plan exceptions require the configured approval policy.

Example user-creation help text:

**Partner / Distribuidor** — Vende y distribuye Desweb sobre una cartera autorizada. Solo puede gestionar sus oportunidades y clientes asignados; no obtiene acceso administrativo global ni a la operación técnica de otros clientes.

---

## Canonical tenant roles

Tenant roles are scoped to exactly one organization and, where applicable, to all sites or an explicit site subset.

### Administrador de empresa

Suggested internal role key: `admin`.

Highest customer-side role.

Allowed scope:

- organization settings available to the tenant;
- users and roles within the company, subject to role-creation rules;
- sites and sublocations;
- suppliers;
- technicians/external collaborators/provider relationships;
- crews;
- assets and inventory;
- work orders, activities and preventive maintenance;
- attendance policy and reports where enabled;
- tenant profile/settings allowed by subscription.

Hard limits:

- cannot manage other organizations;
- cannot alter Desweb platform users;
- cannot create Platform Owner, Superadministrator, Commercial or Partner accounts;
- cannot change contractual platform entitlements unless a future commercial capability explicitly allows requests rather than direct changes.

User-creation rule:

May create/edit tenant users at or below the allowed customer hierarchy, but never platform roles.

Example user-creation help text:

**Administrador de empresa** — Máximo nivel dentro de una empresa cliente. Administra usuarios, sedes y módulos operativos de su organización, pero no puede acceder a otras empresas ni crear roles de plataforma Desweb.

### Manager / Supervisor

Suggested internal role key: `manager`.

Allowed scope:

- operational coordination within the organization/site scope;
- locations, assets, work orders, activities, preventive maintenance, inventory and crews as allowed by the permission matrix;
- attendance management/reports where enabled.

Hard limits:

- no platform administration;
- no contractual plan/limit changes;
- no creation of higher tenant authority unless explicitly delegated by future policy;
- no cross-organization access.

Example user-creation help text:

**Manager / Supervisor** — Coordina la operación de mantenimiento dentro de las sedes autorizadas. Gestiona trabajo operativo y equipos, sin permisos de administración global de la empresa ni de la plataforma.

### Técnico

Suggested internal role key: `technician`.

Allowed scope:

- assets relevant to assigned scope;
- assigned work orders/activities;
- preventive information;
- inventory consultation/use required for execution;
- attendance/self-service field verification where enabled.

Hard limits:

- no user/role administration;
- no plan/company configuration;
- no unrestricted deletion of master data;
- no access outside assigned organization/site/work scope.

Example user-creation help text:

**Técnico** — Ejecuta mantenimiento sobre los trabajos y sedes autorizados. Puede consultar la información necesaria para realizar su labor, pero no administra usuarios, planes ni configuración empresarial.

### Solicitante

Suggested internal role key: `requester`.

Allowed scope:

- create maintenance requests/work orders according to configured workflow;
- view own requests and their permitted status/history.

Hard limits:

- no maintenance administration;
- no asset/configuration editing beyond request permissions;
- no access to unrelated requests unless future policy explicitly permits it.

Example user-creation help text:

**Solicitante** — Reporta necesidades de mantenimiento y consulta el avance de sus solicitudes permitidas. No administra la operación ni la configuración del CMMS.

### Consulta

Suggested internal role key: `viewer`.

Allowed scope:

- read-only visibility of authorized operational modules.

Hard limits:

- no creation/edit/delete operational actions;
- no user administration;
- no configuration or plan controls.

Example user-creation help text:

**Consulta** — Acceso de solo lectura a la información autorizada. Puede consultar datos operativos, pero no crear, editar ni eliminar registros.

### Proveedor de servicios

Suggested internal role key: `provider`.

Existing domain rule remains:

- represents an authenticated account for a service-capable supplier;
- sees/executes only work assigned to that supplier;
- is not a normal internal technician;
- is not a member of internal/external crews by default.

Example user-creation help text:

**Proveedor de servicios** — Representa a una empresa proveedora de servicios y solo puede consultar o ejecutar trabajos asignados a ese proveedor.

### Colaborador externo

Suggested internal role key: `external`.

Existing domain rule remains:

- external individual, optionally linked to a supplier;
- sees/executes only work assigned directly or through a crew containing that person;
- does not inherit all work belonging to a supplier.

Example user-creation help text:

**Colaborador externo** — Persona externa autorizada para trabajos específicos. Solo accede a actividades asignadas directamente o mediante sus cuadrillas autorizadas.

---

## Who may create whom

This matrix is the approved target behavior. Implementation must enforce it server-side, not only hide options in the UI.

| Creator | Platform Owner | Superadmin | Commercial | Partner | Company Admin | Manager | Technician | Requester | Viewer | Provider | External |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Platform Owner | No normal second owner | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Superadmin | No | **No** | Policy-controlled | Policy-controlled | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Commercial | No | No | No | No | Only through approved onboarding flow | No | No | No | No | No | No |
| Partner | No | No | No | No | Only through approved partner onboarding flow | No | No | No | No | No | No |
| Company Admin | No | No | No | No | Policy-controlled within same tenant | Yes | Yes | Yes | Yes | Yes | Yes |
| Manager | No | No | No | No | No | No by default | Policy-controlled | Policy-controlled | Policy-controlled | Policy-controlled | Policy-controlled |
| Other tenant roles | No | No | No | No | No | No | No | No | No | No | No |

Notes:

- “Policy-controlled” means the permission must be explicitly designed before implementation; it is not automatically granted by this document.
- No account may grant a role above its authorized ceiling.
- Tenant creators may only create users inside their own organization and permitted site scope.
- Commercial/Partner onboarding must not become a hidden path to privileged platform access.

---

## Required UX when creating or editing users

Every user-creation/edit interface must explain the selected role before submission.

Minimum information to display:

- role name;
- plain-language purpose;
- organizational scope;
- key permissions;
- key restrictions;
- which lower roles it may create/manage;
- whether it can access one company, assigned customers or the whole platform;
- warning when selecting a privileged platform role.

The role selector must never present only a role name without context.

For highly privileged roles:

- Platform Owner creation is not a normal selectable option;
- Superadministrator creation is visible only to Platform Owner;
- Commercial and Partner roles are platform accounts, not company memberships;
- tenant roles require explicit organization and site scope.

---

## Privilege and destructive-action rules

Role level alone is not sufficient authorization for critical actions.

Future implementation must distinguish:

- normal CRUD permission;
- sensitive administration permission;
- destructive irreversible permission;
- final approval authority.

Examples reserved for a controlled Platform Owner workflow may include:

- permanent tenant purge;
- destructive platform reset;
- deletion of a Superadministrator;
- forced recovery of a tenant when normal administrators are unavailable;
- removal of records otherwise protected by lifecycle rules after retention/legal validation.

These actions require a separate, auditable process. They must not be implemented as an ordinary “Delete” button simply because the actor is Platform Owner.

---

## Future commercial capabilities enabled by this model

The platform-role split is intended to support later features without granting maintenance administration to sellers:

- salesperson/partner attribution on leads and subscriptions;
- customer portfolio ownership;
- commissions;
- renewals;
- commercial targets;
- channel/partner codes;
- approved discounts;
- advisor assignment;
- sales reporting;
- partner-specific customer visibility.

Commercial metrics must remain separate from tenant operational authorization.


## Platform Owner universal deletion — development capability

Status: implemented.

During the active development phase, `platform_owner` has an exclusive universal-deletion capability.

Rules:

- only a server-authenticated `platform_owner` session may access the purge discovery or execution endpoints;
- Superadministrator and every tenant role receive HTTP 403 even if they manually call the endpoint;
- the owner workspace is available at `/dashboard/platform-owner/purge`;
- deletion targets any public base table that exposes an `id` column, except explicitly excluded migration metadata tables;
- the engine discovers foreign-key dependencies from PostgreSQL catalogs rather than relying on a hard-coded list;
- RESTRICT, NO ACTION and CASCADE-owned branches are recursively deleted before the target;
- SET NULL and SET DEFAULT relationships keep their surviving records according to database semantics;
- the whole operation runs in one transaction;
- an unresolved restrictive FK cycle aborts and rolls back the entire operation;
- the active Platform Owner account can never be deleted by this engine;
- the user must explicitly confirm with the word `ELIMINAR` in the universal workspace;
- successful operations write a `platform_owner.force_delete` audit event with target and deletion counts.

Normal roles retain their existing delete/traceability rules. The universal behavior is not inherited by Superadministrators.

Existing delete flows may opt into the universal engine only after verifying `platform_owner` server-side. User deletion is the first integrated normal-flow example: Platform Owner may remove a user with historical records while other roles remain blocked.
