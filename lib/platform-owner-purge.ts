import type { PoolClient } from "pg";
import { pool } from "@/lib/db";

type ForeignKeyDependency = {
  constraint_oid: string;
  child_table: string;
  delete_action: "a" | "r" | "c" | "n" | "d";
  child_columns: string[];
  parent_columns: string[];
};

export type PurgeResult = {
  table: string;
  id: string;
  label: string;
  deletedRows: number;
  deletedByTable: Record<string, number>;
};

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/i;
const EXCLUDED_ROOT_TABLES = new Set([
  "schema_migrations",
  "migrations",
]);

function quoteIdentifier(value: string) {
  if (!IDENTIFIER.test(value)) throw new Error("Identificador SQL inválido.");
  return '"' + value.replaceAll('"', '""') + '"';
}

function tableRef(table: string) {
  return '"public".' + quoteIdentifier(table);
}

function rowLabel(row: Record<string, unknown>, fallback: string) {
  const candidates = ["name", "title", "full_name", "email", "code", "slug", "display_name", "number", "sku"];
  for (const key of candidates) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value);
  }
  return fallback;
}

function rowDetail(row: Record<string, unknown>) {
  const parts: string[] = [];
  for (const key of ["organization_id", "site_id", "status", "role", "platform_role", "created_at"]) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      parts.push(key + ": " + String(value));
    }
  }
  return parts.slice(0, 3).join(" · ");
}

