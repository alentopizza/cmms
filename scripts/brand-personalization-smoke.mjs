import fs from "node:fs";

const required=[
  "components/DashboardChrome.tsx",
  "components/BrandPersonalization.tsx",
  "components/BrandThemeSync.tsx",
  "components/UserManual.tsx",
  "app/dashboard/brand/page.tsx",
  "app/dashboard/preferences/page.tsx",
  "app/api/preferences/profile/route.ts",
  "app/api/organization-branding/route.ts",
  "lib/organization-branding.ts",
  "lib/brand-theme.ts",
  "app/brand-personalization.css",
  "app/account-experience.css",
  "db/migrations/043_brand_personalization.sql",
  "db/migrations/044_brand_personalization_light_default.sql",
  "db/migrations/045_brand_legacy_scheme.sql",
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing account/brand file: "+file);

const chrome=fs.readFileSync("components/DashboardChrome.tsx","utf8");
for(const marker of [
  'href="/dashboard/preferences"','href="/dashboard/help"','href="/dashboard/brand"',
  "Personalización de marca","PRO",'href="/dashboard/settings"',"logoutConfirm",
  'action="/api/auth/logout"','role="alertdialog"',
]){
  if(!chrome.includes(marker))throw new Error("User menu contract missing "+marker);
}
const navigation=fs.readFileSync("components/DashboardNavigation.tsx","utf8");
const dashboardLayout=fs.readFileSync("app/dashboard/layout.tsx","utf8");
if(
  navigation.includes('href:"/dashboard/brand"')||navigation.includes('href: "/dashboard/brand"')
  || dashboardLayout.includes('id: "brand"') || dashboardLayout.includes('id:"brand"')
){
  throw new Error("Brand personalization must not become a permanent sidebar module");
}
if(!dashboardLayout.includes("organizationBranding.autoPalette")){
  throw new Error("Saved automatic-palette preference must reach the dashboard shell");
}

const brand=fs.readFileSync("components/BrandPersonalization.tsx","utf8");
const brandTheme=fs.readFileSync("lib/brand-theme.ts","utf8");
for(const marker of [
  '"Esquema de color"','"Logo e identidad"','"Apariencia"','"Vista previa"',
  "Color principal","Color secundario","Color de acento",
  "Generar paleta automáticamente","Vista previa en tiempo real",
  "Guardar identidad visual","Restaurar predeterminado","cancelChanges",
  "brand-preview-tabs","brand-preview-filter","role=\"tablist\"","onTabKeyDown",'previewData.active?"success":"neutral"',
]){
  if(!brand.includes(marker))throw new Error("Brand workspace contract missing "+marker);
}
for(const marker of ["Predeterminado","Fresco","Luminoso","Azul","Café","Ectoplasma","Medianoche","Océano","Amanecer","Personalizado"]){
  if(!brandTheme.includes(marker))throw new Error("Brand preset missing "+marker);
}
if(brand.includes("/api/brand")||brand.includes("/api/personalization/brand")){
  throw new Error("Brand workspace introduced a parallel branding endpoint");
}
for(const marker of ["Logo existente de la empresa","sin duplicar el archivo","previewData.siteCount","previewData.city"]){
  if(!brand.includes(marker))throw new Error("Brand editor must reuse real Organization context: "+marker);
}
for(const forbidden of ["<strong>12</strong>","<strong>10</strong>","<strong>2</strong>","Bogotá"]){
  if(brand.includes(forbidden))throw new Error("Brand preview must not contain fictitious Organization data: "+forbidden);
}

const orgAssets=fs.readFileSync("lib/organization-assets.ts","utf8");
for(const marker of ["image-invalid","pngDimensions","jpegDimensions","webpDimensions","width>12000","height>12000"]){
  if(!orgAssets.includes(marker))throw new Error("Organization logo validation missing "+marker);
}

const api=fs.readFileSync("app/api/organization-branding/route.ts","utf8");
for(const marker of [
  'session.whiteLabel','session.planCode !== "pro"','session.role !== "admin"',
  "organization_branding","accent_color","scheme_key","interface_style","interface_density",
  'intent==="reset"','intent==="remove_logo"',"session.organizationId",
]){
  if(!api.includes(marker))throw new Error("Existing branding mutation extension missing "+marker);
}
if(api.includes('form.get("organization_id")')||api.includes("form.get('organization_id')")){
  throw new Error("Tenant branding target must come from the authenticated session, never browser form data");
}

const theme=fs.readFileSync("lib/brand-theme.ts","utf8");
for(const marker of [
  "--brand-primary","--brand-on-primary","--brand-secondary","--brand-accent","--brand-on-accent",
  "--brand-sidebar","--brand-on-sidebar","--brand-on-sidebar-active",
  "--color-action-primary","--color-focus-ring","buildBrandPalette","readableBrandText","darkenForLightText",
]){
  if(!theme.includes(marker))throw new Error("Central brand token bridge missing "+marker);
}
for(const forbidden of ["--color-success-","--color-warning-","--color-danger-","--color-info-"]){
  if(theme.includes(forbidden))throw new Error("Brand palette must not override semantic status tokens: "+forbidden);
}

const preferences=fs.readFileSync("app/dashboard/preferences/page.tsx","utf8");
for(const marker of ["Perfil","Preferencias","Apariencia","Seguridad","Integraciones","Información personal","Zona horaria","ThemePreferences","/api/preferences/profile"]){
  if(!preferences.includes(marker))throw new Error("Mi configuración contract missing "+marker);
}
const profileApi=fs.readFileSync("app/api/preferences/profile/route.ts","utf8");
if(!profileApi.includes("session.userId")||profileApi.includes("organization_members")||profileApi.includes("hashPassword")){
  throw new Error("Self profile boundary must update only personal fields of the authenticated user, never credentials or role/scope membership");
}

const help=fs.readFileSync("components/UserManual.tsx","utf8");
for(const marker of ["Manual / Ayuda","Primeros pasos","Administración","Gestión de activos","Órdenes de trabajo","Rutinas de mantenimiento","Inventario","Reportes","Video tutoriales","articlesForRole"]){
  if(!help.includes(marker))throw new Error("Manual/Ayuda category contract missing "+marker);
}

const settings=fs.readFileSync("app/dashboard/settings/page.tsx","utf8");
if(settings.includes('className="white-label-form"'))throw new Error("Company brand editor must be separated from general Settings");
if(!settings.includes('href="/dashboard/brand"'))throw new Error("General Settings must link to dedicated brand experience");

const migration=fs.readFileSync("db/migrations/043_brand_personalization.sql","utf8");
for(const marker of ["ALTER TABLE organization_branding","accent_color","scheme_key","auto_palette","interface_style","interface_density"]){
  if(!migration.includes(marker))throw new Error("Brand migration missing "+marker);
}
if(migration.includes("CREATE TABLE organization_brand"))throw new Error("Branding must extend the existing organization_branding table");

for(const file of ["app/brand-personalization.css","app/account-experience.css"]){
  const css=fs.readFileSync(file,"utf8");
  if(/#[0-9a-fA-F]{3,8}\b/.test(css))throw new Error(file+" must remain Design Token only");
  if(!css.includes(":focus-visible"))throw new Error(file+" must keep visible keyboard focus");
}

const shell=fs.readFileSync("app/shell-v2.css","utf8");
for(const marker of ["var(--brand-sidebar)","var(--brand-background)","brand-density-compact","brand-density-comfortable"]){
  if(!shell.includes(marker))throw new Error("Global shell does not consume organization brand token "+marker);
}

console.log("Account menu + PRO brand personalization checks passed.");
