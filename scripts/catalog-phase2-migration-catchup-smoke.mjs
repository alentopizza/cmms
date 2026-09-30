import fs from "node:fs";

const migrate=fs.readFileSync("scripts/migrate.mjs","utf8");
const docker=fs.readFileSync("Dockerfile","utf8");
const migration=fs.readFileSync("db/migrations/999a_configurable_catalogs_phase2_catchup.sql","utf8");

for(const needle of [
  "ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_type text",
  "ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS work_type text",
  "ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS item_type text",
  "ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS followup_type text",
]){
  if(!migration.includes(needle))throw new Error("Missing catch-up schema: "+needle);
}
if(!migrate.includes("schema_migrations"))throw new Error("Migration registry contract changed");
if(!docker.includes("node scripts/migrate.mjs && node server.js"))throw new Error("Runtime must migrate before serving");
console.log("Catalog Phase 2 migration catch-up smoke: OK");
