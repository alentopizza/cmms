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
    <h1 className="page-title">Resumen operativo</h1><p className="muted">Estado general de mantenimiento de todas las empresas.</p>
    <section className="grid section">
      <div className="card"><span className="muted">Empresas</span><div className="metric">{orgs.rows[0].count}</div></div>
      <div className="card"><span className="muted">Equipos activos</span><div className="metric">{assets.rows[0].count}</div></div>
      <div className="card"><span className="muted">OT abiertas</span><div className="metric">{open.rows[0].count}</div></div>
      <div className="card"><span className="muted">Equipos detenidos</span><div className="metric">{down.rows[0].count}</div></div>
    </section>
    <section className="card section"><h2>Próximos preventivos</h2><p><strong>{due.rows[0].count}</strong> planes vencidos o programados para los próximos 7 días.</p></section>
  </>;
}
