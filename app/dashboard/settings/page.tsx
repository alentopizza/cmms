import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, isPlatformOwner } from "@/lib/permissions";
import { query } from "@/lib/db";
import { subscriptionLabel } from "@/lib/billing";
import ThemePreferences from "@/components/ThemePreferences";
import { getCustomizationSummary, logoOnDarkSrc, logoOnLightSrc } from "@/lib/customization";

type CompanySettingsRow = {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  timezone: string;
  active: boolean;
  site_count: number;
  active_site_count: number;
  sublocation_count: number;
  asset_count: number;
  inventory_item_count: number;
  technician_count: number;
  user_count: number;
  max_sites: number;
  max_sublocations: number;
  max_assets: number;
  max_inventory_items: number;
  max_technicians: number;
  plan_code: "trial" | "basic" | "medium" | "pro";
  plan_name: string;
  plan_description: string | null;
  subscription_status: "trialing" | "trial_expired" | "active" | "past_due" | "suspended" | "canceled";
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  white_label: boolean;
  branding_app_name: string | null;
  branding_primary_color: string | null;
  branding_secondary_color: string | null;
  branding_logo_light: boolean;
  branding_logo_dark: boolean;
  show_desweb_branding: boolean;
};

type ResourceCard = {
  key: string;
  label: string;
  description: string;
  used: number;
  limit: number;
  icon: string;
};

function resourceState(used: number, limit: number) {
  if (limit <= 0) return { ratio: used > 0 ? 100 : 0, state: used > 0 ? "critical" : "normal", label: used > 0 ? "Sin cupo" : "Disponible" };
  const ratio = Math.min(100, Math.round((used / limit) * 100));
  if (ratio >= 95) return { ratio, state: "critical", label: "Crítico" };
  if (ratio >= 80) return { ratio, state: "warning", label: "Próximo al límite" };
  return { ratio, state: "normal", label: "Disponible" };
}

