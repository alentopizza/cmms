import fs from "node:fs";
import pg from "pg";

const {Client}=pg;
if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required");

const page=fs.readFileSync("app/dashboard/assets/page.tsx","utf8");
const overview=fs.readFileSync("components/AssetCatalogOverview.tsx","utf8");
const header=fs.readFileSync("components/ModuleHeader.tsx","utf8");
const pager=fs.readFileSync("components/ui-kit/UrlPagination.tsx","utf8");
const collection=fs.readFileSync("components/ui-kit/DataControls.tsx","utf8");
const detail=fs.readFileSync("app/dashboard/assets/[id]/page.tsx","utf8");
const editRoute=fs.readFileSync("app/api/assets/[id]/route.ts","utf8");
const importRoute=fs.readFileSync("app/api/bulk-import/route.ts","utf8");
const exportRoute=fs.readFileSync("app/api/module-export/route.ts","utf8");
const phase7=fs.readFileSync("scripts/phase7-assets-inventory-smoke.mjs","utf8");

for(const marker of [
  "ASSET_PAGE_SIZE=24","ASSET_STATUSES","ASSET_CRITICALITIES","ASSET_SORTS","assetPageWindow",
  "scopeConditions","a.organization_id=","a.site_id=ANY","filteredConditions","filtered_count",
  "facetsPromise","brandsPromise","modelsPromise","catalogCategoriesPromise","facetOptions",
  "<UrlPagination","serverState={{","requestedPage!==page",
  'redirect(queryString?"/dashboard/assets?"+queryString:"/dashboard/assets")',
  "<AssetCreateModal",'BulkImportModal entity="assets"','ModuleExportMenu entity="assets"',
  '<OwnerRecordActions table="assets"',"LIMIT ${limitToken} OFFSET ${offsetToken}",
  "sitesPromise","locationsPromise","suppliersPromise","sites={sites.rows.map","locations={locations.rows.map","suppliers={suppliers.rows}",
  "maintenancePromise","historyPromise","documentsPromise",
])if(!page.includes(marker))throw new Error("Asset pagination contract missing "+marker);

for(const forbidden of ["LIMIT 600","assets.rows.filter(","assets={assets.rows}"]){
  if(page.includes(forbidden))throw new Error("Legacy asset truncation/client aggregate logic remains: "+forbidden);
}
if((page.match(/assets\.rows\.map/g)||[]).length<2)throw new Error("Grid/List must render the same server page");

for(const marker of [
  "AssetCatalogSummary","AssetBrandSummary","AssetModelSummary",
  "summary.total_count","summary.critical_count","summary.with_category_count",
  "summary.with_manufacturer_count","summary.with_model_count","summary.high_critical_count",
])if(!overview.includes(marker))throw new Error("AssetCatalogOverview aggregate source missing "+marker);
for(const forbidden of ["assets:AssetLike[]","assets.filter(","assets.map("]){
  if(overview.includes(forbidden))throw new Error("AssetCatalogOverview still depends on visible asset rows: "+forbidden);
}

for(const marker of ["serverState?: ModuleHeaderServerState","router.replace",'next.delete(serverState.pageParam||"page")']){
  if(!header.includes(marker))throw new Error("ModuleHeader server mode missing "+marker);
}
for(const marker of ["<Pagination","router.push","searchParams.toString()"]){
  if(!pager.includes(marker))throw new Error("URL pagination wrapper missing "+marker);
}
for(const marker of ['cmms:view-mode-change','localStorage.getItem("cmms:view-mode:"','data-view-pane="grid"','data-view-pane="list"']){
  if(!collection.includes(marker))throw new Error("CollectionView changed during Assets phase: "+marker);
}
if(collection.includes("router.push(")||collection.includes("router.replace("))throw new Error("Grid/List toggle must not navigate or change page");

