import fs from "node:fs";

const required=[
  "components/ui-kit/DataControls.tsx",
  "components/ui-kit/CollectionIdentity.tsx",
  "components/ModuleHeader.tsx",
  "app/dashboard/companies/CompanyDirectory.tsx",
  "components/LocationDirectory.tsx",
  "components/SupplierDirectory.tsx",
  "app/dashboard/users/UserManagement.tsx",
  "components/CrewDirectory.tsx",
  "app/dashboard/assets/page.tsx",
  "app/dashboard/work-orders/page.tsx",
  "app/dashboard/maintenance/page.tsx",
  "app/dashboard/inventory/page.tsx",
  "app/dashboard/leads/page.tsx",
  "components/LeadPreviewAction.tsx",
  "app/ui-kit-core.css",
  "app/phase8-modules.css",
  "app/phase9-modules.css",
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing shared view-mode file: "+file);

const controls=fs.readFileSync("components/ui-kit/DataControls.tsx","utf8");
for(const marker of [
  "export type ViewMode",
  "export function ViewModeToggle",
  "export function CollectionView",
  "cmms:view-mode:",
  "cmms:view-mode-change",
  'toolbarTargetId="module-view-mode-tools"',
  "MutationObserver",
  'name="dashboard"',
  'name="menu"',
]){
  if(!controls.includes(marker))throw new Error("Shared view-mode control missing "+marker);
}
if((controls.match(/export function ViewModeToggle/g)||[]).length!==1)throw new Error("ViewModeToggle must have one implementation");
if((controls.match(/export function CollectionView/g)||[]).length!==1)throw new Error("CollectionView must have one implementation");
for(const marker of ['data-view-pane="grid"','data-view-pane="list"','hidden={mode!=="grid"}','hidden={mode!=="list"}']){
  if(!controls.includes(marker))throw new Error("CollectionView state-preserving pane contract missing "+marker);
}

const moduleHeader=fs.readFileSync("components/ModuleHeader.tsx","utf8");
for(const marker of ["cmms:view-mode-change","viewRevision",'id="module-view-mode-tools"','querySelectorAll<HTMLElement>("[data-module-record]")','closest<HTMLElement>("[data-view-pane]")']){
  if(!moduleHeader.includes(marker))throw new Error("ModuleHeader view-mode integration missing "+marker);
}

const moduleContracts=[
  ["app/dashboard/companies/CompanyDirectory.tsx",'storageKey="companies"'],
  ["components/LocationDirectory.tsx",'storageKey="locations"'],
  ["components/SupplierDirectory.tsx",'storageKey="suppliers"'],
  ["app/dashboard/users/UserManagement.tsx",'storageKey="users"'],
  ["components/CrewDirectory.tsx",'storageKey="crews"'],
  ["app/dashboard/assets/page.tsx",'storageKey="assets"'],
  ["app/dashboard/work-orders/page.tsx",'storageKey="work-orders"'],
  ["app/dashboard/maintenance/page.tsx",'storageKey="maintenance"'],
  ["app/dashboard/inventory/page.tsx",'storageKey="inventory"'],
  ["app/dashboard/leads/page.tsx",'storageKey="leads"'],
];
for(const [file,marker] of moduleContracts){
  const source=fs.readFileSync(file,"utf8");
  if(!source.includes(marker))throw new Error(file+" missing shared view mode "+marker);
}

const visualListContracts=[
  ["app/dashboard/companies/CompanyDirectory.tsx",'list={<StaticDataTable',"has_logo","EntityIdentityCell","ds-list-action"],
  ["components/SupplierDirectory.tsx",'list={<StaticDataTable',"has_logo","EntityIdentityCell","ds-list-action"],
  ["app/dashboard/users/UserManagement.tsx",'list={<StaticDataTable',"has_avatar","EntityIdentityCell","ds-list-action"],
  ["components/CrewDirectory.tsx",'list={<StaticDataTable',"leaderHasAvatar","EntityIdentityCell","Contactar por WhatsApp"],
  ["app/dashboard/assets/page.tsx",'list={<StaticDataTable',"has_image","EntityIdentityCell","ds-list-action"],
  ["app/dashboard/work-orders/page.tsx",'list={<StaticDataTable',"asset_has_image","canReadAssets","EntityIdentityCell","Ver actividades"],
  ["app/dashboard/maintenance/page.tsx",'list={<StaticDataTable',"asset_has_image","canReadAssets","EntityIdentityCell","ListQuickActions"],
  ["app/dashboard/inventory/page.tsx",'list={<StaticDataTable',"has_image","EntityIdentityCell","ds-list-action"],
  ["app/dashboard/leads/page.tsx",'list={<StaticDataTable',"fallback={initials(lead.full_name)}","EntityIdentityCell","LeadPreviewAction","company_name","lead.email","lead.phone","compact"],
];
for(const [file,...markers] of visualListContracts){
  const source=fs.readFileSync(file,"utf8");
  for(const marker of markers)if(!source.includes(marker))throw new Error(file+" visual list identity/action contract missing "+marker);
}
const leads=fs.readFileSync("app/dashboard/leads/page.tsx","utf8");
for(const marker of ["Listado de Leads","<Avatar initials={initials(lead.full_name)}","lead-crm-info-grid","STATUS_LABELS","LeadPreviewAction"]){
  if(!leads.includes(marker))throw new Error("Leads CRM card contract missing "+marker);
}
if(/<Avatar[^>]*src=/.test(leads))throw new Error("Leads must use initials and must not introduce photos");
const leadsCss=fs.readFileSync("app/globals.css","utf8");
for(const marker of [".leads-directory-grid","grid-template-columns:repeat(3,minmax(0,1fr))","@media(max-width:1180px)","-webkit-line-clamp:2",".lead-card-actions"]){
  if(!leadsCss.includes(marker))throw new Error("Leads CRM responsive styling missing "+marker);
}
const leadPreview=fs.readFileSync("components/LeadPreviewAction.tsx","utf8");
for(const marker of ["<Drawer","lead-detail-drawer","lead-detail-scroll","<Avatar initials=",'name="eye"',"Información general","Seguimiento","cmms:record-detail-reopen"]){
  if(!leadPreview.includes(marker))throw new Error("Leads detail drawer missing "+marker);
}
if(leadPreview.includes("Adjuntar archivo")||leadPreview.includes("Agregar nota"))throw new Error("Lead detail must not invent notes/files features without persisted support");
const ownerActions=fs.readFileSync("components/OwnerRecordActions.tsx","utf8");
for(const marker of ["createPortal","owner-record-edit-dialog","owner-record-edit-backdrop","editOverlay","afterSaveReopenKey","Cancelar"]){
  if(!ownerActions.includes(marker))throw new Error("Owner direct edit form contract missing "+marker);
}
if(ownerActions.includes('description="Conserva el flujo de edición existente."')||ownerActions.includes('import { Modal }'))throw new Error("Owner edit must not keep the placeholder modal wrapper");
for(const marker of [".ds-drawer.lead-detail-drawer{width:min(900px,92vw)","grid-template-columns:minmax(360px,1.4fr) minmax(280px,1fr)",".lead-detail-scroll{flex:1","overflow-x:hidden"]){
  if(!leadsCss.includes(marker))throw new Error("Lead detail stable layout missing "+marker);
}

const overlay=fs.readFileSync("components/ui-kit/Overlay.tsx","utf8");
for(const marker of ["headerActions?:ReactNode","className?:string","bodyClassName?:string","ds-overlay-header-actions"]){
  if(!overlay.includes(marker))throw new Error("Shared Drawer extension missing "+marker);
}

const crews=fs.readFileSync("components/CrewDirectory.tsx","utf8");
for(const marker of ['toolbarTargetId="crew-view-mode-tools"','id="crew-view-mode-tools"']){
  if(!crews.includes(marker))throw new Error("Crews local shared-toggle host missing "+marker);
}

const identity=fs.readFileSync("components/ui-kit/CollectionIdentity.tsx","utf8");
for(const marker of ["EntityIdentityCell","ListQuickActions",'variant?:"avatar"|"logo"|"thumbnail"|"icon"']){
  if(!identity.includes(marker))throw new Error("Shared compact list identity missing "+marker);
}

const locations=fs.readFileSync("components/LocationDirectory.tsx","utf8");
for(const marker of ["<StaticDataTable","Listado de ubicaciones","EntityIdentityCell","site.has_image","/api/sites/","icon=\"location\"","Ver ubicación","ds-list-action"]){
  if(!locations.includes(marker))throw new Error("Locations approved list view missing "+marker);
}

const workOrders=fs.readFileSync("app/dashboard/work-orders/page.tsx","utf8");
const maintenance=fs.readFileSync("app/dashboard/maintenance/page.tsx","utf8");
for(const [name,source] of [["Work Orders",workOrders],["Maintenance",maintenance]]){
  if(!source.includes("grid={<div")||!source.includes("list={<StaticDataTable"))throw new Error(name+" must reuse existing card/table presentations inside CollectionView");
}

const phase8=fs.readFileSync("app/phase8-modules.css","utf8");
if(phase8.includes(".crew-directory-view-toggle-v2"))throw new Error("Legacy crew-specific view toggle CSS must be removed");

const phase9=fs.readFileSync("app/phase9-modules.css","utf8");
for(const marker of [".ds-collection-view.is-grid .maintenance-mobile-list",".ds-collection-view.is-grid .work-order-mobile-list",".ds-collection-view.is-list .maintenance-directory-table",".ds-collection-view.is-list .work-order-directory-table"]){
  if(!phase9.includes(marker))throw new Error("Operation view-mode CSS missing "+marker);
}

const coreCss=fs.readFileSync("app/ui-kit-core.css","utf8");
for(const marker of [".ds-view-mode-toggle",".module-page-tools .module-view-mode-tools",".ds-collection-view.is-list [data-collection-grid]",".ds-list-identity-media",".ds-list-quick-actions",".ds-list-action","background:var(--brand-primary)","color:var(--brand-on-primary)"]){
  if(!coreCss.includes(marker))throw new Error("Shared view-mode styling missing "+marker);
}
if(/#[0-9a-fA-F]{3,8}\b/.test(coreCss))throw new Error("UI Kit core CSS must remain token-only");

console.log("Shared grid/list view-mode checks passed.");