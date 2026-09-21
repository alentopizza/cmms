import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { gateFor, getSetupState } from "@/lib/setup-sequence";

type Crew = {
  id:string;
  organization_id:string;
  organization_name:string;
  site_name:string|null;
  name:string;
  description:string|null;
  leader_name:string|null;
  member_count:number;
  active:boolean;
};

type Organization={id:string;name:string};
type Site={id:string;organization_id:string;name:string;organization_name:string};
type Worker={id:string;organization_id:string;full_name:string;role:string;supplier_name:string|null};

export default async function CrewsPage({searchParams}:{searchParams:Promise<{created?:string;error?:string}>}) {
  const session=await getSession();
  if(!session) redirect("/login");
  if(!can(session,"crews.manage")) redirect("/dashboard");
  const params=await searchParams;
  const superadmin=session.platformRole==="superadmin";

  const [crews,organizations,sites,workers]=await Promise.all([
    superadmin
      ? query<Crew>(
          `SELECT c.id,c.organization_id,o.name organization_name,s.name site_name,c.name,c.description,u.full_name leader_name,
                  (SELECT count(*)::int FROM crew_members cm WHERE cm.crew_id=c.id) member_count,c.active
           FROM crews c JOIN organizations o ON o.id=c.organization_id
           LEFT JOIN sites s ON s.id=c.site_id LEFT JOIN users u ON u.id=c.leader_user_id
           ORDER BY o.name,c.active DESC,c.name`)
      : query<Crew>(
          `SELECT c.id,c.organization_id,o.name organization_name,s.name site_name,c.name,c.description,u.full_name leader_name,
                  (SELECT count(*)::int FROM crew_members cm WHERE cm.crew_id=c.id) member_count,c.active
           FROM crews c JOIN organizations o ON o.id=c.organization_id
           LEFT JOIN sites s ON s.id=c.site_id LEFT JOIN users u ON u.id=c.leader_user_id
           WHERE c.organization_id=$1 ORDER BY c.active DESC,c.name`,[session.organizationId]),
    superadmin
      ? query<Organization>("SELECT id,name FROM organizations WHERE active=true ORDER BY name")
      : query<Organization>("SELECT id,name FROM organizations WHERE id=$1",[session.organizationId]),
    superadmin
      ? query<Site>(`SELECT s.id,s.organization_id,s.name,o.name organization_name FROM sites s JOIN organizations o ON o.id=s.organization_id WHERE s.active=true ORDER BY o.name,s.name`)
      : query<Site>(`SELECT s.id,s.organization_id,s.name,o.name organization_name FROM sites s JOIN organizations o ON o.id=s.organization_id WHERE s.active=true AND s.organization_id=$1 ORDER BY s.name`,[session.organizationId]),
    superadmin
      ? query<Worker>(
          `SELECT u.id,om.organization_id,u.full_name,om.role,s.name supplier_name
           FROM organization_members om JOIN users u ON u.id=om.user_id
           LEFT JOIN suppliers s ON s.id=om.external_supplier_id
           WHERE u.active=true AND om.role IN ('technician','external')
           ORDER BY om.organization_id,u.full_name`)
      : query<Worker>(
          `SELECT u.id,om.organization_id,u.full_name,om.role,s.name supplier_name
           FROM organization_members om JOIN users u ON u.id=om.user_id
           LEFT JOIN suppliers s ON s.id=om.external_supplier_id
           WHERE u.active=true AND om.organization_id=$1 AND om.role IN ('technician','external')
           ORDER BY u.full_name`,[session.organizationId]),
  ]);

  const selectedOrgId=superadmin ? (organizations.rows[0]?.id||null) : session.organizationId;
  const gate=selectedOrgId ? gateFor(await getSetupState(selectedOrgId),"crew") : null;

  const error=params.error==="sequence" ? "Primero crea al menos un técnico interno o colaborador externo."
    : params.error==="members" ? "Selecciona al menos un integrante válido para la cuadrilla."
    : params.error==="leader" ? "El líder debe pertenecer a la misma cuadrilla."
    : params.error ? "No fue posible crear la cuadrilla." : "";

  return <>
    <header className="page-header">
      <div><span className="eyebrow">Ejecución operativa</span><h1 className="page-title">Cuadrillas</h1><p className="muted">Agrupa técnicos internos y colaboradores externos en equipos de trabajo con un líder definido.</p></div>
      <div className="brand-pill"><span /> {crews.rowCount} cuadrillas</div>
    </header>

    {params.created && <div className="notice success section">Cuadrilla creada correctamente.</div>}
    {error && <div className="notice error section">{error}</div>}

    <section className="card section setup-flow-card">
      <div className="setup-flow-head"><div><span className="eyebrow">Secuencia</span><h2>Las cuadrillas dependen del personal previamente registrado</h2></div><span className={`setup-flow-state \${gate?.ready ? "ready":"blocked"}`}>{gate?.ready?"Habilitado":"Paso pendiente"}</span></div>
      <div className="setup-flow-steps"><span className="done"><b>1</b> Empresa</span><span className="done"><b>2</b> Ubicación</span><span className="done"><b>3</b> Sububicación</span><span className={gate?.ready?"done":""}><b>4</b> Personal</span><span className={gate?.ready?"active":""}><b>5</b> Cuadrilla</span></div>
      {!gate?.ready && gate?.href && <a className="button secondary" href={gate.href}>{gate.action}</a>}
    </section>

    <section className="card section">
      <div className="section-heading"><div><span className="eyebrow">Nueva cuadrilla</span><h2>Conformar equipo de trabajo</h2><p className="muted">Puedes mezclar técnicos internos y colaboradores externos. Todos deben pertenecer a la misma empresa.</p></div></div>
      <form className="form-grid" method="post" action="/api/crews">
        {superadmin ? <div className="field"><label>Empresa *</label><select name="organization_id" required><option value="">Selecciona una empresa</option>{organizations.rows.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
          : <input type="hidden" name="organization_id" value={session.organizationId||""}/>}
        <div className="field"><label>Sede *</label><select name="site_id" required><option value="">Selecciona una sede</option>{sites.rows.map(s=><option key={s.id} value={s.id}>{s.organization_name} · {s.name}</option>)}</select></div>
        <div className="field"><label>Nombre *</label><input name="name" required placeholder="Ej. Cuadrilla refrigeración 1" /></div>
        <div className="field"><label>Líder *</label><select name="leader_user_id" required><option value="">Selecciona líder</option>{workers.rows.map(w=><option key={w.id} value={w.id}>{w.full_name} · {w.role==="external" ? `Externo · \${w.supplier_name||"Proveedor"}` : "Técnico"}</option>)}</select></div>
        <div className="field form-span-2"><label>Integrantes *</label><div className="crew-member-options">{workers.rows.map(w=><label key={w.id}><input type="checkbox" name="member_ids" value={w.id}/><span><strong>{w.full_name}</strong><small>{w.role==="external" ? `Externo · \${w.supplier_name||"Proveedor"}` : "Técnico interno"}</small></span></label>)}</div></div>
        <div className="field form-span-2"><label>Descripción</label><input name="description" placeholder="Especialidad, turno o alcance de esta cuadrilla." /></div>
        <div className="form-span-2 form-actions"><button className="button" type="submit">Crear cuadrilla</button></div>
      </form>
    </section>

    <section className="section">
      <div className="section-heading"><div><span className="eyebrow">Equipos</span><h2>Cuadrillas registradas</h2></div></div>
      {crews.rowCount ? <div className="crew-grid">{crews.rows.map(c=><article className="card crew-card" key={c.id}>
        <div className="crew-card-head"><span className="crew-icon">◉</span><div><strong>{c.name}</strong><span>{c.organization_name}{c.site_name?` · \${c.site_name}`:""}</span></div><span className={`status-badge \${c.active?"status-active":"status-inactive"}`}><i />{c.active?"Activa":"Inactiva"}</span></div>
        <div className="crew-card-meta"><div><span>Líder</span><strong>{c.leader_name||"Sin líder"}</strong></div><div><span>Integrantes</span><strong>{c.member_count}</strong></div></div>
        {c.description && <p>{c.description}</p>}
      </article>)}</div> : <div className="card empty-state"><strong>Aún no hay cuadrillas.</strong><span>Crea técnicos o colaboradores externos y luego conforma el primer equipo.</span></div>}
    </section>
  </>;
}
