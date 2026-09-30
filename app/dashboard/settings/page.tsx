import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { subscriptionLabel } from "@/lib/billing";
import ThemePreferences from "@/components/ThemePreferences";
import { getCustomizationSummary, logoOnDarkSrc, logoOnLightSrc } from "@/lib/customization";
import FileDropzone from "@/components/FileDropzone";
import { CountrySelect, LocaleSelect } from "@/components/InternationalFields";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import { Alert } from "@/components/ui-kit/Feedback";
import { Badge } from "@/components/ui-kit/Badge";
import { Button } from "@/components/ui-kit/Button";
import { ProgressBar } from "@/components/ui-kit/TimelineProgress";

type CompanySettingsRow = {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  timezone: string;
  preferred_locale: string;
  default_country: string;
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
  procurement_approval_mode: "none" | "all" | "threshold";
  procurement_approval_threshold: string;
  procurement_approver_scope: "admin_only" | "admin_manager";
  procurement_self_approval: boolean;
};

type ResourceCard = {
  key: string;
  label: string;
  description: string;
  used: number;
  limit: number;
  icon: UiIconName;
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
  localeSaved,
  procurementSaved,
  procurementError,
}: {
  company: CompanySettingsRow;
  brandingSaved?: boolean;
  brandingError?: boolean;
  planUpdated?: boolean;
  welcome?: boolean;
  localeSaved?: boolean;
  procurementSaved?: boolean;
  procurementError?: boolean;
}) {
  const resources: ResourceCard[] = [
    { key: "sites", label: "Ubicaciones principales", description: "Sedes principales habilitadas para la empresa.", used: company.site_count, limit: company.max_sites, icon: "location" },
    { key: "locations", label: "Sububicaciones", description: "Áreas, pisos, habitaciones y demás espacios internos.", used: company.sublocation_count, limit: company.max_sublocations, icon: "sublocation" },
    { key: "assets", label: "Activos", description: "Equipos y activos registrados dentro de la operación.", used: company.asset_count, limit: company.max_assets, icon: "asset" },
    { key: "inventory", label: "Inventario", description: "Artículos y repuestos controlados por existencia.", used: company.inventory_item_count, limit: company.max_inventory_items, icon: "inventory" },
    { key: "technicians", label: "Técnicos", description: "Usuarios con rol técnico asignados a la empresa.", used: company.technician_count, limit: company.max_technicians, icon: "user" },
  ];

  return <div className="phase10-settings phase10-company-settings">
    <header className="page-header settings-page-header">
      <div>
        <span className="eyebrow">Empresa</span>
        <h1 className="page-title">Configuración de empresa</h1>
        <p className="muted">Consulta la información de tu organización y el consumo de los recursos asignados por la plataforma.</p>
      </div>
      <Badge variant={company.active?"success":"neutral"} icon="company">{company.active ? "Empresa activa" : "Empresa inactiva"}</Badge>
    </header>

    {(welcome||planUpdated||localeSaved||procurementSaved)&&<div className="section phase10-feedback-stack">
      {welcome&&<Alert variant="success" title="Empresa creada">Tu empresa fue creada correctamente. Ya puedes revisar el plan, sus fechas y los recursos disponibles.</Alert>}
      {planUpdated&&<Alert variant="success" title="Plan actualizado">Los nuevos recursos ya están disponibles.</Alert>}
      {localeSaved&&<Alert variant="success" title="Idioma y región actualizados">La preferencia predeterminada quedó guardada.</Alert>}
      {procurementSaved&&<Alert variant="success" title="Política actualizada">La política de aprobación de abastecimiento quedó guardada.</Alert>}
    </div>}
    {procurementError&&<div className="section"><Alert variant="danger" title="No fue posible guardar la política">Revisa el modo, el monto y el alcance de aprobadores.</Alert></div>}

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
          <Link className="ds-button ds-button-secondary ds-button-md company-plan-upgrade" href="/#planes"><UiIcon name="chevron-right" size={15}/><span>{company.plan_code === "pro" ? "Ver planes" : "Mejorar plan"}</span></Link>
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
              <span className="company-entitlement-icon" aria-hidden="true"><UiIcon name={resource.icon} size={20}/></span>
              <Badge variant={status.state==="critical"?"danger":status.state==="warning"?"warning":"success"}>{status.label}</Badge>
            </div>
            <div className="company-entitlement-copy">
              <span>{resource.label}</span>
              <strong><b>{resource.used}</b><small> / {resource.limit}</small></strong>
              <p>{resource.description}</p>
            </div>
            <ProgressBar value={status.ratio} max={100} showValue={false} compact tone={status.state==="critical"?"danger":status.state==="warning"?"warning":"success"} caption={status.ratio+"% consumido"}/>
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

    <section className="card section settings-panel settings-panel-wide brand-settings-gateway">
      <div className="settings-panel-head">
        <div>
          <span className="settings-kicker">Identidad visual</span>
          <h2>Personalización de marca <Badge variant="brand">PRO</Badge></h2>
          <p>La identidad visual de la empresa se administra en una experiencia independiente para no mezclar marca con la configuración operativa.</p>
        </div>
        <span className="settings-panel-icon" aria-hidden="true"><UiIcon name="preferences" size={20}/></span>
      </div>
      <Link className="settings-link-card" href="/dashboard/brand">
        <div><strong>{company.plan_code==="pro"&&company.white_label?"Abrir Personalización de marca":"Conocer Personalización de marca"}</strong><span>{company.plan_code==="pro"&&company.white_label?"Esquemas, logo, apariencia y vista previa":"Funcionalidad disponible con Plan Pro"}</span></div>
        <span aria-hidden="true"><UiIcon name="chevron-right" size={15}/></span>
      </Link>
    </section>

    <section className="card section settings-panel settings-panel-wide international-settings-panel">
      <div className="settings-panel-head">
        <div>
          <span className="settings-kicker">Internacionalización</span>
          <h2>Idioma y región</h2>
          <p>Define el idioma base de la empresa y el país que se propondrá inicialmente en nuevos formularios.</p>
        </div>
        <span className="settings-panel-icon" aria-hidden="true"><UiIcon name="preferences" size={20}/></span>
      </div>
      <form className="form-grid international-settings-form" method="post" action="/api/preferences/locale">
        <input type="hidden" name="scope" value="organization"/>
        <LocaleSelect id="company-preferred-locale" name="locale" defaultValue={company.preferred_locale}/>
        <CountrySelect id="company-default-country" name="country" label="País predeterminado" defaultValue={company.default_country||"CO"} required/>
        <div className="form-span-2 form-actions"><Button type="submit" iconLeft="check">Guardar idioma y región</Button></div>
      </form>
    </section>

    <section className="card section settings-panel settings-panel-wide procurement-policy-panel">
      <div className="settings-panel-head">
        <div>
          <span className="settings-kicker">Abastecimiento</span>
          <h2>Aprobación de requisiciones</h2>
          <p>Define cuándo una requisición necesita autorización antes de registrar recepciones en Inventario / Kardex.</p>
        </div>
        <span className="settings-panel-icon" aria-hidden="true"><UiIcon name="requisition" size={20}/></span>
      </div>
      <form className="form-grid procurement-policy-form" method="post" action="/api/procurement-policy">
        <div className="field">
          <label>Política de aprobación</label>
          <select name="approval_mode" defaultValue={company.procurement_approval_mode}>
            <option value="none">Sin aprobación obligatoria</option>
            <option value="all">Aprobar todas las requisiciones</option>
            <option value="threshold">Aprobar desde un monto estimado</option>
          </select>
          <small>La regla se copia a cada requisición al momento de crearla para conservar trazabilidad histórica.</small>
        </div>
        <div className="field">
          <label>Monto estimado mínimo</label>
          <input name="approval_threshold" type="number" min="0" step="0.01" defaultValue={company.procurement_approval_threshold||"0"}/>
          <small>Solo aplica cuando eliges aprobación por monto.</small>
        </div>
        <div className="field">
          <label>Quién puede aprobar</label>
          <select name="approver_scope" defaultValue={company.procurement_approver_scope}>
            <option value="admin_only">Solo Administrador de empresa</option>
            <option value="admin_manager">Administrador o Manager / Supervisor</option>
          </select>
        </div>
        <label className="white-label-checkbox">
          <input name="allow_requester_self_approval" type="checkbox" defaultChecked={company.procurement_self_approval}/>
          <span>Permitir que el solicitante apruebe su propia requisición cuando además tenga rol autorizador.</span>
        </label>
        <div className="form-span-2 procurement-policy-note">
          <strong>Regla de integridad</strong>
          <span>Si una requisición aprobada cambia en cantidad, costo o fecha requerida, la aprobación se reabre y el saldo pendiente vuelve a quedar bloqueado hasta una nueva decisión.</span>
        </div>
        <div className="form-span-2 form-actions"><Button type="submit" iconLeft="check">Guardar política de aprobación</Button></div>
      </form>
    </section>

    <section className="settings-grid section company-settings-actions">
      <article className="card settings-panel">
        <div className="settings-panel-head">
          <div>
            <span className="settings-kicker">Acceso</span>
            <h2>Usuarios y roles</h2>
            <p>Administra cuentas de tu organización y define el alcance por sede de cada usuario.</p>
          </div>
          <span className="settings-panel-icon" aria-hidden="true"><UiIcon name="user" size={20}/></span>
        </div>
        <Link className="settings-link-card" href="/dashboard/users">
          <div><strong>Administrar usuarios</strong><span>Roles, sedes y permisos operativos</span></div>
          <span aria-hidden="true"><UiIcon name="chevron-right" size={15}/></span>
        </Link>
      </article>

      <article className="card settings-panel">
        <div className="settings-panel-head">
          <div>
            <span className="settings-kicker">Clasificaciones</span>
            <h2>Catálogos</h2>
            <p>Administra categorías, tipos, marcas, prioridades y demás opciones reutilizables de la empresa.</p>
          </div>
          <span className="settings-panel-icon" aria-hidden="true"><UiIcon name="settings" size={20}/></span>
        </div>
        <Link className="settings-link-card" href="/dashboard/settings/catalogs">
          <div><strong>Administrar catálogos</strong><span>Opciones del sistema y personalizadas</span></div>
          <span aria-hidden="true"><UiIcon name="chevron-right" size={15}/></span>
        </Link>
      </article>

      <article className="card settings-panel">
        <div className="settings-panel-head">
          <div>
            <span className="settings-kicker">Estructura</span>
            <h2>Ubicaciones</h2>
            <p>Consulta y administra las sedes y sububicaciones permitidas dentro del cupo asignado.</p>
          </div>
          <span className="settings-panel-icon" aria-hidden="true"><UiIcon name="location" size={20}/></span>
        </div>
        <Link className="settings-link-card" href="/dashboard/locations">
          <div><strong>Administrar ubicaciones</strong><span>Sedes, áreas y jerarquía física</span></div>
          <span aria-hidden="true"><UiIcon name="chevron-right" size={15}/></span>
        </Link>
      </article>
    </section>
  </div>;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ branding_saved?: string; branding_error?: string; plan_updated?: string; welcome?: string; locale_saved?: string; procurement_saved?: string; procurement_error?: string }>;

}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const params = await searchParams;

  const isPlatformAdmin = can(session, "personalization.manage");
  const isCompanyAdmin = can(session, "settings.view");

  if (!isPlatformAdmin && !isCompanyAdmin) redirect("/dashboard");

  if (isPlatformAdmin) {
    const customization = await getCustomizationSummary();
    return <div className="phase10-settings phase10-platform-settings">
      <header className="page-header settings-page-header">
        <div>
          <span className="eyebrow">Plataforma</span>
          <h1 className="page-title">Configuración</h1>
          <p className="muted">Centraliza la apariencia, la identidad visual y las preferencias globales de Desweb CMMS.</p>
        </div>
        <Badge variant="brand" icon="settings">Configuración global</Badge>
      </header>

      {(params.branding_saved==="1"||params.locale_saved==="1")&&<div className="section phase10-feedback-stack">
        {params.branding_saved==="1"&&<Alert variant="success" title="Identidad visual actualizada">La identidad visual global se actualizó correctamente.</Alert>}
        {params.locale_saved==="1"&&<Alert variant="success" title="Idioma y región actualizados">La configuración global quedó guardada.</Alert>}
      </div>}
      {params.branding_error&&<div className="section"><Alert variant="danger" title="No fue posible guardar la identidad visual">{params.branding_error}</Alert></div>}

      <section className="settings-grid section">
        <article className="card settings-panel settings-panel-wide international-settings-panel">
          <div className="settings-panel-head">
            <div>
              <span className="settings-kicker">Internacionalización</span>
              <h2>Idioma y región predeterminados</h2>
              <p>Configura la base regional de Desweb CMMS. Los nuevos clientes pueden usar otra región sin modificar el catálogo global.</p>
            </div>
            <span className="settings-panel-icon" aria-hidden="true"><UiIcon name="preferences" size={20}/></span>
          </div>
          <form className="form-grid international-settings-form" method="post" action="/api/preferences/locale">
            <input type="hidden" name="scope" value="platform"/>
            <LocaleSelect id="platform-default-locale" name="locale" defaultValue={customization.defaultLocale}/>
            <CountrySelect id="platform-default-country" name="country" label="País predeterminado" defaultValue={customization.defaultCountry} required/>
            <div className="form-span-2 form-actions"><Button type="submit" iconLeft="check">Guardar idioma y región</Button></div>
          </form>
        </article>
        <article className="card settings-panel settings-panel-wide">
          <div className="settings-panel-head">
            <div>
              <span className="settings-kicker">Apariencia</span>
              <h2>Tema de la interfaz</h2>
              <p>Elige cómo quieres visualizar la plataforma. Esta preferencia se guarda en este navegador.</p>
            </div>
            <span className="settings-panel-icon" aria-hidden="true"><UiIcon name="system" size={20}/></span>
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
            <span className="settings-panel-icon" aria-hidden="true"><UiIcon name="company" size={20}/></span>
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
                <FileDropzone id="settings-logo-light" name="logo_on_light" label="Reemplazar archivo" description="Fondo transparente recomendado · 1200×320 px aprox." accept=".png,.webp,.svg,.jpg,.jpeg,image/png,image/webp,image/svg+xml,image/jpeg" maxSizeMb={2} kind="image" existingFileName={customization.logoOnLightName} compact />
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
                <FileDropzone id="settings-logo-dark" name="logo_on_dark" label="Reemplazar archivo" description="Versión blanca/negativa · 1200×320 px aprox." accept=".png,.webp,.svg,.jpg,.jpeg,image/png,image/webp,image/svg+xml,image/jpeg" maxSizeMb={2} kind="image" existingFileName={customization.logoOnDarkName} compact />
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
                <FileDropzone id="settings-favicon" name="favicon" label="Reemplazar favicon" description="Cuadrado · 64×64 o 128×128 px recomendado." accept=".ico,.png,.webp,.svg,image/x-icon,image/png,image/webp,image/svg+xml" maxSizeMb={2} kind="image" existingFileName={customization.faviconName} compact />
              </article>
            </div>

            <div className="platform-branding-actions">
              <div>
                <strong>Guardar identidad visual</strong>
                <span>Solo se reemplazan los archivos que selecciones.</span>
              </div>
              <Button type="submit" iconLeft="check">Guardar cambios</Button>
            </div>
          </form>
        </article>

        <article className="card settings-panel">
          <div className="settings-panel-head">
            <div>
              <span className="settings-kicker">Acceso</span>
              <h2>Usuarios y permisos</h2>
              <p>Gestiona las cuentas, roles y alcance operativo de quienes ingresan al CMMS.</p>
            </div>
            <span className="settings-panel-icon" aria-hidden="true"><UiIcon name="user" size={20}/></span>
          </div>
          <Link className="settings-link-card" href="/dashboard/users">
            <div><strong>Administrar usuarios</strong><span>Roles, empresas, sedes y estado de acceso</span></div>
            <span aria-hidden="true"><UiIcon name="chevron-right" size={15}/></span>
          </Link>
        </article>
      </section>
    </div>;
  }

  if (!session.organizationId) redirect("/dashboard");

  const company = await query<CompanySettingsRow>(
    `SELECT o.id,o.name,o.legal_name,o.tax_id,o.timezone,o.preferred_locale,o.default_country,o.active,
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
            COALESCE(ob.show_desweb_branding,false) show_desweb_branding,
            COALESCE(pp.approval_mode,'none') procurement_approval_mode,
            COALESCE(pp.approval_threshold,0)::text procurement_approval_threshold,
            COALESCE(pp.approver_scope,'admin_only') procurement_approver_scope,
            COALESCE(pp.allow_requester_self_approval,false) procurement_self_approval
     FROM organizations o
     LEFT JOIN organization_limits ol ON ol.organization_id=o.id
     JOIN organization_subscriptions os ON os.organization_id=o.id
     JOIN billing_plans bp ON bp.id=os.plan_id
     LEFT JOIN organization_branding ob ON ob.organization_id=o.id
     LEFT JOIN organization_procurement_policies pp ON pp.organization_id=o.id
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
    localeSaved={params.locale_saved === "1"}
    procurementSaved={params.procurement_saved === "1"}
    procurementError={Boolean(params.procurement_error)}
  />;
}
