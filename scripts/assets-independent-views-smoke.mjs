import fs from "node:fs";

function read(path){return fs.readFileSync(path,"utf8");}
function expect(source,needle,label){if(!source.includes(needle))throw new Error(label+" missing: "+needle);}

const subnav=read("components/AssetSubnav.tsx");
for(const view of ["list","types","categories","brands","models","states","maintenance","history","documents","settings"]){
  expect(subnav,"?view="+view,"asset subnav "+view);
}
if(/\/dashboard\/assets#/.test(subnav))throw new Error("Asset subnav still uses hash anchors");

const page=read("app/dashboard/assets/page.tsx");
expect(page,'const ASSET_VIEWS=new Set<AssetView>',"asset view registry");
expect(page,'view==="list"', "list central view switch");
expect(page,'<AssetCatalogOverview', "asset secondary central renderer");
expect(page,'activeView={view}',"active subnav");
expect(page,'asset-modern-grid-dense',"dense asset grid");
expect(page,"configurable_catalog_options","asset type label resolution");

const overview=read("components/AssetCatalogOverview.tsx");
for(const view of ["types","categories","brands","models","states","maintenance","history","documents"]){
  expect(overview,'view==="'+view+'"',"asset overview "+view);
}
expect(overview,"Administrar tipos","asset settings view");

const css=read("app/globals.css");
for(const needle of [".asset-modern-grid-dense","repeat(4,minmax(0,1fr))","@media(max-width:460px)"]){
  expect(css,needle,"asset responsive UX");
}

console.log("Assets independent views UX smoke: OK");

const assetsPage=read("app/dashboard/assets/page.tsx");
const scopedStart=assetsPage.indexOf("const scopedSql=");
const filteredStart=assetsPage.indexOf("const filteredParams=",scopedStart);
const scopedBlock=assetsPage.slice(scopedStart,filteredStart);
if(scopedBlock.includes("a.asset_type"))throw new Error("Main asset directory must not require Phase 2 asset_type");
for(const needle of [
  'const typesPromise=view==="types"',
  'const brandsPromise=view==="brands"',
  'const modelsPromise=view==="models"',
  'const catalogCategoriesPromise=view==="categories"',
  'const maintenancePromise=view==="maintenance"',
  'const historyPromise=view==="history"',
  'const documentsPromise=view==="documents"',
]){
  expect(assetsPage,needle,"secondary views must be lazy");
}
