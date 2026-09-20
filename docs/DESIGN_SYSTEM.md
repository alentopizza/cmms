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

### Confirmation dialogs

Use `components/ConfirmForm.tsx` for forms that save edits or delete records. It intercepts the form submit event (including Enter), validates the form, opens `ConfirmationDialog`, and submits once after approval. Do not use `window.confirm` or `window.alert` for these operations.

The native HTML `dialog` element supplies top-layer positioning and focus containment; its appearance is fully styled with Desweb tokens, teal save actions, restrained red destructive actions, rounded corners and a blurred backdrop. Cancel is initially focused. Escape cancels only the confirmation, without closing the underlying company detail. Cancellation preserves input values. Focus returns to the invoking control. Motion respects `prefers-reduced-motion` and no sound is played.

Use contextual titles and explicit labels: “Sí, guardar cambios”, “Sí, eliminar empresa”, or “Sí, cambiar estado”. Do not promise successful deletion before the server has checked history and dependencies.

- sufficient contrast in both themes;
- visible focus state;
- no status conveyed through color only;
- avoid tiny essential text;
- uploaded branding must not compromise readability.