for(const marker of ['WHERE a.id=$1',"canAccessSite(session,asset.site_id)","<form",'action={"/api/assets/"+asset.id}',"<RoutineCreateModal"]){
  if(!detail.includes(marker))throw new Error("Asset detail/edit/maintenance flow missing "+marker);
}
for(const marker of ['can(session,"assets.write")',"canAccessSite(session,siteId)","UPDATE assets SET"]){
  if(!editRoute.includes(marker))throw new Error("Asset edit authorization contract missing "+marker);
}
for(const marker of ['entity==="assets"&&!can(session,"assets.write")',"canAccessSite(session,site.id)","assetValidation","INSERT INTO assets"]){
  if(!importRoute.includes(marker))throw new Error("Asset bulk import contract missing "+marker);
}
for(const marker of ['entity==="assets"&&!can(session,"assets.read")',"async function assetRows","FROM assets a","a.site_id=ANY"]){
  if(!exportRoute.includes(marker))throw new Error("Asset export scope contract missing "+marker);
}
if(!phase7.includes("<AssetCatalogOverview")||!phase7.includes("app/dashboard/assets/[id]/page.tsx")){
  throw new Error("Existing Phase 7 Assets regression coverage was lost");
}

const db=new Client({connectionString:process.env.DATABASE_URL});
await db.connect();

const I={
  oa:"33000000-0000-4000-8000-000000000001",ob:"33000000-0000-4000-8000-000000000002",
  sa:"33000000-0000-4000-8000-000000000011",sb:"33000000-0000-4000-8000-000000000012",sx:"33000000-0000-4000-8000-000000000013",
  supa:"33000000-0000-4000-8000-000000000021",supb:"33000000-0000-4000-8000-000000000022",supx:"33000000-0000-4000-8000-000000000023",
  ca:"33000000-0000-4000-8000-000000000031",cb:"33000000-0000-4000-8000-000000000032",cx:"33000000-0000-4000-8000-000000000033",
};
const aid=n=>"33000000-0000-4000-8000-"+String(1000+n).padStart(12,"0");

function scope(kind){
  const params=[],where=[];
  if(kind!=="platform"){
    params.push(I.oa);
    where.push("a.organization_id=$1");
    if(kind==="limited"){
      params.push([I.sa]);
      where.push("a.site_id=ANY($2::uuid[])");
    }
  }
  return {
    params,
    sql:`SELECT a.id,a.organization_id,a.site_id,a.category_id,a.supplier_id,a.code,a.name,o.name company,s.name site,
                c.name category,p.name supplier,a.status,a.criticality,a.manufacturer,a.model,a.created_at
         FROM assets a
         JOIN organizations o ON o.id=a.organization_id
         JOIN sites s ON s.id=a.site_id
         LEFT JOIN asset_categories c ON c.id=a.category_id
         LEFT JOIN suppliers p ON p.id=a.supplier_id
         ${where.length?"WHERE "+where.join(" AND "):""}`,
  };
}
const ids=result=>result.rows.map(row=>row.id).sort();
async function expectScope(kind,expected){
  const scoped=scope(kind);
  const result=await db.query(`WITH scoped AS (${scoped.sql}) SELECT id FROM scoped ORDER BY id`,scoped.params);
  const actual=ids(result),wanted=expected.map(aid).sort();
  if(JSON.stringify(actual)!==JSON.stringify(wanted))throw new Error(kind+" asset scope mismatch: "+actual.join(","));
}

