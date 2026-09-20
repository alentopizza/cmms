import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import ThemePreferences from "@/components/ThemePreferences";

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

function CompanySettings({ company }: { company: CompanySettingsRow }) {
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

    <section className="company-settings-hero section">
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

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isPlatformAdmin = can(session, "personalization.manage");
  const isCompanyAdmin = can(session, "settings.view");

  if (!isPlatformAdmin && !isCompanyAdmin) redirect("/dashboard");

  if (isPlatformAdmin) {
    return <>
      <header className="page-header settings-page-header">
        <div>
          <span className="eyebrow">Plataforma</span>
          <h1 className="page-title">Configuración</h1>
          <p className="muted">Centraliza la apariencia, la identidad visual y las preferencias globales de Desweb CMMS.</p>
        </div>
        <span className="settings-status"><i /> Configuración global</span>
      </header>

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

        <article className="card settings-panel">
          <div className="settings-panel-head">
            <div>
              <span className="settings-kicker">Identidad visual</span>
              <h2>Marca de la plataforma</h2>
              <p>Administra logos, favicon y recursos gráficos globales de la instalación.</p>
            </div>
            <span className="settings-panel-icon" aria-hidden="true">✦</span>
          </div>
          <Link className="settings-link-card" href="/dashboard/personalization">
            <div><strong>Personalización de marca</strong><span>Logos claros/oscuros y favicon</span></div>
            <b aria-hidden="true">→</b>
          </Link>
        </article>

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
            COALESCE(ol.max_technicians,50)::int max_technicians
     FROM organizations o
     LEFT JOIN organization_limits ol ON ol.organization_id=o.id
     WHERE o.id=$1
     LIMIT 1`,
    [session.organizationId],
  );

  if (!company.rowCount) redirect("/dashboard");
  return <CompanySettings company={company.rows[0]} />;
}
