import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getPlanByCode } from "@/lib/billing";
import { hashPassword } from "@/lib/passwords";
import { COOKIE_NAME, userSessionToken } from "@/lib/auth";
import { publicUrl } from "@/lib/urls";
import { isSupportedCountry, isSupportedLocale, timezonesForCountry } from "@/lib/international-catalog";

const EMAIL = /^\S+@\S+\.\S+$/;

function slugify(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function wantsJson(request: Request) {
  return request.headers.get("accept")?.includes("application/json");
}

function failure(request: Request, planCode: string, status: number, message: string, fields?: Record<string,string>) {
  if (wantsJson(request)) return NextResponse.json({ message, fields }, { status });
  return NextResponse.redirect(publicUrl(`/checkout?plan=${encodeURIComponent(planCode)}&error=1`, request.url), 303);
}

export async function POST(request: Request) {
  if (process.env.TEST_CHECKOUT_ENABLED === "false") {
    return failure(request, "trial", 403, "El checkout de prueba está deshabilitado.");
  }

  const form = await request.formData();
  const planCode = String(form.get("plan_code") || "trial");
  const companyName = String(form.get("company_name") || "").trim();
  const fullName = String(form.get("full_name") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const country = String(form.get("country") || "CO").trim().toUpperCase();
  const city = String(form.get("city") || "").trim();
  const preferredLocale = String(form.get("preferred_locale") || "es-CO").trim();
  const siteName = String(form.get("site_name") || "").trim();

  const fields: Record<string,string> = {};
  if (!companyName) fields.company_name = "Ingresa el nombre de la empresa.";
  if (!fullName) fields.full_name = "Ingresa el nombre del administrador.";
  if (!email) fields.email = "Ingresa el correo electrónico.";
  else if (!EMAIL.test(email)) fields.email = "Ingresa un correo válido.";
  if (password.length < 8) fields.password = "La contraseña debe tener al menos 8 caracteres.";
  if (!isSupportedCountry(country)) fields.country = "Selecciona un país válido.";
  if (!city) fields.city = "Selecciona la ciudad.";
  if (!isSupportedLocale(preferredLocale)) fields.general = "El idioma predeterminado no es válido.";
  if (!siteName) fields.site_name = "Ingresa el nombre de la sede principal.";

  const planResult = await getPlanByCode(planCode);
  if (!planResult.rowCount) fields.general = "El plan seleccionado no está disponible.";

  if (Object.keys(fields).length) {
    return failure(request, planCode, 422, "Completa los campos marcados.", fields);
  }

  const plan = planResult.rows[0];
  const client = await pool.connect();
  let userId = "";

  try {
    await client.query("BEGIN");

    const duplicate = await client.query("SELECT 1 FROM users WHERE lower(email)=lower($1)", [email]);
    if (duplicate.rowCount) {
      await client.query("ROLLBACK");
      return failure(request, planCode, 409, "Ese correo ya está registrado.", {
        email: "Este correo ya existe. Inicia sesión o utiliza otro correo.",
      });
    }

    let slug = slugify(companyName) || "empresa";
    const slugExists = await client.query("SELECT 1 FROM organizations WHERE slug=$1", [slug]);
    if (slugExists.rowCount) slug = `${slug}-${Date.now().toString().slice(-6)}`;

    const timezone=timezonesForCountry(country)[0] || "UTC";
    const org = await client.query<{ id: string }>(
      `INSERT INTO organizations(name,slug,timezone,legal_city,legal_country,default_country,preferred_locale)
       VALUES($1,$2,$3,$4,$5,$5,$6)
       RETURNING id`,
      [companyName, slug, timezone, city, country, preferredLocale],
    );
    const organizationId = org.rows[0].id;

    await client.query(
      `INSERT INTO organization_limits(organization_id,max_sites,max_sublocations,max_assets,max_inventory_items,max_technicians)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [organizationId, plan.max_sites, plan.max_sublocations, plan.max_assets, plan.max_inventory_items, plan.max_technicians],
    );

    const isTrial = plan.code === "trial";
    await client.query(
      `INSERT INTO organization_subscriptions(
         organization_id,plan_id,status,source,trial_started_at,trial_ends_at,current_period_start,current_period_end,auto_renew,has_custom_limits
       ) VALUES(
         $1,$2,$3,'test_checkout',
         CASE WHEN $3='trialing' THEN now() ELSE NULL END,
         CASE WHEN $3='trialing' THEN now() + make_interval(days => $4::int) ELSE NULL END,
         CASE WHEN $3='active' THEN now() ELSE NULL END,
         CASE WHEN $3='active' THEN now() + interval '1 month' ELSE NULL END,
         $5,false
       )`,
      [organizationId, plan.id, isTrial ? "trialing" : "active", plan.trial_days, !isTrial],
    );

    await client.query(
      `INSERT INTO sites(organization_id,name,code,city,country)
       VALUES($1,$2,'MAIN',$3,$4)`,
      [organizationId, siteName, city, country],
    );

    const { salt, hash } = hashPassword(password);
    const user = await client.query<{ id: string }>(
      `INSERT INTO users(email,full_name,country_code,preferred_locale,password_hash,password_salt,platform_role)
       VALUES($1,$2,$3,$4,$5,$6,'user')
       RETURNING id`,
      [email, fullName, country, preferredLocale, hash, salt],
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
  } catch (error) {
    await client.query("ROLLBACK");
    const code = (error as { code?: string }).code;
    if (code === "23505") {
      return failure(request, planCode, 409, "Ya existe información registrada con uno de estos datos.", {
        email: "Este correo ya existe. Inicia sesión o utiliza otro correo.",
      });
    }
    return failure(request, planCode, 500, "No fue posible crear la cuenta. Tus datos se conservarán para que puedas corregirlos e intentar de nuevo.", {
      general: "Ocurrió un error al crear la cuenta. Intenta nuevamente.",
    });
  } finally {
    client.release();
  }

  if (wantsJson(request)) {
    const response = NextResponse.json({ ok: true, redirect: "/dashboard/settings?welcome=1" });
    response.cookies.set(COOKIE_NAME, userSessionToken(userId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  }

  const response = NextResponse.redirect(publicUrl("/dashboard/settings?welcome=1", request.url), 303);
  response.cookies.set(COOKIE_NAME, userSessionToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
