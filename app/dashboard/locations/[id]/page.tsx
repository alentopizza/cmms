import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Site = { id: string; organization_id: string; organization_name: string; name: string; code: string | null; address: string | null; city: string | null; country: string; active: boolean; max_sublocations: number; };
type Location = { id: string; parent_id: string | null; name: string; code: string | null; type: string; description: string | null; active: boolean; asset_count: number; child_count: number; };

export default async function LocationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; saved?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session, "locations.manage")) redirect("/dashboard");

  const [{ id }, feedback] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [siteResult, locationsResult] = await Promise.all([
    query<Site>(
      `SELECT s.id,s.organization_id,o.name organization_name,s.name,s.code,s.address,s.city,s.country,s.active,
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
  if (session.platformRole !== "superadmin" && session.organizationId !== site.organization_id) redirect("/dashboard/locations");
  const locations = locationsResult.rows;
  const byParent = new Map<string | null, Location[]>();
  locations.forEach(location => byParent.set(location.parent_id, [...(byParent.get(location.parent_id) || []), location]));

  const message = feedback.error === "limit" ? `Se alcanzó el cupo de ${site.max_sublocations} sububicaciones.`
    : feedback.error === "code" ? "Ese código ya existe dentro de esta ubicación."
    : feedback.error ? "Revisa la información e inténtalo nuevamente."
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
        <form method="post" action={`/api/locations/${location.id}`} className="form-grid">
          <input type="hidden" name="site_id" value={site.id} /><input type="hidden" name="intent" value="update" />
          <div className="field"><label>Nombre</label><input name="name" defaultValue={location.name} required /></div>
          <div className="field"><label>Código</label><input name="code" defaultValue={location.code || ""} /></div>
          <div className="field"><label>Tipo</label><select name="type" defaultValue={location.type}><option value="area">Área</option><option value="floor">Piso</option><option value="room">Habitación</option><option value="department">Departamento</option><option value="zone">Zona</option></select></div>
          <div className="field"><label>Descripción</label><input name="description" defaultValue={location.description || ""} /></div>
          <div className="form-span-2 form-actions"><ConfirmSubmitButton className="button secondary" confirmation="¿Seguro que quieres guardar estos cambios?">Guardar cambios</ConfirmSubmitButton></div>
        </form>
        <form method="post" action={`/api/locations/${location.id}`}><input type="hidden" name="site_id" value={site.id} /><input type="hidden" name="intent" value="toggle" /><ConfirmSubmitButton className="text-button" confirmation={`¿Seguro que quieres ${location.active ? "desactivar" : "activar"} esta sububicación?`}>{location.active ? "Desactivar" : "Activar"}</ConfirmSubmitButton></form>
      </div></details>
      {(byParent.get(location.id)?.length || 0) > 0 && <div className="location-tree-children">{tree(location.id, depth + 1)}</div>}
    </div>);
  }

  return <>
    <header className="page-header"><div><Link className="back-link" href={`/dashboard/companies/${site.organization_id}`}>← {site.organization_name}</Link><span className="eyebrow">Ubicación principal</span><h1 className="page-title">{site.name}</h1><p className="muted">{[site.address, site.city, site.country].filter(Boolean).join(" · ")}</p></div><span className={`status-badge ${site.active ? "status-active" : "status-inactive"}`}><span />{site.active ? "Activa" : "Inactiva"}</span></header>
    {message && <div className={`notice ${feedback.error ? "error" : "success"}`}>{message}</div>}
    <section className="location-summary section"><div className="card compact-metric"><span>Sububicaciones</span><strong>{locations.length}</strong><small>de {site.max_sublocations} permitidas</small></div><div className="card compact-metric"><span>Disponibles</span><strong>{Math.max(site.max_sublocations - locations.length, 0)}</strong><small>según el plan asignado</small></div></section>
    <section className="card section location-create-card"><div className="section-heading"><div><span className="eyebrow">Jerarquía física</span><h2>Crear sububicación</h2></div><small>Puede depender de la ubicación principal o de otra sububicación.</small></div>
      <form className="form-grid" method="post" action={`/api/sites/${site.id}/locations`}>
        <div className="field"><label htmlFor="location-name">Nombre</label><input id="location-name" name="name" required placeholder="Consultorio 001" /></div>
        <div className="field"><label htmlFor="location-code">Código</label><input id="location-code" name="code" placeholder="CONS-001" /></div>
        <div className="field"><label htmlFor="location-parent">Ubicación superior</label><select id="location-parent" name="parent_id"><option value="">{site.name} (nivel principal)</option>{locations.map(location => <option value={location.id} key={location.id}>{location.name}</option>)}</select></div>
        <div className="field"><label htmlFor="location-type">Tipo</label><select id="location-type" name="type"><option value="area">Área</option><option value="floor">Piso</option><option value="room">Habitación</option><option value="department">Departamento</option><option value="zone">Zona</option></select></div>
        <div className="field form-span-2"><label htmlFor="location-description">Descripción</label><input id="location-description" name="description" placeholder="Referencia para técnicos y responsables" /></div>
        <div className="form-span-2 form-actions"><button className="button" disabled={locations.length >= site.max_sublocations}>Crear sububicación</button></div>
      </form>
    </section>
    <section className="section"><div className="section-heading"><div><span className="eyebrow">Estructura</span><h2>Mapa de espacios</h2></div><small>{locations.length} sububicaciones registradas</small></div>{locations.length ? <div className="location-tree">{tree(null)}</div> : <div className="card empty-state"><strong>Aún no hay sububicaciones.</strong><span>Crea la primera área dentro de {site.name}.</span></div>}</section>
  </>;
}
