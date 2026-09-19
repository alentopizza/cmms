import { query } from "@/lib/db";

export default async function Dashboard() {
  const [orgs, assets, open, down, due] = await Promise.all([
    query<{count:string}>("SELECT count(*)::text count FROM organizations WHERE active=true"),
    query<{count:string}>("SELECT count(*)::text count FROM assets WHERE status <> 'retired'"),
    query<{count:string}>("SELECT count(*)::text count FROM work_orders WHERE status IN ('open','assigned','in_progress','paused')"),
    query<{count:string}>("SELECT count(*)::text count FROM assets WHERE status='down'"),
    query<{count:string}>("SELECT count(*)::text count FROM maintenance_plans WHERE active=true AND next_due_at IS NOT NULL AND next_due_at <= now() + interval '7 days'"),
  ]);

  return <>
    <header className="page-header">
      <div>
        <span className="eyebrow">Visión general</span>
        <h1 className="page-title">Resumen operativo</h1>
        <p className="muted">Estado general del mantenimiento en todas las empresas y sedes.</p>
      </div>
      <div className="brand-pill"><span /> Sistema operativo</div>
    </header>

    <section className="grid section metric-grid">
      <div className="card metric-card"><div className="metric-icon">E</div><div><span className="muted">Empresas activas</span><div className="metric">{orgs.rows[0].count}</div></div></div>
      <div className="card metric-card"><div className="metric-icon">A</div><div><span className="muted">Equipos activos</span><div className="metric">{assets.rows[0].count}</div></div></div>
      <div className="card metric-card"><div className="metric-icon">OT</div><div><span className="muted">OT abiertas</span><div className="metric">{open.rows[0].count}</div></div></div>
      <div className="card metric-card metric-card-alert"><div className="metric-icon">!</div><div><span className="muted">Equipos detenidos</span><div className="metric">{down.rows[0].count}</div></div></div>
    </section>

    <section className="dashboard-two-column section">
      <div className="card preventive-summary">
        <div>
          <span className="eyebrow">Planificación</span>
          <h2>Próximos preventivos</h2>
          <p className="muted">Planes vencidos o programados para los próximos 7 días.</p>
        </div>
        <div className="preventive-count"><span>{due.rows[0].count}</span></div>
      </div>

      <div className="card dashboard-brand-card">
        <span>DESWEB CMMS</span>
        <strong>Mantenimiento con información clara y trazable.</strong>
        <p>La plataforma irá consolidando disponibilidad, costos, tiempos de parada, MTTR, MTBF y cumplimiento preventivo.</p>
      </div>
    </section>
  </>;
}
