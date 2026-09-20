import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getPlanByCode } from "@/lib/billing";
import { hashPassword } from "@/lib/passwords";
import { COOKIE_NAME, userSessionToken } from "@/lib/auth";
import { publicUrl } from "@/lib/urls";

function slugify(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function POST(request: Request) {
  if (process.env.TEST_CHECKOUT_ENABLED === "false") {
    return new NextResponse("Checkout de prueba deshabilitado", { status: 403 });
  }

  const form = await request.formData();
  const planCode = String(form.get("plan_code") || "trial");
  const companyName = String(form.get("company_name") || "").trim();
  const fullName = String(form.get("full_name") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const city = String(form.get("city") || "").trim();
  const siteName = String(form.get("site_name") || "Sede principal").trim();

  const planResult = await getPlanByCode(planCode);
  if (!planResult.rowCount || !companyName || !fullName || !email || password.length < 8 || !city || !siteName) {
    return NextResponse.redirect(publicUrl(`/checkout?plan=${encodeURIComponent(planCode)}&error=1`, request.url), 303);
  }
  const plan = planResult.rows[0];

  const client = await pool.connect();
  let userId = "";
  try {
    await client.query("BEGIN");

    const duplicate = await client.query("SELECT 1 FROM users WHERE lower(email)=lower($1)", [email]);
    if (duplicate.rowCount) throw Object.assign(new Error("duplicate"), { code: "23505" });

    let slug = slugify(companyName) || "empresa";
    const slugExists = await client.query("SELECT 1 FROM organizations WHERE slug=$1", [slug]);
    if (slugExists.rowCount) slug = `${slug}-${Date.now().toString().slice(-6)}`;

    const org = await client.query<{ id: string }>(
      `INSERT INTO organizations(name,slug,timezone)
       VALUES($1,$2,'America/Bogota')
       RETURNING id`,
      [companyName, slug],
    );
    const organizationId = org.rows[0].id;

    await client.query(
      `INSERT INTO organization_limits(organization_id,max_sites,max_sublocations,max_assets,max_inventory_items,max_technicians)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [organizationId, plan.max_sites, plan.max_sublocations, plan.max_assets, plan.max_inventory_items, plan.max_technicians],
    );

    const now = new Date();
    const isTrial = plan.code === "trial";
    await client.query(
      `INSERT INTO organization_subscriptions(
         organization_id,plan_id,status,source,trial_started_at,trial_ends_at,current_period_start,current_period_end,auto_renew,has_custom_limits
       ) VALUES(
         $1,$2,$3,'test_checkout',
         CASE WHEN $3='trialing' THEN now() ELSE NULL END,
         CASE WHEN $3='trialing' THEN now() + ($4 || ' days')::interval ELSE NULL END,
         CASE WHEN $3='active' THEN now() ELSE NULL END,
         CASE WHEN $3='active' THEN now() + interval '1 month' ELSE NULL END,
         $5,false
       )`,
      [organizationId, plan.id, isTrial ? "trialing" : "active", plan.trial_days, !isTrial],
    );

    await client.query(
      `INSERT INTO sites(organization_id,name,code,city,country)
       VALUES($1,$2,'MAIN',$3,'CO')`,
      [organizationId, siteName, city],
    );

    const { salt, hash } = hashPassword(password);
    const user = await client.query<{ id: string }>(
      `INSERT INTO users(email,full_name,password_hash,password_salt,platform_role)
       VALUES($1,$2,$3,$4,'user')
       RETURNING id`,
      [email, fullName, hash, salt],
    );
    userId = user.rows[0].id;

    await client.query(
      `INSERT INTO organization_members(organization_id,user_id,role,site_id,access_all_sites)
       VALUES($1,$2,'admin',NULL,true)`,
      [organizationId, userId],
    );

    await client.query(
      `INSERT INTO subscription_events(organization_id,event_type,source,metadata)
       VALUES($1,$2,'test_checkout',$3::jsonb)`,
      [organizationId, isTrial ? "trial_started" : "subscription_activated", JSON.stringify({ plan: plan.code })],
    );

    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    return NextResponse.redirect(publicUrl(`/checkout?plan=${encodeURIComponent(planCode)}&error=1`, request.url), 303);
  } finally {
    client.release();
  }

  const response = NextResponse.redirect(publicUrl("/dashboard", request.url), 303);
  response.cookies.set(COOKIE_NAME, userSessionToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
