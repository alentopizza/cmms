import fs from "node:fs";

const required=[
  "components/business-ui/BusinessCards.tsx",
  "components/business-ui/BusinessCardsPreview.tsx",
  "components/business-ui/index.ts",
  "app/business-ui.css",
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing Phase 5 Business UI file: "+file);

const cards=fs.readFileSync("components/business-ui/BusinessCards.tsx","utf8");
for(const symbol of [
  "BusinessCardShell","AssetCard","InventoryCard","MaintenanceCard","WorkOrderCard","SupplierCard","LocationCard","UserCard","BusinessProfileStat",
]){
  if(!cards.includes("function "+symbol)&&!cards.includes("export function "+symbol))throw new Error("Business UI missing "+symbol);
}
for(const legacyGlyph of [">↻<",">✓<",">◇<",">⌁<"]){
  if(cards.includes(legacyGlyph))throw new Error("Business UI reintroduced Unicode navigation/domain glyph "+legacyGlyph);
}

const css=fs.readFileSync("app/business-ui.css","utf8");
for(const selector of [".ds-business-card",".ds-business-asset",".ds-business-inventory",".ds-business-supplier",".ds-business-location",".ds-business-user"]){
  if(!css.includes(selector))throw new Error("Business UI CSS missing "+selector);
}
if(/#[0-9a-fA-F]{3,8}\b/.test(css))throw new Error("Business UI CSS must use Design Tokens instead of hardcoded hex colors");
if(!css.includes(":focus-visible"))throw new Error("Business UI visible focus contract is required");
if(!css.includes("@media(prefers-reduced-motion:reduce)"))throw new Error("Business UI reduced-motion contract is required");

const migrations={
  "app/dashboard/assets/page.tsx":"<AssetCard",
  "app/dashboard/inventory/page.tsx":"<InventoryCard",
  "app/dashboard/maintenance/page.tsx":"<MaintenanceCard",
  "app/dashboard/work-orders/page.tsx":"<WorkOrderCard",
  "components/SupplierDirectory.tsx":"<SupplierCard",
  "components/LocationDirectory.tsx":"<LocationCard",
  "app/dashboard/users/UserManagement.tsx":"<UserCard",
  "components/EntityProfileWorkspace.tsx":"<BusinessProfileStat",
};
for(const [file,marker] of Object.entries(migrations)){
  const source=fs.readFileSync(file,"utf8");
  if(!source.includes(marker))throw new Error(file+" is not consuming Phase 5 Business UI: "+marker);
}

const layout=fs.readFileSync("app/layout.tsx","utf8");
const dataIndex=layout.indexOf('import "./data-ui.css";');
const businessIndex=layout.indexOf('import "./business-ui.css";');
const shellIndex=layout.indexOf('import "./shell-v2.css";');
if(dataIndex<0||businessIndex<0||shellIndex<0||businessIndex<dataIndex||shellIndex<businessIndex){
  throw new Error("Business UI CSS must load after Shared Data UI and before shell-v2");
}

const uiKit=fs.readFileSync("app/ui-kit/page.tsx","utf8");
if(!uiKit.includes("BusinessCardsPreview")||!uiKit.includes("#business-cards"))throw new Error("/ui-kit does not document Business UI");

const workflow=fs.readFileSync(".github/workflows/ci.yml","utf8");
if(!workflow.includes("node scripts/business-ui-smoke.mjs"))throw new Error("CI does not run Phase 5 Business UI smoke checks");

console.log("DESWEB Design System V2 Phase 5 Business UI checks passed.");
