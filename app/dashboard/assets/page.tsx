import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";

export default async function AssetsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session, "assets.read")) redirect("/dashboard");

  const superadmin = session.platformRole === "superadmin";
  const orgId = session.organizationId;
  const canWrite = can(session, "assets.write");

  const [assets, sites] = await Promise.all([
    superadmin
      ? query<{id:string;code:string;name:string;company:string;site:string;status:string;criticality:string}>(
          `SELECT a.id,a.code,a.name,o.name company,s.name site,a.status,a.criticality
           FROM assets a JOIN organizations o ON o.id=a.organization_id JOIN sites s ON s.id=a.site_id
           ORDER BY a.created_at DESC LIMIT 200`)
      : session.accessAllSites
        ? query<{id:string;code:string;name:string;company:string;site:string;status:string;criticality:string}>(
            `SELECT a.id,a.code,a.name,o.name company,s.name site,a.status,a.criticality
             FROM assets a JOIN organizations o ON o.id=a.organization_id JOIN sites s ON s.id=a.site_id
             WHERE a.organization_id=$1 ORDER BY a.created_at DESC LIMIT 200`, [orgId])
        : query<{id:string;code:string;name:string;company:string;site:string;status:string;criticality:string}>(
            `SELECT a.id,a.code,a.name,o.name company,s.name site,a.status,a.criticality
             FROM assets a JOIN organizations o ON o.id=a.organization_id JOIN sites s ON s.id=a.site_id
             WHERE a.organization_id=$1 AND a.site_id = ANY($2::uuid[])
             ORDER BY a.created_at DESC LIMIT 200`, [orgId, session.siteIds]),
    canWrite
      ? (superadmin
          ? query<{id:string;label:string}>(`SELECT s.id,o.name || ' · ' || s.name label FROM sites s JOIN organizations o ON o.id=s.organization_id WHERE s.active=true ORDER BY o.name,s.name`)
          : session.accessAllSites
            ? query<{id:string;label:string}>(`SELECT s.id,s.name label FROM sites s WHERE s.organization_id=$1 AND s.active=true ORDER BY s.name`, [orgId])
            : query<{id:string;label:string}>(`SELECT s.id,s.name label FROM sites s WHERE s.organization_id=$1 AND s.active=true AND s.id = ANY($2::uuid[]) ORDER BY s.name`, [orgId, session.siteIds]))
      : Promise.resolve({ rows: [] } as { rows: {id:string;label:string}[] }),
  ]);

  return <>
    <h1 className="page-title">Activos y equipos</h1><p className="muted">Registro maestro de los equipos mantenibles visibles para tu rol.</p>
    {canWrite && <section className="card section"><h2>Registrar equipo</h2>
      {sites.rows.length===0 ? <p>Primero crea una ubicación principal.</p> :
      <form className="form-grid" method="post" action="/api/assets">
        <div className="field"><label>Sede</label><select name="site_id" required>{sites.rows.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
        <div className="field"><label>Código</label><input name="code" required placeholder="HORNO-001" /></div>
        <div className="field"><label>Nombre</label><input name="name" required placeholder="Horno principal" /></div>
        <div className="field"><label>Criticidad</label><select name="criticality"><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option></select></div>
        <div className="field"><label>Fabricante</label><input name="manufacturer" /></div>
        <div className="field"><label>Modelo</label><input name="model" /></div>
        <div><button className="button" type="submit">Registrar equipo</button></div>
      </form>}
    </section>}
    <section className="section"><table className="table"><thead><tr><th>Código</th><th>Equipo</th><th>Empresa / sede</th><th>Estado</th><th>Criticidad</th></tr></thead>
    <tbody>{assets.rows.map(a=><tr key={a.id}><td>{a.code}</td><td><strong>{a.name}</strong></td><td>{a.company} · {a.site}</td><td><span className="status">{a.status}</span></td><td>{a.criticality}</td></tr>)}</tbody></table></section>
  </>;
}
