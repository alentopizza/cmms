import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAuthenticated()) redirect("/dashboard");
  const params = await searchParams;

  return <main className="login-page">
    <section className="login-shell">
      <div className="login-visual">
        <div className="login-visual-glow login-visual-glow-one" />
        <div className="login-visual-glow login-visual-glow-two" />

        <div className="login-brand">
          <div className="login-brand-mark" aria-hidden="true"><span /><span /></div>
          <div><strong>DESWEL</strong><small>CMMS</small></div>
        </div>

        <div className="login-visual-copy">
          <span className="login-kicker">Mantenimiento inteligente</span>
          <h2>Controla tus activos.<br />Mantén tu operación en movimiento.</h2>
          <p>Órdenes de trabajo, equipos, preventivos e inventario en un solo lugar.</p>
        </div>

        <div className="login-feature-row">
          <div><strong>Multiempresa</strong><span>Una plataforma, múltiples operaciones</span></div>
          <div><strong>En tiempo real</strong><span>Visibilidad clara del mantenimiento</span></div>
        </div>
      </div>

      <div className="login-panel">
        <div className="login-panel-inner">
          <div className="login-mobile-brand">
            <div className="login-brand-mark" aria-hidden="true"><span /><span /></div>
            <strong>DESWEL CMMS</strong>
          </div>

          <span className="login-eyebrow">Bienvenido</span>
          <h1>Inicia sesión</h1>
          <p className="login-subtitle">Accede al centro de control de mantenimiento.</p>
          <LoginForm hasError={params.error === "1"} />
          <div className="login-security-note"><span aria-hidden="true">●</span> Conexión segura · cmms.desweb.cloud</div>
        </div>
      </div>
    </section>
  </main>;
}
