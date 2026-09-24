# DESWEB Design System V2 — Phase 1 audit

Audit date: 2026-09-24.

## Runtime stack

- Next.js 16
- React 19
- TypeScript
- global CSS in `app/globals.css`
- no Tailwind
- no CSS-in-JS framework
- no third-party component library

This confirms that the V2 migration should use CSS custom properties plus reusable React components rather than introducing another styling framework.

## Legacy CSS baseline

At the start of Phase 1, `app/globals.css` measured approximately:

- 13,502 lines;
- 540 KB;
- 1,561 hexadecimal color occurrences;
- 915 unique hexadecimal values;
- 682 RGB/RGBA expressions;
- 68 existing CSS custom properties.

These figures are a migration baseline, not a target for immediate removal.

Frequent legacy values include `#fff`, prior dark/teal surfaces and numerous component-specific light/dark variants. A repository-wide blind replacement is prohibited.

## Existing token layer before V2

The legacy top-level aliases were:

- `--brand-dark`
- `--brand-white`
- `--brand-mint-light`
- `--brand-mint`
- `--brand-teal`
- `--brand-teal-hover`
- `--bg`
- `--surface`
- `--text`
- `--text-soft`
- `--border`
- `--success`
- `--warning`
- `--danger`
- `--shadow`

Phase 1 keeps these names as compatibility aliases but maps them to V2 semantic tokens in `app/design-tokens.css`.

## Reusable component candidates already present

Existing components that must be evaluated before creating equivalents in Phase 2:

- `UiIcon`
- `ConfirmDialog`
- `ConfirmSubmitButton`
- `CreateRecordModal`
- `ModuleHeader`
- `MultiSelectDropdown`
- `FileDropzone`
- `EntityProfileWorkspace`
- `InventorySubnav`
- `DashboardChrome`
- `DashboardSidebar`
- `ThemeToggle`
- `ThemePreferences`

Phase 2 should extend/absorb these where appropriate instead of creating parallel copies.

## Icon decision

`components/UiIcon.tsx` remains the official internal icon mechanism for the first V2 migration stages.

Reasons:

- it already uses consistent outline SVGs;
- it has no runtime dependency;
- it is used in the approved entity-profile pattern;
- introducing a new icon library during Foundations would add unnecessary migration surface.

Future rules:

- new functional icons should extend `UiIcon` while this decision remains active;
- Unicode glyphs in legacy navigation remain migration targets for Phase 3;
- replacing `UiIcon` with an external library requires a dedicated ADR and migration plan.

## White-label compatibility

Existing organization branding currently supplies custom primary/secondary colors from the Dashboard shell.

Phase 1 maps those values to:

- `--color-action-primary`
- `--color-action-accent`

while continuing to set the legacy `--brand-teal` / `--brand-mint` aliases.

The immutable DESWEB brand foundation tokens remain available for system identity, while organization-specific action tokens preserve Pro white-label behavior.

## Theme strategy

`app/design-tokens.css` is loaded after `app/globals.css`.

This is intentional:

1. legacy selectors remain untouched;
2. V2 aliases become the effective variables;
3. dark-mode semantic variables override the legacy theme aliases;
4. module migration can proceed gradually.

Do not reorder the token stylesheet before legacy global CSS unless the migration architecture is intentionally changed.

## Phase 1 outputs

- V2 runtime token layer;
- legacy aliases;
- semantic light/dark tokens;
- white-label action-token bridge;
- typed token catalog in `lib/design-system.ts`;
- `components/ui-kit/` foundation;
- authenticated `/ui-kit` live playground;
- automated Foundations smoke validation.

## Deferred to Phase 2+

Not part of Foundations:

- complete Button primitive;
- complete form primitives;
- DataTable;
- Modal/Drawer replacement;
- global shell redesign;
- module card redesign;
- removal of legacy color declarations;
- Unicode navigation icon migration.

Those changes remain phased according to `docs/DESIGN_MIGRATION_PLAN.md`.
