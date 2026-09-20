import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { before, after, test } from 'node:test';
import pg from 'pg';

let db;
let schema;
let legacy;
const embeddedModule = process.env.CMMS_TEST_PGLITE_MODULE;
const sql = (text, params = []) => db.query(text, params);
const run = text => embeddedModule ? db.exec(text) : db.query(text);
async function migration(name) {
  let source = await readFile(new URL(`../db/migrations/${name}`, import.meta.url), 'utf8');
  if (embeddedModule) source = source.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '');
  await run(source);
}
async function scope() {
  const org = randomUUID(), site = randomUUID(), parent = randomUUID(), location = randomUUID();
  await sql('INSERT INTO organizations(id,name,slug) VALUES($1,$2,$3)', [org, 'Test company', org]);
  await sql('INSERT INTO sites(id,organization_id,name) VALUES($1,$2,$3)', [site, org, 'Hospital']);
  await sql('INSERT INTO locations(id,organization_id,site_id,name) VALUES($1,$2,$3,$4)', [parent, org, site, 'Floor']);
  await sql('INSERT INTO locations(id,organization_id,site_id,parent_id,name) VALUES($1,$2,$3,$4,$5)', [location, org, site, parent, 'Room']);
  return { org, site, parent, location };
}
async function asset(s) {
  const id = randomUUID();
  await sql('INSERT INTO assets(id,organization_id,site_id,location_id,code,name) VALUES($1,$2,$3,$4,$5,$6)', [id,s.org,s.site,s.location,id,'Equipment']);
  return id;
}
async function protectedScope(s) {
  for (const [table,id] of [['organizations',s.org],['sites',s.site],['locations',s.parent],['locations',s.location]]) {
    await assert.rejects(sql(`DELETE FROM ${table} WHERE id=$1`, [id]), error => error.code === 'P2001');
    const row = await sql(`SELECT deletion_locked FROM ${table} WHERE id=$1`, [id]);
    assert.equal(row.rows[0].deletion_locked, true);
  }
}

before(async () => {
  if (embeddedModule) {
    const { PGlite } = await import(embeddedModule);
    db = new PGlite();
  } else {
    if (!process.env.TEST_DATABASE_URL) throw Error('Set TEST_DATABASE_URL to a disposable test database. Never use production.');
    db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
    await db.connect();
  }
  schema = `cmms_test_${randomUUID().replaceAll('-', '')}`;
  await run(`CREATE SCHEMA ${schema}; SET search_path TO ${schema},public;`);
  for (const name of ['001_init.sql','002_app_customization.sql','003_organization_visual_assets.sql','004_tenant_limits_and_location_hierarchy.sql']) await migration(name);
  legacy = await scope();
  await asset(legacy);
  await migration('005_protect_operational_history.sql');
});

after(async () => {
  if (!db) return;
  if (schema) await run(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  if (embeddedModule) await db.close(); else await db.end();
});

test('migration protects existing records and their ancestors', async () => { await protectedScope(legacy); });
test('empty records remain deletable, without erasing another company', async () => {
  const s = await scope();
  for (const [table,id] of [['locations',s.location],['locations',s.parent],['sites',s.site],['organizations',s.org]]) await sql(`DELETE FROM ${table} WHERE id=$1`, [id]);
  assert.equal((await sql('SELECT count(*)::int n FROM organizations WHERE id=$1',[s.org])).rows[0].n, 0);
  await protectedScope(legacy);
});
test('deleting a company with empty principal sites is allowed', async () => {
  const s = await scope();
  await sql('DELETE FROM locations WHERE id=$1', [s.location]);
  await sql('DELETE FROM locations WHERE id=$1', [s.parent]);
  await sql('DELETE FROM organizations WHERE id=$1', [s.org]);
  assert.equal((await sql('SELECT count(*)::int n FROM sites WHERE id=$1',[s.site])).rows[0].n,0);
});
test('empty parents with children must be resolved first', async () => {
  const s=await scope();
  for (const [table,id] of [['locations',s.parent],['sites',s.site],['organizations',s.org]]) await assert.rejects(sql(`DELETE FROM ${table} WHERE id=$1`,[id]),e=>e.code==='P2001');
});
test('new assets protect all scopes even after removal', async () => {
  const s=await scope(); const id=await asset(s);
  await sql('DELETE FROM assets WHERE id=$1',[id]);
  await protectedScope(s);
});
test('moving an asset does not unlock the original location', async () => {
  const from=await scope(), to=await scope(); const id=await asset(from);
  await sql('UPDATE assets SET organization_id=$1,site_id=$2,location_id=$3 WHERE id=$4',[to.org,to.site,to.location,id]);
  await protectedScope(from); await protectedScope(to);
});
test('cancelled work orders remain history, even if removed', async () => {
  const s=await scope();
  await sql("INSERT INTO work_orders(organization_id,site_id,location_id,title,status) VALUES($1,$2,$3,'Test OT','cancelled')",[s.org,s.site,s.location]);
  await sql('DELETE FROM work_orders WHERE organization_id=$1',[s.org]);
  await protectedScope(s);
});
test('inventory movements and zero stock protect original scopes', async () => {
  const s=await scope(); const id=randomUUID();
  await sql("INSERT INTO inventory_items(id,organization_id,site_id,location_id,sku,name) VALUES($1,$2,$3,$4,$5,'Part')",[id,s.org,s.site,s.location,id]);
  await sql("INSERT INTO inventory_transactions(organization_id,item_id,type,quantity) VALUES($1,$2,'receipt',2)",[s.org,id]);
  await sql('DELETE FROM inventory_items WHERE id=$1',[id]);
  await protectedScope(s);
});
test('deactivation is allowed and history markers cannot be cleared', async () => {
  const s=await scope(); await asset(s);
  for (const [table,id] of [['organizations',s.org],['sites',s.site],['locations',s.parent],['locations',s.location]]) {
    await sql(`UPDATE ${table} SET active=false,deletion_locked=false WHERE id=$1`,[id]);
    assert.equal((await sql(`SELECT active FROM ${table} WHERE id=$1`,[id])).rows[0].active,false);
  }
  await protectedScope(s);
});
test('direct audit activity protects a physical location', async () => {
  const s=await scope();
  await sql("INSERT INTO audit_log(organization_id,action,entity_type,entity_id) VALUES($1,'movement','location',$2)",[s.org,s.location]);
  await sql('DELETE FROM audit_log WHERE organization_id=$1',[s.org]);
  await protectedScope(s);
});
test('foreign-company references are rejected atomically', async () => {
  const s=await scope(), other=await scope();
  await assert.rejects(asset({...s,site:other.site}),e=>e.code==='23503');
  assert.equal((await sql('SELECT deletion_locked FROM organizations WHERE id=$1',[s.org])).rows[0].deletion_locked,false);
});
