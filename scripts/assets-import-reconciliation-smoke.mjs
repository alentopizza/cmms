import fs from "node:fs";
import pg from "pg";

function read(path){return fs.readFileSync(path,"utf8");}
function expect(source,needle,label){if(!source.includes(needle))throw new Error(label+" missing: "+needle);}

const template=read("app/api/bulk-import/template/route.ts");
for(const marker of [
  "REFERENCIAS_CMMS",
  '"ACTIVO_ID","ACTUALIZADO_EN"',
  '"SEDE_ID","Sede *"',
  '"SUBUBICACION_ID","Sububicación *"',
  '"PROVEEDOR_ID","Proveedor *"',
  "Celdas vacías",
  "Coincidencias",
  "ACTUALIZADO_EN permite detectar",
  'dataMode==="current"&&entity==="assets"',
  "a.site_id=ANY($2::uuid[])",
])expect(template,marker,"asset knowledge template");

const route=read("app/api/bulk-import/route.ts");
for(const marker of [
  'assetId:["ACTIVO_ID"',
  'updatedAt:["ACTUALIZADO_EN"',
  "function similarity(",
  "function resolutionKey(",
  'operation:"create"|"update"|"unchanged"|"conflict"|"pending"',
  "effectiveAssetResolutions",
  "unchangedCount",
  "conflictCount",
  "pendingCount",
  "El activo fue modificado en CMMS después de descargar la plantilla.",
  "resolvedExistingBySimilarity",
  "row.existing?.category_id||null",
  'row.operation==="create"||row.operation==="update"',
  "assets.bulk_import_updated",
  "assets.bulk_import_created",
  "asset_import_resolution_aliases",
  "hasLimitedInventorySiteScope(session)",
])expect(route,marker,"asset reconciliation engine");

const modal=read("components/BulkImportModal.tsx");
for(const marker of [
  "Con datos actuales",
  "Conciliación en CMMS",
  "Aplicar correcciones",
  "Vista previa de conciliación",
  "resolutionChoices",
  'body.set("resolutions",JSON.stringify(resolutionChoices))',
  "Sin cambios",
  "Conflicto",
])expect(modal,marker,"asset reconciliation UI");

const css=read("app/globals.css");
for(const marker of [
  ".bulk-import-reconciliation{",
  ".bulk-import-reconciliation-list",
  ".bulk-import-preview",
  ".bulk-import-operation.unchanged",
  ".bulk-import-operation.conflict",
])expect(css,marker,"asset reconciliation styles");

const migration=read("db/migrations/999d_asset_import_resolution_aliases.sql");
expect(migration,"CREATE TABLE IF NOT EXISTS asset_import_resolution_aliases","asset alias migration");

const databaseUrl=process.env.DATABASE_URL;
if(databaseUrl){
  const {Client}=pg;
  const client=new Client({connectionString:databaseUrl});
  await client.connect();
  try{
    const table=await client.query("SELECT to_regclass('public.asset_import_resolution_aliases') name");
    if(!table.rows[0]?.name)throw new Error("asset_import_resolution_aliases migration was not applied");
  }finally{
    await client.end();
  }
}

console.log("Asset import reconciliation checks passed.");
