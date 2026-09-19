import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getCustomizationSummary, logoOnDarkSrc, logoOnLightSrc } from "@/lib/customization";
import LoginForm from "./LoginForm";
import MaintenancePreview from "./MaintenancePreview";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAuthenticated()) redirect("/dashboard");
  const [params, customization] = await Promise.all([searchParams, getCustomizationSummary()]);

  return <main className="login-page">
    <section className="login-shell">
      <div className="login-panel">
        <div className="login-panel-inner">
          <div className="login-brand">
            <img className="theme-logo theme-logo-light" src={logoOnLightSrc(customization)} alt="Desweb - Desarrollo de Soluciones" />
            <img className="theme-logo theme-logo-dark" src={logoOnDarkSrc(customization)} alt="Desweb - Desarrollo de Soluciones" />
            <span>CMMS</span>
          </div>

          <div className="login-heading">
            <span>Gestión de mantenimiento</span>
            <h1>Bienvenido</h1>
            <p>Administra equipos, órdenes de trabajo, preventivos e inventario desde una sola plataforma.</p>
          </div>

          <LoginForm hasError={params.error === "1"} />

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
