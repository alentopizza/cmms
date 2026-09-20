import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can, type OrganizationRole } from "@/lib/permissions";
import { hashPassword } from "@/lib/passwords";
import { pool } from "@/lib/db";
import { publicUrl } from "@/lib/urls";

const ROLES = new Set<OrganizationRole>(["owner","admin","manager","technician","requester","viewer"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function target(requestUrl: string, suffix: string) {
  return NextResponse.redirect(publicUrl(`/dashboard/users${suffix}`, requestUrl), 303);
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
  let organizationId = String(form.get("organization_id") || "");
  const siteId = String(form.get("site_id") || "");

  const creatingSuperadmin = requestedRole === "superadmin";
  if (!fullName || !email || password.length < 8) return target(request.url, "?error=required");

  if (session.platformRole !== "superadmin") {
    organizationId = session.organizationId || "";
    if (creatingSuperadmin) return new NextResponse("Forbidden", { status: 403 });
  }

  if (!creatingSuperadmin && (!UUID.test(organizationId) || !ROLES.has(requestedRole as OrganizationRole))) {
    return target(request.url, "?error=required");
  }
  if (siteId && !UUID.test(siteId)) return target(request.url, "?error=required");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (!creatingSuperadmin) {
      const organization = await client.query("SELECT 1 FROM organizations WHERE id=$1 AND active=true", [organizationId]);
      if (!organization.rowCount) {
        await client.query("ROLLBACK");
        return target(request.url, "?error=required");
      }

      if (siteId) {
        const site = await client.query("SELECT 1 FROM sites WHERE id=$1 AND organization_id=$2 AND active=true", [siteId, organizationId]);
        if (!site.rowCount) {
          await client.query("ROLLBACK");
          return target(request.url, "?error=required");
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
          return target(request.url, "?error=technician-limit");
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
        `INSERT INTO organization_members(organization_id,user_id,role,site_id)
         VALUES($1,$2,$3,$4)`,
        [organizationId, user.rows[0].id, requestedRole, siteId || null],
      );
    }

    await client.query("COMMIT");
    return target(request.url, "?created=1");
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") return target(request.url, "?error=email");
    throw error;
  } finally {
    client.release();
  }
}
