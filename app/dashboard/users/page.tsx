import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, type OrganizationRole } from "@/lib/permissions";
import { query } from "@/lib/db";
import UserManagement, { type ManagedUser } from "./UserManagement";

type Organization = { id: string; name: string };
type Site = { id: string; organization_id: string; name: string; organization_name: string };

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session, "users.manage")) redirect("/dashboard");

  const isSuperadmin = session.platformRole === "superadmin";

  const [users, organizations, sites] = await Promise.all([
    isSuperadmin
      ? query<ManagedUser>(
          `SELECT u.id,u.email,u.full_name,u.phone,u.active,u.platform_role,u.last_login_at::text,
                  membership.organization_id,membership.organization_name,membership.role,membership.access_all_sites,membership.site_ids,membership.site_names,
                  (
                    EXISTS(SELECT 1 FROM work_orders w WHERE w.requested_by=u.id OR w.assigned_to=u.id)
                    OR EXISTS(SELECT 1 FROM meter_readings mr WHERE mr.recorded_by=u.id)
                    OR EXISTS(SELECT 1 FROM work_order_comments wc WHERE wc.user_id=u.id)
                    OR EXISTS(SELECT 1 FROM audit_log al WHERE al.user_id=u.id)
                  ) has_activity
           FROM users u
           LEFT JOIN LATERAL (
             SELECT om.organization_id,o.name organization_name,om.role,om.access_all_sites,
                    COALESCE((
                      SELECT array_agg(oms.site_id::text ORDER BY site.name)
                      FROM organization_member_sites oms
                      JOIN sites site ON site.id=oms.site_id
                      WHERE oms.organization_id=om.organization_id AND oms.user_id=om.user_id
                    ), ARRAY[]::text[]) site_ids,
                    COALESCE((
                      SELECT array_agg(site.name ORDER BY site.name)
                      FROM organization_member_sites oms
                      JOIN sites site ON site.id=oms.site_id
                      WHERE oms.organization_id=om.organization_id AND oms.user_id=om.user_id
                    ), ARRAY[]::text[]) site_names
             FROM organization_members om
             JOIN organizations o ON o.id=om.organization_id
             WHERE om.user_id=u.id
             ORDER BY om.created_at ASC
             LIMIT 1
           ) membership ON true
           ORDER BY u.active DESC,u.full_name`,
        )
      : query<ManagedUser>(
          `SELECT u.id,u.email,u.full_name,u.phone,u.active,u.platform_role,u.last_login_at::text,
                  om.organization_id,o.name organization_name,om.role,om.access_all_sites,
                  COALESCE((
                    SELECT array_agg(oms.site_id::text ORDER BY site.name)
                    FROM organization_member_sites oms
                    JOIN sites site ON site.id=oms.site_id
                    WHERE oms.organization_id=om.organization_id AND oms.user_id=om.user_id
                  ), ARRAY[]::text[]) site_ids,
                  COALESCE((
                    SELECT array_agg(site.name ORDER BY site.name)
                    FROM organization_member_sites oms
                    JOIN sites site ON site.id=oms.site_id
                    WHERE oms.organization_id=om.organization_id AND oms.user_id=om.user_id
                  ), ARRAY[]::text[]) site_names,
                  (
                    EXISTS(SELECT 1 FROM work_orders w WHERE w.requested_by=u.id OR w.assigned_to=u.id)
                    OR EXISTS(SELECT 1 FROM meter_readings mr WHERE mr.recorded_by=u.id)
                    OR EXISTS(SELECT 1 FROM work_order_comments wc WHERE wc.user_id=u.id)
                    OR EXISTS(SELECT 1 FROM audit_log al WHERE al.user_id=u.id)
                  ) has_activity
           FROM organization_members om
           JOIN users u ON u.id=om.user_id
           JOIN organizations o ON o.id=om.organization_id
           WHERE om.organization_id=$1
           ORDER BY u.active DESC,u.full_name`,
          [session.organizationId],
        ),
    isSuperadmin
      ? query<Organization>("SELECT id,name FROM organizations WHERE active=true ORDER BY name")
      : query<Organization>("SELECT id,name FROM organizations WHERE id=$1", [session.organizationId]),
    isSuperadmin
      ? query<Site>(
          `SELECT s.id,s.organization_id,s.name,o.name organization_name
           FROM sites s JOIN organizations o ON o.id=s.organization_id
           WHERE s.active=true AND o.active=true ORDER BY o.name,s.name`,
        )
      : query<Site>(
          `SELECT s.id,s.organization_id,s.name,o.name organization_name
           FROM sites s JOIN organizations o ON o.id=s.organization_id
           WHERE s.active=true AND s.organization_id=$1 ORDER BY s.name`,
          [session.organizationId],
        ),
  ]);

  return <>
    <header className="page-header users-page-header">
      <div>
        <span className="eyebrow">Control de acceso</span>
        <h1 className="page-title">Usuarios y roles</h1>
        <p className="muted">Administra cuentas, roles y alcance operativo sin perder la trazabilidad de las acciones realizadas.</p>
      </div>
      <div className="brand-pill"><span /> {users.rowCount} cuentas</div>
    </header>

    <UserManagement
      users={users.rows}
      organizations={organizations.rows}
      sites={sites.rows}
      isSuperadmin={isSuperadmin}
      fixedOrganizationId={session.organizationId}
      currentUserId={session.userId}
    />
  </>;
}
