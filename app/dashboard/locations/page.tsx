import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { LocationCreateModal } from "@/components/ContextCreateModals";
import ModuleHeader from "@/components/ModuleHeader";
import CreationPrerequisiteState from "@/components/CreationPrerequisiteState";
import { getCreationGateForScope } from "@/lib/setup-sequence";
import LocationDirectory, { type LocationDirectoryService, type LocationDirectorySite, type LocationDirectorySub } from "@/components/LocationDirectory";

type OrganizationRow = { id: string; name: string };
type SiteRow = LocationDirectorySite;

export default async function LocationsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string; create?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session, "locations.manage")) redirect("/dashboard");

  const params = await searchParams;
  const superadmin = session.platformRole !== "user";
  const sublocationGate = await getCreationGateForScope("sublocation", session.organizationId, superadmin);
  const sites = superadmin
    ? await query<SiteRow>(
        `SELECT s.id,s.organization_id,o.name organization_name,s.name,s.code,s.address,s.city,s.country,s.active,
                s.contact_name,s.contact_phone,s.contact_email,s.latitude,s.longitude,s.geofence_radius_m,
                s.business_days,s.business_open_time::text,s.business_close_time::text,
                (s.image_data IS NOT NULL) has_image,(o.logo_data IS NOT NULL) organization_has_logo,
                (SELECT count(*)::int FROM locations l WHERE l.site_id=s.id AND l.active=true) location_count,
                (SELECT count(*)::int FROM assets a WHERE a.site_id=s.id AND a.status<>'retired') asset_count
         FROM sites s JOIN organizations o ON o.id=s.organization_id
         ORDER BY o.name,s.active DESC,s.name`,
      )
    : session.accessAllSites
      ? await query<SiteRow>(
          `SELECT s.id,s.organization_id,o.name organization_name,s.name,s.code,s.address,s.city,s.country,s.active,
                  s.contact_name,s.contact_phone,s.contact_email,s.latitude,s.longitude,s.geofence_radius_m,
                  s.business_days,s.business_open_time::text,s.business_close_time::text,
                  (s.image_data IS NOT NULL) has_image,(o.logo_data IS NOT NULL) organization_has_logo,
                  (SELECT count(*)::int FROM locations l WHERE l.site_id=s.id AND l.active=true) location_count,
                  (SELECT count(*)::int FROM assets a WHERE a.site_id=s.id AND a.status<>'retired') asset_count
           FROM sites s JOIN organizations o ON o.id=s.organization_id
           WHERE s.organization_id=$1
           ORDER BY s.active DESC,s.name`,
          [session.organizationId],
        )
      : await query<SiteRow>(
          `SELECT s.id,s.organization_id,o.name organization_name,s.name,s.code,s.address,s.city,s.country,s.active,
                  s.contact_name,s.contact_phone,s.contact_email,s.latitude,s.longitude,s.geofence_radius_m,
                  s.business_days,s.business_open_time::text,s.business_close_time::text,
                  (s.image_data IS NOT NULL) has_image,(o.logo_data IS NOT NULL) organization_has_logo,
                  (SELECT count(*)::int FROM locations l WHERE l.site_id=s.id AND l.active=true) location_count,
                  (SELECT count(*)::int FROM assets a WHERE a.site_id=s.id AND a.status<>'retired') asset_count
           FROM sites s JOIN organizations o ON o.id=s.organization_id
           WHERE s.organization_id=$1 AND s.id = ANY($2::uuid[])
           ORDER BY s.active DESC,s.name`,
          [session.organizationId, session.siteIds],
        );

  const [organizations, sublocations, services] = await Promise.all([
    superadmin
      ? query<OrganizationRow>("SELECT id,name FROM organizations WHERE active=true ORDER BY name")
      : query<OrganizationRow>("SELECT id,name FROM organizations WHERE id=$1", [session.organizationId]),
    superadmin
      ? query<LocationDirectorySub>(
          `SELECT l.id,l.organization_id,l.site_id,l.parent_id,l.name,l.code,l.type,l.description,l.active,
                  (l.image_data IS NOT NULL) has_image,
                  (SELECT count(*)::int FROM assets a WHERE a.location_id=l.id AND a.status<>'retired') asset_count,
                  (SELECT count(*)::int FROM locations child WHERE child.parent_id=l.id AND child.active=true) child_count
           FROM locations l
           JOIN sites s ON s.id=l.site_id
           JOIN organizations o ON o.id=l.organization_id
           ORDER BY o.name,s.name,l.name`,
        )
      : session.accessAllSites
        ? query<LocationDirectorySub>(
            `SELECT l.id,l.organization_id,l.site_id,l.parent_id,l.name,l.code,l.type,l.description,l.active,
                    (l.image_data IS NOT NULL) has_image,
                    (SELECT count(*)::int FROM assets a WHERE a.location_id=l.id AND a.status<>'retired') asset_count,
                    (SELECT count(*)::int FROM locations child WHERE child.parent_id=l.id AND child.active=true) child_count
             FROM locations l WHERE l.organization_id=$1 ORDER BY l.name`,
            [session.organizationId],
          )
        : query<LocationDirectorySub>(
            `SELECT l.id,l.organization_id,l.site_id,l.parent_id,l.name,l.code,l.type,l.description,l.active,
                    (l.image_data IS NOT NULL) has_image,
                    (SELECT count(*)::int FROM assets a WHERE a.location_id=l.id AND a.status<>'retired') asset_count,
                    (SELECT count(*)::int FROM locations child WHERE child.parent_id=l.id AND child.active=true) child_count
             FROM locations l WHERE l.organization_id=$1 AND l.site_id=ANY($2::uuid[]) ORDER BY l.name`,
            [session.organizationId,session.siteIds],
          ),
    superadmin
      ? query<LocationDirectoryService>(
          `SELECT w.id,w.site_id,w.number::text,w.title,w.status,w.type,w.priority,w.requested_at::text,
                  l.name location_name
           FROM work_orders w
           LEFT JOIN assets a ON a.id=w.asset_id
           LEFT JOIN locations l ON l.id=a.location_id
           ORDER BY w.requested_at DESC LIMIT 500`,
        )
      : session.accessAllSites
        ? query<LocationDirectoryService>(
            `SELECT w.id,w.site_id,w.number::text,w.title,w.status,w.type,w.priority,w.requested_at::text,
                    l.name location_name
             FROM work_orders w
             LEFT JOIN assets a ON a.id=w.asset_id
             LEFT JOIN locations l ON l.id=a.location_id
             WHERE w.organization_id=$1
             ORDER BY w.requested_at DESC LIMIT 500`,
            [session.organizationId],
          )
        : query<LocationDirectoryService>(
            `SELECT w.id,w.site_id,w.number::text,w.title,w.status,w.type,w.priority,w.requested_at::text,
                    l.name location_name
             FROM work_orders w
             LEFT JOIN assets a ON a.id=w.asset_id
             LEFT JOIN locations l ON l.id=a.location_id
             WHERE w.organization_id=$1 AND w.site_id=ANY($2::uuid[])
             ORDER BY w.requested_at DESC LIMIT 500`,
            [session.organizationId,session.siteIds],
          ),
  ]);

  const siteOptions = sites.rows.map(site => ({
    id: site.id,
    organization_id: site.organization_id,
    name: site.name,
    organization_name: site.organization_name,
  }));

  const message = params.error === "site-limit"
    ? "La empresa alcanzó el límite de ubicaciones principales asignado."
    : params.error === "site-code"
      ? "Ese código de sede ya existe dentro de la empresa."
      : params.error === "site-geofence"
        ? "Valida la dirección en el mapa y define un radio de geocerca entre 20 y 5000 metros."
        : params.error === "site-required"
          ? "Completa nombre, dirección, ciudad, país y punto geográfico de la ubicación."
        : params.error === "business-hours"
          ? "La hora de cierre debe ser posterior a la hora de apertura."
        : params.error === "business-days"
          ? "Selecciona al menos un día de atención."
          : params.error
            ? "Revisa la información de la ubicación."
            : "";

  return <>
    <ModuleHeader
      eyebrow="Estructura física"
      title="Ubicaciones"
      description="Administra las sedes principales y entra a su jerarquía de áreas, pisos, habitaciones y zonas."
      count={sites.rowCount || 0}
      countLabel="sedes"
      searchPlaceholder="Buscar sede, empresa, ciudad o código"
      action={organizations.rows.length > 0 ? <LocationCreateModal
        organizations={organizations.rows}
        sites={siteOptions}
        locations={sublocations.rows.map(location=>({id:location.id,organization_id:location.organization_id,site_id:location.site_id,name:location.name,label:location.name}))}
        fixedOrganizationId={superadmin ? undefined : session.organizationId || undefined}
        fixedOrganizationName={superadmin ? undefined : session.organizationName || undefined}
        returnTo="/dashboard/locations"
        autoOpen={params.create==="site" || params.create==="sub"}
        initialKind={params.create==="sub" ? "sub" : "site"}
      /> : undefined}
    />

    {params.created && <div className="notice success section">{params.created === "location" ? "Sububicación creada correctamente." : "Ubicación principal creada correctamente."}</div>}
    {message && <div className="notice error section">{message}</div>}

    {!sublocationGate.ready && <CreationPrerequisiteState
      icon="⌁"
      eyebrow="Jerarquía de ubicaciones"
      title={sublocationGate.title}
      message={sublocationGate.message}
      href={sublocationGate.href || "/dashboard/companies"}
      action={sublocationGate.action || "Continuar"}
    />}

    <section className="section">
      {sites.rowCount ? <LocationDirectory sites={sites.rows} sublocations={sublocations.rows} services={services.rows} /> : sublocationGate.ready ? <div className="card empty-state"><strong>No hay ubicaciones disponibles.</strong><span>Crea la primera sede para comenzar la estructura física.</span></div> : null}
    </section>
  </>;
}
