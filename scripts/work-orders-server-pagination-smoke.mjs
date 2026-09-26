import fs from "node:fs";
import pg from "pg";

const {Client}=pg;
if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required");

const page=fs.readFileSync("app/dashboard/work-orders/page.tsx","utf8");
const header=fs.readFileSync("components/ModuleHeader.tsx","utf8");
const pager=fs.readFileSync("components/ui-kit/UrlPagination.tsx","utf8");
const collection=fs.readFileSync("components/ui-kit/DataControls.tsx","utf8");

for(const marker of [
  "WORK_ORDER_PAGE_SIZE=24","WORK_ORDER_STATUSES","WORK_ORDER_PRIORITIES","WORK_ORDER_TYPES","WORK_ORDER_SORTS",
  "workOrderPageWindow","scopeConditions","w.requested_by=","w.service_supplier_id=","t.service_supplier_id=",
  "w.assigned_to=","t.assigned_to=","crew_members cm","w.site_id=ANY","filteredConditions","filtered_count",
  "facetOptions","<UrlPagination","serverState={{","requestedPage!==page",
  'redirect(queryString?"/dashboard/work-orders?"+queryString:"/dashboard/work-orders")',
  "<CreateRecordModal",'<OwnerRecordActions table="work_orders"',"LIMIT ${limitToken} OFFSET ${offsetToken}",
])if(!page.includes(marker))throw new Error("Work-order pagination contract missing "+marker);
for(const forbidden of ["LIMIT 200","orders.rows.filter(order=>","async function loadOrders"])if(page.includes(forbidden))throw new Error("Legacy work-order truncation/client KPI logic remains: "+forbidden);
for(const marker of ["serverState?: ModuleHeaderServerState","router.replace",'next.delete(serverState.pageParam||"page")'])if(!header.includes(marker))throw new Error("ModuleHeader server mode missing "+marker);
if(!header.includes('querySelectorAll<HTMLElement>("[data-module-record]")'))throw new Error("ModuleHeader DOM mode must remain for unmigrated modules");
for(const marker of ["<Pagination","router.push","searchParams.toString()"])if(!pager.includes(marker))throw new Error("URL pagination wrapper missing "+marker);
for(const marker of ['cmms:view-mode-change','localStorage.getItem("cmms:view-mode:"','data-view-pane="grid"','data-view-pane="list"'])if(!collection.includes(marker))throw new Error("CollectionView changed during work-order pilot: "+marker);

const db=new Client({connectionString:process.env.DATABASE_URL});
await db.connect();
const I={
  oa:"32000000-0000-4000-8000-000000000001",ob:"32000000-0000-4000-8000-000000000002",
  sa:"32000000-0000-4000-8000-000000000011",sb:"32000000-0000-4000-8000-000000000012",sx:"32000000-0000-4000-8000-000000000013",
  aa:"32000000-0000-4000-8000-000000000021",ab:"32000000-0000-4000-8000-000000000022",ax:"32000000-0000-4000-8000-000000000023",
  req:"32000000-0000-4000-8000-000000000031",other:"32000000-0000-4000-8000-000000000032",ext:"32000000-0000-4000-8000-000000000033",
  sup:"32000000-0000-4000-8000-000000000041",sup2:"32000000-0000-4000-8000-000000000042",crew:"32000000-0000-4000-8000-000000000051",
};
const wid=n=>"32000000-0000-4000-8000-"+String(1000+n).padStart(12,"0");
const tid=n=>"32000000-0000-4000-8000-"+String(2000+n).padStart(12,"0");

function scope(kind,limited=false){
  const params=[],where=[];
  if(kind!=="platform"){
    params.push(I.oa);where.push("w.organization_id=$1");
    if(kind==="requester"){params.push(I.req);where.push("w.requested_by=$2");}
    else if(kind==="provider"){params.push(I.sup);where.push("$2::uuid IS NOT NULL AND (w.service_supplier_id=$2 OR EXISTS(SELECT 1 FROM work_order_tasks t WHERE t.work_order_id=w.id AND t.service_supplier_id=$2))");}
    else if(kind==="external"){params.push(I.ext);where.push("(w.assigned_to=$2 OR EXISTS(SELECT 1 FROM work_order_tasks t WHERE t.work_order_id=w.id AND (t.assigned_to=$2 OR EXISTS(SELECT 1 FROM crew_members cm WHERE cm.crew_id=t.crew_id AND cm.user_id=$2))))");}
    if(limited){params.push([I.sa]);where.push("w.site_id=ANY($"+params.length+"::uuid[])");}
  }
  return {
    params,
    sql:`SELECT DISTINCT w.id,w.organization_id,w.site_id,s.name site,w.number::text number,w.title,coalesce(a.name,'Sin equipo') asset,o.name company,w.type,w.priority,w.status,w.requested_at
         FROM work_orders w JOIN organizations o ON o.id=w.organization_id JOIN sites s ON s.id=w.site_id LEFT JOIN assets a ON a.id=w.asset_id
         ${where.length?"WHERE "+where.join(" AND "):""}`,
  };
}
const ids=result=>result.rows.map(row=>row.id).sort();
async function expectScope(kind,limited,expected){
  const scoped=scope(kind,limited);
  const result=await db.query(`WITH scoped AS (${scoped.sql}) SELECT id FROM scoped ORDER BY id`,scoped.params);
  const actual=ids(result),wanted=expected.map(wid).sort();
  if(JSON.stringify(actual)!==JSON.stringify(wanted))throw new Error(kind+(limited?":limited":":all")+" scope mismatch: "+actual.join(","));
}

