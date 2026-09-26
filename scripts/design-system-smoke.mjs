import fs from "node:fs";

const tokens=fs.readFileSync("app/design-tokens.css","utf8");
const layout=fs.readFileSync("app/layout.tsx","utf8");
const dashboard=fs.readFileSync("app/dashboard/layout.tsx","utf8");
const brandTheme=fs.readFileSync("lib/brand-theme.ts","utf8");
const uiKit=fs.readFileSync("app/ui-kit/page.tsx","utf8");

const required=[
  "--color-brand-primary:#72F1DC",
  "--color-brand-secondary:#2C8780",
  "--color-brand-dark:#1D1D2C",
  "--color-bg:#F4F8F9",
  "--color-surface:#FFFFFF",
  "--color-text-primary:#1D1D2C",
  "--color-border-default:#D5E1E3",
  "--color-success-500:#10B981",
  "--color-warning-500:#F59E0B",
  "--color-danger-500:#EF4444",
  "--color-info-500:#3B82F6",
  "--space-1:4px",
  "--space-16:64px",
  "--radius-md:8px",
  "--radius-3xl:20px",
  "--motion-fast:120ms",
  "--motion-slow:320ms",
  "--brand-teal:var(--color-action-primary)",
  "--brand-mint:var(--color-action-accent)",
];

for(const token of required){
  if(!tokens.includes(token))throw new Error("Missing Design System token: "+token);
}

if(!tokens.includes('html[data-theme="dark"]'))throw new Error("Dark semantic token mapping is missing");
if(!tokens.includes("@media(prefers-reduced-motion:reduce)"))throw new Error("Reduced-motion token override is missing");

const legacyImport=layout.indexOf('import "./globals.css";');
const tokenImport=layout.indexOf('import "./design-tokens.css";');
if(legacyImport<0||tokenImport<0||tokenImport<legacyImport){
  throw new Error("design-tokens.css must load after globals.css");
}

if(!dashboard.includes("brandCssVariables"))throw new Error("Dashboard must consume the centralized organization brand bridge");
for(const variable of ["--color-action-primary","--color-action-accent","--brand-teal","--brand-mint"]){
  if(!brandTheme.includes(variable))throw new Error("White-label bridge missing "+variable);
}

if(!uiKit.includes('getSession()')||!uiKit.includes('FoundationPreview')){
  throw new Error("/ui-kit must remain authenticated and render the real foundation preview");
}

console.log("DESWEB Design System V2 foundation checks passed.");
