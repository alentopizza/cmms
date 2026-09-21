import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isPlatformOwner } from "@/lib/permissions";
import { pool } from "@/lib/db";
import { forceDeleteRecord, listPurgeableRecords, listPurgeableTables } from "@/lib/platform-owner-purge";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!isPlatformOwner(session)) {
    return NextResponse.json(
      { message: "La eliminación universal está reservada exclusivamente al Propietario Desweb." },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const table = String(url.searchParams.get("table") || "").trim();

  if (!table) {
    const tables = await listPurgeableTables();
    return NextResponse.json({ tables });
  }

  try {
    const records = await listPurgeableRecords(table, 150);
    return NextResponse.json({ records });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible consultar los registros.";
    return NextResponse.json({ message }, { status: 422 });
  }
}

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

  if (!table || !id) {
    return NextResponse.json({ message: "Selecciona un registro válido." }, { status: 422 });
  }
  if (confirmation !== "ELIMINAR") {
    return NextResponse.json(
      { message: "Escribe ELIMINAR para confirmar la eliminación universal." },
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
