import Link from "next/link";
import { query } from "@/lib/db";

type Company = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  site_count: string;
  active_site_count: string;
  asset_count: string;
};

export default async function CompaniesPage() {
  const companies = await query<Company>(
    `SELECT o.id,o.name,o.slug,o.active,
      count(DISTINCT s.id)::text site_count,
      count(DISTINCT s.id) FILTER (WHERE s.active=true)::text active_site_count,
      count(DISTINCT a.id)::text asset_count
     FROM organizations o
     LEFT JOIN sites s ON s.organization_id=o.id
     LEFT JOIN assets a ON a.organization_id=o.id
     GROUP BY o.id
     ORDER BY o.active DESC,o.name`,
  );

  return <>
    <div className="page-header">
      <div>
        <span className="eyebrow">Configuración operativa</span>
        <h1 className="page-title">Empresas y sedes</h1>
        <p className="muted">Administra cada empresa, sus datos generales y todas sus ubicaciones.</p>
      </div>
      <span className="brand-pill"><span /> {companies.rows.filter(company => company.active).length} empresas activas</span>
    </div>

    <section className="card section">
      <div className="section-heading">
        <div><span className="eyebrow">Nuevo registro</span><h2>Crear empresa</h2></div>
        <small>La primera sede se crea junto con la empresa.</small>
      </div>
      <form className="form-grid" method="post" action="/api/organizations">
        <div className="field"><label htmlFor="new-company-name">Empresa</label><input id="new-company-name" name="name" required placeholder="Alento Pizza" /></div>
        <div className="field"><label htmlFor="new-company-site">Sede principal</label><input id="new-company-site" name="site_name" required placeholder="Sede Medellín" /></div>
        <div className="field"><label htmlFor="new-company-city">Ciudad</label><input id="new-company-city" name="city" placeholder="Medellín" /></div>
        <div className="field company-create-action"><label>&nbsp;</label><button className="button" type="submit">Crear empresa</button></div>
      </form>
    </section>

    <section className="section">
      <div className="section-heading sites-heading">
        <div><span className="eyebrow">Directorio</span><h2>Empresas registradas ({companies.rowCount})</h2></div>
      </div>

      {companies.rowCount === 0 ? <div className="card empty-state"><strong>Aún no hay empresas registradas.</strong><span>Crea la primera empresa usando el formulario anterior.</span></div> :
      <div className="company-list">
        {companies.rows.map(company => <article className="card company-list-card" key={company.id}>
          <div className="company-list-main">
            <span className={`status-badge ${company.active ? "status-active" : "status-inactive"}`}><span aria-hidden="true" />{company.active ? "Activa" : "Inactiva"}</span>
            <h3>{company.name}</h3>
            <small>{company.slug}</small>
          </div>
          <div className="company-list-stat"><strong>{company.active_site_count}</strong><span>Sedes activas</span><small>{company.site_count} registradas</small></div>
          <div className="company-list-stat"><strong>{company.asset_count}</strong><span>Activos</span><small>Equipos vinculados</small></div>
          <Link className="button secondary company-detail-link" href={`/dashboard/companies/${company.id}`}>Ver detalle →</Link>
        </article>)}
      </div>}
    </section>
  </>;
}
