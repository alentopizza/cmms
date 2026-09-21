import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isPlatformOwner } from "@/lib/permissions";
import { pool } from "@/lib/db";

type FieldKind =
  | { type: "text"; nullable?: boolean }
  | { type: "number"; nullable?: boolean }
  | { type: "integer"; nullable?: boolean }
  | { type: "boolean" }
  | { type: "date"; nullable?: boolean }
  | { type: "enum"; values: string[] };

const TABLES: Record<string, Record<string, FieldKind>> = {
  sales_leads: {
    full_name: { type: "text" },
    company_name: { type: "text" },
    email: { type: "text" },
    phone: { type: "text", nullable: true },
    message: { type: "text", nullable: true },
    status: { type: "enum", values: ["new","contacted","qualified","closed","discarded"] },
  },
  assets: {
    code: { type: "text" },
    name: { type: "text" },
    description: { type: "text", nullable: true },
    manufacturer: { type: "text", nullable: true },
    model: { type: "text", nullable: true },
    serial_number: { type: "text", nullable: true },
    status: { type: "enum", values: ["operational","maintenance","down","retired"] },
    criticality: { type: "enum", values: ["low","medium","high","critical"] },
  },
  work_orders: {
    title: { type: "text" },
    description: { type: "text", nullable: true },
    type: { type: "enum", values: ["corrective","preventive","inspection","emergency","improvement"] },
    priority: { type: "enum", values: ["low","medium","high","urgent"] },
    status: { type: "enum", values: ["open","assigned","in_progress","paused","completed","cancelled"] },
    due_at: { type: "date", nullable: true },
    completion_notes: { type: "text", nullable: true },
  },
  maintenance_plans: {
    name: { type: "text" },
    description: { type: "text", nullable: true },
    frequency_value: { type: "integer" },
    frequency_unit: { type: "enum", values: ["day","week","month","year","meter"] },
    next_due_at: { type: "date", nullable: true },
    estimated_minutes: { type: "integer", nullable: true },
    active: { type: "boolean" },
  },
  inventory_items: {
    sku: { type: "text" },
    name: { type: "text" },
    description: { type: "text", nullable: true },
    unit: { type: "text" },
    quantity: { type: "number" },
    min_quantity: { type: "number" },
    unit_cost: { type: "number" },
    storage_location: { type: "text", nullable: true },
    active: { type: "boolean" },
  },
  suppliers: {
    name: { type: "text" },
    tax_id: { type: "text", nullable: true },
    supplier_type: { type: "enum", values: ["materials","services","both"] },
    service_category: { type: "text", nullable: true },
    contact_name: { type: "text", nullable: true },
    email: { type: "text", nullable: true },
    phone: { type: "text", nullable: true },
    notes: { type: "text", nullable: true },
    active: { type: "boolean" },
  },
  crews: {
    name: { type: "text" },
    description: { type: "text", nullable: true },
    active: { type: "boolean" },
  },
};

function quoteIdentifier(value: string) {
  return '"' + value.replaceAll('"', '""') + '"';
}

function normalize(kind: FieldKind, raw: unknown) {
  if (kind.type === "boolean") {
    return raw === true || raw === "true" || raw === "1";
  }

  const value = raw === null || raw === undefined ? "" : String(raw).trim();
  if (!value) {
    if ("nullable" in kind && kind.nullable) return null;
    throw new Error("Campo requerido vacío.");
  }

  if (kind.type === "text" || kind.type === "date") return value;
  if (kind.type === "number") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error("Valor numérico inválido.");
    return parsed;
  }
  if (kind.type === "integer") {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) throw new Error("Valor entero inválido.");
    return parsed;
  }
  if (!kind.values.includes(value)) throw new Error("Valor fuera de las opciones permitidas.");
  return value;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!isPlatformOwner(session)) {
    return NextResponse.json({ message: "La edición total está reservada al Propietario Desweb." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    table?: string;
    id?: string;
    values?: Record<string, unknown>;
  } | null;

  const table = String(body?.table || "");
  const id = String(body?.id || "");
  const schema = TABLES[table];
  if (!schema || !id || !body?.values || typeof body.values !== "object") {
    return NextResponse.json({ message: "Registro o tabla no permitidos." }, { status: 422 });
  }

  const entries = Object.entries(body.values).filter(([field]) => Boolean(schema[field]));
  if (!entries.length) return NextResponse.json({ message: "No hay campos editables." }, { status: 422 });

  try {
    const values = entries.map(([field, raw]) => normalize(schema[field], raw));
    const assignments = entries.map(([field], index) => quoteIdentifier(field) + "=$" + (index + 1));
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const updated = await client.query(
        `UPDATE "public".${quoteIdentifier(table)}
         SET ${assignments.join(", ")}
         WHERE id::text=$${values.length + 1}`,
        [...values, id],
      );
      if (!updated.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json({ message: "Registro no encontrado." }, { status: 404 });
      }

      await client.query(
        `INSERT INTO audit_log(organization_id,user_id,action,entity_type,entity_id,metadata)
         VALUES(NULL,$1,'platform_owner.force_update',$2,$3,$4::jsonb)`,
        [
          session.userId,
          table,
          id,
          JSON.stringify({ actor_email: session.email, fields: entries.map(([field]) => field) }),
        ],
      );
      await client.query("COMMIT");
      return NextResponse.json({ message: "Registro actualizado." });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    const code = (error as { code?: string }).code;
    const message = code === "23505"
      ? "El cambio genera un valor duplicado."
      : error instanceof Error ? error.message : "No fue posible actualizar el registro.";
    return NextResponse.json({ message }, { status: 409 });
  }
}
