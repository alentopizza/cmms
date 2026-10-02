import fs from "node:fs";

const required=[
  "components/AssetSubnav.tsx",
  "components/AssetCatalogOverview.tsx",
  "components/InventorySubnav.tsx",
  "app/phase7-modules.css",
  "app/dashboard/assets/page.tsx",
  "app/dashboard/assets/[id]/page.tsx",
  "app/dashboard/inventory/page.tsx",
  "app/dashboard/inventory/[id]/page.tsx",
  "app/dashboard/inventory/categories/page.tsx",
  "app/dashboard/inventory/warehouses/page.tsx",
  "app/dashboard/inventory/kardex/page.tsx",
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing Phase 7 file: "+file);

const assetNav=fs.readFileSync("components/AssetSubnav.tsx","utf8");
for(const label of ["Lista de Activos","Tipos","Categorías","Marcas","Modelos","Estados","Mantenimientos","Historial","Documentos","Configuración"]){
  if(!assetNav.includes(label))throw new Error("Asset secondary navigation missing "+label);
}
if(!assetNav.includes("ModuleNavigation"))throw new Error("Asset navigation must consume official ModuleNavigation");

const inventoryNav=fs.readFileSync("components/InventorySubnav.tsx","utf8");
for(const label of ["Resumen","Productos","Categorías","Almacenes","Entradas","Salidas","Ajustes","Transferencias","Kardex","Reportes","Configuración"]){
  if(!inventoryNav.includes(label))throw new Error("Inventory secondary navigation missing "+label);
}
if(!inventoryNav.includes("ModuleNavigation"))throw new Error("Inventory navigation must consume official ModuleNavigation");

const assets=fs.readFileSync("app/dashboard/assets/page.tsx","utf8");
for(const marker of ["phase7-assets","<AssetSubnav","<MetricGrid","<KpiCard","<CollectionView","<AssetCard","<AssetCatalogOverview"]){
  if(!assets.includes(marker))throw new Error("Assets Phase 7 contract missing "+marker);
}
const assetCatalog=fs.readFileSync("components/AssetCatalogOverview.tsx","utf8");
for(const marker of ["asset-types","asset-categories","asset-brands","asset-models","asset-states","asset-maintenance","asset-history","asset-documents","asset-settings","<StaticDataTable","<StatTiles"]){
  if(!assetCatalog.includes(marker))throw new Error("Asset catalog surface missing "+marker);
}

const inventory=fs.readFileSync("app/dashboard/inventory/page.tsx","utf8");
for(const marker of ["phase7-inventory","<InventorySubnav","inventory-category-nav","<MetricGrid","<KpiCard","<CollectionView","<InventoryCard","variant=\"catalog\"","inventory-reports","inventory-settings","inventory-kardex-preview"]){
  if(!inventory.includes(marker))throw new Error("Inventory Phase 7 contract missing "+marker);
}
for(const glyph of ["×","▤"])if(inventory.includes(glyph))throw new Error("Inventory summary still contains legacy glyph "+glyph);

for(const file of ["app/dashboard/inventory/categories/page.tsx","app/dashboard/inventory/warehouses/page.tsx"]){
  const source=fs.readFileSync(file,"utf8");
  for(const marker of ["phase7-inventory","<Alert","<Badge","<StatTiles"]){
    if(!source.includes(marker))throw new Error(file+" missing Phase 7 primitive "+marker);
  }
}
const kardex=fs.readFileSync("app/dashboard/inventory/kardex/page.tsx","utf8");
for(const marker of ["phase7-kardex","ds-data-table","<Badge","<Alert","<EmptyState"]){
  if(!kardex.includes(marker))throw new Error("Kardex Phase 7 migration missing "+marker);
}
if(kardex.includes('className="table inventory-kardex-table"'))throw new Error("Kardex still uses legacy table grammar");

const inventoryDetail=fs.readFileSync("app/dashboard/inventory/[id]/page.tsx","utf8");
if(!inventoryDetail.includes("ds-data-table")||!inventoryDetail.includes("<MetricGrid")||!inventoryDetail.includes("<Alert"))throw new Error("Inventory detail is not fully on Phase 7 primitives");
if(!inventoryDetail.includes('id="inventory-edit"'))throw new Error("Inventory detail edit anchor required by catalog action");

const assetDetail=fs.readFileSync("app/dashboard/assets/[id]/page.tsx","utf8");
if(!assetDetail.includes("<AssetSubnav")||!assetDetail.includes("<StaticDataTable")||!assetDetail.includes("<Badge")||!assetDetail.includes("<Alert"))throw new Error("Asset detail is not fully on Phase 7 primitives");

const importer=fs.readFileSync("components/BulkImportModal.tsx","utf8");
for(const marker of [
  "phase7-bulk-import",
  "bulk-import-footer",
  "<Alert",
  "<Badge",
  "<UiIcon name=\"x\"",
  'import { createPortal } from "react-dom";',
  "createPortal(",
  "document.body",
  'document.body.classList.add("ds-overlay-open")',
]){
  if(!importer.includes(marker))throw new Error("Bulk import Phase 7 integration missing "+marker);
}

const globalCss=fs.readFileSync("app/globals.css","utf8");
for(const marker of [
  ".bulk-import-backdrop{z-index:1500}",
  ".bulk-import-footer{",
  "grid-template-columns:minmax(190px,1fr) minmax(200px,1fr) minmax(250px,1.25fr)",
  "min-height:44px",
  ".bulk-import-modal{",
  "background:var(--surface)",
  "box-shadow:0 30px 80px",
]){
  if(!globalCss.includes(marker))throw new Error("Bulk import modal visual contract missing "+marker);
}

const createModal=fs.readFileSync("components/CreateRecordModal.tsx","utf8");
if(!createModal.includes("iconName?:UiIconName")||!createModal.includes("<UiIcon name={iconName}"))throw new Error("CreateRecordModal canonical icon bridge missing");

const navigation=fs.readFileSync("components/ui-kit/Navigation.tsx","utf8");
if(!navigation.includes("if(exact||/[?#]/.test(itemHref))return activeHref===itemHref;")||!navigation.includes("exact?:boolean"))throw new Error("ModuleNavigation must support exact query/hash module sections");

const css=fs.readFileSync("app/phase7-modules.css","utf8");
for(const selector of [".phase7-assets",".phase7-inventory",".phase7-bulk-import",":focus-visible","@media(max-width:700px)","@media(prefers-reduced-motion:reduce)"]){
  if(!css.includes(selector))throw new Error("Phase 7 CSS missing "+selector);
}
for(const marker of [
  ".inventory-catalog-grid{grid-template-columns:repeat(3,minmax(0,1fr))",
  ".inventory-catalog-card-v2:hover",".inventory-catalog-visual img{width:100%;height:100%;object-fit:contain",
  ".inventory-catalog-metrics{",".inventory-catalog-stock-track",".inventory-movements-section .inventory-movement-list",
  "@media(max-width:1180px)","@media(max-width:700px)",
]){
  if(!css.includes(marker))throw new Error("Inventory catalog styling missing "+marker);
}
if(/#[0-9a-fA-F]{3,8}\b/.test(css))throw new Error("Phase 7 CSS must use Design Tokens only");

const layout=fs.readFileSync("app/layout.tsx","utf8");
const phase6=layout.indexOf('import "./phase6-modules.css";');
const phase7=layout.indexOf('import "./phase7-modules.css";');
const shell=layout.indexOf('import "./shell-v2.css";');
if(phase6<0||phase7<0||shell<0||phase7<phase6||shell<phase7)throw new Error("Phase 7 CSS load order is invalid");

const workflow=fs.readFileSync(".github/workflows/ci.yml","utf8");
if(!workflow.includes("node scripts/phase7-assets-inventory-smoke.mjs"))throw new Error("CI does not run Phase 7 checks");

console.log("DESWEB Design System V2 Phase 7 Assets/Inventory checks passed.");

if(!globalCss.includes(".bulk-import-history{"))throw new Error("Bulk import layout contract missing "+".bulk-import-history{");

if(!globalCss.includes("margin:12px 18px 0"))throw new Error("Bulk import layout contract missing "+"margin:12px 18px 0");

if(!globalCss.includes("box-sizing:border-box"))throw new Error("Bulk import layout contract missing "+"box-sizing:border-box");

if(!globalCss.includes("grid-template-columns:minmax(190px,1fr) minmax(200px,1fr) minmax(250px,1.25fr)"))throw new Error("Bulk import layout contract missing "+"grid-template-columns:minmax(190px,1fr) minmax(200px,1fr) minmax(250px,1.25fr)");

if(!globalCss.includes("display:inline-flex"))throw new Error("Bulk import layout contract missing "+"display:inline-flex");

if(!globalCss.includes("align-items:center"))throw new Error("Bulk import layout contract missing "+"align-items:center");
