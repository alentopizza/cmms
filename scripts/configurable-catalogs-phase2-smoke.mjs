import fs from "node:fs";

function read(path){return fs.readFileSync(path,"utf8");}
function expect(source,needle,label){if(!source.includes(needle))throw new Error(label+" missing: "+needle);}

const select=read("components/ConfigurableCatalogSelect.tsx");
for(const needle of ["Buscar ","Crear nueva opción","Administrar catálogo","multiple?:boolean","organization_id="])expect(select,needle,"central selector");

const assetsCreate=read("components/ContextCreateModals.tsx");
for(const catalog of ["asset_types","asset_categories","asset_brands","asset_models","asset_statuses","asset_criticalities","routine_types","routine_priorities","routine_specialties","routine_frequencies"]){
  expect(assetsCreate,'catalog="'+catalog+'"',"context forms "+catalog);
}
const assetsEdit=read("app/dashboard/assets/[id]/page.tsx");
for(const catalog of ["asset_types","asset_categories","asset_brands","asset_models","asset_statuses","asset_criticalities"])expect(assetsEdit,'catalog="'+catalog+'"',"asset edit "+catalog);

const workOrders=read("app/dashboard/work-orders/page.tsx");
for(const catalog of ["work_order_types","work_order_priorities","work_order_statuses","work_order_work_types","work_order_causes"])expect(workOrders,'catalog="'+catalog+'"',"work order "+catalog);

const inventoryCreate=read("app/dashboard/inventory/page.tsx");
const inventoryEdit=read("app/dashboard/inventory/[id]/page.tsx");
for(const catalog of ["inventory_categories","inventory_types","inventory_units","inventory_statuses"]){
  expect(inventoryCreate,'catalog="'+catalog+'"',"inventory create "+catalog);
  expect(inventoryEdit,'catalog="'+catalog+'"',"inventory edit "+catalog);
}

const suppliers=read("app/dashboard/suppliers/page.tsx");
const supplierEdit=read("components/SupplierDirectory.tsx");
for(const catalog of ["supplier_types","supplier_specialties"]){
  expect(suppliers,'catalog="'+catalog+'"',"supplier create "+catalog);
  expect(supplierEdit,'catalog="'+catalog+'"',"supplier edit "+catalog);
}
expect(supplierEdit,"multiple","supplier multi-select");

const leads=read("app/dashboard/leads/page.tsx");
for(const catalog of ["lead_sources","lead_interests","lead_statuses","lead_followups"])expect(leads,'catalog="'+catalog+'"',"lead "+catalog);

const admin=read("components/CatalogAdminPanel.tsx");
for(const needle of ["Nueva opción","Editar","Desactivar","Activar","Sistema","Empresa"])expect(admin,needle,"catalog admin");

const migration=read("db/migrations/999_configurable_catalogs.sql");
for(const needle of ["organization_id uuid REFERENCES organizations","origin IN ('SYSTEM','CUSTOM')","supplier_capability_catalog","supplier_specialty_catalog","work_type text","routine_type text","item_type text","followup_type text"])expect(migration,needle,"catalog migration");

const api=read("app/api/catalogs/[catalogKey]/route.ts");
expect(api,"canAccessOrganization","catalog tenant scope");
expect(api,"supplier_capability_catalog","supplier bridge");
expect(api,"supplier_specialty_catalog","supplier bridge");

console.log("Configurable catalogs phase 2 smoke: OK");

const selectorUx=read("components/ConfigurableCatalogSelect.tsx");
for(const needle of ["SISTEMA","EMPRESA","canManage","canCreate"])expect(selectorUx,needle,"selector UX contract");

const controlled=read("db/migrations/999_configurable_catalogs.sql");
for(const key of ["asset_statuses","asset_criticalities","work_order_types","work_order_priorities","work_order_statuses","routine_frequencies","inventory_statuses","lead_sources","lead_interests","lead_statuses","lead_followups"]){
  expect(controlled,key,"controlled catalog "+key);
}
expect(controlled,"allow_custom=false","controlled catalog flag");

const supplierCreate=read("app/api/suppliers/route.ts");
const supplierEdit=read("app/api/suppliers/[id]/route.ts");
for(const source of [supplierCreate,supplierEdit]){
  expect(source,"configurable_catalog_options","supplier tenant catalog validation");
  expect(source,"cco.organization_id IS NULL OR cco.organization_id=$2","supplier tenant scope");
}

const leadsPage=read("app/dashboard/leads/page.tsx");
if(/<option value="new">Nuevo<\/option>/.test(leadsPage))throw new Error("Lead status still hardcoded in rendered controls");
