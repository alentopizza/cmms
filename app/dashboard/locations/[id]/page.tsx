import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessSite, getSession } from "@/lib/auth";
import { can, isPlatformOwner } from "@/lib/permissions";
import { query } from "@/lib/db";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import OwnerDeleteButton from "@/components/OwnerDeleteButton";
import { AssetCreateModal, SubLocationCreateModal } from "@/components/ContextCreateModals";
import BusinessHoursFields from "@/components/BusinessHoursFields";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Site = { id: string; organization_id: string; organization_name: string; name: string; code: string | null; address: string | null; city: string | null; country: string; active: boolean; max_sublocations: number; latitude:number|null; longitude:number|null; geofence_radius_m:number; business_days:number[]; business_open_time:string; business_close_time:string; business_schedule:import("@/lib/business-hours").BusinessDaySchedule[]; };
type Location = { id: string; parent_id: string | null; name: string; code: string | null; type: string; description: string | null; active: boolean; asset_count: number; child_count: number; };
type Supplier = { id: string; organization_id: string; name: string };

export default async function LocationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; saved?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session, "locations.manage")) redirect("/dashboard");
  const owner = isPlatformOwner(session);

  const [{ id }, feedback] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [siteResult, locationsResult] = await Promise.all([
    query<Site>(
      `SELECT s.id,s.organization_id,o.name organization_name,s.name,s.code,s.address,s.city,s.country,s.active,
              s.latitude,s.longitude,s.geofence_radius_m,
              s.business_days,s.business_open_time::text,s.business_close_time::text,s.business_schedule,
              COALESCE(ol.max_sublocations,100)::int max_sublocations
       FROM sites s JOIN organizations o ON o.id=s.organization_id
       LEFT JOIN organization_limits ol ON ol.organization_id=o.id WHERE s.id=$1`, [id]),
    query<Location>(
      `SELECT l.id,l.parent_id,l.name,l.code,l.type,l.description,l.active,
              count(DISTINCT a.id)::int asset_count,count(DISTINCT c.id)::int child_count
       FROM locations l LEFT JOIN assets a ON a.location_id=l.id LEFT JOIN locations c ON c.parent_id=l.id
       WHERE l.site_id=$1 GROUP BY l.id ORDER BY l.active DESC,l.name`, [id]),
  ]);
  if (!siteResult.rowCount) notFound();
  const site = siteResult.rows[0];
  if (session.platformRole === "user" && session.organizationId !== site.organization_id) redirect("/dashboard/locations");
  if (!canAccessSite(session, site.id)) redirect("/dashboard/locations");
  const suppliers = await query<Supplier>(
    "SELECT id,organization_id,name FROM suppliers WHERE organization_id=$1 AND active=true ORDER BY name",
    [site.organization_id],
  );
  const locations = locationsResult.rows;
  const siteOptions = [{ id: site.id, organization_id: site.organization_id, name: site.name, organization_name: site.organization_name }];
  const locationOptions = locations.map(location => ({
    id: location.id,
    organization_id: site.organization_id,
    site_id: site.id,
    name: location.name,
    label: location.name,
  }));
  const byParent = new Map<string | null, Location[]>();
  locations.forEach(location => byParent.set(location.parent_id, [...(byParent.get(location.parent_id) || []), location]));

  const message = feedback.error === "limit" ? `Se alcanzó el cupo de ${site.max_sublocations} sububicaciones.`
    : feedback.error === "code" ? "Ese código ya existe dentro de esta ubicación."
    : feedback.error === "site-geofence" ? "Revisa las coordenadas o el radio de la geocerca."
    : feedback.error ? "Revisa la información e inténtalo nuevamente."
    : feedback.created === "asset" ? "Activo creado y asociado a la sububicación seleccionada."
    : feedback.created ? "Sububicación creada correctamente."
    : feedback.saved ? "Cambios guardados correctamente." : "";

  function tree(parentId: string | null, depth = 0): React.ReactNode {
    return (byParent.get(parentId) || []).map(location => <div className="location-tree-row" style={{ "--location-depth": depth } as React.CSSProperties} key={location.id}>
      <div className="location-tree-main">
        <span className="location-type-icon" aria-hidden="true">{depth ? "⌁" : "⌂"}</span>
        <div><span className="eyebrow">{location.type}</span><strong>{location.name}</strong><small>{location.code || "Sin código"}{location.description ? ` · ${location.description}` : ""}</small></div>
      </div>
      <div className="location-tree-metrics"><span><b>{location.child_count}</b> áreas</span><span><b>{location.asset_count}</b> activos</span><span className={`status-badge ${location.active ? "status-active" : "status-inactive"}`}><i />{location.active ? "Activa" : "Inactiva"}</span></div>
      <details className="location-actions"><summary>Administrar</summary><div className="location-action-panel">
        {location.active && <div className="contextual-inline-actions">
          <AssetCreateModal
            sites={siteOptions}
            locations={locationOptions}
            suppliers={suppliers.rows}
            fixedSiteId={site.id}
            fixedSiteName={site.name}
            fixedLocationId={location.id}
            fixedLocationName={location.name}
            returnTo={"/dashboard/locations/"+site.id}
            triggerLabel="Crear activo aquí"
            secondary
          />
          <SubLocationCreateModal
            sites={siteOptions}
            locations={locationOptions}
            fixedSiteId={site.id}
            fixedSiteName={site.name}
            fixedParentId={location.id}
            returnTo={"/dashboard/locations/"+site.id}
            triggerLabel="Crear sububicación interna"
            secondary
          />
        </div>}
        <form method="post" action={`/api/locations/${location.id}`} className="form-grid">
          <input type="hidden" name="site_id" value={site.id} /><input type="hidden" name="intent" value="update" />
          <div className="field"><label>Nombre</label><input name="name" defaultValue={location.name} required /></div>
          <div className="field"><label>Código</label><input name="code" defaultValue={location.code || ""} /></div>
          <div className="field"><label>Tipo</label><select name="type" defaultValue={location.type}><option value="area">Área</option><option value="floor">Piso</option><option value="room">Habitación</option><option value="department">Departamento</option><option value="zone">Zona</option></select></div>
          <div className="field"><label>Descripción</label><input name="description" defaultValue={location.description || ""} /></div>
          <div className="form-span-2 form-actions"><ConfirmSubmitButton className="button secondary" confirmation="¿Seguro que quieres guardar estos cambios?">Guardar cambios</ConfirmSubmitButton></div>
        </form>
        <div className="owner-inline-row">
          <form method="post" action={`/api/locations/${location.id}`}><input type="hidden" name="site_id" value={site.id} /><input type="hidden" name="intent" value="toggle" /><ConfirmSubmitButton className="text-button" confirmation={`¿Seguro que quieres ${location.active ? "desactivar" : "activar"} esta sububicación?`}>{location.active ? "Desactivar" : "Activar"}</ConfirmSubmitButton></form>
          {owner && <OwnerDeleteButton table="locations" id={location.id} label={location.name} />}
        </div>
      </div></details>
      {(byParent.get(location.id)?.length || 0) > 0 && <div className="location-tree-children">{tree(location.id, depth + 1)}</div>}
    </div>);
  }

  return <>
    <header className="page-header"><div><Link className="back-link" href={session.platformRole !== "user" ? `/dashboard/companies/${site.organization_id}` : "/dashboard/locations"}>← {session.platformRole !== "user" ? site.organization_name : "Ubicaciones"}</Link><span className="eyebrow">Ubicación principal</span><h1 className="page-title">{site.name}</h1><p className="muted">{[site.address, site.city, site.country].filter(Boolean).join(" · ")}</p></div><span className={`status-badge ${site.active ? "status-active" : "status-inactive"}`}><span />{site.active ? "Activa" : "Inactiva"}</span></header>
    {message && <div className={`notice ${feedback.error ? "error" : "success"}`}>{message}</div>}
    <section className="contextual-action-bar section">
      <div>
        <span className="eyebrow">Acciones de {site.name}</span>
        <strong>Crear dentro de esta ubicación</strong>
        <small>La sede ya está seleccionada; no tendrás que volver a escogerla.</small>
      </div>
      <div className="contextual-action-buttons">
        <SubLocationCreateModal
          sites={siteOptions}
          locations={locationOptions}
          fixedSiteId={site.id}
          fixedSiteName={site.name}
          returnTo={"/dashboard/locations/"+site.id}
        />
      </div>
    </section>
    <section className="location-summary section"><div className="card compact-metric"><span>Sububicaciones</span><strong>{locations.length}</strong><small>de {site.max_sublocations} permitidas</small></div><div className="card compact-metric"><span>Disponibles</span><strong>{Math.max(site.max_sublocations - locations.length, 0)}</strong><small>según el plan asignado</small></div></section>
    <section className="card section">
      <div className="section-heading"><div><span className="eyebrow">Control de campo</span><h2>Geocerca de asistencia</h2><p className="muted">Define el punto GPS de esta sede y el radio permitido para entradas y salidas del personal de campo.</p></div><span className={`setup-flow-state ${site.latitude!==null && site.longitude!==null ? "ready":"blocked"}`}>{site.latitude!==null && site.longitude!==null ? "Configurada":"Pendiente"}</span></div>
      <form method="post" action={"/api/sites/"+site.id} className="form-grid">
        <input type="hidden" name="organization_id" value={site.organization_id}/>
        <input type="hidden" name="return_to" value={"/dashboard/locations/"+site.id}/>
        <input type="hidden" name="name" value={site.name}/>
        <input type="hidden" name="code" value={site.code||""}/>
        <input type="hidden" name="address" value={site.address||""}/>
        <input type="hidden" name="city" value={site.city||""}/>
        <input type="hidden" name="country" value={site.country}/>
        <div className="field"><label>Latitud</label><input name="latitude" type="number" step="0.000001" min="-90" max="90" defaultValue={site.latitude??""} placeholder="4.711000"/></div>
        <div className="field"><label>Longitud</label><input name="longitude" type="number" step="0.000001" min="-180" max="180" defaultValue={site.longitude??""} placeholder="-74.072100"/></div>
        <div className="field"><label>Radio permitido (metros)</label><input name="geofence_radius_m" type="number" min="20" max="5000" defaultValue={site.geofence_radius_m||250}/><small>Recomendado en campo: 100–300 m según precisión GPS y tamaño de la sede.</small></div>
        <div className="field"><label>Estado</label><div className="geofence-status-copy">{site.latitude!==null && site.longitude!==null ? `Punto: ${site.latitude.toFixed(6)}, ${site.longitude.toFixed(6)}` : "Aún sin coordenadas"}</div></div>
        <BusinessHoursFields
          days={site.business_days}
          openTime={site.business_open_time}
          closeTime={site.business_close_time}
          schedule={site.business_schedule}
          title="Horario de atención de la sede"
          description="Se usa en Reacción para saber si esta sede está abierta."
        />
        <div className="form-span-2 form-actions"><button className="button" type="submit">Guardar geocerca</button></div>
      </form>
    </section>
    <section className="section"><div className="section-heading"><div><span className="eyebrow">Estructura</span><h2>Mapa de espacios</h2></div><small>{locations.length} sububicaciones registradas</small></div>{locations.length ? <div className="location-tree">{tree(null)}</div> : <div className="card empty-state"><strong>Aún no hay sububicaciones.</strong><span>Crea la primera área dentro de {site.name}.</span></div>}</section>
  </>;
}
