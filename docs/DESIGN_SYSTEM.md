# Desweb CMMS design system

## Core brand tokens

```css
:root {
  --brand-dark: #293644;
  --brand-white: #FCFCFC;
  --brand-mint-light: #BAE3E0;
  --brand-mint: #79CAC4;
  --brand-teal: #38B2A9;
  --brand-teal-hover: #2F9D95;
}
```

## Theme implementation

Two themes are implemented.

### Light

- light workspace;
- white/light surfaces;
- institutional dark text;
- Desweb teal primary actions;
- dark logo variant.

### Dark

- dark workspace;
- darker elevated surfaces;
- light text;
- teal and mint accents;
- light/white logo variant.

Mechanism:

- `data-theme="light"` or `data-theme="dark"` on `<html>`;
- persisted in `localStorage` under `desweb-theme`;
- first visit honors `prefers-color-scheme`;
- theme toggle in authenticated top bar.

Do not duplicate complete component styles per theme. Prefer semantic CSS variables and targeted overrides.

## Personalization module

Visual branding is controlled through **Dashboard → Personalización**.

Current editable assets:

- logo for light backgrounds;
- logo for dark backgrounds;
- favicon.

Guidelines:

- transparent PNG, WebP or SVG for logos;
- SVG or square PNG preferred for favicon;
- maximum upload size: 2 MB per asset;
- preserve original logo aspect ratio;
- do not apply arbitrary recoloring to uploaded logos.

The module is designed to expand later with color, typography and other visual settings.

## Components

### Cards
- subtle border;
- restrained shadow;
- 14px radius.

Company directory cards use a horizontal point-of-reference cover, a centered circular logo, location metadata and compact operational metrics. Missing legacy images use branded fallbacks.

Card details open in a modal with read-only fields by default. Editing must be explicitly enabled, saving requires confirmation, and destructive deletion requires a separate irreversible-action confirmation.

### Confirmation dialogs
- application confirmations must use the branded in-app dialog instead of browser-native `window.confirm()`;
- default confirmations use Desweb teal/mint accents;
- irreversible actions use the semantic danger treatment and explicit action labels;
- dialogs must support Escape, backdrop cancellation, keyboard focus, light/dark themes and reduced-motion preferences;
- confirmation copy should explain the consequence rather than rely on generic “Aceptar” wording.

### Buttons
Primary: Desweb teal with white label.  
Secondary: neutral surface with theme-aware text.

### Inputs
- visible labels;
- semantic surface/background;
- teal focus state;
- 9px radius.

### Tables
- semantic surface;
- soft row borders;
- theme-aware header background.

### Status
Semantic red/amber/green remain available where operational meaning requires them.

## Accessibility

- sufficient contrast in both themes;
- visible focus state;
- no status conveyed through color only;
- avoid tiny essential text;
- uploaded branding must not compromise readability.
