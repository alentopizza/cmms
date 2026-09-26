import fs from "node:fs";

const files=[
  "app/dashboard/suppliers/page.tsx",
  "components/SupplierDirectory.tsx",
  "app/api/suppliers/[id]/route.ts",
  "app/api/suppliers/[id]/documents/route.ts",
  "components/EntityProfileWorkspace.tsx",
];
for(const file of files)if(!fs.existsSync(file))throw new Error("Missing supplier performance Phase 2 file: "+file);

const page=fs.readFileSync("app/dashboard/suppliers/page.tsx","utf8");
for(const marker of [
  "active_activity_count",
  "active_item_count",
  "directory_requisition_count",
  "open_requisition_count",
  "active_document_count",
  'getCreationGateForScope("supplier"',
  "<SupplierDirectory",
]){
  if(!page.includes(marker))throw new Error("Supplier directory summary contract missing "+marker);
}
for(const forbidden of [
  "type SupplierActivity",
  "type SupplierDocument",
  "type SupplierRequisition",
  "RequisitionSelectableItem",
  "loadSupplierCommercialAnalytics",
  "LIMIT 600",
  "LIMIT 800",
  "activities={activities.rows}",
  "items={items.rows}",
  "requisitions={requisitions.rows}",
  "documents={documents.rows}",
  "commercialAnalytics=",
  "inventorySites={",
]){
  if(page.includes(forbidden))throw new Error("Supplier initial render still preloads detail data: "+forbidden);
}

const directory=fs.readFileSync("components/SupplierDirectory.tsx","utf8");
for(const marker of [
  "detailsBySupplier",
  "statisticsBySupplier",
  "documentsBySupplier",
  "activitiesBySupplier",
  "inventoryBySupplier",
  "requisitionsBySupplier",
  "dataViewForTab",
  'view==="documents"',
  '"/api/suppliers/"+selectedId+"?view="',
  'onTabChange={setPreferredTab}',
  'demandContent("general"',
  'demandContent("statistics"',
  'demandContent("documents"',
  'demandContent("activities"',
  'demandContent("inventory"',
  'demandContent("requisitions"',
  "<CollectionView",
  "<StaticDataTable",
  '<CollectionView storageKey="suppliers"',
  "supplier-card-primary-action-v3",
  "supplier-card-quick-action-v3",
  "<RequisitionBuilder",
  "<RequisitionExportMenu",
  'action="/api/inventory"',
  'action={"/api/inventory/"+item.id}',
  '<SupplierDocuments supplier={selected}',
]){
  if(!directory.includes(marker))throw new Error("Supplier tab-demand/cache contract missing "+marker);
}
for(const forbidden of [
  "suppliers,activities,items,requisitions,documents",
  "commercialAnalytics,commercialTrends,commercialRequisitions",
  "inventorySites,inventoryLocations,inventoryCategories,inventoryWarehouses,canInventoryWrite",
]){
  if(directory.includes(forbidden))throw new Error("SupplierDirectory still requires globally preloaded detail props: "+forbidden);
}

const detailRoute=fs.readFileSync("app/api/suppliers/[id]/route.ts","utf8");
for(const marker of [
  "export async function GET",
  'can(session,"suppliers.manage")',
  "accessibleSupplier",
  'view==="general"',
  'view==="statistics"',
  'view==="activities"',
  'view==="inventory"',
  'view==="requisitions"',
  "loadSupplierCommercialAnalytics([id])",
  "Promise.all([",
  "export async function POST",
  'intent==="delete"',
  'intent==="financial"',
]){
  if(!detailRoute.includes(marker))throw new Error("Supplier on-demand endpoint contract missing "+marker);
}

const documentsRoute=fs.readFileSync("app/api/suppliers/[id]/documents/route.ts","utf8");
for(const marker of [
  "export async function GET",
  'can(session,"suppliers.manage")',
  "FROM supplier_documents",
  "NextResponse.json({documents:result.rows})",
  "export async function POST",
  "INSERT INTO supplier_documents",
]){
  if(!documentsRoute.includes(marker))throw new Error("Supplier lazy documents endpoint contract missing "+marker);
}

const profile=fs.readFileSync("components/EntityProfileWorkspace.tsx","utf8");
if(!profile.includes("onTabChange?.(tab.id)"))throw new Error("EntityProfileWorkspace tab-demand hook missing");

console.log("Supplier performance Phase 2 checks passed.");
