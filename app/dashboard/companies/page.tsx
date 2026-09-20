import { query } from "@/lib/db";
import NewCompanyModal from "./NewCompanyModal";
import CompanyDirectory, { type CompanyDirectoryItem } from "./CompanyDirectory";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ create_error?: string; saved?: string; deleted?: string; error?: string }>;
}) {
  const [companies, params] = await Promise.all([
    query<CompanyDirectoryItem>(
      `SELECT o.id,o.name,o.slug,o.legal_name,o.tax_id,o.timezone,o.active,
        (SELECT count(*)::text FROM sites sx WHERE sx.organization_id=o.id) site_count,
        (SELECT count(*)::text FROM sites sx WHERE sx.organization_id=o.id AND sx.active=true) active_site_count,
        (SELECT count(*)::text FROM assets ax WHERE ax.organization_id=o.id) asset_count,
        s.id site_id,s.name site_name,s.code site_code,s.city,s.country,s.address,
        (o.logo_data IS NOT NULL) has_logo,
        (o.cover_data IS NOT NULL) has_cover
       FROM organizations o
       LEFT JOIN LATERAL (
         SELECT id,name,code,city,country,address
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
        <p className="muted">Selecciona una empresa para consultar su información protegida o administrar sus sedes.</p>
      </div>
      <div className="companies-header-actions">
        <span className="brand-pill"><span /> {companies.rows.filter(company => company.active).length} empresas activas</span>
        <NewCompanyModal error={params.create_error} />
      </div>
    </div>

    {(params.saved || params.deleted || params.error) && <div className="section">
      {params.saved && <div className="notice success">Los cambios de la empresa se guardaron correctamente.</div>}
      {params.deleted && <div className="notice success">La empresa y su información relacionada fueron eliminadas.</div>}
      {params.error && <div className="notice error" role="alert">{params.error === "history"
        ? "No se puede eliminar esta empresa: tiene movimientos o información vinculada. Puedes desactivarla desde su administración para conservar el historial."
        : "No fue posible completar la operación. Revisa la información e inténtalo nuevamente."}</div>}
    </div>}

    <section className="section">
      <div className="section-heading sites-heading">
        <div><span className="eyebrow">Directorio</span><h2>Empresas registradas ({companies.rowCount})</h2></div>
      </div>
      <CompanyDirectory companies={companies.rows} />
    </section>
  </>;
}