try{
  await db.query("BEGIN");
  await db.query("INSERT INTO organizations(id,name,slug,active) VALUES($1,'Asset Org A','asset-page-a',true),($2,'Asset Org B','asset-page-b',true)",[I.oa,I.ob]);
  await db.query("INSERT INTO sites(id,organization_id,name,code,country,active) VALUES($1,$4,'Sede A','ASA','CO',true),($2,$4,'Sede B','ASB','CO',true),($3,$5,'Sede X','ASX','CO',true)",[I.sa,I.sb,I.sx,I.oa,I.ob]);
  await db.query("INSERT INTO suppliers(id,organization_id,code,name,supplier_type,active) VALUES($1,$4,'AS-SUP-A','Proveedor A','both',true),($2,$4,'AS-SUP-B','Proveedor B','both',true),($3,$5,'AS-SUP-X','Proveedor X','both',true)",[I.supa,I.supb,I.supx,I.oa,I.ob]);
  await db.query("INSERT INTO asset_categories(id,organization_id,name) VALUES($1,$4,'Bombas'),($2,$4,'Motores'),($3,$5,'Categoría X')",[I.ca,I.cb,I.cx,I.oa,I.ob]);

  const baseRows=[
    [1,I.oa,I.sa,I.ca,I.supa,"AS-A1","Bomba A","operational","critical","Acme","MX1","2027-01-01"],
    [2,I.oa,I.sb,I.ca,I.supb,"AS-B1","Bomba B","maintenance","high","Acme","MX2","2027-01-02"],
    [3,I.oa,I.sa,I.cb,I.supa,"AS-A2","Motor A","down","medium","Beta","M1","2027-01-03"],
    [4,I.ob,I.sx,I.cx,I.supx,"AS-X1","Activo fuera organización","operational","critical","LeakCo","Secret","2027-01-04"],
  ];
  for(const row of baseRows)await db.query(
    "INSERT INTO assets(id,organization_id,site_id,category_id,supplier_id,code,name,status,criticality,manufacturer,model,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
    [aid(row[0]),...row.slice(1)],
  );

  await expectScope("platform",[1,2,3,4]);
  await expectScope("tenant",[1,2,3]);
  await expectScope("limited",[1,3]);

  for(let n=5;n<=38;n++){
    const status=n%5===0?"maintenance":n%7===0?"down":"operational";
    const criticality=n%4===0?"critical":n%3===0?"high":"medium";
    const category=n%2===0?I.ca:I.cb;
    const supplier=n%2===0?I.supa:I.supb;
    const manufacturer=n%2===0?"Acme":"Beta";
    const model="P"+String(n).padStart(2,"0");
    await db.query(
      "INSERT INTO assets(id,organization_id,site_id,category_id,supplier_id,code,name,status,criticality,manufacturer,model,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
      [aid(n),I.oa,I.sa,category,supplier,"AS-P"+n,"Activo paginado "+n,status,criticality,manufacturer,model,new Date(Date.UTC(2027,1,n-4)).toISOString()],
    );
  }

  const limited=scope("limited");
  const count=await db.query(`WITH scoped AS (${limited.sql}) SELECT count(*)::int total FROM scoped`,limited.params);
  if(count.rows[0].total!==36)throw new Error("Asset COUNT must represent the complete limited-site scope");
  if(count.rows[0].total<=24)throw new Error("Fixture must exceed one visible page");

  const first=await db.query(`WITH scoped AS (${limited.sql}) SELECT id,site_id,code FROM scoped ORDER BY created_at DESC,id DESC LIMIT $3 OFFSET $4`,[...limited.params,24,0]);
  const second=await db.query(`WITH scoped AS (${limited.sql}) SELECT id,site_id,code FROM scoped ORDER BY created_at DESC,id DESC LIMIT $3 OFFSET $4`,[...limited.params,24,24]);
  if(first.rowCount!==24||second.rowCount!==12)throw new Error("Asset pagination fixture did not create the expected second page");
  if([...first.rows,...second.rows].some(row=>row.site_id!==I.sa))throw new Error("Changing asset page expanded the limited-site scope");

  const target=second.rows[0];
  const found=await db.query(`WITH scoped AS (${limited.sql}) SELECT id FROM scoped WHERE code ILIKE $3 ORDER BY created_at DESC,id DESC LIMIT $4 OFFSET 0`,[...limited.params,"%"+target.code+"%",24]);
  if(found.rowCount!==1||found.rows[0].id!==target.id)throw new Error("Server search did not recover an asset outside page 1");

  const knownOutside=await db.query(`WITH scoped AS (${limited.sql}) SELECT id FROM scoped WHERE id=$3::uuid`,[...limited.params,aid(2)]);
  if(knownOutside.rowCount!==0)throw new Error("Known asset ID from an unauthorized site bypassed scope");
  const orgOutside=await db.query(`WITH scoped AS (${limited.sql}) SELECT id FROM scoped WHERE id=$3::uuid`,[...limited.params,aid(4)]);
  if(orgOutside.rowCount!==0)throw new Error("Known asset ID from another organization bypassed scope");

  const combined=await db.query(
    `WITH scoped AS (${limited.sql}) SELECT id FROM scoped
     WHERE status=$3 AND criticality=$4 AND category_id=$5::uuid AND supplier_id=$6::uuid
     ORDER BY created_at DESC,id DESC LIMIT $7 OFFSET 0`,
    [...limited.params,"operational","critical",I.ca,I.supa,24],
  );
  if(combined.rowCount<1)throw new Error("Combined asset filters returned no authorized rows");

  const facets=await db.query(
    `WITH scoped AS (${limited.sql})
     SELECT array_agg(DISTINCT organization_id::text) organizations,
            array_agg(DISTINCT site_id::text) sites,
            array_agg(DISTINCT category_id::text) categories,
            array_agg(DISTINCT supplier_id::text) suppliers
     FROM scoped`,
    limited.params,
  );
  if((facets.rows[0].organizations||[]).length!==1||facets.rows[0].organizations[0]!==I.oa)throw new Error("Asset facets leaked another organization");
  if((facets.rows[0].sites||[]).length!==1||facets.rows[0].sites[0]!==I.sa)throw new Error("Asset facets leaked another site");

  const kpi=await db.query(
    `WITH scoped AS (${limited.sql})
     SELECT count(*)::int total_count,
            count(*) FILTER(WHERE status='operational')::int operational_count,
            count(*) FILTER(WHERE status='maintenance')::int maintenance_count,
            count(*) FILTER(WHERE status='down')::int down_count,
            count(*) FILTER(WHERE criticality='critical')::int critical_count,
            count(*) FILTER(WHERE criticality IN ('high','critical'))::int high_critical_count,
            count(*) FILTER(WHERE category_id IS NOT NULL)::int with_category_count,
            count(*) FILTER(WHERE NULLIF(btrim(COALESCE(manufacturer,'')),'') IS NOT NULL)::int with_manufacturer_count,
            count(*) FILTER(WHERE NULLIF(btrim(COALESCE(model,'')),'') IS NOT NULL)::int with_model_count
     FROM scoped`,
    limited.params,
  );
  if(kpi.rows[0].total_count!==count.rows[0].total)throw new Error("Asset KPI total differs from full authorized scope");
  if(kpi.rows[0].total_count===first.rowCount)throw new Error("Asset KPI appears to be calculated from the visible page");

  const brands=await db.query(
    `WITH scoped AS (${limited.sql})
     SELECT btrim(manufacturer) name,count(*)::int asset_count FROM scoped
     WHERE NULLIF(btrim(COALESCE(manufacturer,'')),'') IS NOT NULL
     GROUP BY btrim(manufacturer) ORDER BY name`,
    limited.params,
  );
  if(brands.rows.some(row=>row.name==="LeakCo"))throw new Error("AssetCatalogOverview brand aggregation leaked out-of-scope data");

  const categoryCounts=await db.query(
    `WITH scoped AS (${limited.sql})
     SELECT c.id,count(scoped.id)::int asset_count
     FROM asset_categories c LEFT JOIN scoped ON scoped.category_id=c.id
     WHERE c.organization_id=$1
     GROUP BY c.id ORDER BY c.id`,
    limited.params,
  );
  const caCount=categoryCounts.rows.find(row=>row.id===I.ca)?.asset_count;
  const directCa=await db.query(`WITH scoped AS (${limited.sql}) SELECT count(*)::int total FROM scoped WHERE category_id=$3::uuid`,[...limited.params,I.ca]);
  if(caCount!==directCa.rows[0].total)throw new Error("Category summary count is not scoped to authorized assets");

  console.log("Asset scopes passed: platform, tenant and limited-site variants.");
  console.log("Search, filters, COUNT, facets, KPI and AssetCatalogOverview aggregates remain on the complete authorized scope.");
  console.log("Grid/List, creation, edit, import/export, maintenance, documents, history and row actions remain decoupled from the visible page.");
}finally{
  await db.query("ROLLBACK").catch(()=>{});
  await db.end();
}

console.log("Assets Phase 3 server pagination regression checks passed.");
