import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPlanByCode } from "@/lib/billing";
import { pool } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

export async function POST(request: Request) {
  if (process.env.TEST_CHECKOUT_ENABLED === "false") {
    return new NextResponse("Checkout de prueba deshabilitado", { status: 403 });
  }

  const session = await getSession();
  if (!session || session.platformRole === "superadmin" || !session.organizationId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const form = await request.formData();
  const planCode = String(form.get("plan_code") || "");
  if (planCode === "trial") {
    return NextResponse.redirect(publicUrl("/checkout?plan=trial&error=1", request.url), 303);
  }

  const planResult = await getPlanByCode(planCode);
  if (!planResult.rowCount) {
    return NextResponse.redirect(publicUrl("/#planes", request.url), 303);
  }
  const plan = planResult.rows[0];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO organization_limits(organization_id,max_sites,max_sublocations,max_assets,max_inventory_items,max_technicians)
       VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT(organization_id) DO UPDATE
       SET max_sites=EXCLUDED.max_sites,
           max_sublocations=EXCLUDED.max_sublocations,
           max_assets=EXCLUDED.max_assets,
           max_inventory_items=EXCLUDED.max_inventory_items,
           max_technicians=EXCLUDED.max_technicians,
           updated_at=now()`,
      [session.organizationId, plan.max_sites, plan.max_sublocations, plan.max_assets, plan.max_inventory_items, plan.max_technicians],
    );

    await client.query(
      `INSERT INTO organization_subscriptions(
         organization_id,plan_id,status,source,current_period_start,current_period_end,auto_renew,has_custom_limits,updated_at
       ) VALUES($1,$2,'active','test_checkout',now(),now()+interval '1 month',true,false,now())
       ON CONFLICT(organization_id) DO UPDATE
       SET plan_id=EXCLUDED.plan_id,
           status='active',
           source='test_checkout',
           trial_started_at=NULL,
           trial_ends_at=NULL,
           current_period_start=now(),
           current_period_end=now()+interval '1 month',
           auto_renew=true,
           has_custom_limits=false,
           updated_at=now()`,
      [session.organizationId, plan.id],
    );

    await client.query(
      `INSERT INTO subscription_events(organization_id,event_type,source,metadata)
       VALUES($1,'subscription_activated','test_checkout',$2::jsonb)`,
      [session.organizationId, JSON.stringify({ plan: plan.code })],
    );

    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    return NextResponse.redirect(publicUrl(`/checkout?plan=${encodeURIComponent(planCode)}&error=1`, request.url), 303);
  } finally {
    client.release();
  }

  return NextResponse.redirect(publicUrl("/dashboard", request.url), 303);
}
