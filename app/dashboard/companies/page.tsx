import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import NewCompanyModal from "./NewCompanyModal";
import CompanyDirectory, { type CompanyDirectoryItem } from "./CompanyDirectory";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ create_error?: string; saved?: string; deleted?: string; error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session, "companies.manage")) redirect("/dashboard");

  const [companies, params] = await Promise.all([
    query<CompanyDirectoryItem>(
      `SELECT o.id,o.name,o.slug,o.legal_name,o.tax_id,o.timezone,o.active,o.admin_email,o.primary_contact_name,
        bp.name plan_name,
        round(100.0 * (
          (o.name IS NOT NULL AND o.name <> '')::int +
          (o.legal_name IS NOT NULL AND o.legal_name <> '')::int +
          (o.tax_id IS NOT NULL AND o.tax_id <> '')::int +
          (o.tax_id_type IS NOT NULL AND o.tax_id_type <> '')::int +
          (o.legal_address IS NOT NULL AND o.legal_address <> '')::int +
          (o.legal_city IS NOT NULL AND o.legal_city <> '')::int +
          (o.legal_country IS NOT NULL AND o.legal_country <> '')::int +
          (o.phone IS NOT NULL AND o.phone <> '')::int +
          (o.admin_email IS NOT NULL AND o.admin_email <> '')::int +
          (o.primary_contact_name IS NOT NULL AND o.primary_contact_name <> '')::int +
          (o.primary_contact_email IS NOT NULL AND o.primary_contact_email <> '')::int +
          (o.logo_data IS NOT NULL)::int +
          (o.cover_data IS NOT NULL)::int +
          (SELECT count(*)::int FROM organization_documents rd
            WHERE rd.organization_id=o.id AND rd.archived_at IS NULL AND rd.requirement_level='required'
              AND rd.file_data IS NOT NULL AND (rd.expires_at IS NULL OR rd.expires_at >= current_date))
        ) / NULLIF(13 + (
          SELECT count(*)::int FROM organization_documents rq
          WHERE rq.organization_id=o.id AND rq.archived_at IS NULL AND rq.requirement_level='required'
        ),0))::int profile_completion,
        (SELECT count(*)::text FROM organization_documents od WHERE od.organization_id=o.id AND od.archived_at IS NULL) document_count,
        (SELECT count(*)::text FROM organization_documents od
          WHERE od.organization_id=o.id AND od.archived_at IS NULL AND od.requirement_level='required'
            AND (od.file_data IS NULL OR (od.expires_at IS NOT NULL AND od.expires_at < current_date))) pending_document_count,
        (SELECT count(*)::text FROM sites sx WHERE sx.organization_id=o.id) site_count,
        (SELECT count(*)::text FROM sites sx WHERE sx.organization_id=o.id AND sx.active=true) active_site_count,
        (SELECT count(*)::text FROM assets ax WHERE ax.organization_id=o.id) asset_count,
        (SELECT count(*)::text FROM locations lx WHERE lx.organization_id=o.id) sublocation_count,
        (SELECT count(*)::text FROM inventory_items ix WHERE ix.organization_id=o.id) inventory_item_count,
        (SELECT count(*)::text FROM organization_members om WHERE om.organization_id=o.id AND om.role='technician') technician_count,
        COALESCE(ol.max_sites,5)::text max_sites,
        COALESCE(ol.max_sublocations,100)::text max_sublocations,
        COALESCE(ol.max_assets,500)::text max_assets,
        COALESCE(ol.max_inventory_items,1000)::text max_inventory_items,
        COALESCE(ol.max_technicians,50)::text max_technicians,
        s.id site_id,s.name site_name,s.code site_code,s.city,s.country,s.address,
        (o.logo_data IS NOT NULL) has_logo,
        (o.cover_data IS NOT NULL) has_cover
       FROM organizations o
       LEFT JOIN organization_limits ol ON ol.organization_id=o.id
       LEFT JOIN organization_subscriptions os ON os.organization_id=o.id
       LEFT JOIN billing_plans bp ON bp.id=os.plan_id
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
      {params.error && <div className="notice error">No fue posible completar la operación. Revisa la información e inténtalo nuevamente.</div>}
    </div>}

    <section className="section">
      <div className="section-heading sites-heading">
        <div><span className="eyebrow">Directorio</span><h2>Empresas registradas ({companies.rowCount})</h2></div>
      </div>
      <CompanyDirectory
        companies={companies.rows}
        canManageResources={can(session, "company_resources.manage")}
      />
    </section>
  </>;
}
