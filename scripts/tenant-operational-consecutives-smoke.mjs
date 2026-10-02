import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const client = await pool.connect();
try {
  await client.query("BEGIN");

  const orgA = (await client.query(
    "INSERT INTO organizations(name,slug) VALUES($1,$2) RETURNING id",
    ["Sequence Smoke A", "sequence-smoke-a-" + Date.now()]
  )).rows[0].id;
  const orgB = (await client.query(
    "INSERT INTO organizations(name,slug) VALUES($1,$2) RETURNING id",
    ["Sequence Smoke B", "sequence-smoke-b-" + Date.now()]
  )).rows[0].id;

  async function seedOrg(orgId, suffix) {
    const siteId = (await client.query(
      "INSERT INTO sites(organization_id,name,code) VALUES($1,$2,$3) RETURNING id",
      [orgId, "Sede " + suffix, "SITE-" + suffix]
    )).rows[0].id;

    const assetId = (await client.query(
      "INSERT INTO assets(organization_id,site_id,code,name) VALUES($1,$2,$3,$4) RETURNING id",
      [orgId, siteId, "ASSET-" + suffix, "Activo " + suffix]
    )).rows[0].id;

    return { siteId, assetId };
  }

  const a = await seedOrg(orgA, "A");
  const b = await seedOrg(orgB, "B");

  async function createWorkOrder(orgId, siteId, assetId, title) {
    return (await client.query(
      `INSERT INTO work_orders(organization_id,site_id,asset_id,title)
       VALUES($1,$2,$3,$4)
       RETURNING number::bigint AS number`,
      [orgId, siteId, assetId, title]
    )).rows[0].number;
  }

  async function createRoutine(orgId, assetId, name) {
    return (await client.query(
      `INSERT INTO maintenance_plans(
         organization_id,asset_id,name,trigger_type,frequency_value,frequency_unit
       )
       VALUES($1,$2,$3,'calendar',1,'month')
       RETURNING number::bigint AS number`,
      [orgId, assetId, name]
    )).rows[0].number;
  }

  const otA1 = await createWorkOrder(orgA, a.siteId, a.assetId, "OT A1");
  const otB1 = await createWorkOrder(orgB, b.siteId, b.assetId, "OT B1");
  const otA2 = await createWorkOrder(orgA, a.siteId, a.assetId, "OT A2");
  const otB2 = await createWorkOrder(orgB, b.siteId, b.assetId, "OT B2");

  const routineA1 = await createRoutine(orgA, a.assetId, "Rutina A1");
  const routineB1 = await createRoutine(orgB, b.assetId, "Rutina B1");
  const routineA2 = await createRoutine(orgA, a.assetId, "Rutina A2");
  const routineB2 = await createRoutine(orgB, b.assetId, "Rutina B2");

  assert(String(otA1) === "1", "Empresa A debe iniciar OT en 1");
  assert(String(otB1) === "1", "Empresa B debe iniciar OT en 1");
  assert(String(otA2) === "2", "Empresa A debe continuar OT en 2");
  assert(String(otB2) === "2", "Empresa B debe continuar OT en 2");

  assert(String(routineA1) === "1", "Empresa A debe iniciar Rutina en 1");
  assert(String(routineB1) === "1", "Empresa B debe iniciar Rutina en 1");
  assert(String(routineA2) === "2", "Empresa A debe continuar Rutina en 2");
  assert(String(routineB2) === "2", "Empresa B debe continuar Rutina en 2");

  const counters = await client.query(
    `SELECT organization_id::text,entity_type,last_value::bigint
     FROM organization_operational_counters
     WHERE organization_id = ANY($1::uuid[])
     ORDER BY organization_id,entity_type`,
    [[orgA, orgB]]
  );
  assert(counters.rowCount === 4, "Deben existir dos contadores por cada empresa");
  assert(counters.rows.every(row => String(row.last_value) === "2"), "Cada contador debe quedar en 2");

  console.log("tenant-operational-consecutives-smoke: OK");
  await client.query("ROLLBACK");
} catch (error) {
  await client.query("ROLLBACK");
  console.error(error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