try{
  await db.query("BEGIN");
  await db.query("INSERT INTO organizations(id,name,slug,active) VALUES($1,'WO Org A','wo-rbac-a',true),($2,'WO Org B','wo-rbac-b',true)",[I.oa,I.ob]);
  await db.query("INSERT INTO sites(id,organization_id,name,code,country,active) VALUES($1,$4,'Sede A','WOA','CO',true),($2,$4,'Sede B','WOB','CO',true),($3,$5,'Sede X','WOX','CO',true)",[I.sa,I.sb,I.sx,I.oa,I.ob]);
  await db.query("INSERT INTO suppliers(id,organization_id,code,name,supplier_type,active) VALUES($1,$3,'WO-PROV-A','Proveedor A','services',true),($2,$3,'WO-PROV-B','Proveedor B','services',true)",[I.sup,I.sup2,I.oa]);
  await db.query("INSERT INTO users(id,email,full_name,active) VALUES($1,'wo-req@test.local','Requester',true),($2,'wo-other@test.local','Other',true),($3,'wo-ext@test.local','External',true)",[I.req,I.other,I.ext]);
  await db.query("INSERT INTO assets(id,organization_id,site_id,code,name,status,criticality) VALUES($1,$4,$5,'WOA','Equipo A','operational','medium'),($2,$4,$6,'WOB','Equipo B','operational','medium'),($3,$7,$8,'WOX','Equipo X','operational','medium')",[I.aa,I.ab,I.ax,I.oa,I.sa,I.sb,I.ob,I.sx]);
  await db.query("INSERT INTO crews(id,organization_id,site_id,name,active) VALUES($1,$2,$3,'Crew RBAC',true)",[I.crew,I.oa,I.sa]);
  await db.query("INSERT INTO crew_members(crew_id,organization_id,user_id) VALUES($1,$2,$3)",[I.crew,I.oa,I.ext]);

  const rows=[
    [1,I.oa,I.sa,I.aa,"Requester A",I.req,null,null,"corrective","medium","open","2027-01-01"],
    [2,I.oa,I.sb,I.ab,"Requester B",I.req,null,null,"preventive","high","assigned","2027-01-02"],
    [3,I.oa,I.sa,I.aa,"Requester ajena",I.other,null,null,"inspection","low","completed","2027-01-03"],
    [4,I.oa,I.sa,I.aa,"Provider directo",I.other,null,I.sup,"emergency","urgent","open","2027-01-04"],
    [5,I.oa,I.sb,I.ab,"Provider tarea",I.other,null,null,"corrective","high","in_progress","2027-01-05"],
    [6,I.oa,I.sa,I.aa,"Provider ajeno",I.other,null,I.sup2,"improvement","medium","open","2027-01-06"],
    [7,I.oa,I.sa,I.aa,"External directo",I.other,I.ext,null,"inspection","medium","assigned","2027-01-07"],
    [8,I.oa,I.sb,I.ab,"External tarea",I.other,null,null,"corrective","medium","in_progress","2027-01-08"],
    [9,I.oa,I.sa,I.aa,"External crew",I.other,null,null,"preventive","medium","open","2027-01-09"],
    [10,I.oa,I.sb,I.ab,"Interna B",I.other,null,null,"corrective","low","paused","2027-01-10"],
    [11,I.ob,I.sx,I.ax,"Fuera organización",null,null,null,"emergency","urgent","open","2027-01-11"],
  ];
  for(const row of rows)await db.query(
    "INSERT INTO work_orders(id,organization_id,site_id,asset_id,title,requested_by,assigned_to,service_supplier_id,type,priority,status,requested_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
    [wid(row[0]),...row.slice(1)],
  );
  await db.query("INSERT INTO work_order_tasks(id,organization_id,work_order_id,description,sort_order,service_supplier_id,status) VALUES($1,$2,$3,'Provider task',1,$4,'pending')",[tid(1),I.oa,wid(5),I.sup]);
  await db.query("INSERT INTO work_order_tasks(id,organization_id,work_order_id,description,sort_order,assigned_to,status) VALUES($1,$2,$3,'External task',1,$4,'pending')",[tid(2),I.oa,wid(8),I.ext]);
  await db.query("INSERT INTO work_order_tasks(id,organization_id,work_order_id,description,sort_order,crew_id,status) VALUES($1,$2,$3,'Crew task',1,$4,'pending')",[tid(3),I.oa,wid(9),I.crew]);

  await expectScope("platform",false,[1,2,3,4,5,6,7,8,9,10,11]);
  await expectScope("requester",false,[1,2]);
  await expectScope("requester",true,[1]);
  await expectScope("provider",false,[4,5]);
  await expectScope("provider",true,[4]);
  await expectScope("external",false,[7,8,9]);
  await expectScope("external",true,[7,9]);
  await expectScope("internal",false,[1,2,3,4,5,6,7,8,9,10]);
  await expectScope("internal",true,[1,3,4,6,7,9]);

  const requester=scope("requester",true);
  const search=await db.query(`WITH scoped AS (${requester.sql}) SELECT id FROM scoped WHERE title ILIKE $3 LIMIT 24 OFFSET 0`,[...requester.params,"%Fuera organización%"]);
  if(search.rowCount!==0)throw new Error("Search leaked work order outside requester scope");
  const knownOutside=await db.query(`WITH scoped AS (${requester.sql}) SELECT id FROM scoped WHERE id=$3::uuid`,[...requester.params,wid(11)]);
  if(knownOutside.rowCount!==0)throw new Error("Known work-order ID bypassed requester scope");
  const count=await db.query(`WITH scoped AS (${requester.sql}) SELECT count(*)::int total FROM scoped`,requester.params);
  if(count.rows[0].total!==1)throw new Error("Requester COUNT includes work outside scope");
  const facets=await db.query(`WITH scoped AS (${requester.sql}) SELECT array_agg(DISTINCT site_id::text) sites,array_agg(DISTINCT priority) priorities FROM scoped`,requester.params);
  if((facets.rows[0].sites||[]).length!==1||facets.rows[0].sites[0]!==I.sa)throw new Error("Facets leaked site outside requester scope");

  for(let n=12;n<=40;n++)await db.query(
    "INSERT INTO work_orders(id,organization_id,site_id,asset_id,title,type,priority,status,requested_at) VALUES($1,$2,$3,$4,$5,'corrective','medium','open',$6)",
    [wid(n),I.oa,I.sa,I.aa,"Paginada "+n,new Date(Date.UTC(2027,1,n-11)).toISOString()],
  );
  const internal=scope("internal",true);
  const first=await db.query(`WITH scoped AS (${internal.sql}) SELECT id,site_id FROM scoped ORDER BY requested_at DESC,id DESC LIMIT $3 OFFSET $4`,[...internal.params,24,0]);
  const second=await db.query(`WITH scoped AS (${internal.sql}) SELECT id,site_id,title FROM scoped ORDER BY requested_at DESC,id DESC LIMIT $3 OFFSET $4`,[...internal.params,24,24]);
  if(first.rowCount!==24||second.rowCount<1)throw new Error("Pagination fixture did not create page 2");
  if([...first.rows,...second.rows].some(row=>row.site_id!==I.sa))throw new Error("Changing page expanded limited-site scope");
  const target=second.rows[0];
  const found=await db.query(`WITH scoped AS (${internal.sql}) SELECT id FROM scoped WHERE title ILIKE $3 ORDER BY requested_at DESC,id DESC LIMIT $4 OFFSET 0`,[...internal.params,"%"+target.title+"%",24]);
  if(found.rowCount<1||!found.rows.some(row=>row.id===target.id))throw new Error("Server search did not recover work order outside first page");
  const combined=await db.query(`WITH scoped AS (${internal.sql}) SELECT id FROM scoped WHERE status=$3 AND priority=$4 AND site_id=$5::uuid ORDER BY requested_at DESC,id DESC LIMIT $6 OFFSET 0`,[...internal.params,"open","medium",I.sa,24]);
  if(combined.rowCount<1)throw new Error("Combined work-order filters returned no authorized rows");

  console.log("Work-order RBAC scopes passed: platform, requester, provider, external and internal, including limited-site variants.");
  console.log("Search, COUNT, facets and page navigation remain inside the authorized scope.");
}finally{
  await db.query("ROLLBACK").catch(()=>{});
  await db.end();
}
console.log("Work Orders Phase 3 pagination regression checks passed.");