async function assertPurgeableTable(client: PoolClient, table: string) {
  if (!IDENTIFIER.test(table) || EXCLUDED_ROOT_TABLES.has(table)) {
    throw new Error("Tabla no permitida para eliminación universal.");
  }

  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1
       FROM information_schema.tables t
       JOIN information_schema.columns c
         ON c.table_schema=t.table_schema AND c.table_name=t.table_name
       WHERE t.table_schema='public'
         AND t.table_type='BASE TABLE'
         AND t.table_name=$1
         AND c.column_name='id'
     ) exists`,
    [table],
  );

  if (!result.rows[0]?.exists) {
    throw new Error("La tabla no existe o no expone una columna id.");
  }
}

async function dependenciesFor(client: PoolClient, parentTable: string) {
  const result = await client.query<ForeignKeyDependency>(
    `SELECT
       con.oid::text constraint_oid,
       child.relname child_table,
       con.confdeltype::text delete_action,
       array_agg(child_att.attname ORDER BY child_key.ord)::text[] child_columns,
       array_agg(parent_att.attname ORDER BY child_key.ord)::text[] parent_columns
     FROM pg_constraint con
     JOIN pg_class child ON child.oid=con.conrelid
     JOIN pg_namespace child_ns ON child_ns.oid=child.relnamespace
     JOIN pg_class parent ON parent.oid=con.confrelid
     JOIN pg_namespace parent_ns ON parent_ns.oid=parent.relnamespace
     JOIN LATERAL unnest(con.conkey) WITH ORDINALITY child_key(attnum,ord) ON true
     JOIN LATERAL unnest(con.confkey) WITH ORDINALITY parent_key(attnum,ord)
       ON parent_key.ord=child_key.ord
     JOIN pg_attribute child_att
       ON child_att.attrelid=child.oid AND child_att.attnum=child_key.attnum
     JOIN pg_attribute parent_att
       ON parent_att.attrelid=parent.oid AND parent_att.attnum=parent_key.attnum
     WHERE con.contype='f'
       AND child_ns.nspname='public'
       AND parent_ns.nspname='public'
       AND parent.relname=$1
     GROUP BY con.oid,child.relname,con.confdeltype`,
    [parentTable],
  );
  return result.rows;
}

async function deleteRowByCtid(
  client: PoolClient,
  table: string,
  ctid: string,
  visited: Set<string>,
  active: Set<string>,
  stats: Map<string, number>,
) {
  const key = table + ":" + ctid;
  if (visited.has(key)) return;

  const rowResult = await client.query<{ row_data: Record<string, unknown> }>(
    `SELECT to_jsonb(t) row_data FROM ${tableRef(table)} t WHERE ctid::text=$1 LIMIT 1`,
    [ctid],
  );
  const row = rowResult.rows[0]?.row_data;
  if (!row) {
    visited.add(key);
    return;
  }

  if (table === "users" && row.platform_role === "platform_owner") {
    throw new Error("La cuenta Propietario Desweb está protegida contra eliminación.");
  }

  active.add(key);
  const dependencies = await dependenciesFor(client, table);

  for (const dependency of dependencies) {
    // Delete branches that PostgreSQL would block (NO ACTION/RESTRICT) and
    // branches that are semantically owned by the parent (CASCADE). Keep
    // SET NULL / SET DEFAULT references intact.
    if (
      dependency.delete_action !== "a" &&
      dependency.delete_action !== "r" &&
      dependency.delete_action !== "c"
    ) continue;

    const values = dependency.parent_columns.map(column => row[column]);
    if (values.some(value => value === null || value === undefined)) continue;

    const predicates = dependency.child_columns
      .map((column, index) => quoteIdentifier(column) + "=$" + (index + 1))
      .join(" AND ");

    const childRows = await client.query<{ ctid: string }>(
      `SELECT ctid::text ctid FROM ${tableRef(dependency.child_table)} WHERE ${predicates}`,
      values,
    );

    for (const child of childRows.rows) {
      const childKey = dependency.child_table + ":" + child.ctid;
      if (active.has(childKey)) {
        throw new Error(
          "Se detectó un ciclo de llaves foráneas RESTRICT/NO ACTION entre " +
          table + " y " + dependency.child_table +
          ". Requiere una regla explícita antes de continuar.",
        );
      }
      await deleteRowByCtid(client, dependency.child_table, child.ctid, visited, active, stats);
    }
  }

  const deleted = await client.query(
    `DELETE FROM ${tableRef(table)} WHERE ctid::text=$1`,
    [ctid],
  );

  const deletedCount = deleted.rowCount || 0;
  if (deletedCount) {
    stats.set(table, (stats.get(table) || 0) + deletedCount);
  }

  active.delete(key);
  visited.add(key);
}

export async function forceDeleteRecord(
  client: PoolClient,
  table: string,
  id: string,
  actor: { userId: string | null; email: string },
): Promise<PurgeResult> {
  await assertPurgeableTable(client, table);

  const targetResult = await client.query<{ ctid: string; row_data: Record<string, unknown> }>(
    `SELECT ctid::text ctid,to_jsonb(t) row_data
     FROM ${tableRef(table)} t
     WHERE id::text=$1
     LIMIT 1`,
    [id],
  );

  const target = targetResult.rows[0];
  if (!target) throw new Error("Registro no encontrado.");

  if (table === "users") {
    if (target.row_data.platform_role === "platform_owner") {
      throw new Error("La cuenta Propietario Desweb no puede eliminarse.");
    }
    if (actor.userId && String(target.row_data.id) === actor.userId) {
      throw new Error("No puedes eliminar la cuenta que está ejecutando la operación.");
    }
  }

  const label = rowLabel(target.row_data, id);
  const stats = new Map<string, number>();

  await deleteRowByCtid(client, table, target.ctid, new Set(), new Set(), stats);

  const deletedByTable = Object.fromEntries(
    [...stats.entries()].sort(([a], [b]) => a.localeCompare(b)),
  );
  const deletedRows = [...stats.values()].reduce((total, count) => total + count, 0);

  await client.query(
    `INSERT INTO audit_log(organization_id,user_id,action,entity_type,entity_id,metadata)
     VALUES(NULL,$1,'platform_owner.force_delete',$2,$3,$4::jsonb)`,
    [
      actor.userId,
      table,
      id,
      JSON.stringify({
        actor_email: actor.email,
        target_label: label,
        deleted_rows: deletedRows,
        deleted_by_table: deletedByTable,
        mode: "platform_owner_universal_delete",
      }),
    ],
  );

  return { table, id, label, deletedRows, deletedByTable };
}
