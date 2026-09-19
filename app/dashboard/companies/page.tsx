import { query } from "@/lib/db";

export default async function CompaniesPage() {
  const companies = await query<{id:string;name:string;slug:string;site_count:string;asset_count:string}>(
    `SELECT o.id,o.name,o.slug,count(DISTINCT s.id)::text site_count,count(DISTINCT a.id)::text asset_count
     FROM organizations o LEFT JOIN sites s ON s.organization_id=o.id LEFT JOIN assets a ON a.organization_id=o.id
     GROUP BY o.id ORDER BY o.name`
  );
  return <>
    <h1 className="page-title">Empresas y sedes</h1><p className="muted">Cada empresa mantiene sus activos y mantenimiento separados.</p>
    <section className="card section">
      <h2>Nueva empresa</h2>
      <form className="form-grid" method="post" action="/api/organizations">
        <div className="field"><label>Empresa</label><input name="name" required placeholder="Alento Pizza" /></div>
        <div className="field"><label>Sede principal</label><input name="site_name" required placeholder="Sede Medellín" /></div>
        <div className="field"><label>Ciudad</label><input name="city" placeholder="Medellín" /></div>
        <div className="field"><label>&nbsp;</label><button className="button" type="submit">Crear empresa</button></div>
      </form>
    </section>
    <section className="section"><table className="table"><thead><tr><th>Empresa</th><th>Identificador</th><th>Sedes</th><th>Equipos</th></tr></thead>
      <tbody>{companies.rows.map(c=><tr key={c.id}><td><strong>{c.name}</strong></td><td>{c.slug}</td><td>{c.site_count}</td><td>{c.asset_count}</td></tr>)}</tbody>
    </table></section>
  </>;
}
