import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, isPlatformOwner } from "@/lib/permissions";
import { query } from "@/lib/db";
import NewCompanyModal from "./NewCompanyModal";
import ModuleHeader from "@/components/ModuleHeader";
import CompanyDirectory, { type CompanyDirectoryItem } from "./CompanyDirectory";
import { getCustomizationSummary } from "@/lib/customization";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string; create_error?: string; saved?: string; deleted?: string; error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session, "companies.manage")) redirect("/dashboard");

  const [companies, params, customization] = await Promise.all([
    query<CompanyDirectoryItem>(
      `SELECT o.id,o.name,o.slug,o.legal_name,o.tax_id,o.tax_id_type,o.timezone,o.active,
        o.legal_address,o.legal_city,o.legal_country,o.phone,o.admin_email,o.billing_email,o.website,
        o.primary_contact_name,o.primary_contact_title,o.primary_contact_phone,o.primary_contact_email,o.internal_notes,
        o.business_days,o.business_open_time::text,o.business_close_time::text,o.business_schedule,
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
        (SELECT count(*)::text FROM suppliers sp WHERE sp.organization_id=o.id) supplier_count,
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
        s.id site_id,s.name site_name,s.code site_code,s.city,s.country,s.address,s.latitude site_latitude,s.longitude site_longitude,s.geofence_radius_m site_geofence_radius_m,
        s.business_days site_business_days,s.business_open_time::text site_business_open_time,s.business_close_time::text site_business_close_time,s.business_schedule site_business_schedule,
        (o.logo_data IS NOT NULL) has_logo,
        (o.cover_data IS NOT NULL) has_cover
       FROM organizations o
       LEFT JOIN organization_limits ol ON ol.organization_id=o.id
       LEFT JOIN organization_subscriptions os ON os.organization_id=o.id
       LEFT JOIN billing_plans bp ON bp.id=os.plan_id
       LEFT JOIN LATERAL (
         SELECT id,name,code,city,country,address,latitude,longitude,geofence_radius_m,
                business_days,business_open_time,business_close_time,business_schedule
         FROM sites
         WHERE organization_id=o.id
         ORDER BY active DESC,created_at ASC
         LIMIT 1
       ) s ON true
       ORDER BY o.active DESC,o.name`,
    ),
    searchParams,
    getCustomizationSummary(),
  ]);

  return <>
    <ModuleHeader
      eyebrow="Configuración operativa"
      title="Compañías"
      description="Administra empresas, planes, estructura operativa y recursos contratados desde un mismo directorio."
      count={companies.rowCount || 0}
      countLabel="compañías"
      searchPlaceholder="Buscar compañía, ciudad, NIT o plan"
      facets={[
        {key:"plan",label:"Plan",allLabel:"Todos los planes"},
        {key:"country",label:"País",allLabel:"Todos los países"},
        {key:"city",label:"Ciudad",allLabel:"Todas las ciudades"},
      ]}
      action={<NewCompanyModal error={params.create_error} autoOpen={params.create==="1"} defaultCountry={customization.defaultCountry} defaultLocale={customization.defaultLocale} />}
    />

    {(params.saved || params.deleted || params.error) && <div className="section">
      {params.saved && <div className="notice success">Los cambios de la empresa se guardaron correctamente.</div>}
      {params.deleted && <div className="notice success">La empresa y su información relacionada fueron eliminadas.</div>}
      {params.error && <div className="notice error">{
        params.error === "site-geofence"
          ? "Valida la dirección de la sede principal en el mapa y define un radio permitido entre 20 y 5000 metros."
          : params.error === "business-hours"
            ? "La hora de cierre debe ser posterior a la hora de apertura."
            : params.error === "business-days"
              ? "Selecciona al menos un día de atención."
              : params.error === "invalid-email"
                ? "El correo administrativo no tiene un formato válido."
                : params.error === "value-too-long"
                  ? "Uno de los campos supera la longitud permitida."
                  : params.error === "invalid-data"
                    ? "Uno de los valores tiene un formato inválido."
                    : params.error === "missing-data"
                      ? "Falta un dato obligatorio para completar la actualización."
                      : params.error === "related-data"
                        ? "Hay una referencia relacionada que ya no es válida."
                        : params.error === "save"
                          ? "Ocurrió un error interno al guardar. Revisa el registro del servicio con la referencia ORG-SAVE."
                          : "No fue posible completar la operación. Revisa la información e inténtalo nuevamente."
      }</div>}
    </div>}

    <section className="section">
      <CompanyDirectory
        companies={companies.rows}
        canManageResources={can(session, "company_resources.manage")}
        canDelete={isPlatformOwner(session)}
      />
    </section>
  </>;
}
