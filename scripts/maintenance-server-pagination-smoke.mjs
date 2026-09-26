import fs from "node:fs";
import pg from "pg";

const {Client}=pg;
const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error("DATABASE_URL is required");

const pageSource=fs.readFileSync("app/dashboard/maintenance/page.tsx","utf8");
const headerSource=fs.readFileSync("components/ModuleHeader.tsx","utf8");
const pagerSource=fs.readFileSync("components/ui-kit/UrlPagination.tsx","utf8");
const collectionSource=fs.readFileSync("components/ui-kit/DataControls.tsx","utf8");

for(const marker of [
  "ROUTINE_PAGE_SIZE=24",
  "ROUTINE_STATUSES",
  "ROUTINE_FREQUENCIES",
  "ROUTINE_SORTS",
  "scopeConditions",
  "filteredConditions",
  "filtered_count",
  "facetOptions",
  "<UrlPagination",
  "serverState={{",
  "LIMIT ${limitToken} OFFSET ${offsetToken}",
]){
  if(!pageSource.includes(marker))throw new Error("Maintenance server-pagination contract missing "+marker);
}
for(const forbidden of ["LIMIT 200","plans.rows.filter(plan=>plan.active)","querySelectorAll"]){
  if(pageSource.includes(forbidden))throw new Error("Maintenance pilot still depends on truncated/client collection logic: "+forbidden);
}
for(const marker of [
  "serverState?: ModuleHeaderServerState",
  "if(serverState){",
  "router.replace",
  'next.delete(serverState.pageParam||"page")',
  "serverState.facetOptions",
]){
  if(!headerSource.includes(marker))throw new Error("Optional ModuleHeader server mode missing "+marker);
}
if(!headerSource.includes('querySelectorAll<HTMLElement>("[data-module-record]")'))throw new Error("ModuleHeader DOM mode must remain available for unmigrated modules");
for(const marker of ["<Pagination","router.push","searchParams.toString()"]){
  if(!pagerSource.includes(marker))throw new Error("URL Pagination wrapper missing "+marker);
}
for(const marker of ['cmms:view-mode-change','localStorage.getItem("cmms:view-mode:"','data-view-pane="grid"','data-view-pane="list"']){
  if(!collectionSource.includes(marker))throw new Error("CollectionView contract changed during maintenance pilot: "+marker);
}

const client=new Client({connectionString:databaseUrl});
await client.connect();

const org="30000000-0000-4000-8000-000000000301";
const siteAllowed="30000000-0000-4000-8000-000000000302";
const siteHidden="30000000-0000-4000-8000-000000000303";
const assetAllowed="30000000-0000-4000-8000-000000000304";
const assetHidden="30000000-0000-4000-8000-000000000305";
const targetPlan="30000000-0000-4000-8000-000000000399";
const hiddenPlan="30000000-0000-4000-8000-000000000398";
const pageSize=24;

function uuidFor(index){
  return "30000000-0000-4000-8000-"+String(400+index).padStart(12,"0");
}

const scopedSql=`
  SELECT p.id,p.organization_id,a.site_id,s.name site,p.name,a.id asset_id,
         a.name asset,o.name company,p.frequency_value,p.frequency_unit,p.next_due_at,p.active
  FROM maintenance_plans p
  JOIN assets a ON a.id=p.asset_id
  JOIN organizations o ON o.id=p.organization_id
  JOIN sites s ON s.id=a.site_id
  WHERE p.organization_id=$1 AND a.site_id=ANY($2::uuid[])`;

