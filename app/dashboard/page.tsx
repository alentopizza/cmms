import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  const superadmin = session.platformRole === "superadmin";
  const orgId = session.organizationId;
  const requesterFilter = session.role === "requester" && session.userId ? session.userId : null;

  const [orgs, assets, open, down, due] = await Promise.all([
    superadmin
      ? query<{count:string}>("SELECT count(*)::text count FROM organizations WHERE active=true")
      : query<{count:string}>("SELECT count(*)::text count FROM organizations WHERE id=$1 AND active=true", [orgId]),
    can(session, "assets.read")
      ? (superadmin
          ? query<{count:string}>("SELECT count(*)::text count FROM assets WHERE status <> 'retired'")
          : session.accessAllSites
            ? query<{count:string}>("SELECT count(*)::text count FROM assets WHERE organization_id=$1 AND status <> 'retired'", [orgId])
            : query<{count:string}>("SELECT count(*)::text count FROM assets WHERE organization_id=$1 AND site_id = ANY($2::uuid[]) AND status <> 'retired'", [orgId, session.siteIds]))
      : Promise.resolve({ rows: [{ count: "0" }] } as { rows: {count:string}[] }),
    can(session, "work_orders.read")
      ? (superadmin
          ? query<{count:string}>("SELECT count(*)::text count FROM work_orders WHERE status IN ('open','assigned','in_progress','paused')")
          : requesterFilter
            ? (session.accessAllSites
                ? query<{count:string}>("SELECT count(*)::text count FROM work_orders WHERE organization_id=$1 AND requested_by=$2 AND status IN ('open','assigned','in_progress','paused')", [orgId, requesterFilter])
                : query<{count:string}>("SELECT count(*)::text count FROM work_orders WHERE organization_id=$1 AND requested_by=$2 AND site_id = ANY($3::uuid[]) AND status IN ('open','assigned','in_progress','paused')", [orgId, requesterFilter, session.siteIds]))
            : (session.accessAllSites
                ? query<{count:string}>("SELECT count(*)::text count FROM work_orders WHERE organization_id=$1 AND status IN ('open','assigned','in_progress','paused')", [orgId])
                : query<{count:string}>("SELECT count(*)::text count FROM work_orders WHERE organization_id=$1 AND site_id = ANY($2::uuid[]) AND status IN ('open','assigned','in_progress','paused')", [orgId, session.siteIds])))
      : Promise.resolve({ rows: [{ count: "0" }] } as { rows: {count:string}[] }),
    can(session, "assets.read")
      ? (superadmin
          ? query<{count:string}>("SELECT count(*)::text count FROM assets WHERE status='down'")
          : session.accessAllSites
            ? query<{count:string}>("SELECT count(*)::text count FROM assets WHERE organization_id=$1 AND status='down'", [orgId])
            : query<{count:string}>("SELECT count(*)::text count FROM assets WHERE organization_id=$1 AND site_id = ANY($2::uuid[]) AND status='down'", [orgId, session.siteIds]))
      : Promise.resolve({ rows: [{ count: "0" }] } as { rows: {count:string}[] }),
    can(session, "maintenance.read")
      ? (superadmin
          ? query<{count:string}>("SELECT count(*)::text count FROM maintenance_plans WHERE active=true AND next_due_at IS NOT NULL AND next_due_at <= now() + interval '7 days'")
          : session.accessAllSites
            ? query<{count:string}>("SELECT count(*)::text count FROM maintenance_plans WHERE organization_id=$1 AND active=true AND next_due_at IS NOT NULL AND next_due_at <= now() + interval '7 days'", [orgId])
            : query<{count:string}>("SELECT count(*)::text count FROM maintenance_plans p JOIN assets a ON a.id=p.asset_id WHERE p.organization_id=$1 AND a.site_id = ANY($2::uuid[]) AND p.active=true AND p.next_due_at IS NOT NULL AND p.next_due_at <= now() + interval '7 days'", [orgId, session.siteIds]))
      : Promise.resolve({ rows: [{ count: "0" }] } as { rows: {count:string}[] }),
  ]);

  return <>
    <header className="page-header">
      <div>
        <span className="eyebrow">Visión general</span>
        <h1 className="page-title">Resumen operativo</h1>
        <p className="muted">{superadmin ? "Estado general del mantenimiento en todas las empresas y sedes." : `Información habilitada para ${session.organizationName}.`}</p>
      </div>
      <div className="brand-pill"><span /> Sesión por rol</div>
    </header>

    <section className="grid section metric-grid">
      <div className="card metric-card"><div className="metric-icon">E</div><div><span className="muted">{superadmin ? "Empresas activas" : "Empresa activa"}</span><div className="metric">{orgs.rows[0].count}</div></div></div>
      <div className="card metric-card"><div className="metric-icon">A</div><div><span className="muted">Equipos visibles</span><div className="metric">{assets.rows[0].count}</div></div></div>
      <div className="card metric-card"><div className="metric-icon">OT</div><div><span className="muted">{requesterFilter ? "Mis OT abiertas" : "OT abiertas"}</span><div className="metric">{open.rows[0].count}</div></div></div>
      <div className="card metric-card metric-card-alert"><div className="metric-icon">!</div><div><span className="muted">Equipos detenidos</span><div className="metric">{down.rows[0].count}</div></div></div>
    </section>

    {can(session, "maintenance.read") && <section className="dashboard-two-column section">
      <div className="card preventive-summary">
        <div><span className="eyebrow">Planificación</span><h2>Próximos preventivos</h2><p className="muted">Planes vencidos o programados para los próximos 7 días.</p></div>
        <div className="preventive-count"><span>{due.rows[0].count}</span></div>
      </div>
      <div className="card dashboard-brand-card">
        <span>DESWEB CMMS</span><strong>Mantenimiento con información clara y trazable.</strong><p>El acceso y los datos mostrados dependen de la empresa y del rol asignado a la cuenta.</p>
      </div>
    </section>}
  </>;
}
