import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, roleLabel, type Permission } from "@/lib/permissions";
import { isSubscriptionUsable } from "@/lib/billing";
import { getCustomizationSummary, logoOnDarkSrc } from "@/lib/customization";
import { SidebarNavigation, type DashboardNavItem } from "@/components/DashboardNavigation";
import { CurrentSectionHeader, SidebarAccountMenu } from "@/components/DashboardChrome";
import { getOrganizationBranding } from "@/lib/organization-branding";

export const dynamic = "force-dynamic";

type NavItem = DashboardNavItem & { permission?: Permission };

const navItems: NavItem[] = [
  { icon: "▦", label: "Resumen", href: "/dashboard" },
  { icon: "◫", label: "Empresas", href: "/dashboard/companies", permission: "companies.manage" },
  { icon: "✦", label: "Leads", href: "/dashboard/leads", permission: "leads.manage" },
  { icon: "⌂", label: "Ubicaciones", href: "/dashboard/locations", permission: "locations.manage" },
  { icon: "◎", label: "Usuarios", href: "/dashboard/users", permission: "users.manage" },
  { icon: "◇", label: "Activos", href: "/dashboard/assets", permission: "assets.read" },
  { icon: "✓", label: "Órdenes", href: "/dashboard/work-orders", permission: "work_orders.read" },
  { icon: "↻", label: "Preventivos", href: "/dashboard/maintenance", permission: "maintenance.read" },
  { icon: "▤", label: "Inventario", href: "/dashboard/inventory", permission: "inventory.read" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.platformRole !== "superadmin" && !isSubscriptionUsable(session.subscriptionStatus, session.trialEndsAt)) {
    redirect("/subscription/expired");
  }

  const customization = await getCustomizationSummary();
  const organizationBranding = session.whiteLabel && session.organizationId
    ? await getOrganizationBranding(session.organizationId)
    : null;
  const visibleItems = navItems.filter(item => !item.permission || can(session, item.permission));
  const navigationItems: DashboardNavItem[] = visibleItems.map(({ icon, label, href }) => ({ icon, label, href }));
  const canConfigure = can(session, "personalization.manage") || can(session, "settings.view");

  const shellStyle = organizationBranding ? {
    ...(organizationBranding.primaryColor ? { "--brand-teal": organizationBranding.primaryColor } : {}),
    ...(organizationBranding.secondaryColor ? { "--brand-mint": organizationBranding.secondaryColor } : {}),
  } as React.CSSProperties : undefined;
  const sidebarLogo = organizationBranding?.hasLogoOnDark
    ? "/api/organization-branding/logo/dark"
    : logoOnDarkSrc(customization);
  const productName = organizationBranding?.appName || "Desweb CMMS";

  return <div className="shell" style={shellStyle}>
    <aside className="sidebar">
      <div className={`sidebar-brand ${organizationBranding?.hasLogoOnDark || customization.hasLogoOnDark ? "has-dark-logo" : "uses-fallback-logo"}`}>
        <img src={sidebarLogo} alt={productName} />
        <span>CMMS</span>
      </div>

      <div className="sidebar-product">
        <span>PLATAFORMA</span>
        <strong>{productName}</strong>
      </div>

      <SidebarNavigation items={navigationItems} />

      <div className="sidebar-bottom">
        <SidebarAccountMenu
          fullName={session.fullName}
          role={roleLabel(session)}
          canConfigure={canConfigure}
        />
        {(!organizationBranding || organizationBranding.showDeswebBranding) && <div className="sidebar-signature">
          <span>DESWEB</span>
          <small>Desarrollo de Soluciones</small>
        </div>}
      </div>
    </aside>

    <main className="main">
      <CurrentSectionHeader organizationName={session.organizationName} />
      <div className="workspace-content">{children}</div>
    </main>
  </div>;
}
