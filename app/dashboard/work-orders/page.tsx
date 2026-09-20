import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";

export default async function WorkOrdersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session, "work_orders.read")) redirect("/dashboard");

  const superadmin = session.platformRole === "superadmin";
  const orgId = session.organizationId;
  const canWrite = can(session, "work_orders.write");
  const requesterOnly = session.role === "requester" && session.userId;

  const [orders, assets] = await Promise.all([
    superadmin
      ? query<{id:string;number:string;title:string;asset:string;company:string;priority:string;status:string;requested_at:string}>(
          `SELECT w.id,w.number::text,w.title,coalesce(a.name,'Sin equipo') asset,o.name company,w.priority,w.status,w.requested_at::text
           FROM work_orders w JOIN organizations o ON o.id=w.organization_id LEFT JOIN assets a ON a.id=w.asset_id ORDER BY w.requested_at DESC LIMIT 200`)
      : requesterOnly
        ? query<{id:string;number:string;title:string;asset:string;company:string;priority:string;status:string;requested_at:string}>(
            `SELECT w.id,w.number::text,w.title,coalesce(a.name,'Sin equipo') asset,o.name company,w.priority,w.status,w.requested_at::text
             FROM work_orders w JOIN organizations o ON o.id=w.organization_id LEFT JOIN assets a ON a.id=w.asset_id
             WHERE w.organization_id=$1 AND w.requested_by=$2 ORDER BY w.requested_at DESC LIMIT 200`, [orgId, session.userId])
        : query<{id:string;number:string;title:string;asset:string;company:string;priority:string;status:string;requested_at:string}>(
            `SELECT w.id,w.number::text,w.title,coalesce(a.name,'Sin equipo') asset,o.name company,w.priority,w.status,w.requested_at::text
             FROM work_orders w JOIN organizations o ON o.id=w.organization_id LEFT JOIN assets a ON a.id=w.asset_id
             WHERE w.organization_id=$1 ORDER BY w.requested_at DESC LIMIT 200`, [orgId]),
    canWrite
      ? (superadmin
          ? query<{id:string;label:string}>(`SELECT a.id,o.name || ' · ' || s.name || ' · ' || a.code || ' ' || a.name label FROM assets a JOIN organizations o ON o.id=a.organization_id JOIN sites s ON s.id=a.site_id WHERE a.status <> 'retired' ORDER BY o.name,a.name`)
          : query<{id:string;label:string}>(`SELECT a.id,s.name || ' · ' || a.code || ' ' || a.name label FROM assets a JOIN sites s ON s.id=a.site_id WHERE a.organization_id=$1 AND a.status <> 'retired' ORDER BY a.name`, [orgId]))
      : Promise.resolve({ rows: [] } as { rows: {id:string;label:string}[] }),
  ]);

  return <>
    <h1 className="page-title">Órdenes de trabajo</h1><p className="muted">{requesterOnly ? "Consulta y registra tus solicitudes de mantenimiento." : "Correctivos, preventivos, inspecciones y emergencias."}</p>
    {canWrite && <section className="card section"><h2>{requesterOnly ? "Nueva solicitud" : "Nueva orden"}</h2>
      <form className="form-grid" method="post" action="/api/work-orders">
        <div className="field"><label>Equipo</label><select name="asset_id" required>{assets.rows.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select></div>
        <div className="field"><label>Título</label><input name="title" required placeholder="Revisar temperatura irregular" /></div>
        {!requesterOnly && <><div className="field"><label>Tipo</label><select name="type"><option value="corrective">Correctivo</option><option value="preventive">Preventivo</option><option value="inspection">Inspección</option><option value="emergency">Emergencia</option><option value="improvement">Mejora</option></select></div>
        <div className="field"><label>Prioridad</label><select name="priority"><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></div></>}
        <div><button className="button" type="submit">{requesterOnly ? "Enviar solicitud" : "Crear orden"}</button></div>
      </form>
    </section>}
    <section className="section"><table className="table"><thead><tr><th>OT</th><th>Trabajo</th><th>Empresa</th><th>Equipo</th><th>Prioridad</th><th>Estado</th></tr></thead>
    <tbody>{orders.rows.map(w=><tr key={w.id}><td>#{w.number}</td><td><strong>{w.title}</strong></td><td>{w.company}</td><td>{w.asset}</td><td>{w.priority}</td><td><span className="status">{w.status}</span></td></tr>)}</tbody></table></section>
  </>;
}
