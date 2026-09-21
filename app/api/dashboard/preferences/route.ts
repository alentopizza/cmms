import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

const ALLOWED = new Set([
  "dashboard",
  "companies",
  "leads",
  "locations",
  "suppliers",
  "users",
  "crews",
  "assets",
  "work_orders",
  "maintenance",
  "inventory",
]);

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => null) as {
    order?: unknown;
    collapsed?: unknown;
  } | null;

  if (!body) return NextResponse.json({ message: "Solicitud inválida." }, { status: 400 });

  const rawOrder = Array.isArray(body.order) ? body.order : [];
  const order = [...new Set(
    rawOrder
      .filter((value): value is string => typeof value === "string")
      .filter(value => ALLOWED.has(value)),
  )];

  if (order.length > ALLOWED.size) {
    return NextResponse.json({ message: "Orden de módulos inválido." }, { status: 422 });
  }

  const collapsed = Boolean(body.collapsed);

  // The environment bootstrap account has no persistent user row.
  // Its preferences are kept locally by the client.
  if (!session.userId) {
    return NextResponse.json({ persisted: false, reason: "bootstrap" });
  }

  await query(
    `INSERT INTO user_dashboard_preferences(user_id,sidebar_order,sidebar_collapsed,updated_at)
     VALUES($1,$2,$3,now())
     ON CONFLICT(user_id)
     DO UPDATE SET sidebar_order=EXCLUDED.sidebar_order,
                   sidebar_collapsed=EXCLUDED.sidebar_collapsed,
                   updated_at=now()`,
    [session.userId, order, collapsed],
  );

  return NextResponse.json({ persisted: true, order, collapsed });
}
