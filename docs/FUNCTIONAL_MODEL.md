# Functional model and implementation order

This document preserves the product flow agreed with the project owner. Reference screenshots describe behavior and information density; they are not a visual template to copy.

## Roles

### Super administrator

- creates and activates/deactivates companies;
- assigns resource limits;
- sees platform-level metrics;
- does not operate the daily maintenance records of customer companies.

### Company administrator

- works only inside their organization;
- creates principal locations and nested sublocations;
- manages suppliers, assets, inventory, technicians and crews;
- creates routines, work orders and preventive maintenance plans.

The active access model now includes:

- **Owner / company administrator:** users, locations and operational modules inside one organization. User access can cover all active sites or an explicit subset of sites.
- **Manager / supervisor:** locations, assets, work orders, preventive maintenance and inventory for one organization.
- **Technician:** asset visibility, work-order operation, preventive visibility and inventory consultation.
- **Requester:** creates maintenance requests/work orders and sees only requests created by that account in the current foundation.
- **Viewer:** read-only visibility of assets, work orders, preventive maintenance and inventory.
- **Super administrator:** platform-wide access including companies, global personalization and cross-company user creation.

Permissions are enforced both in navigation and server-side routes. Tenant users derive their `organization_id` from the signed-in session; browser-supplied identifiers are never sufficient authorization.

User lifecycle rules:
- creation is available to authorized account administrators;
- editing, activation/deactivation and permanent deletion are reserved to the platform superadministrator in the current hierarchy;
- users with operational history are never permanently deleted; they must be deactivated so work-order, meter, comment and audit traceability remains intact;
- changing the organization/global scope of an account with recorded activity is blocked, while role changes inside the same organization remain possible;
- organization users can be granted **all-site access** or **specific-site access**; specific assignments are stored independently and applied to operational reads/writes for locations, assets, work orders, preventive maintenance and site-scoped inventory.

## Resource entitlements

Initial controlled resources:

- principal locations (`sites`);
- sublocations (`locations`, all depths count toward one entitlement);
- assets;
- inventory articles;
- technicians.

Only the **Super administrator** can assign or change these resource entitlements. Company administrators consume the assigned capacity but cannot view or edit contractual/platform limits from their operational role.

Creating a record at the limit must fail on the server with a clear message. Deactivation preserves history and does not normally release an entitlement; only permanent deletion does. This rule prevents plans from being bypassed by repeatedly deactivating records.

## Operational creation flow

1. Super administrator creates a company and assigns its plan limits.
2. Company administrator creates a principal location, such as a hospital.
3. They create its hierarchy: floor, department, room, area or any required nested space.
4. They create suppliers.
5. They register assets or inventory articles and associate the supplier when applicable.
6. They place each asset/article in a principal location and optionally in an exact sublocation.
7. They create technicians and crews, selecting one crew leader.
8. They create routines, work orders and preventive maintenance linked to the physical location and assets.
9. Inventory parts may be assigned/consumed by maintenance activity, producing traceable stock movements.

## Entity distinction

- **Asset:** individually identifiable equipment or furniture; can receive work orders, preventive plans and history.
- **Inventory article:** quantity-controlled material with receipts, issues, returns and adjustments.
- **Spare part:** an inventory article consumed or reserved by a maintenance activity.
- **Supplier:** commercial party related to supplied assets/articles; it is not their physical owner or location.
- **Crew:** a temporary or stable group of technicians with one leader.

## Interaction rules

- Directory information uses modern cards with search and filters.
- Creation and detail actions normally open modal dialogs.
- Detail dialogs start read-only to prevent accidental changes.
- Edit mode must be explicitly enabled.
- Saving and deleting require contextual confirmation.
- Destructive operations explain impact before confirmation.
- Image inputs state accepted formats, maximum size and recommended pixels.
- Motion is short and functional: hover lift, pressed button state, modal transition and clear success/error feedback.
- Sound is optional, subtle, disabled by default and must respect reduced-motion/accessibility preferences where relevant.

## Implementation order

1. Tenant limits and location hierarchy.
2. Suppliers.
3. Assets and asset hierarchy.
4. Inventory and stock movements.
5. Technicians and authorization (authentication/RBAC foundation already implemented; technician operational profiles continue here).
6. Crews and leadership.
7. Routines/checklists.
8. Work-order lifecycle.
9. Preventive maintenance generation and scheduling.
10. Metrics, notifications and final visual refinement.
