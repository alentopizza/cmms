import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, roleLabel, type Permission } from "@/lib/permissions";
import { getCustomizationSummary, logoOnDarkSrc } from "@/lib/customization";
import ThemeToggle from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

type NavItem = { icon: string; label: string; href: string; permission?: Permission };

const navItems: NavItem[] = [
  { icon: "▦", label: "Resumen", href: "/dashboard" },
  { icon: "◫", label: "Empresas y sedes", href: "/dashboard/companies", permission: "companies.manage" },
  { icon: "⌂", label: "Ubicaciones", href: "/dashboard/locations", permission: "locations.manage" },
  { icon: "◎", label: "Usuarios y roles", href: "/dashboard/users", permission: "users.manage" },
  { icon: "◇", label: "Activos y equipos", href: "/dashboard/assets", permission: "assets.read" },
  { icon: "✓", label: "Órdenes de trabajo", href: "/dashboard/work-orders", permission: "work_orders.read" },
  { icon: "↻", label: "Preventivos", href: "/dashboard/maintenance", permission: "maintenance.read" },
  { icon: "▤", label: "Inventario", href: "/dashboard/inventory", permission: "inventory.read" },
  { icon: "✦", label: "Personalización", href: "/dashboard/personalization", permission: "personalization.manage" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const customization = await getCustomizationSummary();
  const visibleItems = navItems.filter(item => !item.permission || can(session, item.permission));

  return <div className="shell">
    <aside className="sidebar">
      <div className={`sidebar-brand ${customization.hasLogoOnDark ? "has-dark-logo" : "uses-fallback-logo"}`}>
        <img src={logoOnDarkSrc(customization)} alt="Desweb" />
        <span>CMMS</span>
      </div>
      <div className="sidebar-caption">Mantenimiento inteligente</div>

      <nav className="nav">
        {visibleItems.map(item =>
          <Link key={item.href} href={item.href}><span className="nav-icon">{item.icon}</span><span>{item.label}</span></Link>
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
          <span className="topbar-label">{session.organizationName || "Desweb CMMS"}</span>
          <strong>Centro de mantenimiento</strong>
        </div>
        <div className="topbar-actions">
          <div className="session-identity">
            <strong>{session.fullName}</strong>
            <span>{roleLabel(session)}</span>
          </div>
          <ThemeToggle />
          <span className="topbar-domain">cmms.desweb.cloud</span>
          <form method="post" action="/api/auth/logout"><button className="button secondary">Salir</button></form>
        </div>
      </div>
      {children}
    </main>
  </div>;
}
