import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getCustomizationSummary, logoOnDarkSrc, logoOnLightSrc } from "@/lib/customization";
import LoginForm from "./LoginForm";
import MaintenancePreview from "./MaintenancePreview";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAuthenticated()) redirect("/dashboard");
  const [params, customization] = await Promise.all([searchParams, getCustomizationSummary()]);

  return <main className="login-page">
    <div className="login-public-nav">
      <Link href="/" className="login-public-home">← Inicio</Link>
      <div>
        <Link href="/#planes">Ver planes</Link>
        <Link href="/downloads">Self-hosted</Link>
      </div>
    </div>

    <section className="login-shell">
      <div className="login-panel">
        <div className="login-panel-inner">
          <Link href="/" className={`login-brand ${customization.hasLogoOnDark ? "has-dark-logo" : "uses-fallback-logo"}`} aria-label="Volver al inicio">
            <img className="theme-logo theme-logo-light" src={logoOnLightSrc(customization)} alt="Desweb - Desarrollo de Soluciones" />
            <img className="theme-logo theme-logo-dark" src={logoOnDarkSrc(customization)} alt="Desweb - Desarrollo de Soluciones" />
            <span>CMMS</span>
          </Link>

          <div className="login-heading">
            <span>Gestión de mantenimiento</span>
            <h1>Bienvenido</h1>
            <p>Administra equipos, órdenes de trabajo, preventivos e inventario desde una sola plataforma.</p>
          </div>

          <LoginForm hasError={params.error === "1"} />

          <div className="login-conversion">
            <span>¿Primera vez en Desweb CMMS?</span>
            <Link href="/checkout?plan=trial">Prueba la plataforma durante 15 días</Link>
            <div>
              <Link href="/#planes">Comparar planes</Link>
              <span aria-hidden="true">·</span>
              <Link href="/downloads">Ver edición self-hosted</Link>
            </div>
          </div>

          <div className="login-security-note">
            <span aria-hidden="true">●</span>
            Acceso seguro · cmms.desweb.cloud
          </div>
        </div>
      </div>

      <MaintenancePreview />
    </section>
  </main>;
}
