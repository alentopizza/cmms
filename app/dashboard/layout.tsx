import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, roleLabel, type Permission } from "@/lib/permissions";
import { isSubscriptionUsable } from "@/lib/billing";
import { getCustomizationSummary, logoOnDarkSrc } from "@/lib/customization";
import type { DashboardNavItem } from "@/components/DashboardNavigation";
import { CurrentSectionHeader } from "@/components/DashboardChrome";
import DashboardSidebar, { type ReorderableNavItem } from "@/components/DashboardSidebar";
import { query } from "@/lib/db";
import { getOrganizationBranding } from "@/lib/organization-branding";

export const dynamic = "force-dynamic";

type NavItem = DashboardNavItem & { id: string; permission?: Permission; anyPermissions?: Permission[] };

const navItems: NavItem[] = [
  { id: "dashboard", icon: "▦", label: "Dashboard", href: "/dashboard" },
  { id: "companies", icon: "◫", label: "Empresas", href: "/dashboard/companies", permission: "companies.manage" },
  { id: "leads", icon: "✦", label: "Leads", href: "/dashboard/leads", permission: "leads.manage" },
  { id: "locations", icon: "⌂", label: "Ubicaciones", href: "/dashboard/locations", permission: "locations.manage" },
  { id: "suppliers", icon: "▣", label: "Proveedores", href: "/dashboard/suppliers", permission: "suppliers.manage" },
  { id: "users", icon: "◎", label: "Usuarios", href: "/dashboard/users", permission: "users.manage" },
  { id: "crews", icon: "◉", label: "Cuadrillas", href: "/dashboard/crews", permission: "crews.manage" },
  { id: "attendance", icon: "◌", label: "Asistencia", href: "/dashboard/attendance", anyPermissions: ["attendance.self","attendance.manage","attendance.reports"] },
  { id: "assets", icon: "◇", label: "Activos", href: "/dashboard/assets", permission: "assets.read" },
  { id: "work_orders", icon: "✓", label: "Órdenes", href: "/dashboard/work-orders", permission: "work_orders.read" },
  { id: "maintenance", icon: "↻", label: "Rutinas", href: "/dashboard/maintenance", permission: "maintenance.read" },
  { id: "inventory", icon: "▤", label: "Inventario", href: "/dashboard/inventory", permission: "inventory.read" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.platformRole === "user" && !isSubscriptionUsable(session.subscriptionStatus, session.trialEndsAt)) {
    redirect("/subscription/expired");
  }

  const customization = await getCustomizationSummary();
  const organizationBranding = session.whiteLabel && session.organizationId
    ? await getOrganizationBranding(session.organizationId)
    : null;
  const visibleItems = navItems.filter(item =>
(!item.permission || can(session, item.permission)) &&
    (!item.anyPermissions || item.anyPermissions.some(permission => can(session, permission)))
  );
  const navigationItems: ReorderableNavItem[] = visibleItems.map(({ id, icon, label, href }) => ({ id, icon, label, href }));
  const canConfigure = can(session, "personalization.manage") || can(session, "settings.view");

  const preferenceResult = session.userId
    ? await query<{ sidebar_order: string[] | null; sidebar_collapsed: boolean | null }>(
        "SELECT sidebar_order,sidebar_collapsed FROM user_dashboard_preferences WHERE user_id=$1",
        [session.userId],
      )
    : { rows: [] as Array<{ sidebar_order: string[] | null; sidebar_collapsed: boolean | null }> };

  const initialSidebarOrder = preferenceResult.rows[0]?.sidebar_order || [];
  const initialSidebarCollapsed = Boolean(preferenceResult.rows[0]?.sidebar_collapsed);

  const shellStyle = organizationBranding ? {
    ...(organizationBranding.primaryColor ? { "--brand-teal": organizationBranding.primaryColor } : {}),
    ...(organizationBranding.secondaryColor ? { "--brand-mint": organizationBranding.secondaryColor } : {}),
  } as React.CSSProperties : undefined;
  const sidebarLogo = organizationBranding?.hasLogoOnDark
    ? "/api/organization-branding/logo/dark"
    : logoOnDarkSrc(customization);
  const productName = organizationBranding?.appName || "Desweb CMMS";
  const mobileNavigationMode = session.platformRole === "user" && (session.role === "technician" || session.role === "external")
    ? "field"
    : "drawer";

  return <div className={"shell mobile-nav-" + mobileNavigationMode} style={shellStyle}>
    <DashboardSidebar
      items={navigationItems}
      initialOrder={initialSidebarOrder}
      initialCollapsed={initialSidebarCollapsed}
      persistentUser={Boolean(session.userId)}
      sidebarLogo={sidebarLogo}
      productName={productName}
      fullName={session.fullName}
      role={roleLabel(session)}
      canConfigure={canConfigure}
      showDeswebBranding={!organizationBranding || organizationBranding.showDeswebBranding}
      mobileNavigationMode={mobileNavigationMode}
    />

    <main className="main">
      <CurrentSectionHeader contextName={session.organizationName || roleLabel(session)} />
      <div className="workspace-content">{children}</div>
    </main>
  </div>;
}
