# Desweb CMMS design system

## CSS tokens

The canonical implementation is in `app/globals.css`.

Core tokens:

```css
:root {
  --brand-dark: #293644;
  --brand-white: #FCFCFC;
  --brand-mint-light: #BAE3E0;
  --brand-mint: #79CAC4;
  --brand-teal: #38B2A9;
  --brand-teal-hover: #2F9D95;

  --bg: #F4F7F8;
  --surface: #FCFCFC;
  --text: #1F2937;
  --text-soft: #66727E;
  --border: #D9E2E7;
}
```

When adding new components, use these tokens instead of hardcoding unrelated colors.

## Layout

### Application shell

Desktop:
- dark sidebar;
- light main workspace;
- top bar inside workspace.

Mobile:
- current sidebar is hidden below the responsive breakpoint;
- future work should introduce a dedicated mobile navigation rather than forcing desktop navigation onto small screens.

### Content width

The main workspace is constrained to a readable maximum width while remaining fluid.

## Components

### Cards

Default cards:
- white surface;
- subtle gray border;
- 14px radius;
- very light shadow.

Cards should not use heavy shadows.

### Buttons

Primary:
- Desweb teal;
- white label;
- teal hover state.

Secondary:
- light neutral background;
- institutional dark text.

Danger actions should use semantic red rather than teal.

### Inputs

- white surface;
- soft gray border;
- teal focus border;
- subtle teal focus ring;
- consistent 9px radius.

### Tables

- white surface;
- soft borders;
- light header background;
- compact uppercase header labels.

### Status badges

Status badges should use soft tinted backgrounds and clearly legible text.

## Dashboard KPIs

KPI cards use:
- small semantic/brand icon block;
- descriptive label;
- large dark metric.

Operational exceptions may use warning/danger treatments.

## Charts

Preferred chart color order for neutral CMMS reporting:

1. `#38B2A9`
2. `#79CAC4`
3. `#BAE3E0`
4. `#293644`

Use red/amber/green only when the data has corresponding semantic meaning.

Do not use rainbow palettes for routine operational charts.

## Spacing and radius

General conventions:
- small gaps: 6–8px;
- form/component gaps: 12–18px;
- section spacing: ~24px;
- card radius: 14px;
- input/button radius: 9px.

Consistency is more important than introducing many size variants.

## Accessibility

- Preserve sufficient contrast.
- Do not communicate status through color alone.
- Inputs require visible labels.
- Focus state must remain visible.
- Avoid tiny text for essential information.
- Responsive views must remain usable without horizontal scrolling.

## Illustration and decorative content

The login CMMS preview is decorative/product-communicative and must remain explicitly labeled as illustrative.

Do not fabricate real operational data in authenticated dashboards. Authenticated dashboard values must originate from the database.
