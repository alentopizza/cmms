import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";

type Lead = {
  id:string;
  full_name:string;
  company_name:string;
  email:string;
  phone:string|null;
  interest:string;
  message:string|null;
  status:"new"|"contacted"|"qualified"|"closed"|"discarded";
  created_at:string;
};

const INTEREST_LABELS:Record<string,string>={
  demo:"Demostración",
  trial:"Prueba 15 días",
  basic:"Plan Básico",
  medium:"Plan Medio",
  pro:"Plan Pro / marca blanca",
  self_hosted:"Self-hosted",
  other:"Otro",
};

export default async function LeadsPage() {
  const session=await getSession();
  if(!session) redirect("/login");
  if(!can(session,"leads.manage")) redirect("/dashboard");

  const leads=await query<Lead>(
    `SELECT id,full_name,company_name,email,phone,interest,message,status,created_at::text
     FROM sales_leads
     ORDER BY created_at DESC
     LIMIT 300`
  );

  const totals=await query<{status:string;count:string}>(
    `SELECT status,count(*)::text count
     FROM sales_leads GROUP BY status`
  );
  const byStatus=Object.fromEntries(totals.rows.map(row=>[row.status,row.count]));

  return <>
    <header className="page-header">
      <div>
        <span className="eyebrow">Comercial</span>
        <h1 className="page-title">Leads de la landing</h1>
        <p className="muted">Solicitudes registradas desde el formulario público para seguimiento por asesores.</p>
      </div>
      <div className="brand-pill"><span /> {leads.rowCount} registros</div>
    </header>

    <section className="grid section metric-grid leads-metrics">
      <div className="card metric-card"><div className="metric-icon">N</div><div><span className="muted">Nuevos</span><div className="metric">{byStatus.new || "0"}</div></div></div>
      <div className="card metric-card"><div className="metric-icon">C</div><div><span className="muted">Contactados</span><div className="metric">{byStatus.contacted || "0"}</div></div></div>
      <div className="card metric-card"><div className="metric-icon">Q</div><div><span className="muted">Calificados</span><div className="metric">{byStatus.qualified || "0"}</div></div></div>
      <div className="card metric-card"><div className="metric-icon">✓</div><div><span className="muted">Cerrados</span><div className="metric">{byStatus.closed || "0"}</div></div></div>
    </section>

    <section className="section leads-directory">
      {leads.rowCount===0 ? <div className="card empty-state"><span className="eyebrow">Sin oportunidades</span><h2>Aún no hay leads registrados</h2><p>Cuando alguien solicite contacto desde la landing aparecerá aquí.</p></div> :
        leads.rows.map(lead=><article className="card lead-card" key={lead.id}>
          <div className="lead-card-head">
            <div><strong>{lead.full_name}</strong><span>{lead.company_name}</span></div>
            <span className={`lead-status lead-status-${lead.status}`}>{lead.status}</span>
          </div>
          <div className="lead-card-info">
            <div><span>Interés</span><strong>{INTEREST_LABELS[lead.interest] || lead.interest}</strong></div>
            <div><span>Correo</span><a href={`mailto:${lead.email}`}>{lead.email}</a></div>
            <div><span>Teléfono</span><strong>{lead.phone || "No registrado"}</strong></div>
            <div><span>Fecha</span><strong>{new Date(lead.created_at).toLocaleString("es-CO")}</strong></div>
          </div>
          {lead.message && <p className="lead-message">{lead.message}</p>}
          <form className="lead-status-form" method="post" action={`/api/leads/${lead.id}/status`}>
            <label>Seguimiento
              <select name="status" defaultValue={lead.status}>
                <option value="new">Nuevo</option>
                <option value="contacted">Contactado</option>
                <option value="qualified">Calificado</option>
                <option value="closed">Cerrado</option>
                <option value="discarded">Descartado</option>
              </select>
            </label>
            <button className="button secondary" type="submit">Actualizar</button>
          </form>
        </article>)}
    </section>
  </>;
}
