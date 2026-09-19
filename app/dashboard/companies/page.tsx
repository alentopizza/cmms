import Link from "next/link";
import { query } from "@/lib/db";
import NewCompanyModal from "./NewCompanyModal";

type Company = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  site_count: string;
  active_site_count: string;
  asset_count: string;
  site_name: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  has_logo: boolean;
  has_cover: boolean;
};

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [companies, params] = await Promise.all([
    query<Company>(
      `SELECT o.id,o.name,o.slug,o.active,
        (SELECT count(*)::text FROM sites sx WHERE sx.organization_id=o.id) site_count,
        (SELECT count(*)::text FROM sites sx WHERE sx.organization_id=o.id AND sx.active=true) active_site_count,
        (SELECT count(*)::text FROM assets ax WHERE ax.organization_id=o.id) asset_count,
        s.name site_name,s.city,s.country,s.address,
        (o.logo_data IS NOT NULL) has_logo,
        (o.cover_data IS NOT NULL) has_cover
       FROM organizations o
       LEFT JOIN LATERAL (
         SELECT name,city,country,address
         FROM sites
         WHERE organization_id=o.id
         ORDER BY active DESC,created_at ASC
         LIMIT 1
       ) s ON true
       ORDER BY o.active DESC,o.name`,
    ),
    searchParams,
  ]);

  return <>
    <div className="page-header companies-directory-header">
      <div>
        <span className="eyebrow">Configuración operativa</span>
        <h1 className="page-title">Empresas y sedes</h1>
        <p className="muted">Selecciona una empresa para administrar su información, sedes y operación.</p>
      </div>
      <div className="companies-header-actions">
        <span className="brand-pill"><span /> {companies.rows.filter(company => company.active).length} empresas activas</span>
        <NewCompanyModal error={params.error} />
      </div>
    </div>

    <section className="section">
      <div className="section-heading sites-heading">
        <div><span className="eyebrow">Directorio</span><h2>Empresas registradas ({companies.rowCount})</h2></div>
      </div>

      {companies.rowCount === 0 ? <div className="card empty-state"><strong>Aún no hay empresas registradas.</strong><span>Usa el botón “Nueva empresa” para crear la primera.</span></div> :
      <div className="company-card-grid">
        {companies.rows.map(company => <article className="company-visual-card" key={company.id}>
          <Link className="company-card-link" href={`/dashboard/companies/${company.id}`} aria-label={`Ver detalle de ${company.name}`}>
            <div className={`company-card-cover ${company.has_cover ? "" : "company-card-cover-fallback"}`}>
              {company.has_cover && <img src={`/api/organizations/${company.id}/assets/cover`} alt={`Punto de referencia de ${company.name}`} />}
              <span className={`status-badge company-card-status ${company.active ? "status-active" : "status-inactive"}`}>
                <span aria-hidden="true" />{company.active ? "Activa" : "Inactiva"}
              </span>
            </div>

            <div className="company-card-logo">
              {company.has_logo
                ? <img src={`/api/organizations/${company.id}/assets/logo`} alt={`Logo de ${company.name}`} />
                : <span>{initials(company.name)}</span>}
            </div>

            <div className="company-card-content">
              <h3>{company.name}</h3>
              <div className="company-card-location">
                <span>Sede: {company.site_name || "Sin sede principal"}</span>
                <span>{company.city ? `${company.city} · ${company.country || "CO"}` : "Ciudad sin registrar"}</span>
                <span>{company.address || "Dirección sin registrar"}</span>
              </div>

              <div className="company-card-metrics">
                <div><strong>{company.active_site_count}</strong><span>Sedes activas</span><small>{company.site_count} registradas</small></div>
                <div><strong>{company.asset_count}</strong><span>Activos</span><small>Equipos vinculados</small></div>
              </div>

              <span className="company-card-action">Ver detalle <span aria-hidden="true">→</span></span>
            </div>
          </Link>
        </article>)}
      </div>}
    </section>
  </>;
}
