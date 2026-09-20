import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, roleLabel, type Permission } from "@/lib/permissions";
import { getCustomizationSummary, logoOnDarkSrc } from "@/lib/customization";
import { HeaderTabs, SidebarNavigation, type DashboardNavItem } from "@/components/DashboardNavigation";

export const dynamic = "force-dynamic";

type NavItem = DashboardNavItem & { permission?: Permission };

const navItems: NavItem[] = [
  { icon: "▦", label: "Resumen", href: "/dashboard" },
  { icon: "◫", label: "Empresas", href: "/dashboard/companies", permission: "companies.manage" },
  { icon: "⌂", label: "Ubicaciones", href: "/dashboard/locations", permission: "locations.manage" },
  { icon: "◎", label: "Usuarios", href: "/dashboard/users", permission: "users.manage" },
  { icon: "◇", label: "Activos", href: "/dashboard/assets", permission: "assets.read" },
  { icon: "✓", label: "Órdenes", href: "/dashboard/work-orders", permission: "work_orders.read" },
  { icon: "↻", label: "Preventivos", href: "/dashboard/maintenance", permission: "maintenance.read" },
  { icon: "▤", label: "Inventario", href: "/dashboard/inventory", permission: "inventory.read" },
  { icon: "⚙", label: "Configuración", href: "/dashboard/settings", permission: "personalization.manage" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const customization = await getCustomizationSummary();
  const visibleItems = navItems.filter(item => !item.permission || can(session, item.permission));
  const navigationItems: DashboardNavItem[] = visibleItems.map(({ icon, label, href }) => ({ icon, label, href }));

  return <div className="shell">
    <aside className="sidebar">
      <div className={`sidebar-brand ${customization.hasLogoOnDark ? "has-dark-logo" : "uses-fallback-logo"}`}>
        <img src={logoOnDarkSrc(customization)} alt="Desweb" />
        <span>CMMS</span>
      </div>

      <div className="sidebar-product">
        <span>PLATAFORMA</span>
        <strong>Mantenimiento inteligente</strong>
      </div>

      <SidebarNavigation items={navigationItems} />

      <div className="sidebar-footer">
        <span>DESWEB</span>
        <small>Desarrollo de Soluciones</small>
      </div>
    </aside>

    <main className="main">
      <header className="app-header">
        <div className="app-header-top">
          <div className="app-header-brand">
            <span className="app-header-mark">D</span>
            <div>
              <span>{session.organizationName || "Desweb CMMS"}</span>
              <strong>Centro de mantenimiento</strong>
            </div>
          </div>

          <div className="app-header-actions">
            <div className="session-identity">
              <strong>{session.fullName}</strong>
              <span>{roleLabel(session)}</span>
            </div>
            {can(session, "personalization.manage") && <Link className="header-icon-button" href="/dashboard/settings" aria-label="Configuración" title="Configuración">⚙</Link>}
            <form method="post" action="/api/auth/logout"><button className="header-logout" type="submit">Salir</button></form>
          </div>
        </div>

        <HeaderTabs items={navigationItems} />
      </header>

      <div className="workspace-content">{children}</div>
    </main>
  </div>;
}
