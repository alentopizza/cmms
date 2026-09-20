import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import ThemePreferences from "@/components/ThemePreferences";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session, "personalization.manage")) redirect("/dashboard");

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
          <div>
            <strong>Personalización de marca</strong>
            <span>Logos claros/oscuros y favicon</span>
          </div>
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
          <div>
            <strong>Administrar usuarios</strong>
            <span>Roles, empresas, sedes y estado de acceso</span>
          </div>
          <b aria-hidden="true">→</b>
        </Link>
      </article>
    </section>
  </>;
}
