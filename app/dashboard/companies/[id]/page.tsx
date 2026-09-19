import Link from "next/link";
import { notFound } from "next/navigation";
import { query } from "@/lib/db";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Organization = {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  tax_id: string | null;
  timezone: string;
  active: boolean;
  updated_at: string;
  asset_count: string;
  work_order_count: string;
  has_logo: boolean;
  has_cover: boolean;
};

type Site = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  country: string;
  active: boolean;
  asset_count: string;
  work_order_count: string;
};

function Feedback({ saved, created, error }: { saved?: string; created?: string; error?: string }) {
  if (error === "slug") return <div className="notice error">El identificador ya está siendo usado por otra empresa.</div>;
  if (error === "site-code") return <div className="notice error">Ese código de sede ya existe dentro de esta empresa.</div>;
  if (error === "image-type") return <div className="notice error">Las imágenes deben ser PNG, JPG o WebP.</div>;
  if (error === "image-size") return <div className="notice error">Una de las imágenes supera el tamaño permitido.</div>;
  if (error === "image-required") return <div className="notice error">Selecciona al menos una imagen para actualizar.</div>;
  if (error) return <div className="notice error">Revisa los campos obligatorios e inténtalo nuevamente.</div>;
  if (created === "company") return <div className="notice success">La empresa y su sede principal fueron creadas correctamente.</div>;
  if (created === "site") return <div className="notice success">La nueva sede fue creada correctamente.</div>;
  if (saved === "company") return <div className="notice success">La información de la empresa fue actualizada.</div>;
  if (saved === "assets") return <div className="notice success">El logo y la portada fueron actualizados.</div>;
  if (saved === "status") return <div className="notice success">El estado de la empresa fue actualizado.</div>;
  if (saved === "site-status") return <div className="notice success">El estado de la sede fue actualizado.</div>;
  if (saved === "site") return <div className="notice success">La información de la sede fue actualizada.</div>;
  return null;
}

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; created?: string; error?: string }>;
}) {
  const [{ id }, feedback] = await Promise.all([params, searchParams]);
  if (!UUID_PATTERN.test(id)) notFound();

  const [organizationResult, sitesResult] = await Promise.all([
    query<Organization>(
      `SELECT o.id,o.name,o.slug,o.legal_name,o.tax_id,o.timezone,o.active,o.updated_at::text,
        (o.logo_data IS NOT NULL) has_logo,
        (o.cover_data IS NOT NULL) has_cover,
        (SELECT count(*)::text FROM assets a WHERE a.organization_id=o.id) asset_count,
        (SELECT count(*)::text FROM work_orders w WHERE w.organization_id=o.id) work_order_count
       FROM organizations o WHERE o.id=$1`,
      [id],
    ),
    query<Site>(
      `SELECT s.id,s.name,s.code,s.address,s.city,s.country,s.active,
        count(DISTINCT a.id)::text asset_count,
        count(DISTINCT w.id)::text work_order_count
       FROM sites s
       LEFT JOIN assets a ON a.site_id=s.id
       LEFT JOIN work_orders w ON w.site_id=s.id
       WHERE s.organization_id=$1
       GROUP BY s.id
       ORDER BY s.active DESC,s.name`,
      [id],
    ),
  ]);

  if (!organizationResult.rowCount) notFound();
  const organization = organizationResult.rows[0];
  const sites = sitesResult.rows;
  const activeSites = sites.filter(site => site.active).length;

  return <>
    <div className="page-header company-page-header">
      <div>
        <Link className="back-link" href="/dashboard/companies">← Empresas y sedes</Link>
        <span className="eyebrow">Detalle de empresa</span>
        <h1 className="page-title">{organization.name}</h1>
        <p className="muted">Administra la información general, el estado y las sedes de esta empresa.</p>
      </div>
      <span className={`status-badge ${organization.active ? "status-active" : "status-inactive"}`}>
        <span aria-hidden="true" />
        {organization.active ? "Empresa activa" : "Empresa inactiva"}
      </span>
    </div>

    <div className="section">
      <Feedback saved={feedback.saved} created={feedback.created} error={feedback.error} />
    </div>

    <section className="company-metrics section">
      <div className="card compact-metric"><span>Sedes activas</span><strong>{activeSites}</strong><small>de {sites.length} registradas</small></div>
      <div className="card compact-metric"><span>Activos</span><strong>{organization.asset_count}</strong><small>equipos registrados</small></div>
      <div className="card compact-metric"><span>Órdenes</span><strong>{organization.work_order_count}</strong><small>histórico total</small></div>
    </section>

    <section className="card section company-visual-settings">
      <div className="section-heading">
        <div><span className="eyebrow">Identidad visual</span><h2>Logo y foto de portada</h2></div>
        <small>Estas imágenes se muestran en la tarjeta de la empresa.</small>
      </div>
      <div className="company-assets-current">
        <div className="company-current-logo">
          {organization.has_logo
            ? <img src={`/api/organizations/${organization.id}/assets/logo`} alt={`Logo de ${organization.name}`} />
            : <span>Sin logo</span>}
        </div>
        <div className="company-current-cover">
          {organization.has_cover
            ? <img src={`/api/organizations/${organization.id}/assets/cover`} alt={`Portada de ${organization.name}`} />
            : <span>Sin portada</span>}
        </div>
      </div>
      <form className="form-grid company-assets-form" method="post" action={`/api/organizations/${organization.id}`} encType="multipart/form-data">
        <input type="hidden" name="intent" value="assets" />
        <div className="field"><label htmlFor="company-logo">Reemplazar logo</label><input id="company-logo" type="file" name="logo" accept="image/png,image/jpeg,image/webp" /></div>
        <div className="field"><label htmlFor="company-cover">Reemplazar portada</label><input id="company-cover" type="file" name="cover" accept="image/png,image/jpeg,image/webp" /></div>
        <div className="form-span-2 form-actions"><button className="button secondary" type="submit">Actualizar imágenes</button></div>
      </form>
    </section>

    <section className="company-detail-grid section">
      <div className="card">
        <div className="section-heading">
          <div><span className="eyebrow">Información general</span><h2>Editar empresa</h2></div>
          <small>Última actualización: {new Date(organization.updated_at).toLocaleDateString("es-CO")}</small>
        </div>
        <form className="form-grid" method="post" action={`/api/organizations/${organization.id}`}>
          <input type="hidden" name="intent" value="update" />
          <div className="field"><label htmlFor="company-name">Nombre comercial</label><input id="company-name" name="name" defaultValue={organization.name} required /></div>
          <div className="field"><label htmlFor="company-legal-name">Razón social</label><input id="company-legal-name" name="legal_name" defaultValue={organization.legal_name || ""} placeholder="Nombre legal de la empresa" /></div>
          <div className="field"><label htmlFor="company-tax-id">NIT / Identificación</label><input id="company-tax-id" name="tax_id" defaultValue={organization.tax_id || ""} placeholder="900.000.000-0" /></div>
          <div className="field"><label htmlFor="company-slug">Identificador</label><input id="company-slug" name="slug" defaultValue={organization.slug} required /></div>
          <div className="field form-span-2"><label htmlFor="company-timezone">Zona horaria</label>
            <select id="company-timezone" name="timezone" defaultValue={organization.timezone}>
              <option value="America/Bogota">Colombia · America/Bogota</option>
              <option value="America/Lima">Perú · America/Lima</option>
              <option value="America/Mexico_City">México · America/Mexico_City</option>
              <option value="America/New_York">Estados Unidos · America/New_York</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
          <div className="form-span-2 form-actions"><button className="button" type="submit">Guardar cambios</button></div>
        </form>
      </div>

      <aside className="card company-state-card">
        <div>
          <span className="eyebrow">Disponibilidad</span>
          <h2>{organization.active ? "Empresa habilitada" : "Empresa deshabilitada"}</h2>
          <p className="muted">{organization.active
            ? "La empresa está disponible para la operación y sus datos permanecen visibles."
            : "La empresa conserva toda su información, pero queda marcada como inactiva."}</p>
        </div>
        <form method="post" action={`/api/organizations/${organization.id}`}>
          <input type="hidden" name="intent" value="toggle" />
          <button className={`button ${organization.active ? "danger-secondary" : ""}`} type="submit">
            {organization.active ? "Desactivar empresa" : "Activar empresa"}
          </button>
        </form>
      </aside>
    </section>

    <section className="card section">
      <div className="section-heading">
        <div><span className="eyebrow">Nueva ubicación</span><h2>Crear sede</h2></div>
        <small>Puedes registrar todas las sedes necesarias.</small>
      </div>
      <form className="form-grid site-create-form" method="post" action={`/api/organizations/${organization.id}/sites`}>
        <div className="field"><label htmlFor="new-site-name">Nombre de la sede</label><input id="new-site-name" name="name" required placeholder="Sede principal" /></div>
        <div className="field"><label htmlFor="new-site-code">Código</label><input id="new-site-code" name="code" placeholder="BOG-01" /></div>
        <div className="field"><label htmlFor="new-site-address">Dirección</label><input id="new-site-address" name="address" placeholder="Calle 00 # 00-00" /></div>
        <div className="field"><label htmlFor="new-site-city">Ciudad</label><input id="new-site-city" name="city" placeholder="Bogotá" /></div>
        <div className="field"><label htmlFor="new-site-country">País</label><input id="new-site-country" name="country" defaultValue="CO" maxLength={2} /></div>
        <div className="field site-create-action"><label>&nbsp;</label><button className="button" type="submit">Crear sede</button></div>
      </form>
    </section>

    <section className="section">
      <div className="section-heading sites-heading">
        <div><span className="eyebrow">Ubicaciones registradas</span><h2>Sedes ({sites.length})</h2></div>
      </div>

      {sites.length === 0 ? <div className="card empty-state"><strong>Aún no hay sedes registradas.</strong><span>Completa el formulario anterior para crear la primera.</span></div> :
      <div className="site-grid">
        {sites.map(site => <article className="card site-card" key={site.id}>
          <div className="site-card-header">
            <div>
              <span className={`status-badge ${site.active ? "status-active" : "status-inactive"}`}><span aria-hidden="true" />{site.active ? "Activa" : "Inactiva"}</span>
              <h3>{site.name}</h3>
              <p>{site.city || "Ciudad sin registrar"} · {site.country}</p>
            </div>
            <div className="site-stats"><strong>{site.asset_count}</strong><span>activos</span><strong>{site.work_order_count}</strong><span>OT</span></div>
          </div>

          <form className="form-grid site-edit-form" method="post" action={`/api/sites/${site.id}`}>
            <input type="hidden" name="organization_id" value={organization.id} />
            <input type="hidden" name="intent" value="update" />
            <div className="field"><label htmlFor={`site-name-${site.id}`}>Nombre</label><input id={`site-name-${site.id}`} name="name" defaultValue={site.name} required /></div>
            <div className="field"><label htmlFor={`site-code-${site.id}`}>Código</label><input id={`site-code-${site.id}`} name="code" defaultValue={site.code || ""} /></div>
            <div className="field form-span-2"><label htmlFor={`site-address-${site.id}`}>Dirección</label><input id={`site-address-${site.id}`} name="address" defaultValue={site.address || ""} /></div>
            <div className="field"><label htmlFor={`site-city-${site.id}`}>Ciudad</label><input id={`site-city-${site.id}`} name="city" defaultValue={site.city || ""} /></div>
            <div className="field"><label htmlFor={`site-country-${site.id}`}>País</label><input id={`site-country-${site.id}`} name="country" defaultValue={site.country} maxLength={2} /></div>
            <div className="form-span-2 form-actions"><button className="button secondary" type="submit">Guardar sede</button></div>
          </form>

          <form className="site-status-form" method="post" action={`/api/sites/${site.id}`}>
            <input type="hidden" name="organization_id" value={organization.id} />
            <input type="hidden" name="intent" value="toggle" />
            <button className={`text-button ${site.active ? "text-danger" : ""}`} type="submit">
              {site.active ? "Desactivar sede" : "Activar sede"}
            </button>
          </form>
        </article>)}
      </div>}
    </section>
  </>;
}
