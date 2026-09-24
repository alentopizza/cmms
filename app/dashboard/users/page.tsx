import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, isPlatformOperator, isPlatformOwner, type OrganizationRole } from "@/lib/permissions";
import { query } from "@/lib/db";
import UserManagement, { type ManagedUser } from "./UserManagement";

type Organization = { id: string; name: string; country: string };
type Site = { id: string; organization_id: string; name: string; organization_name: string };
type ServiceSupplier = { id: string; organization_id: string; name: string };

// ── Authorized user directory data and related scope options ────────────────

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session, "users.manage")) redirect("/dashboard");

  const isGlobalOperator = isPlatformOperator(session);
  const ownerAccess = isPlatformOwner(session);

  const [users, organizations, sites, serviceSuppliers] = await Promise.all([
    isGlobalOperator
      ? query<ManagedUser>(
          `SELECT u.id,u.email,u.full_name,u.phone,u.country_code,u.identity_document_type,u.identity_document_number,u.preferred_locale,u.active,u.platform_role,u.last_login_at::text,
                  (u.avatar_data IS NOT NULL) has_avatar,
                  CASE
                    WHEN bp.revoked_at IS NOT NULL THEN 'revoked'
                    WHEN bp.enrollment_method='supervised_camera' AND bp.identity_verified_at IS NOT NULL AND bp.encrypted_embedding IS NOT NULL THEN 'verified'
                    WHEN bp.user_id IS NOT NULL THEN 'legacy'
                    ELSE 'missing'
                  END biometric_status,
                  (SELECT count(*)::int FROM work_orders w WHERE w.assigned_to=u.id AND w.status NOT IN ('completed','cancelled')) assigned_work_orders,
                  (SELECT count(*)::int FROM work_order_tasks wt WHERE wt.assigned_to=u.id AND wt.status IN ('pending','in_progress')) pending_activities,
                  (SELECT count(*)::int FROM activity_execution_events aee WHERE aee.user_id=u.id AND aee.event_type='completed' AND aee.occurred_at>=now()-interval '30 days') completed_activities_30d,
                  COALESCE((SELECT ROUND((SUM(EXTRACT(EPOCH FROM (COALESCE(ats.check_out_at,now())-ats.check_in_at)))/3600)::numeric,1)::float8
                            FROM attendance_shifts ats WHERE ats.user_id=u.id AND ats.check_in_at>=now()-interval '30 days'),0)::float8 attendance_hours_30d,
                  EXISTS(SELECT 1 FROM attendance_shifts ats WHERE ats.user_id=u.id AND ats.status='open') open_shift,
                  EXISTS(SELECT 1 FROM technician_tracking_sessions ts WHERE ts.user_id=u.id AND ts.status='active' AND ts.last_seen_at>now()-interval '2 minutes') tracking_live,
                  membership.organization_id,membership.organization_name,membership.role,membership.external_supplier_id,membership.external_supplier_name,
                  COALESCE(membership.access_all_sites,true) access_all_sites,
                  COALESCE(membership.site_ids,ARRAY[]::text[]) site_ids,
                  COALESCE(membership.site_names,ARRAY[]::text[]) site_names,
                  (
                    EXISTS(SELECT 1 FROM work_orders w WHERE w.requested_by=u.id OR w.assigned_to=u.id)
                    OR EXISTS(SELECT 1 FROM meter_readings mr WHERE mr.recorded_by=u.id)
                    OR EXISTS(SELECT 1 FROM work_order_comments wc WHERE wc.user_id=u.id)
                    OR EXISTS(SELECT 1 FROM audit_log al WHERE al.user_id=u.id)
                    OR EXISTS(SELECT 1 FROM work_order_tasks wt WHERE wt.assigned_to=u.id)
                    OR EXISTS(SELECT 1 FROM crew_members cm WHERE cm.user_id=u.id)
                    OR EXISTS(SELECT 1 FROM attendance_shifts ats WHERE ats.user_id=u.id)
                    OR EXISTS(SELECT 1 FROM activity_execution_events aee WHERE aee.user_id=u.id)
                  ) has_activity
           FROM users u
           LEFT JOIN LATERAL (
             SELECT om.organization_id,o.name organization_name,om.role,om.access_all_sites,om.external_supplier_id,supplier.name external_supplier_name,
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
             LEFT JOIN suppliers supplier ON supplier.id=om.external_supplier_id
             WHERE om.user_id=u.id
             ORDER BY om.created_at ASC
             LIMIT 1
           ) membership ON true
           LEFT JOIN user_biometric_profiles bp ON bp.user_id=u.id AND bp.organization_id=membership.organization_id
           ORDER BY u.active DESC,u.full_name`,
        )
      : query<ManagedUser>(
          `SELECT u.id,u.email,u.full_name,u.phone,u.country_code,u.identity_document_type,u.identity_document_number,u.preferred_locale,u.active,u.platform_role,u.last_login_at::text,
                  (u.avatar_data IS NOT NULL) has_avatar,
                  CASE
                    WHEN bp.revoked_at IS NOT NULL THEN 'revoked'
                    WHEN bp.enrollment_method='supervised_camera' AND bp.identity_verified_at IS NOT NULL AND bp.encrypted_embedding IS NOT NULL THEN 'verified'
                    WHEN bp.user_id IS NOT NULL THEN 'legacy'
                    ELSE 'missing'
                  END biometric_status,
                  (SELECT count(*)::int FROM work_orders w WHERE w.assigned_to=u.id AND w.status NOT IN ('completed','cancelled')) assigned_work_orders,
                  (SELECT count(*)::int FROM work_order_tasks wt WHERE wt.assigned_to=u.id AND wt.status IN ('pending','in_progress')) pending_activities,
                  (SELECT count(*)::int FROM activity_execution_events aee WHERE aee.user_id=u.id AND aee.event_type='completed' AND aee.occurred_at>=now()-interval '30 days') completed_activities_30d,
                  COALESCE((SELECT ROUND((SUM(EXTRACT(EPOCH FROM (COALESCE(ats.check_out_at,now())-ats.check_in_at)))/3600)::numeric,1)::float8
                            FROM attendance_shifts ats WHERE ats.user_id=u.id AND ats.check_in_at>=now()-interval '30 days'),0)::float8 attendance_hours_30d,
                  EXISTS(SELECT 1 FROM attendance_shifts ats WHERE ats.user_id=u.id AND ats.status='open') open_shift,
                  EXISTS(SELECT 1 FROM technician_tracking_sessions ts WHERE ts.user_id=u.id AND ts.status='active' AND ts.last_seen_at>now()-interval '2 minutes') tracking_live,
                  om.organization_id,o.name organization_name,om.role,om.access_all_sites,om.external_supplier_id,supplier.name external_supplier_name,
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
                    OR EXISTS(SELECT 1 FROM work_order_tasks wt WHERE wt.assigned_to=u.id)
                    OR EXISTS(SELECT 1 FROM crew_members cm WHERE cm.user_id=u.id)
                    OR EXISTS(SELECT 1 FROM attendance_shifts ats WHERE ats.user_id=u.id)
                    OR EXISTS(SELECT 1 FROM activity_execution_events aee WHERE aee.user_id=u.id)
                  ) has_activity
           FROM organization_members om
           JOIN users u ON u.id=om.user_id
           JOIN organizations o ON o.id=om.organization_id
           LEFT JOIN suppliers supplier ON supplier.id=om.external_supplier_id
           LEFT JOIN user_biometric_profiles bp ON bp.user_id=u.id AND bp.organization_id=om.organization_id
           WHERE om.organization_id=$1
           ORDER BY u.active DESC,u.full_name`,
          [session.organizationId],
        ),
    isGlobalOperator
      ? query<Organization>(`SELECT o.id,o.name,COALESCE(o.legal_country,(SELECT s.country FROM sites s WHERE s.organization_id=o.id ORDER BY s.created_at ASC LIMIT 1),'CO') country FROM organizations o WHERE o.active=true ORDER BY o.name`)
      : query<Organization>(`SELECT o.id,o.name,COALESCE(o.legal_country,(SELECT s.country FROM sites s WHERE s.organization_id=o.id ORDER BY s.created_at ASC LIMIT 1),'CO') country FROM organizations o WHERE o.id=$1`, [session.organizationId]),
    isGlobalOperator
      ? query<Site>(
          `SELECT s.id,s.organization_id,s.name,o.name organization_name
           FROM sites s JOIN organizations o ON o.id=s.organization_id
           WHERE s.active=true AND o.active=true ORDER BY o.name,s.name`,
        )
      : session.accessAllSites
        ? query<Site>(
            `SELECT s.id,s.organization_id,s.name,o.name organization_name
             FROM sites s JOIN organizations o ON o.id=s.organization_id
             WHERE s.active=true AND s.organization_id=$1 ORDER BY s.name`,
            [session.organizationId],
          )
        : query<Site>(
            `SELECT s.id,s.organization_id,s.name,o.name organization_name
             FROM sites s JOIN organizations o ON o.id=s.organization_id
             WHERE s.active=true AND s.organization_id=$1 AND s.id = ANY($2::uuid[])
             ORDER BY s.name`,
            [session.organizationId, session.siteIds],
          ),
    isGlobalOperator
      ? query<ServiceSupplier>(
          `SELECT id,organization_id,name
           FROM suppliers
           WHERE active=true AND supplier_type IN ('services','both')
           ORDER BY organization_id,name`,
        )
      : query<ServiceSupplier>(
          `SELECT id,organization_id,name
           FROM suppliers
           WHERE active=true AND supplier_type IN ('services','both') AND organization_id=$1
           ORDER BY name`,
          [session.organizationId],
        ),
  ]);

  return <>
    <UserManagement
      users={users.rows}
      organizations={organizations.rows}
      sites={sites.rows}
      isPlatformOperator={isGlobalOperator}
      isPlatformOwner={ownerAccess}
      fixedOrganizationId={session.organizationId}
      currentUserId={session.userId}
      serviceSuppliers={serviceSuppliers.rows}
    />
  </>;
}