function CompanySettings({
  company,
  brandingSaved,
  brandingError,
  planUpdated,
  welcome,
}: {
  company: CompanySettingsRow;
  brandingSaved?: boolean;
  brandingError?: boolean;
  planUpdated?: boolean;
  welcome?: boolean;
}) {
  const resources: ResourceCard[] = [
    { key: "sites", label: "Ubicaciones principales", description: "Sedes principales habilitadas para la empresa.", used: company.site_count, limit: company.max_sites, icon: "⌂" },
    { key: "locations", label: "Sububicaciones", description: "Áreas, pisos, habitaciones y demás espacios internos.", used: company.sublocation_count, limit: company.max_sublocations, icon: "⌗" },
    { key: "assets", label: "Activos", description: "Equipos y activos registrados dentro de la operación.", used: company.asset_count, limit: company.max_assets, icon: "◇" },
    { key: "inventory", label: "Inventario", description: "Artículos y repuestos controlados por existencia.", used: company.inventory_item_count, limit: company.max_inventory_items, icon: "▤" },
    { key: "technicians", label: "Técnicos", description: "Usuarios con rol técnico asignados a la empresa.", used: company.technician_count, limit: company.max_technicians, icon: "◎" },
  ];

  return <>
    <header className="page-header settings-page-header">
      <div>
        <span className="eyebrow">Empresa</span>
        <h1 className="page-title">Configuración de empresa</h1>
        <p className="muted">Consulta la información de tu organización y el consumo de los recursos asignados por la plataforma.</p>
      </div>
      <span className="settings-status"><i /> {company.active ? "Empresa activa" : "Empresa inactiva"}</span>
    </header>

    {welcome && <div className="notice success section">Tu empresa fue creada correctamente. Ya puedes revisar el plan, sus fechas y los recursos disponibles.</div>}
    {planUpdated && <div className="notice success section">Tu plan fue actualizado correctamente y los nuevos recursos ya están disponibles.</div>}

    <section className="company-settings-hero section">
      <article className="card company-plan-banner">
        <div>
          <span className="settings-kicker">Plan actual</span>
          <h2>{company.plan_name}</h2>
          <p>{company.plan_description}</p>
        </div>
        <div className="company-plan-meta company-plan-meta-detailed">
          <div><span>Estado</span><strong>{subscriptionLabel(company.subscription_status, company.trial_ends_at)}</strong></div>
          <div><span>Inicio</span><strong>{company.trial_started_at || company.current_period_start ? new Date(company.trial_started_at || company.current_period_start || "").toLocaleDateString("es-CO") : "No registrado"}</strong></div>
          <div><span>{company.subscription_status === "trialing" ? "Fin de prueba" : "Fin del periodo"}</span><strong>{company.subscription_status === "trialing" && company.trial_ends_at
            ? new Date(company.trial_ends_at).toLocaleDateString("es-CO")
            : company.current_period_end
              ? new Date(company.current_period_end).toLocaleDateString("es-CO")
              : "No registrado"}</strong></div>
          <Link className="button company-plan-upgrade" href="/#planes">{company.plan_code === "pro" ? "Ver planes" : "Mejorar plan"}</Link>
        </div>
      </article>

      <article className="card company-settings-profile">
        <div className="company-settings-profile-mark">{company.name.split(/\s+/).slice(0,2).map(part => part[0]).join("").toUpperCase()}</div>
        <div>
          <span className="settings-kicker">Información de la empresa</span>
          <h2>{company.name}</h2>
          <p>{company.legal_name || "Razón social no registrada"}</p>
        </div>
        <div className="company-settings-profile-meta">
          <div><span>NIT / Identificación</span><strong>{company.tax_id || "Sin registrar"}</strong></div>
          <div><span>Zona horaria</span><strong>{company.timezone}</strong></div>
          <div><span>Sedes activas</span><strong>{company.active_site_count} de {company.site_count}</strong></div>
          <div><span>Usuarios</span><strong>{company.user_count}</strong></div>
        </div>
      </article>
    </section>

    <section className="section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Capacidad contratada</span>
          <h2>Recursos asignados</h2>
          <p className="muted">Estos valores son informativos. Solo el Superadministrador puede modificar los cupos asignados.</p>
        </div>
      </div>

      <div className="company-entitlement-grid">
        {resources.map(resource => {
          const status = resourceState(resource.used, resource.limit);
          return <article className={`card company-entitlement-card company-entitlement-${status.state}`} key={resource.key}>
            <div className="company-entitlement-head">
              <span className="company-entitlement-icon" aria-hidden="true">{resource.icon}</span>
              <span className={`company-entitlement-status company-entitlement-status-${status.state}`}>{status.label}</span>
            </div>
            <div className="company-entitlement-copy">
              <span>{resource.label}</span>
              <strong><b>{resource.used}</b><small> / {resource.limit}</small></strong>
              <p>{resource.description}</p>
            </div>
            <div className="company-entitlement-progress" aria-label={`${status.ratio}% consumido`}>
              <span style={{ width: `${status.ratio}%` }} />
            </div>
            <div className="company-entitlement-foot">
              <span>{status.ratio}% consumido</span>
              <strong>{Math.max(0, resource.limit - resource.used)} disponibles</strong>
            </div>
          </article>;
        })}
      </div>

      <div className="company-resource-legend">
        <span><i className="normal" /> Menos de 80%</span>
        <span><i className="warning" /> 80% a 94%</span>
        <span><i className="critical" /> 95% o más</span>
      </div>
    </section>

    {company.white_label && <section className="card section white-label-panel">
      <div className="settings-panel-head">
        <div>
          <span className="settings-kicker">Pro · Marca blanca</span>
          <h2>Identidad de tu plataforma</h2>
          <p>Personaliza el nombre, colores y logos visibles dentro del panel de tu empresa.</p>
        </div>
        <span className="settings-panel-icon" aria-hidden="true">✦</span>
      </div>
      {brandingSaved && <div className="notice success">La identidad visual de tu empresa se actualizó correctamente.</div>}
      {brandingError && <div className="notice error">No fue posible guardar la personalización. Revisa colores y archivos.</div>}
      <form className="white-label-form" method="post" action="/api/organization-branding" encType="multipart/form-data">
        <div className="form-grid">
          <div className="field form-span-2"><label>Nombre de la plataforma</label><input name="app_name" defaultValue={company.branding_app_name || `${company.name} CMMS`} required /></div>
          <div className="field"><label>Color principal</label><input name="primary_color" type="color" defaultValue={company.branding_primary_color || "#38B2A9"} required /></div>
          <div className="field"><label>Color secundario</label><input name="secondary_color" type="color" defaultValue={company.branding_secondary_color || "#79CAC4"} required /></div>
          <div className="field"><label>Logo para fondo claro</label><input name="logo_on_light" type="file" accept="image/png,image/jpeg,image/webp" /><small>{company.branding_logo_light ? "Logo personalizado cargado." : "PNG, JPG o WebP · máximo 2 MB."}</small></div>
          <div className="field"><label>Logo para fondo oscuro</label><input name="logo_on_dark" type="file" accept="image/png,image/jpeg,image/webp" /><small>{company.branding_logo_dark ? "Logo personalizado cargado." : "PNG, JPG o WebP · máximo 2 MB."}</small></div>
          <label className="white-label-checkbox form-span-2"><input name="show_desweb_branding" type="checkbox" defaultChecked={company.show_desweb_branding} /><span>Mostrar “Desweb · Desarrollo de Soluciones” en el pie del panel.</span></label>
        </div>
        <div className="form-actions"><button className="button" type="submit">Guardar identidad visual</button></div>
      </form>
    </section>}

    <section className="settings-grid section company-settings-actions">
      <article className="card settings-panel">
        <div className="settings-panel-head">
          <div>
            <span className="settings-kicker">Acceso</span>
            <h2>Usuarios y roles</h2>
            <p>Administra cuentas de tu organización y define el alcance por sede de cada usuario.</p>
          </div>
          <span className="settings-panel-icon" aria-hidden="true">◎</span>
        </div>
        <Link className="settings-link-card" href="/dashboard/users">
          <div><strong>Administrar usuarios</strong><span>Roles, sedes y permisos operativos</span></div>
          <b aria-hidden="true">→</b>
        </Link>
      </article>

      <article className="card settings-panel">
        <div className="settings-panel-head">
          <div>
            <span className="settings-kicker">Estructura</span>
            <h2>Ubicaciones</h2>
            <p>Consulta y administra las sedes y sububicaciones permitidas dentro del cupo asignado.</p>
          </div>
          <span className="settings-panel-icon" aria-hidden="true">⌂</span>
        </div>
        <Link className="settings-link-card" href="/dashboard/locations">
          <div><strong>Administrar ubicaciones</strong><span>Sedes, áreas y jerarquía física</span></div>
          <b aria-hidden="true">→</b>
        </Link>
      </article>
    </section>
  </>;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ branding_saved?: string; branding_error?: string; plan_updated?: string; welcome?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const params = await searchParams;

  const isPlatformAdmin = can(session, "personalization.manage");
  const isCompanyAdmin = can(session, "settings.view");

  if (!isPlatformAdmin && !isCompanyAdmin) redirect("/dashboard");

  if (isPlatformAdmin) {
    const customization = await getCustomizationSummary();
    return <>
      <header className="page-header settings-page-header">
        <div>
          <span className="eyebrow">Plataforma</span>
          <h1 className="page-title">Configuración</h1>
          <p className="muted">Centraliza la apariencia, la identidad visual y las preferencias globales de Desweb CMMS.</p>
        </div>
        <span className="settings-status"><i /> Configuración global</span>
      </header>

      {params.branding_saved === "1" && <div className="notice success section">La identidad visual global se actualizó correctamente.</div>}
      {params.branding_error && <div className="notice error section">{params.branding_error}</div>}

      <section className="settings-grid section">
        <article className="card settings-panel settings-panel-wide">
          <div className="settings-panel-head">
            <div>
              <span className="settings-kicker">Apariencia</span>
              <h2>Tema de la interfaz</h2>
              <p>Elige cómo quieres visualizar la plataforma. Esta preferencia se guarda en este navegador.</p>
            </div>
            <span className="settings-panel-icon" aria-hidden="true">◐</span>
          </div>
          <ThemePreferences />
        </article>

        <article className="card settings-panel settings-panel-branding settings-panel-wide">
          <div className="settings-panel-head">
            <div>
              <span className="settings-kicker">Identidad visual</span>
              <h2>Marca de la plataforma</h2>
              <p>Administra directamente los recursos gráficos globales usados por Desweb CMMS.</p>
            </div>
            <span className="settings-panel-icon" aria-hidden="true">✦</span>
          </div>

          <form className="platform-branding-form" method="post" action="/api/customization" encType="multipart/form-data">
            <input type="hidden" name="return_to" value="settings" />
            <div className="platform-branding-grid">
              <article className="platform-brand-asset">
                <div className="platform-brand-preview platform-brand-preview-light">
                  <img src={logoOnLightSrc(customization)} alt="Logo actual para fondos claros" />
                </div>
                <div className="platform-brand-copy">
                  <span>Logo para fondos claros</span>
                  <strong>Versión oscura / principal</strong>
                  <p>Se usa sobre superficies blancas o muy claras.</p>
                  <ul>
                    <li>Formatos: PNG, JPG, WebP o SVG</li>
                    <li>Tamaño máximo: 2 MB</li>
                    <li>Recomendado: fondo transparente, 1200×320 px aprox.</li>
                  </ul>
                </div>
                <div className="field">
                  <label htmlFor="settings-logo-light">Reemplazar archivo</label>
                  <input id="settings-logo-light" name="logo_on_light" type="file" accept=".png,.webp,.svg,.jpg,.jpeg,image/png,image/webp,image/svg+xml,image/jpeg" />
                </div>
              </article>

              <article className="platform-brand-asset">
                <div className="platform-brand-preview platform-brand-preview-dark">
                  <img src={logoOnDarkSrc(customization)} alt="Logo actual para fondos oscuros" />
                </div>
                <div className="platform-brand-copy">
                  <span>Logo para fondos oscuros</span>
                  <strong>Versión blanca / negativa</strong>
                  <p>Se usa en sidebar, fondos oscuros y superficies de alto contraste.</p>
                  <ul>
                    <li>Formatos: PNG, JPG, WebP o SVG</li>
                    <li>Tamaño máximo: 2 MB</li>
                    <li>Recomendado: fondo transparente, 1200×320 px aprox.</li>
                  </ul>
                </div>
                <div className="field">
                  <label htmlFor="settings-logo-dark">Reemplazar archivo</label>
                  <input id="settings-logo-dark" name="logo_on_dark" type="file" accept=".png,.webp,.svg,.jpg,.jpeg,image/png,image/webp,image/svg+xml,image/jpeg" />
                </div>
              </article>

              <article className="platform-brand-asset">
                <div className="platform-brand-preview platform-brand-preview-favicon">
                  <img src="/api/customization/assets/favicon" alt="Favicon actual" />
                </div>
                <div className="platform-brand-copy">
                  <span>Favicon</span>
                  <strong>Icono del navegador</strong>
                  <p>Se muestra en pestañas, accesos directos y marcadores.</p>
                  <ul>
                    <li>Formatos: ICO, PNG, WebP o SVG</li>
                    <li>Tamaño máximo: 2 MB</li>
                    <li>Recomendado: cuadrado, 64×64 o 128×128 px</li>
                  </ul>
                </div>
                <div className="field">
                  <label htmlFor="settings-favicon">Reemplazar archivo</label>
                  <input id="settings-favicon" name="favicon" type="file" accept=".ico,.png,.webp,.svg,image/x-icon,image/png,image/webp,image/svg+xml" />
                </div>
              </article>
            </div>

            <div className="platform-branding-actions">
              <div>
                <strong>Guardar identidad visual</strong>
                <span>Solo se reemplazan los archivos que selecciones.</span>
              </div>
              <button className="button" type="submit">Guardar cambios</button>
            </div>
          </form>
        </article>

        {isPlatformOwner(session) && <article className="card settings-panel">
          <div className="settings-panel-head">
            <div>
              <span className="settings-kicker">Propietario Desweb</span>
              <h2>Eliminación universal</h2>
              <p>Herramienta exclusiva de desarrollo para eliminar registros aunque tengan dependencias o historial relacionado.</p>
            </div>
            <span className="settings-panel-icon" aria-hidden="true">⌫</span>
          </div>
          <Link className="settings-link-card" href="/dashboard/platform-owner/purge">
            <div><strong>Abrir zona destructiva</strong><span>Eliminación por tabla, registro y dependencias FK</span></div>
            <b aria-hidden="true">→</b>
          </Link>
        </article>}

        <article className="card settings-panel">
          <div className="settings-panel-head">
            <div>
              <span className="settings-kicker">Acceso</span>
              <h2>Usuarios y permisos</h2>
              <p>Gestiona las cuentas, roles y alcance operativo de quienes ingresan al CMMS.</p>
            </div>
            <span className="settings-panel-icon" aria-hidden="true">◎</span>
          </div>
          <Link className="settings-link-card" href="/dashboard/users">
            <div><strong>Administrar usuarios</strong><span>Roles, empresas, sedes y estado de acceso</span></div>
            <b aria-hidden="true">→</b>
          </Link>
        </article>
      </section>
    </>;
  }

  if (!session.organizationId) redirect("/dashboard");

  const company = await query<CompanySettingsRow>(
    `SELECT o.id,o.name,o.legal_name,o.tax_id,o.timezone,o.active,
            (SELECT count(*)::int FROM sites s WHERE s.organization_id=o.id) site_count,
            (SELECT count(*)::int FROM sites s WHERE s.organization_id=o.id AND s.active=true) active_site_count,
            (SELECT count(*)::int FROM locations l WHERE l.organization_id=o.id) sublocation_count,
            (SELECT count(*)::int FROM assets a WHERE a.organization_id=o.id) asset_count,
            (SELECT count(*)::int FROM inventory_items i WHERE i.organization_id=o.id) inventory_item_count,
            (SELECT count(*)::int FROM organization_members om WHERE om.organization_id=o.id AND om.role='technician') technician_count,
            (SELECT count(*)::int FROM organization_members om WHERE om.organization_id=o.id) user_count,
            COALESCE(ol.max_sites,5)::int max_sites,
            COALESCE(ol.max_sublocations,100)::int max_sublocations,
            COALESCE(ol.max_assets,500)::int max_assets,
            COALESCE(ol.max_inventory_items,1000)::int max_inventory_items,
            COALESCE(ol.max_technicians,50)::int max_technicians,
            bp.code plan_code,bp.name plan_name,bp.description plan_description,
            os.status subscription_status,os.trial_started_at::text trial_started_at,
            os.trial_ends_at::text trial_ends_at,os.current_period_start::text current_period_start,
            os.current_period_end::text current_period_end,bp.white_label,
            ob.app_name branding_app_name,ob.primary_color branding_primary_color,
            ob.secondary_color branding_secondary_color,
            (ob.logo_on_light IS NOT NULL) branding_logo_light,
            (ob.logo_on_dark IS NOT NULL) branding_logo_dark,
            COALESCE(ob.show_desweb_branding,false) show_desweb_branding
     FROM organizations o
     LEFT JOIN organization_limits ol ON ol.organization_id=o.id
     JOIN organization_subscriptions os ON os.organization_id=o.id
     JOIN billing_plans bp ON bp.id=os.plan_id
     LEFT JOIN organization_branding ob ON ob.organization_id=o.id
     WHERE o.id=$1
     LIMIT 1`,
    [session.organizationId],
  );

  if (!company.rowCount) redirect("/dashboard");
  return <CompanySettings
    company={company.rows[0]}
    brandingSaved={params.branding_saved === "1"}
    brandingError={Boolean(params.branding_error)}
    planUpdated={params.plan_updated === "1"}
    welcome={params.welcome === "1"}
  />;
}
