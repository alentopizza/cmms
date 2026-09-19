import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import LoginForm from "./LoginForm";
import MaintenancePreview from "./MaintenancePreview";

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

      <MaintenancePreview />
    </section>
  </main>;
}
