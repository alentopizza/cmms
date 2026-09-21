import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/passwords";
import { pool } from "@/lib/db";
import { isPlatformOwner, type OrganizationRole, type PlatformRole } from "@/lib/permissions";
import { gateFor, getSetupState } from "@/lib/setup-sequence";
import { forceDeleteRecord } from "@/lib/platform-owner-purge";

const ROLES = new Set<OrganizationRole>(["admin","manager","technician","requester","viewer","provider","external"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^\S+@\S+\.\S+$/;

type FieldErrors = Record<string, string>;

function json(status: number, payload: { message?: string; fields?: FieldErrors }) {
  return NextResponse.json(payload, { status });
}

async function hasActivity(client: import("pg").PoolClient, userId: string) {
  const result = await client.query<{ has_activity: boolean }>(
    `SELECT (
      EXISTS(SELECT 1 FROM work_orders WHERE requested_by=$1 OR assigned_to=$1)
      OR EXISTS(SELECT 1 FROM meter_readings WHERE recorded_by=$1)
      OR EXISTS(SELECT 1 FROM work_order_comments WHERE user_id=$1)
      OR EXISTS(SELECT 1 FROM audit_log WHERE user_id=$1)
      OR EXISTS(SELECT 1 FROM work_order_tasks WHERE assigned_to=$1)
      OR EXISTS(SELECT 1 FROM crew_members WHERE user_id=$1)
      OR EXISTS(SELECT 1 FROM attendance_shifts WHERE user_id=$1)
      OR EXISTS(SELECT 1 FROM activity_execution_events WHERE user_id=$1)
    ) has_activity`,
    [userId],
  );
  return result.rows[0]?.has_activity ?? false;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (session.platformRole === "user") return new NextResponse("Forbidden", { status: 403 });

  const { id } = await params;
  if (!UUID.test(id)) return json(400, { message: "Usuario inválido." });
  if (session.userId && session.userId === id) return json(409, { message: "No puedes modificar o eliminar tu propia cuenta desde esta pantalla." });

  const form = await request.formData();
  const intent = String(form.get("intent") || "update");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query<{
      id: string;
      platform_role: PlatformRole;
      organization_id: string | null;
      role: OrganizationRole | null;
      site_id: string | null;
      active: boolean;
      external_supplier_id: string | null;
    }>(
      `SELECT u.id,u.platform_role,om.organization_id,om.role,om.site_id,u.active,om.external_supplier_id
       FROM users u
       LEFT JOIN organization_members om ON om.user_id=u.id
       WHERE u.id=$1
       LIMIT 1`,
      [id],
    );

    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return json(404, { message: "Usuario no encontrado." });
    }

    const target = existing.rows[0];
    if (target.platform_role === "platform_owner") {
      await client.query("ROLLBACK");
      return json(403, { message: "La cuenta Propietario Desweb está protegida y no se modifica desde el directorio de usuarios." });
    }
    if (session.platformRole === "superadmin" && target.platform_role !== "user") {
      await client.query("ROLLBACK");
      return json(403, { message: "Un Superadministrador no puede modificar otras cuentas de plataforma." });
    }

    if (intent === "activate" || intent === "deactivate") {
      await client.query("UPDATE users SET active=$1,updated_at=now() WHERE id=$2", [intent === "activate", id]);
      await client.query("COMMIT");
      return json(200, { message: intent === "activate" ? "Usuario reactivado." : "Usuario desactivado." });
    }

    if (intent === "delete") {
      if (!isPlatformOwner(session)) {
        await client.query("ROLLBACK");
        return json(403, { message: "Solo el Propietario Desweb puede eliminar usuarios definitivamente." });
      }
      if (isPlatformOwner(session)) {
        const result = await forceDeleteRecord(client, "users", id, {
          userId: session.userId,
          email: session.email,
        });
        await client.query("COMMIT");
        return json(200, { message: "Usuario y dependencias eliminados por Propietario Desweb (" + result.deletedRows + " filas)." });
      }

      if (await hasActivity(client, id)) {
        await client.query("ROLLBACK");
        return json(409, { message: "Este usuario tiene movimientos registrados. Por trazabilidad no puede eliminarse; desactívalo para conservar su historial." });
      }

      await client.query("DELETE FROM users WHERE id=$1", [id]);
      await client.query("COMMIT");
      return json(200, { message: "Usuario eliminado definitivamente." });
    }

    const fullName = String(form.get("full_name") || "").trim();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const phone = String(form.get("phone") || "").trim();
    const password = String(form.get("password") || "");
    const requestedRole = String(form.get("role") || "");
    const externalSupplierId = String(form.get("external_supplier_id") || "");
    const organizationId = String(form.get("organization_id") || "");
    let accessAllSites = String(form.get("access_all_sites") || "true") === "true";
    let siteIds = [...new Set(form.getAll("site_ids").map(value => String(value)).filter(Boolean))];
    const makingSuperadmin = requestedRole === "superadmin";
    const fields: FieldErrors = {};

    if (makingSuperadmin && !isPlatformOwner(session)) {
      fields.role = "Solo el Propietario Desweb puede crear o asignar Superadministradores.";
    }

    if (!fullName) fields.full_name = "Ingresa el nombre completo.";
    if (!email) fields.email = "Ingresa el correo electrónico.";
    else if (!EMAIL.test(email)) fields.email = "Ingresa un correo válido.";
    if (password && password.length < 8) fields.password = "La nueva contraseña debe tener al menos 8 caracteres.";

    if (!makingSuperadmin) {
      if (!UUID.test(organizationId)) fields.organization_id = "Selecciona una empresa.";
      if (!ROLES.has(requestedRole as OrganizationRole)) fields.role = "Selecciona un rol válido.";
      if (requestedRole === "provider" && !UUID.test(externalSupplierId)) fields.external_supplier_id = "Selecciona el proveedor de servicios al que representa.";
      if (requestedRole === "external" && externalSupplierId && !UUID.test(externalSupplierId)) fields.external_supplier_id = "El proveedor seleccionado no es válido.";
      if (!accessAllSites && siteIds.length === 0) fields.site_ids = "Selecciona al menos una sede o habilita el acceso a todas.";
      if (siteIds.some(siteId => !UUID.test(siteId))) fields.site_ids = "Una de las sedes seleccionadas no es válida.";
    } else {
      accessAllSites = true;
      siteIds = [];
    }

    if (Object.keys(fields).length) {
      await client.query("ROLLBACK");
      return json(422, { message: "Completa los campos marcados.", fields });
    }

    const duplicate = await client.query("SELECT 1 FROM users WHERE lower(email)=lower($1) AND id<>$2", [email, id]);
    if (duplicate.rowCount) {
      await client.query("ROLLBACK");
      return json(409, { fields: { email: "Ya existe otra cuenta con este correo electrónico." } });
    }

    const activity = await hasActivity(client, id);
    const current = existing.rows[0];
    const scopeChanged =
      (current.platform_role === "superadmin") !== makingSuperadmin
      || (!makingSuperadmin && current.organization_id !== organizationId);

    if (activity && scopeChanged) {
      await client.query("ROLLBACK");
      return json(409, {
        fields: {
          organization_id: "El usuario tiene movimientos registrados y no puede trasladarse a otra empresa ni cambiar entre acceso global y acceso de empresa.",
          role: "Puedes modificar su rol dentro de la empresa actual, pero no cambiar su alcance histórico.",
        },
      });
    }

    if (!makingSuperadmin) {
      const organization = await client.query("SELECT 1 FROM organizations WHERE id=$1 AND active=true", [organizationId]);
      if (!organization.rowCount) {
        await client.query("ROLLBACK");
        return json(422, { fields: { organization_id: "La empresa seleccionada no está disponible." } });
      }

      if (!accessAllSites) {
        const validSites = await client.query<{ id: string }>(
          "SELECT id::text id FROM sites WHERE organization_id=$1 AND active=true AND id = ANY($2::uuid[])",
          [organizationId, siteIds],
        );
        if (validSites.rowCount !== siteIds.length) {
          await client.query("ROLLBACK");
          return json(422, { fields: { site_ids: "Todas las sedes seleccionadas deben pertenecer a la empresa y estar activas." } });
        }
      }

      if (requestedRole === "technician" || requestedRole === "external" || requestedRole === "provider") {
        const setupGate = gateFor(await getSetupState(organizationId, client), requestedRole === "provider" ? "provider" : "workforce");
        if (!setupGate.ready) {
          await client.query("ROLLBACK");
          return json(409, { fields: { role: setupGate.message, ...(requestedRole === "provider" ? { external_supplier_id: setupGate.message } : {}) } });
        }
      }

      if ((requestedRole === "provider" || requestedRole === "external") && externalSupplierId) {
        const supplier = await client.query(
          "SELECT 1 FROM suppliers WHERE id=$1 AND organization_id=$2 AND active=true AND supplier_type IN ('services','both')",
          [externalSupplierId, organizationId],
        );
        if (!supplier.rowCount) {
          await client.query("ROLLBACK");
          return json(422, { fields: { external_supplier_id: "El proveedor debe pertenecer a la empresa y prestar servicios." } });
        }
      }

      if (requestedRole === "technician" && (current.role !== "technician" || current.organization_id !== organizationId)) {
        const quota = await client.query<{ used: number; allowed: number }>(
          `SELECT (SELECT count(*)::int FROM organization_members WHERE organization_id=$1 AND role='technician') used,
                  COALESCE((SELECT max_technicians FROM organization_limits WHERE organization_id=$1),50)::int allowed`,
          [organizationId],
        );
        if (quota.rows[0].used >= quota.rows[0].allowed) {
          await client.query("ROLLBACK");
          return json(409, { fields: { role: "La empresa alcanzó el límite de técnicos asignado." } });
        }
      }
    }

    await client.query(
      `UPDATE users SET full_name=$1,email=$2,phone=$3,platform_role=$4,updated_at=now() WHERE id=$5`,
      [fullName, email, phone || null, makingSuperadmin ? "superadmin" : "user", id],
    );

    if (password) {
      const { salt, hash } = hashPassword(password);
      await client.query("UPDATE users SET password_hash=$1,password_salt=$2,updated_at=now() WHERE id=$3", [hash, salt, id]);
    }

    if (makingSuperadmin) {
      await client.query("DELETE FROM organization_members WHERE user_id=$1", [id]);
    } else {
      await client.query(
        `INSERT INTO organization_members(organization_id,user_id,role,site_id,access_all_sites,external_supplier_id)
         VALUES($1,$2,$3,NULL,$4,$5)
         ON CONFLICT(organization_id,user_id)
         DO UPDATE SET role=EXCLUDED.role,site_id=NULL,access_all_sites=EXCLUDED.access_all_sites,external_supplier_id=EXCLUDED.external_supplier_id`,
        [organizationId, id, requestedRole, accessAllSites, (requestedRole === "provider" || requestedRole === "external") && externalSupplierId ? externalSupplierId : null],
      );

      if (current.organization_id && current.organization_id !== organizationId) {
        await client.query("DELETE FROM organization_members WHERE user_id=$1 AND organization_id<>$2", [id, organizationId]);
      }

      await client.query(
        "DELETE FROM organization_member_sites WHERE organization_id=$1 AND user_id=$2",
        [organizationId, id],
      );

      if (!accessAllSites) {
        for (const siteId of siteIds) {
          await client.query(
            `INSERT INTO organization_member_sites(organization_id,user_id,site_id)
             VALUES($1,$2,$3)`,
            [organizationId, id, siteId],
          );
        }
      }
    }

    await client.query("COMMIT");
    return json(200, { message: "Usuario actualizado correctamente." });
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") {
      return json(409, { fields: { email: "Ya existe otra cuenta con este correo electrónico." } });
    }
    throw error;
  } finally {
    client.release();
  }
}
