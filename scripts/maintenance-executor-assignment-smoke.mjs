import fs from "node:fs";

function read(path){return fs.readFileSync(path,"utf8");}
function expect(source,needle,label){if(!source.includes(needle))throw new Error(label+" missing: "+needle);}

const migration=read("db/migrations/999e_maintenance_plan_assignment.sql");
for(const marker of [
  "ADD COLUMN IF NOT EXISTS assigned_to",
  "ADD COLUMN IF NOT EXISTS crew_id",
  "ADD COLUMN IF NOT EXISTS service_supplier_id",
])expect(migration,marker,"maintenance assignment migration");

const routineModal=read("components/ContextCreateModals.tsx");
for(const marker of [
  "Responsable de la rutina",
  'name="assigned_to"',
  'name="crew_id"',
  'name="service_supplier_id"',
  "visibleWorkers",
  "visibleCrews",
  "visibleServiceSuppliers",
])expect(routineModal,marker,"routine assignment UI");

const routineApi=read("app/api/maintenance-plans/route.ts");
for(const marker of [
  'form.get("assigned_to")',
  'form.get("crew_id")',
  'form.get("service_supplier_id")',
  "selected.length>1",
  "organization_member_sites",
  "(site_id IS NULL OR site_id=$3)",
  "assigned_to,crew_id,service_supplier_id",
])expect(routineApi,marker,"routine assignment API");

const routinePage=read("app/dashboard/maintenance/page.tsx");
for(const marker of [
  "workersPromise",
  "crewsPromise",
  "serviceSuppliersPromise",
  "assigned_to_label",
  "assignedTo={p.assigned_to_label",
  'key:"assigned",label:"Responsable"',
])expect(routinePage,marker,"routine assignment directory");

const woPage=read("app/dashboard/work-orders/page.tsx");
for(const marker of [
  "Responsable inicial",
  'name="assigned_to"',
  'name="crew_id"',
  'name="service_supplier_id"',
  "workersPromise",
  "crewsPromise",
  "serviceSuppliersPromise",
])expect(woPage,marker,"work order initial assignment UI");

const woApi=read("app/api/work-orders/route.ts");
for(const marker of [
  'form.get("assigned_to")',
  'form.get("crew_id")',
  'form.get("service_supplier_id")',
  "selected.length>1",
  "organization_member_sites",
  "(site_id IS NULL OR site_id=$3)",
  "assigned_to,crew_id,service_supplier_id",
  'selected.length&&status==="open"?"assigned":status',
])expect(woApi,marker,"work order initial assignment API");

const detail=read("app/dashboard/work-orders/[id]/page.tsx");
expect(detail,"organization_member_sites","work order activity worker site scope");
expect(detail,"(site_id IS NULL OR site_id=$2)","work order activity crew site scope");

const activityApi=read("app/api/work-orders/[id]/activities/route.ts");
expect(activityApi,"organization_member_sites","activity assignment worker validation");
expect(activityApi,"(site_id IS NULL OR site_id=$3)","activity assignment crew validation");

const cards=read("components/business-ui/BusinessCards.tsx");
expect(cards,'<small>Responsable</small>','routine card responsible label');

console.log("Maintenance and work-order executor assignment checks passed.");
