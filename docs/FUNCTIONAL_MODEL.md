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

Future roles include manager, technician, requester and viewer with narrower permissions.

## Resource entitlements

Initial controlled resources:

- principal locations (`sites`);
- sublocations (`locations`, all depths count toward one entitlement);
- assets;
- inventory articles;
- technicians.

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

### Deletion and historical integrity

- Companies, principal locations and sublocations with operational history cannot be permanently deleted, including inactive records and cancelled work orders.
- For safety, registering an asset, inventory article, work order, plan, reading, stock movement or operational audit record is sufficient to establish history.
- The history marker remains after a transfer or deletion of the source record; it propagates to the original physical ancestors and company.
- Existing data is backfilled by migration 005. Activity erased before this migration and absent from all surviving audit data cannot be reconstructed.
- Empty leaf locations can be deleted with confirmation. Parents with sublocations or other linked dependencies must be resolved first. A company may delete its empty principal sites as part of confirmed deletion; operational data is never silently cascaded.
- Use activation/deactivation to retire a record with history. This operation preserves data and does not release its resource entitlement.
- Enforce this policy in PostgreSQL, not just by hiding buttons. API handlers translate blocked deletion to a clear message recommending deactivation.
- Do not claim full tenant authorization: environment-based bootstrap authentication remains in use until the planned user/role module is implemented.

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
5. Technicians and authorization.
6. Crews and leadership.
7. Routines/checklists.
8. Work-order lifecycle.
9. Preventive maintenance generation and scheduling.
10. Metrics, notifications and final visual refinement.
