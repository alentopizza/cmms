# Desweb branding

This document defines the official visual identity for Desweb CMMS.

## Brand name

Primary brand: **DESWEB**

Product name: **Desweb CMMS**

Tagline used in source artwork: **Desarrollo de Soluciones**

Do not use the misspelling "Deswel".

## Official palette

The approved brand palette supplied by the project owner is:

| Role | Hex |
|---|---|
| Dark / institutional background | `#293644` |
| White | `#FCFCFC` |
| Mint light | `#BAE3E0` |
| Mint medium | `#79CAC4` |
| Primary teal | `#38B2A9` |

These five colors are the source palette. Derived UI colors may be used for hover, borders, shadows and semantic states, but the product should visually remain anchored to these values.

## Logo assets

Current repository asset:

`public/brand/desweb-logo-dark.webp`

This asset was prepared from the official logo supplied by the project owner and is intended primarily for use on `#293644` or visually compatible dark backgrounds.

Current uses:
- login branding;
- application sidebar.

If additional official logo variants are supplied later, preserve the original files and add explicit light/dark/icon variants rather than overwriting this asset.

## Logo rules

- Preserve aspect ratio.
- Do not stretch or skew.
- Keep comfortable whitespace around the wordmark.
- Prefer the official logo over reconstructed text whenever there is sufficient horizontal space.
- For compact UI where the full wordmark does not fit, a documented icon/monogram variant may be used.
- Avoid decorative shadows or effects directly on the wordmark.
- Do not recolor the supplied logo arbitrarily.

## Product visual direction

Desweb CMMS should look:
- professional;
- technical;
- clean;
- modern;
- calm rather than flashy;
- suitable for industrial/operational software.

The dark institutional color is appropriate for:
- sidebar/navigation;
- login visualization panel;
- high-emphasis branded panels.

The teal is appropriate for:
- primary buttons;
- active navigation;
- KPI accents;
- chart series;
- focus states;
- progress indicators.

Mint tones are appropriate for:
- soft backgrounds;
- secondary charts;
- badges;
- visual hierarchy;
- hover surfaces.

## Typography

Current application stack:

`Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

Do not add a remote font dependency unless there is a clear product reason. The UI should remain fast and predictable in production.

## Semantic colors

Operational status colors may extend beyond the brand palette where meaning requires it:

- success / operational: green;
- warning / attention: amber;
- danger / stopped / urgent: red;
- informational / primary: Desweb teal.

Brand teal should not replace danger or warning semantics when that would reduce clarity.

## Login

The approved direction is a two-panel enterprise login:

Left:
- Desweb logo;
- login heading;
- email;
- password;
- primary teal submit action.

Right:
- dark Desweb background;
- representative CMMS metrics;
- asset availability;
- work-order backlog;
- preventive compliance;
- asset criticality.

The values in this login preview are illustrative, not customer data.

## Dashboard

The dashboard uses:
- institutional dark sidebar;
- white/light surfaces;
- teal action and KPI accents;
- restrained shadows;
- rounded cards;
- clear status hierarchy.

Future screens should follow the same tokens rather than inventing independent color schemes.
