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
  | { type: "uuid"; nullable?: boolean }
  | { type: "enum"; values: string[] };

const TABLES: Record<string, Record<string, FieldKind>> = {
  sites: {
    name: { type: "text" },
    code: { type: "text", nullable: true },
    address: { type: "text", nullable: true },
    city: { type: "text", nullable: true },
    country: { type: "text" },
    latitude: { type: "number", nullable: true },
    longitude: { type: "number", nullable: true },
    geofence_radius_m: { type: "integer" },
    active: { type: "boolean" },
  },
  locations: {
    name: { type: "text" },
    code: { type: "text", nullable: true },
    type: { type: "enum", values: ["area","floor","room","department","zone"] },
    description: { type: "text", nullable: true },
    active: { type: "boolean" },
  },
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
    asset_id: { type: "uuid", nullable: true },
    title: { type: "text" },
    description: { type: "text", nullable: true },
    type: { type: "enum", values: ["corrective","preventive","inspection","emergency","improvement"] },
    work_type: { type: "text", nullable: true },
    cause: { type: "text", nullable: true },
    priority: { type: "enum", values: ["low","medium","high","urgent"] },
    status: { type: "enum", values: ["open","assigned","in_progress","paused","completed","cancelled"] },
    due_at: { type: "date", nullable: true },
    assigned_to: { type: "uuid", nullable: true },
    crew_id: { type: "uuid", nullable: true },
    service_supplier_id: { type: "uuid", nullable: true },
    completion_notes: { type: "text", nullable: true },
  },
  maintenance_plans: {
    asset_id: { type: "uuid" },
    name: { type: "text" },
    description: { type: "text", nullable: true },
    routine_type: { type: "text", nullable: true },
    priority: { type: "text", nullable: true },
    specialty: { type: "text", nullable: true },
    frequency_value: { type: "integer" },
    frequency_unit: { type: "enum", values: ["day","week","month","year","meter"] },
    next_due_at: { type: "date", nullable: true },
    estimated_minutes: { type: "integer", nullable: true },
    assigned_to: { type: "uuid", nullable: true },
    crew_id: { type: "uuid", nullable: true },
    service_supplier_id: { type: "uuid", nullable: true },
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
  if (kind.type === "uuid") {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new Error("Identificador relacionado inválido.");
    }
    return value;
  }
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
      if (table === "work_orders" || table === "maintenance_plans") {
        const currentResult = await client.query<{
          organization_id:string;asset_id:string|null;site_id?:string;
          assigned_to:string|null;crew_id:string|null;service_supplier_id:string|null;
        }>(
          table === "work_orders"
            ? "SELECT organization_id::text,asset_id::text,site_id::text,assigned_to::text,crew_id::text,service_supplier_id::text FROM work_orders WHERE id::text=$1 FOR UPDATE"
            : "SELECT organization_id::text,asset_id::text,assigned_to::text,crew_id::text,service_supplier_id::text FROM maintenance_plans WHERE id::text=$1 FOR UPDATE",
          [id],
        );
        if (!currentResult.rowCount) {
          await client.query("ROLLBACK");
          return NextResponse.json({ message: "Registro no encontrado." }, { status: 404 });
        }
        const current=currentResult.rows[0];
        const normalized=Object.fromEntries(entries.map(([field],index)=>[field,values[index]]));
        const assetId=(normalized.asset_id ?? current.asset_id) as string|null;
        if (!assetId) throw new Error("El activo es obligatorio.");
        const asset=await client.query<{organization_id:string;site_id:string}>(
          "SELECT organization_id::text,site_id::text FROM assets WHERE id=$1 AND status<>'retired'",
          [assetId],
        );
        if (!asset.rowCount || asset.rows[0].organization_id!==current.organization_id) {
          throw new Error("El activo seleccionado no pertenece a la empresa del registro.");
        }

        const assignedTo=(Object.prototype.hasOwnProperty.call(normalized,"assigned_to")?normalized.assigned_to:current.assigned_to) as string|null;
        const crewId=(Object.prototype.hasOwnProperty.call(normalized,"crew_id")?normalized.crew_id:current.crew_id) as string|null;
        const supplierId=(Object.prototype.hasOwnProperty.call(normalized,"service_supplier_id")?normalized.service_supplier_id:current.service_supplier_id) as string|null;
        if ([assignedTo,crewId,supplierId].filter(Boolean).length>1) {
          throw new Error("Selecciona un único responsable: persona, cuadrilla o proveedor.");
        }
        if (assignedTo) {
          const worker=await client.query(
            `SELECT 1 FROM organization_members om
             JOIN users u ON u.id=om.user_id
             WHERE om.organization_id=$1 AND u.id=$2 AND u.active=true
               AND om.role IN ('technician','external')
               AND (COALESCE(om.access_all_sites,true)=true OR EXISTS(
                 SELECT 1 FROM organization_member_sites oms
                 WHERE oms.organization_id=om.organization_id AND oms.user_id=om.user_id AND oms.site_id=$3
               ))`,
            [current.organization_id,assignedTo,asset.rows[0].site_id],
          );
          if(!worker.rowCount) throw new Error("La persona seleccionada no tiene acceso válido a la sede del activo.");
        }
        if (crewId) {
          const crew=await client.query(
            "SELECT 1 FROM crews WHERE id=$1 AND organization_id=$2 AND active=true AND (site_id IS NULL OR site_id=$3)",
            [crewId,current.organization_id,asset.rows[0].site_id],
          );
          if(!crew.rowCount) throw new Error("La cuadrilla seleccionada no es válida para la sede del activo.");
        }
        if (supplierId) {
          const supplier=await client.query(
            "SELECT 1 FROM suppliers WHERE id=$1 AND organization_id=$2 AND active=true AND supplier_type IN ('services','both')",
            [supplierId,current.organization_id],
          );
          if(!supplier.rowCount) throw new Error("El proveedor seleccionado no es válido para esta empresa.");
        }
      }

      const updated = await client.query(
        `UPDATE "public".${quoteIdentifier(table)}
         SET ${assignments.join(", ")}
         WHERE id::text=${values.length + 1}`,
        [...values, id],
      );

      if (table === "work_orders") {
        const assetEntry=entries.findIndex(([field])=>field==="asset_id");
        if(assetEntry>=0){
          const assetId=values[assetEntry] as string;
          await client.query(
            "UPDATE work_orders w SET site_id=a.site_id FROM assets a WHERE w.id::text=$1 AND a.id=$2",
            [id,assetId],
          );
        }
      }
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
