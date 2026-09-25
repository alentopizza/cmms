import fs from "node:fs";

const required=[
  "components/maintenance-ui/OperationStatus.tsx",
  "app/dashboard/maintenance/page.tsx",
  "app/dashboard/work-orders/page.tsx",
  "app/dashboard/work-orders/[id]/page.tsx",
  "app/dashboard/reaction/page.tsx",
  "components/ReactionMap.tsx",
  "app/phase9-modules.css",
];
for(const file of required)if(!fs.existsSync(file))throw new Error("Missing Phase 9 file: "+file);

const operation=fs.readFileSync("components/maintenance-ui/OperationStatus.tsx","utf8");
for(const marker of ["WorkOrderStatusBadge","ActivityStatusBadge","PriorityBadge","workOrderStatusLabel","activityStatusLabel"]){
  if(!operation.includes(marker))throw new Error("Operation status grammar missing "+marker);
}

const maintenance=fs.readFileSync("app/dashboard/maintenance/page.tsx","utf8");
for(const marker of ["phase9-maintenance","<MetricGrid","<KpiCard","<StaticDataTable","<Alert","<Badge","icon=\"maintenance\""]){
  if(!maintenance.includes(marker))throw new Error("Maintenance Phase 9 migration missing "+marker);
}
if(maintenance.includes('className="table maintenance-directory-table"'))throw new Error("Maintenance still renders legacy desktop table");

const orders=fs.readFileSync("app/dashboard/work-orders/page.tsx","utf8");
for(const marker of ["phase9-work-orders","<MetricGrid","<KpiCard","<StaticDataTable","<PriorityBadge","<WorkOrderStatusBadge","iconName=\"work-order\"","icon=\"work-order\""]){
  if(!orders.includes(marker))throw new Error("Work Orders Phase 9 migration missing "+marker);
}
if(orders.includes('className="table work-order-directory-table"'))throw new Error("Work Orders still render legacy desktop table");
for(const field of ["w.organization_id","w.site_id","s.name site","w.type"])if(!orders.includes(field))throw new Error("Scoped Work Order directory metadata missing "+field);

const detail=fs.readFileSync("app/dashboard/work-orders/[id]/page.tsx","utf8");
for(const marker of ["phase9-work-order-detail","<StepProgress","<ProgressBar","<Timeline","<ActivityStatusBadge","<PriorityBadge","<WorkOrderStatusBadge","<EmptyState","<Button"]){
  if(!detail.includes(marker))throw new Error("Work Order detail Phase 9 migration missing "+marker);
}
if(!detail.includes("overdueActivities"))throw new Error("Work Order detail must expose due-date risk without changing state authority");
if(!detail.includes("w.requested_at::text"))throw new Error("Work Order timeline source date missing");

const reactionPage=fs.readFileSync("app/dashboard/reaction/page.tsx","utf8");
if(!reactionPage.includes("phase9-reaction"))throw new Error("Reaction page is not scoped to Phase 9");
const reaction=fs.readFileSync("components/ReactionMap.tsx","utf8");
for(const marker of ["<Search","<Select","<Button","<Badge","<EmptyState","<Drawer","<PriorityBadge","<ActivityStatusBadge"]){
  if(!reaction.includes(marker))throw new Error("Reaction shared-pattern migration missing "+marker);
}
if(reaction.includes("reaction-detail-backdrop")||reaction.includes("reaction-detail-modal"))throw new Error("Reaction still uses the legacy contextual modal");
for(const glyph of ["⌕","×","↺","☎"])if(reaction.includes(glyph))throw new Error("Reaction still contains legacy glyph "+glyph);
if(reaction.includes("setSearchFocused"))throw new Error("Reaction still references the removed private search-focus state");

const cards=fs.readFileSync("components/business-ui/BusinessCards.tsx","utf8");
if(!cards.includes("<PriorityBadge priority={priority}/>")||!cards.includes("<WorkOrderStatusBadge status={status}/>"))throw new Error("WorkOrderCard does not consume shared Phase 9 status grammar");

const prereq=fs.readFileSync("components/CreationPrerequisiteState.tsx","utf8");
for(const marker of ['maintenance:"maintenance"','"work-order":"work-order"'])if(!prereq.includes(marker))throw new Error("Prerequisite icon mapping missing "+marker);

const css=fs.readFileSync("app/phase9-modules.css","utf8");
for(const selector of [".phase9-maintenance",".phase9-work-orders",".phase9-work-order-detail",".phase9-reaction",":focus-visible","@media(max-width:760px)","@media(prefers-reduced-motion:reduce)"]){
  if(!css.includes(selector))throw new Error("Phase 9 CSS missing "+selector);
}
if(/#[0-9a-fA-F]{3,8}\b/.test(css))throw new Error("Phase 9 CSS must use Design Tokens only");

const layout=fs.readFileSync("app/layout.tsx","utf8");
const p8=layout.indexOf('import "./phase8-modules.css";');
const p9=layout.indexOf('import "./phase9-modules.css";');
const shell=layout.indexOf('import "./shell-v2.css";');
if(p8<0||p9<0||shell<0||p9<p8||shell<p9)throw new Error("Phase 9 CSS load order is invalid");

const workflow=fs.readFileSync(".github/workflows/ci.yml","utf8");
if(!workflow.includes("node scripts/phase9-maintenance-operation-smoke.mjs"))throw new Error("CI does not run Phase 9 checks");

console.log("DESWEB Design System V2 Phase 9 maintenance-operation checks passed.");
