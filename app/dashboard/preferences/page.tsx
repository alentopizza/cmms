import { redirect } from "next/navigation";
import ThemePreferences from "@/components/ThemePreferences";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ── Personal settings available to every authenticated user ─────────────────

export default async function PreferencesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <>
    <header className="page-header settings-page-header">
      <div>
        <span className="eyebrow">Cuenta</span>
        <h1 className="page-title">Mi configuración</h1>
        <p className="muted">Preferencias personales de tu sesión. Estas opciones no cambian la configuración de la empresa.</p>
      </div>
      <span className="settings-status"><i /> Preferencias personales</span>
    </header>

    <section className="settings-grid section">
      <article className="card settings-panel settings-panel-wide">
        <div className="settings-panel-head">
          <div>
            <span className="settings-kicker">Apariencia</span>
            <h2>Tema de la interfaz</h2>
            <p>El tema claro es la apariencia predeterminada. Puedes cambiar a oscuro o seguir el sistema si lo prefieres.</p>
          </div>
          <span className="settings-panel-icon" aria-hidden="true">◐</span>
        </div>
        <ThemePreferences />
      </article>
    </section>
  </>;
}
