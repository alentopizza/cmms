import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can, type OrganizationRole } from "@/lib/permissions";
import { hashPassword } from "@/lib/passwords";
import { pool } from "@/lib/db";
import { publicUrl } from "@/lib/urls";
import { gateFor, getSetupState } from "@/lib/setup-sequence";

const ROLES = new Set<OrganizationRole>(["admin","manager","technician","requester","viewer","external"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^\S+@\S+\.\S+$/;

type FieldErrors = Record<string, string>;

function response(request: Request, status: number, payload: { message?: string; fields?: FieldErrors }, redirectSuffix = "") {
  if (request.headers.get("accept")?.includes("application/json")) {
    return NextResponse.json(payload, { status });
  }
  return NextResponse.redirect(publicUrl(`/dashboard/users${redirectSuffix}`, request.url), 303);
}

function uniqueSiteIds(form: FormData) {
  return [...new Set(form.getAll("site_ids").map(value => String(value)).filter(Boolean))];
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!can(session, "users.manage")) return new NextResponse("Forbidden", { status: 403 });

  const form = await request.formData();
  const fullName = String(form.get("full_name") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const phone = String(form.get("phone") || "").trim();
  const password = String(form.get("password") || "");
  const requestedRole = String(form.get("role") || "");
  const externalSupplierId = String(form.get("external_supplier_id") || "");
  let organizationId = String(form.get("organization_id") || "");
  let accessAllSites = String(form.get("access_all_sites") || "true") === "true";
  let siteIds = uniqueSiteIds(form);
  const creatingSuperadmin = requestedRole === "superadmin";

  const fields: FieldErrors = {};
  if (!fullName) fields.full_name = "Ingresa el nombre completo.";
  if (!email) fields.email = "Ingresa el correo electrónico.";
  else if (!EMAIL.test(email)) fields.email = "Ingresa un correo válido.";
  if (password.length < 8) fields.password = "Usa una contraseña de al menos 8 caracteres.";

  if (session.platformRole !== "superadmin") {
    organizationId = session.organizationId || "";
    if (creatingSuperadmin) fields.role = "No tienes permiso para crear un superadministrador.";

    if (accessAllSites && !session.accessAllSites) {
      fields.site_ids = "No puedes otorgar acceso a todas las sedes porque tu propia cuenta tiene un alcance limitado.";
    }
    if (!accessAllSites && !session.accessAllSites) {
      const allowed = new Set(session.siteIds);
      if (siteIds.some(siteId => !allowed.has(siteId))) {
        fields.site_ids = "Solo puedes asignar sedes a las que tu cuenta ya tiene acceso.";
      }
    }
  }

  if (!creatingSuperadmin) {
    if (!UUID.test(organizationId)) fields.organization_id = "Selecciona una empresa.";
    if (!ROLES.has(requestedRole as OrganizationRole)) fields.role = "Selecciona un rol válido.";
    if (requestedRole === "external" && !UUID.test(externalSupplierId)) fields.external_supplier_id = "Selecciona el proveedor de servicios al que pertenece.";
    if (!accessAllSites && siteIds.length === 0) fields.site_ids = "Selecciona al menos una sede o habilita el acceso a todas.";
    if (siteIds.some(siteId => !UUID.test(siteId))) fields.site_ids = "Una de las sedes seleccionadas no es válida.";
  } else {
    accessAllSites = true;
    siteIds = [];
  }

  if (Object.keys(fields).length) {
    return response(request, 422, { message: "Completa los campos marcados.", fields }, "?error=required");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const duplicate = await client.query("SELECT 1 FROM users WHERE lower(email)=lower($1)", [email]);
    if (duplicate.rowCount) {
      await client.query("ROLLBACK");
      return response(request, 409, { fields: { email: "Ya existe una cuenta con este correo electrónico." } }, "?error=email");
    }

    if (!creatingSuperadmin) {
      const organization = await client.query("SELECT 1 FROM organizations WHERE id=$1 AND active=true", [organizationId]);
      if (!organization.rowCount) {
        await client.query("ROLLBACK");
        return response(request, 422, { fields: { organization_id: "La empresa seleccionada no está disponible." } }, "?error=required");
      }

      if (!accessAllSites) {
        const validSites = await client.query<{ id: string }>(
          "SELECT id::text id FROM sites WHERE organization_id=$1 AND active=true AND id = ANY($2::uuid[])",
          [organizationId, siteIds],
        );
        if (validSites.rowCount !== siteIds.length) {
          await client.query("ROLLBACK");
          return response(request, 422, { fields: { site_ids: "Todas las sedes seleccionadas deben pertenecer a la empresa y estar activas." } }, "?error=required");
        }
      }

      if (requestedRole === "technician" || requestedRole === "external") {
        const setupGate = gateFor(await getSetupState(organizationId, client), requestedRole === "external" ? "external" : "workforce");
        if (!setupGate.ready) {
          await client.query("ROLLBACK");
          return response(request, 409, {
            fields: {
              role: setupGate.message,
              ...(requestedRole === "external" ? { external_supplier_id: setupGate.message } : {}),
            },
          }, "?error=sequence");
        }
      }

      if (requestedRole === "external") {
        const supplier = await client.query(
          "SELECT 1 FROM suppliers WHERE id=$1 AND organization_id=$2 AND active=true AND supplier_type IN ('services','both')",
          [externalSupplierId, organizationId],
        );
        if (!supplier.rowCount) {
          await client.query("ROLLBACK");
          return response(request, 422, { fields: { external_supplier_id: "El proveedor debe pertenecer a la empresa y prestar servicios." } }, "?error=required");
        }
      }

      if (requestedRole === "technician") {
        const quota = await client.query<{ used: number; allowed: number }>(
          `SELECT (SELECT count(*)::int FROM organization_members WHERE organization_id=$1 AND role='technician') used,
                  COALESCE((SELECT max_technicians FROM organization_limits WHERE organization_id=$1),50)::int allowed`,
          [organizationId],
        );
        if (quota.rows[0].used >= quota.rows[0].allowed) {
          await client.query("ROLLBACK");
          return response(request, 409, { fields: { role: "La empresa alcanzó el límite de técnicos asignado." } }, "?error=technician-limit");
        }
      }
    }

    const { salt, hash } = hashPassword(password);
    const user = await client.query<{ id: string }>(
      `INSERT INTO users(email,full_name,phone,password_hash,password_salt,platform_role)
       VALUES($1,$2,$3,$4,$5,$6)
       RETURNING id`,
      [email, fullName, phone || null, hash, salt, creatingSuperadmin ? "superadmin" : "user"],
    );

    if (!creatingSuperadmin) {
      await client.query(
        `INSERT INTO organization_members(organization_id,user_id,role,site_id,access_all_sites,external_supplier_id)
         VALUES($1,$2,$3,NULL,$4,$5)`,
        [organizationId, user.rows[0].id, requestedRole, accessAllSites, requestedRole === "external" ? externalSupplierId : null],
      );

      if (!accessAllSites) {
        for (const siteId of siteIds) {
          await client.query(
            `INSERT INTO organization_member_sites(organization_id,user_id,site_id)
             VALUES($1,$2,$3)`,
            [organizationId, user.rows[0].id, siteId],
          );
        }
      }
    }

    await client.query("COMMIT");
    return response(request, 201, { message: "Usuario creado correctamente." }, "?created=1");
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") {
      return response(request, 409, { fields: { email: "Ya existe una cuenta con este correo electrónico." } }, "?error=email");
    }
    throw error;
  } finally {
    client.release();
  }
}