try{
  await client.query("BEGIN");
  await client.query(
    `INSERT INTO organizations(id,name,slug,active) VALUES($1,'Pagination Pilot Org','pagination-pilot-org',true)`,
    [org],
  );
  await client.query(
    `INSERT INTO sites(id,organization_id,name,code,country,active)
     VALUES($1,$3,'Sede permitida','PILOT-A','CO',true),($2,$3,'Sede oculta','PILOT-B','CO',true)`,
    [siteAllowed,siteHidden,org],
  );
  await client.query(
    `INSERT INTO assets(id,organization_id,site_id,code,name,status,criticality)
     VALUES($1,$3,$4,'PILOT-ASSET-A','Equipo permitido','operational','medium'),
           ($2,$3,$5,'PILOT-ASSET-B','Equipo oculto','operational','medium')`,
    [assetAllowed,assetHidden,org,siteAllowed,siteHidden],
  );

  for(let index=1;index<=30;index++){
    const id=index===30?targetPlan:uuidFor(index);
    const name=index===30?"Rutina Aguja Fuera Primera Pagina":"Rutina Piloto "+String(index).padStart(2,"0");
    const unit=index===30?"year":"month";
    const due=new Date(Date.UTC(2027,0,index)).toISOString();
    await client.query(
      `INSERT INTO maintenance_plans(id,organization_id,asset_id,name,frequency_value,frequency_unit,next_due_at,active)
       VALUES($1,$2,$3,$4,1,$5,$6,true)`,
      [id,org,assetAllowed,name,unit,due],
    );
  }
  await client.query(
    `INSERT INTO maintenance_plans(id,organization_id,asset_id,name,frequency_value,frequency_unit,next_due_at,active)
     VALUES($1,$2,$3,'Rutina Aguja Fuera Primera Pagina',1,'day','2027-01-01T00:00:00Z',true)`,
    [hiddenPlan,org,assetHidden],
  );

  const baseParams=[org,[siteAllowed]];
  const firstPage=await client.query(
    `WITH scoped AS (${scopedSql})
     SELECT id,name FROM scoped
     ORDER BY next_due_at ASC NULLS LAST,name ASC,id ASC
     LIMIT $3 OFFSET $4`,
    [...baseParams,pageSize,0],
  );
  if(firstPage.rowCount!==pageSize)throw new Error("Expected first maintenance page to contain "+pageSize+" rows");
  if(firstPage.rows.some(row=>row.id===targetPlan))throw new Error("Target routine unexpectedly belongs to first page");

  const secondPage=await client.query(
    `WITH scoped AS (${scopedSql})
     SELECT id,name FROM scoped
     ORDER BY next_due_at ASC NULLS LAST,name ASC,id ASC
     LIMIT $3 OFFSET $4`,
    [...baseParams,pageSize,pageSize],
  );
  if(!secondPage.rows.some(row=>row.id===targetPlan))throw new Error("Page navigation did not recover target routine from page 2");

  const searchPattern="%Rutina Aguja Fuera Primera Pagina%";
  const searched=await client.query(
    `WITH scoped AS (${scopedSql})
     SELECT id,name,site_id FROM scoped
     WHERE (name ILIKE $3 OR asset ILIKE $3 OR company ILIKE $3 OR site ILIKE $3 OR frequency_unit ILIKE $3)
     ORDER BY next_due_at ASC NULLS LAST,name ASC,id ASC
     LIMIT $4 OFFSET $5`,
    [...baseParams,searchPattern,pageSize,0],
  );
  if(searched.rowCount!==1||searched.rows[0].id!==targetPlan)throw new Error("Server search did not find the routine outside page 1 or leaked hidden-site data");

  const combined=await client.query(
    `WITH scoped AS (${scopedSql})
     SELECT id,name FROM scoped
     WHERE active=$3 AND frequency_unit=$4 AND site_id=$5::uuid
     ORDER BY next_due_at ASC NULLS LAST,name ASC,id ASC
     LIMIT $6 OFFSET $7`,
    [...baseParams,true,"year",siteAllowed,pageSize,0],
  );
  if(combined.rowCount!==1||combined.rows[0].id!==targetPlan)throw new Error("Combined server filters failed for target routine");

  const counts=await client.query(
    `WITH scoped AS (${scopedSql}),
          filtered AS (SELECT * FROM scoped WHERE frequency_unit=$3)
     SELECT (SELECT count(*)::int FROM scoped) total_count,
            (SELECT count(*)::int FROM filtered) filtered_count`,
    [...baseParams,"year"],
  );
  if(counts.rows[0].total_count!==30||counts.rows[0].filtered_count!==1)throw new Error("Authorized/filtered routine counts are not based on the complete scoped set");

  const facets=await client.query(
    `WITH scoped AS (${scopedSql})
     SELECT array_agg(DISTINCT frequency_unit ORDER BY frequency_unit) frequencies,
            array_agg(DISTINCT site_id::text ORDER BY site_id::text) sites
     FROM scoped`,
    baseParams,
  );
  const frequencies=facets.rows[0].frequencies||[];
  const sites=facets.rows[0].sites||[];
  if(!frequencies.includes("month")||!frequencies.includes("year")||frequencies.includes("day"))throw new Error("Facets do not represent the complete authorized set");
  if(sites.length!==1||sites[0]!==siteAllowed)throw new Error("Facet scope leaked an unauthorized site");

  console.log("Maintenance server pagination SQL behavior passed: page 2, search, combined filters, counts, facets and site scope.");
}finally{
  await client.query("ROLLBACK").catch(()=>{});
  await client.end();
}

console.log("Maintenance Phase 3 pilot regression checks passed.");
