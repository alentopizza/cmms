import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getCustomizationSummary, logoOnDarkSrc } from "@/lib/customization";
import ThemeToggle from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

const navItems = [
  ["▦", "Resumen", "/dashboard"],
  ["◫", "Empresas y sedes", "/dashboard/companies"],
  ["◇", "Activos y equipos", "/dashboard/assets"],
  ["✓", "Órdenes de trabajo", "/dashboard/work-orders"],
  ["↻", "Preventivos", "/dashboard/maintenance"],
  ["▤", "Inventario", "/dashboard/inventory"],
  ["✦", "Personalización", "/dashboard/personalization"],
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthenticated())) redirect("/login");
  const customization = await getCustomizationSummary();

  return <div className="shell">
    <aside className="sidebar">
      <div className={`sidebar-brand ${customization.hasLogoOnDark ? "has-dark-logo" : "uses-fallback-logo"}`}>
        <img src={logoOnDarkSrc(customization)} alt="Desweb" />
        <span>CMMS</span>
      </div>
      <div className="sidebar-caption">Mantenimiento inteligente</div>

      <nav className="nav">
        {navItems.map(([icon, label, href]) =>
          <Link key={href} href={href}><span className="nav-icon">{icon}</span><span>{label}</span></Link>
        )}
      </nav>

      <div className="sidebar-footer">
        <span>DESWEB</span>
        <small>Desarrollo de Soluciones</small>
      </div>
    </aside>

    <main className="main">
      <div className="topbar">
        <div>
          <span className="topbar-label">Desweb CMMS</span>
          <strong>Centro de mantenimiento</strong>
        </div>
        <div className="topbar-actions">
          <ThemeToggle />
          <span className="topbar-domain">cmms.desweb.cloud</span>
          <form method="post" action="/api/auth/logout"><button className="button secondary">Salir</button></form>
        </div>
      </div>
      {children}
    </main>
  </div>;
}
