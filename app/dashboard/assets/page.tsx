import { query } from "@/lib/db";

export default async function AssetsPage() {
  const [assets, sites] = await Promise.all([
    query<{id:string;code:string;name:string;company:string;site:string;status:string;criticality:string}>(
      `SELECT a.id,a.code,a.name,o.name company,s.name site,a.status,a.criticality
       FROM assets a JOIN organizations o ON o.id=a.organization_id JOIN sites s ON s.id=a.site_id
       ORDER BY a.created_at DESC LIMIT 200`
    ),
    query<{id:string;organization_id:string;label:string}>(
      `SELECT s.id,s.organization_id,o.name || ' · ' || s.name label FROM sites s JOIN organizations o ON o.id=s.organization_id WHERE s.active=true ORDER BY o.name,s.name`
    )
  ]);
  return <>
    <h1 className="page-title">Activos y equipos</h1><p className="muted">Registro maestro de los equipos mantenibles.</p>
    <section className="card section"><h2>Registrar equipo</h2>
      {sites.rows.length===0 ? <p>Primero crea una empresa y una sede.</p> :
      <form className="form-grid" method="post" action="/api/assets">
        <div className="field"><label>Sede</label><select name="site_picker" required onChange={undefined}>{sites.rows.map(s=><option key={s.id} value={`${s.organization_id}|${s.id}`}>{s.label}</option>)}</select></div>
        <div className="field"><label>Código</label><input name="code" required placeholder="HORNO-001" /></div>
        <div className="field"><label>Nombre</label><input name="name" required placeholder="Horno principal" /></div>
        <div className="field"><label>Criticidad</label><select name="criticality"><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option></select></div>
        <div className="field"><label>Fabricante</label><input name="manufacturer" /></div>
        <div className="field"><label>Modelo</label><input name="model" /></div>
        <input type="hidden" name="organization_id" value={sites.rows[0]?.organization_id||""}/><input type="hidden" name="site_id" value={sites.rows[0]?.id||""}/>
        <div><button className="button" type="submit">Registrar equipo</button></div>
      </form>}
    </section>
    <section className="section"><table className="table"><thead><tr><th>Código</th><th>Equipo</th><th>Empresa / sede</th><th>Estado</th><th>Criticidad</th></tr></thead>
    <tbody>{assets.rows.map(a=><tr key={a.id}><td>{a.code}</td><td><strong>{a.name}</strong></td><td>{a.company} · {a.site}</td><td><span className="status">{a.status}</span></td><td>{a.criticality}</td></tr>)}</tbody></table></section>
  </>;
}
