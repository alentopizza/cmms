import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAuthenticated()) redirect("/dashboard");
  const params = await searchParams;

  return <main className="login-page">
    <section className="login-shell">
      <div className="login-panel">
        <div className="login-panel-inner">
          <div className="login-brand">
            <div className="login-brand-dot" aria-hidden="true" />
            <div className="login-brand-copy">
              <span>DESWEB</span>
              <strong>CMMS</strong>
            </div>
          </div>

          <div className="login-heading">
            <span>Bienvenido a</span>
            <h1>Desweb CMMS</h1>
            <p>Gestiona mantenimiento, activos y operaciones desde un solo lugar.</p>
          </div>

          <LoginForm hasError={params.error === "1"} />

          <div className="login-security-note">
            <span aria-hidden="true">●</span>
            Acceso seguro · cmms.desweb.cloud
          </div>
        </div>
      </div>

      <div className="login-art" aria-hidden="true">
        <div className="art-stars" />
        <div className="art-moon"><span /></div>
        <div className="art-mountain art-mountain-back" />
        <div className="art-mountain art-mountain-mid" />
        <div className="art-mountain art-mountain-front" />

        <div className="art-building art-building-main">
          <div className="art-door"><span /><span /><span /></div>
          <div className="art-window art-window-a" />
          <div className="art-window art-window-b" />
        </div>

        <div className="art-building art-building-side">
          <div className="art-window-grid">
            {Array.from({ length: 9 }).map((_, i) => <span key={i} />)}
          </div>
        </div>

        <div className="art-platform">
          <span />
          <span />
          <span />
        </div>

        <div className="art-plant art-plant-one"><span /><span /><span /></div>
        <div className="art-plant art-plant-two"><span /><span /><span /></div>

        <div className="art-floor">
          <div className="art-path" />
        </div>

        <div className="art-copy">
          <span>Mantenimiento conectado</span>
          <strong>Todo bajo control.</strong>
        </div>
      </div>
    </section>
  </main>;
}
