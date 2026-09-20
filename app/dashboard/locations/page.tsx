import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";

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
  const superadmin = session.platformRole === "superadmin";
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

  const message = params.error === "site-limit"
    ? "La empresa alcanzó el límite de ubicaciones principales asignado."
    : params.error === "site-code"
      ? "Ese código de sede ya existe dentro de la empresa."
      : params.error
        ? "Revisa la información de la ubicación."
        : "";

  return <>
    <header className="page-header">
      <div>
        <span className="eyebrow">Estructura física</span>
        <h1 className="page-title">Ubicaciones</h1>
        <p className="muted">Administra las sedes principales y entra a su jerarquía de áreas, pisos, habitaciones y zonas.</p>
      </div>
      <div className="brand-pill"><span /> {sites.rowCount} sedes</div>
    </header>

    {params.created && <div className="notice success section">Ubicación principal creada correctamente.</div>}
    {message && <div className="notice error section">{message}</div>}

    {!superadmin && session.organizationId && session.accessAllSites && <section className="card section">
      <div className="section-heading">
        <div><span className="eyebrow">Nueva ubicación principal</span><h2>Crear sede</h2></div>
        <small>{session.organizationName}</small>
      </div>
      <form className="form-grid" method="post" action={`/api/organizations/${session.organizationId}/sites`}>
        <div className="field"><label>Nombre</label><input name="name" required placeholder="Sede principal" /></div>
        <div className="field"><label>Código</label><input name="code" placeholder="MED-01" /></div>
        <div className="field form-span-2"><label>Dirección</label><input name="address" /></div>
        <div className="field"><label>Ciudad</label><input name="city" /></div>
        <div className="field"><label>País</label><input name="country" defaultValue="CO" maxLength={2} /></div>
        <div className="form-span-2 form-actions"><button className="button">Crear ubicación</button></div>
      </form>
    </section>}

    <section className="section">
      <div className="site-grid">
        {sites.rows.map(site => <article className="card site-card" key={site.id}>
          <div className="site-card-header">
            <div>
              <span className={`status-badge ${site.active ? "status-active" : "status-inactive"}`}><span />{site.active ? "Activa" : "Inactiva"}</span>
              <h3>{site.name}</h3>
              <p>{site.organization_name} · {site.city || "Ciudad sin registrar"} · {site.country}</p>
            </div>
            <div className="site-stats"><strong>{site.location_count}</strong><span>sububicaciones</span></div>
          </div>
          <Link className="button" href={`/dashboard/locations/${site.id}`}>Administrar jerarquía</Link>
        </article>)}
      </div>
      {!sites.rowCount && <div className="card empty-state"><strong>No hay ubicaciones disponibles.</strong><span>Crea la primera sede para comenzar la estructura física.</span></div>}
    </section>
  </>;
}
