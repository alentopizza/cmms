import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, isPlatformOwner } from "@/lib/permissions";
import { query } from "@/lib/db";
import { LocationCreateModal } from "@/components/ContextCreateModals";
import ModuleHeader from "@/components/ModuleHeader";
import OwnerRecordActions from "@/components/OwnerRecordActions";

type OrganizationRow = { id: string; name: string };
type LocationOption = { id: string; organization_id: string; site_id: string; name: string; label: string };

type SiteRow = {
  id: string;
  organization_id: string;
  organization_name: string;
  name: string;
  code: string | null;
  city: string | null;
  country: string;
  active: boolean;
  location_count: number;
};

export default async function LocationsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session, "locations.manage")) redirect("/dashboard");

  const params = await searchParams;
  const superadmin = session.platformRole !== "user";
  const owner = isPlatformOwner(session);
  const sites = superadmin
    ? await query<SiteRow>(
        `SELECT s.id,s.organization_id,o.name organization_name,s.name,s.code,s.city,s.country,s.active,
                (SELECT count(*)::int FROM locations l WHERE l.site_id=s.id) location_count
         FROM sites s JOIN organizations o ON o.id=s.organization_id
         ORDER BY o.name,s.active DESC,s.name`,
      )
    : session.accessAllSites
      ? await query<SiteRow>(
          `SELECT s.id,s.organization_id,o.name organization_name,s.name,s.code,s.city,s.country,s.active,
                  (SELECT count(*)::int FROM locations l WHERE l.site_id=s.id) location_count
           FROM sites s JOIN organizations o ON o.id=s.organization_id
           WHERE s.organization_id=$1
           ORDER BY s.active DESC,s.name`,
          [session.organizationId],
        )
      : await query<SiteRow>(
          `SELECT s.id,s.organization_id,o.name organization_name,s.name,s.code,s.city,s.country,s.active,
                  (SELECT count(*)::int FROM locations l WHERE l.site_id=s.id) location_count
           FROM sites s JOIN organizations o ON o.id=s.organization_id
           WHERE s.organization_id=$1 AND s.id = ANY($2::uuid[])
           ORDER BY s.active DESC,s.name`,
          [session.organizationId, session.siteIds],
        );

  const [organizations, sublocations] = await Promise.all([
    superadmin
      ? query<OrganizationRow>("SELECT id,name FROM organizations WHERE active=true ORDER BY name")
      : query<OrganizationRow>("SELECT id,name FROM organizations WHERE id=$1", [session.organizationId]),
    superadmin
      ? query<LocationOption>(
          `SELECT l.id,l.organization_id,l.site_id,l.name,
                  o.name || ' · ' || s.name || ' · ' || l.name label
           FROM locations l
           JOIN sites s ON s.id=l.site_id
           JOIN organizations o ON o.id=l.organization_id
           WHERE l.active=true
           ORDER BY o.name,s.name,l.name`,
        )
      : session.accessAllSites
        ? query<LocationOption>(
            `SELECT l.id,l.organization_id,l.site_id,l.name,
                    s.name || ' · ' || l.name label
             FROM locations l JOIN sites s ON s.id=l.site_id
             WHERE l.organization_id=$1 AND l.active=true
             ORDER BY s.name,l.name`,
            [session.organizationId],
          )
        : query<LocationOption>(
            `SELECT l.id,l.organization_id,l.site_id,l.name,
                    s.name || ' · ' || l.name label
             FROM locations l JOIN sites s ON s.id=l.site_id
             WHERE l.organization_id=$1 AND l.active=true AND l.site_id = ANY($2::uuid[])
             ORDER BY s.name,l.name`,
            [session.organizationId, session.siteIds],
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
      action={<LocationCreateModal
        organizations={organizations.rows}
        sites={siteOptions}
        locations={sublocations.rows}
        fixedOrganizationId={superadmin ? undefined : session.organizationId || undefined}
        fixedOrganizationName={superadmin ? undefined : session.organizationName || undefined}
        returnTo="/dashboard/locations"
      />}
    />

    {params.created && <div className="notice success section">{params.created === "location" ? "Sububicación creada correctamente." : "Ubicación principal creada correctamente."}</div>}
    {message && <div className="notice error section">{message}</div>}

    <section className="section">
      <div className="site-grid">
        {sites.rows.map(site => <article className="card site-card" key={site.id} data-module-record data-status={site.active?"active":"inactive"} data-search={[site.name,site.organization_name,site.code,site.city,site.country].filter(Boolean).join(" ")}>
          <div className="site-card-header">
            <div>
              <span className={`status-badge ${site.active ? "status-active" : "status-inactive"}`}><span />{site.active ? "Activa" : "Inactiva"}</span>
              <h3>{site.name}</h3>
              <p>{site.organization_name} · {site.city || "Ciudad sin registrar"} · {site.country}</p>
            </div>
            <div className="site-stats"><strong>{site.location_count}</strong><span>sububicaciones</span></div>
          </div>
          <div className="owner-inline-row">
            <Link className="button" href={`/dashboard/locations/${site.id}`}>Administrar jerarquía</Link>
            {owner && <OwnerRecordActions table="sites" id={site.id} label={site.name} fields={[
              {name:"name",label:"Nombre",value:site.name},
              {name:"code",label:"Código",value:site.code||""},
              {name:"city",label:"Ciudad",value:site.city||""},
              {name:"country",label:"País",value:site.country},
              {name:"active",label:"Estado",value:site.active,type:"checkbox"},
            ]}/>}
          </div>
        </article>)}
      </div>
      {!sites.rowCount && <div className="card empty-state"><strong>No hay ubicaciones disponibles.</strong><span>Crea la primera sede para comenzar la estructura física.</span></div>}
    </section>
  </>;
}
