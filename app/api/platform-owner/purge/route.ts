import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isPlatformOwner } from "@/lib/permissions";
import { pool } from "@/lib/db";
import { forceDeleteRecord } from "@/lib/platform-owner-purge";

const CONTEXTUAL_DELETE_TABLES = new Set([
  "organizations",
  "sites",
  "locations",
  "users",
  "sales_leads",
  "assets",
  "work_orders",
  "work_order_tasks",
  "maintenance_plans",
  "inventory_items",
  "suppliers",
  "crews",
  "organization_documents",
]);

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!isPlatformOwner(session)) {
    return NextResponse.json(
      { message: "La eliminación universal está reservada exclusivamente al Propietario Desweb." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null) as {
    table?: string;
    id?: string;
    confirmation?: string;
  } | null;

  const table = String(body?.table || "").trim();
  const id = String(body?.id || "").trim();
  const confirmation = String(body?.confirmation || "").trim();

  if (!table || !id || !CONTEXTUAL_DELETE_TABLES.has(table)) {
    return NextResponse.json({ message: "Registro o módulo no permitido para eliminación contextual." }, { status: 422 });
  }
  if (confirmation !== "ELIMINAR") {
    return NextResponse.json(
      { message: "Confirma la eliminación desde el registro seleccionado." },
      { status: 422 },
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await forceDeleteRecord(client, table, id, {
      userId: session.userId,
      email: session.email,
    });
    await client.query("COMMIT");
    return NextResponse.json({
      message: "Eliminación universal completada.",
      result,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    const message = error instanceof Error ? error.message : "No fue posible completar la eliminación universal.";
    const status = message === "Registro no encontrado." ? 404 : 409;
    return NextResponse.json({ message }, { status });
  } finally {
    client.release();
  }
}
