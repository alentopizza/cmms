# DESWEB Design System V2 — Phase 1 baseline audit

Date: 2026-09-24  
Scope: frontend foundations only. This audit does not authorize module redesign or functional changes.

## 1. Technical stack

- Next.js 16
- React 19
- TypeScript
- Global CSS in `app/globals.css`
- No Tailwind
- No external component framework
- Existing theme contract: light / dark / system
- Existing configurable branding: light logo, dark logo and favicon

Conclusion: V2 should use central CSS variables + React components. Introducing Tailwind or a third-party UI framework would add a second styling system and requires an explicit ADR.

## 2. CSS baseline

Measured from `app/globals.css` on the Phase 1 starting point:

- file size: approximately **540 KB**;
- raw hex occurrences: **1,561**;
- distinct hex values: **915**;
- CSS variable definitions: **103** occurrences / **68** unique names.

The quantity of distinct hex values confirms that color debt cannot be safely solved by repository-wide replacement.

Most repeated raw values include:

- `#FFF`: 175 occurrences;
- `#203C3D`: 20;
- `#174D3D`: 18;
- `#16835F`: 18;
- `#E7F7F5`: 14;
- `#31595B`: 14;
- `#BE123C`: 13;
- `#FECDD3`: 12.

These counts are a migration baseline, not a list of approved colors.

## 3. Existing variables

The legacy stylesheet already has useful abstraction attempts, including:

- `--brand-*`;
- `--bg`, `--surface`, `--text`, `--border`;
- `--glass-*`;
- `--ui-space*`;
- `--ui-radius-*`;
- `--ui-shadow-*`;
- `--ui-control-height*`;
- module-header variables.

However, these variables evolved before Design System V2 and do not provide the complete approved token contract.

Phase 1 therefore adds `app/design-system/tokens.css` as the V2 runtime layer while leaving legacy variables untouched until controlled component migration.

## 4. Repeated visual families

Selector-name inspection shows multiple parallel implementations.

Examples:

### Buttons

- `.button`
- `.module-add-button`
- `.header-icon-button`
- `.text-button`
- `.dashboard-export-button`
- `.entity-action-button`
- file-upload and context-specific button styles

### Cards

Multiple independent card families exist for:

- companies;
- users;
- suppliers;
- inventory KPI;
- role selection;
- theme preferences;
- marketing;
- downloads;
- documents.

Some domain-specific differences are intentional; primitives/elevation/spacing/status treatment should still converge on UI Kit foundations.

### Modals

Existing families include:

- `.unified-create-modal`;
- `.company-modal`;
- legacy company/location detail modal styles;
- shared modal headers/backdrops;
- user-specific action rows.

The UI Kit should absorb modal primitives without reintroducing profile modals where the in-page workspace is already contractual.

### Status/badges

Existing families include:

- `.status-badge`;
- requisition status;
- inventory stock badges;
- procurement match/review badges;
- attendance and Reaction states.

This is a strong candidate for the Phase 2 Badge + StatusIndicator system.

### Data UI

There are parallel implementations of:

- tables;
- filters;
- search;
- KPI;
- tabs;
- alerts.

These remain in place until Phases 2–4 create and validate replacements.

## 5. Existing reusable components to preserve/extend

The audit identified reusable foundations already present:

- `UiIcon`
- `ModuleHeader`
- `ConfirmDialog`
- `ConfirmSubmitButton`
- `CreateRecordModal`
- `EntityProfileWorkspace`
- `FileDropzone`
- `MultiSelectDropdown`
- `InventorySubnav`
- `ProfileExportMenu`

They should not be discarded merely to rename them. Each Phase 2–5 migration must decide whether to:

1. keep as-is;
2. adapt to tokens;
3. wrap/re-export;
4. refactor into an official primitive;
5. retire only after all consumers migrate.

## 6. Icon decision for Phase 1

`UiIcon` is the provisional canonical icon system.

Reasons:

- already used in core entity/profile flows;
- SVG outline language matches the new UI direction;
- no external dependency;
- current icon size/stroke model is consistent;
- replacing it now would create migration churn without functional value.

Phase 1 exposes it through `components/ui/Icon.tsx`. Legacy imports remain valid. Phase 2 may expand names/accessibility contracts but must not create a competing icon family.

## 7. Runtime token architecture

New source:

`app/design-system/tokens.css`

Rules:

- loaded before `app/globals.css`;
- V2 token names are independent from legacy variables;
- legacy variables are intentionally **not overridden globally** in Phase 1;
- new UI Kit code consumes V2 tokens immediately;
- dark mode remaps semantic V2 tokens using approved Navy/Teal scales;
- reduced-motion preference collapses motion-duration tokens.

This prevents a foundation PR from silently restyling the whole production application.

## 8. UI Kit skeleton

`/ui-kit` is now a live, no-index catalog of actual V2 foundations.

Phase 1 sections:

- Brand;
- semantic colors;
- chart sequence;
- typography;
- spacing;
- radius;
- shadows;
- motion;
- icon system.

It deliberately does not claim Phase 2 primitives are complete.

## 9. Migration risks

High-risk patterns to avoid:

- blind old-hex → new-hex replacement;
- overriding all legacy aliases at `:root` before component validation;
- moving server/business logic into UI primitives;
- replacing all modal/profile patterns indiscriminately;
- mixing a new third-party icon library with `UiIcon`;
- using dark-theme overrides that only work for one module;
- shrinking desktop patterns on mobile instead of adapting composition.

## 10. Phase 1 completion criteria

- [x] V2 runtime token layer exists.
- [x] Brand/semantic/chart foundations exist.
- [x] Typography/spacing/radius/shadow/motion tokens exist.
- [x] Dark semantic mapping exists.
- [x] Reduced motion is represented.
- [x] Existing legacy styling remains operational.
- [x] UI Kit namespace exists.
- [x] Existing icon system has a canonical migration path.
- [x] `/ui-kit` foundation catalog exists.
- [x] Legacy CSS debt is measured.
- [ ] Phase 2 primitives — intentionally not part of this phase.

Next: **Phase 2 — UI Core primitives and interaction states**.
