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
import TechnicianLocationTracker from "@/components/TechnicianLocationTracker";
import BrandThemeSync from "@/components/BrandThemeSync";
import { brandCssVariables } from "@/lib/brand-theme";

export const dynamic = "force-dynamic";

type NavItem = DashboardNavItem & { id: string; permission?: Permission; anyPermissions?: Permission[] };

const navItems: NavItem[] = [
  { id: "dashboard", icon: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "companies", icon: "company", label: "Empresas", href: "/dashboard/companies", permission: "companies.manage" },
  { id: "leads", icon: "lead", label: "Leads", href: "/dashboard/leads", permission: "leads.manage" },
  { id: "locations", icon: "location", label: "Ubicaciones", href: "/dashboard/locations", permission: "locations.manage" },
  { id: "suppliers", icon: "supplier", label: "Proveedores", href: "/dashboard/suppliers", permission: "suppliers.manage" },
  { id: "users", icon: "user", label: "Usuarios", href: "/dashboard/users", permission: "users.manage" },
  { id: "crews", icon: "crew", label: "Cuadrillas", href: "/dashboard/crews", permission: "crews.manage" },
  { id: "attendance", icon: "attendance", label: "Asistencia", href: "/dashboard/attendance", anyPermissions: ["attendance.self","attendance.manage","attendance.reports"] },
  { id: "reaction", icon: "reaction", label: "Reacción", href: "/dashboard/reaction", permission: "reaction.view" },
  { id: "assets", icon: "asset", label: "Activos", href: "/dashboard/assets", permission: "assets.read" },
  { id: "work_orders", icon: "work-order", label: "Órdenes", href: "/dashboard/work-orders", permission: "work_orders.read" },
  { id: "maintenance", icon: "maintenance", label: "Rutinas", href: "/dashboard/maintenance", permission: "maintenance.read" },
  { id: "inventory", icon: "inventory", label: "Inventario", href: "/dashboard/inventory", permission: "inventory.read" },
  { id: "requisitions", icon: "requisition", label: "Requisiciones", href: "/dashboard/requisitions", permission: "requisitions.read" },
  { id: "reports", icon: "report", label: "Reportes", href: "/dashboard/reports" },
  { id: "help", icon: "help", label: "Manual / Ayuda", href: "/dashboard/help" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.platformRole === "user" && !isSubscriptionUsable(session.subscriptionStatus, session.trialEndsAt)) {
    redirect("/subscription/expired");
  }

  const visibleItems = navItems.filter(item =>
(!item.permission || can(session, item.permission)) &&
    (!item.anyPermissions || item.anyPermissions.some(permission => can(session, permission)))
  );
  const navigationItems: ReorderableNavItem[] = visibleItems.map(({ id, icon, label, href }) => ({
    id,
    icon,
    label: id==="companies" && session.platformRole==="user" && session.role==="admin" ? "Mi empresa" : label,
    href,
  }));
  const canConfigure = can(session, "personalization.manage") || can(session, "settings.view");
  const canBrandPersonalization = Boolean(session.organizationId && session.role === "admin");
  const brandPersonalizationEnabled = Boolean(canBrandPersonalization && session.planCode === "pro" && session.whiteLabel);

  const [customization, organizationBranding, preferenceResult, identityResult] = await Promise.all([
    getCustomizationSummary(),
    session.whiteLabel && session.organizationId
      ? getOrganizationBranding(session.organizationId)
      : Promise.resolve(null),
    session.userId
      ? query<{ sidebar_order: string[] | null; sidebar_collapsed: boolean | null }>(
          "SELECT sidebar_order,sidebar_collapsed FROM user_dashboard_preferences WHERE user_id=$1",
          [session.userId],
        )
      : Promise.resolve({ rows: [] as Array<{ sidebar_order: string[] | null; sidebar_collapsed: boolean | null }> }),
    session.userId
      ? query<{ has_avatar: boolean }>("SELECT (avatar_data IS NOT NULL) has_avatar FROM users WHERE id=$1", [session.userId])
      : Promise.resolve({ rows: [] as Array<{ has_avatar: boolean }> }),
  ]);

  const initialSidebarOrder = preferenceResult.rows[0]?.sidebar_order || [];
  const initialSidebarCollapsed = Boolean(preferenceResult.rows[0]?.sidebar_collapsed);
  const accountAvatarSrc = session.userId && identityResult.rows[0]?.has_avatar
    ? `/api/users/${session.userId}/avatar`
    : null;

  // Organization identity extends the existing semantic token bridge.
  // Status colors remain untouched; only brand/navigation tokens are overridden.
  const shellStyle = organizationBranding
    ? brandCssVariables({
        primary: organizationBranding.primaryColor,
        secondary: organizationBranding.secondaryColor,
        accent: organizationBranding.accentColor,
      },organizationBranding.autoPalette) as React.CSSProperties
    : undefined;
  const sidebarLogo = organizationBranding?.hasLogoOnDark
    ? "/api/organization-branding/logo/dark"
    : organizationBranding?.hasBrandingRecord && organizationBranding.hasOrganizationLogo && session.organizationId
      ? `/api/organizations/${session.organizationId}/assets/logo`
      : logoOnDarkSrc(customization);
  const productName = organizationBranding?.appName || "Desweb CMMS";
  const mobileNavigationMode = session.platformRole === "user" && (session.role === "technician" || session.role === "external")
    ? "field"
    : "drawer";

  const densityClass=organizationBranding ? " brand-density-"+organizationBranding.interfaceDensity : "";
  return <div className={"shell desweb-shell-v2 mobile-nav-" + mobileNavigationMode + densityClass} style={shellStyle}>
    {organizationBranding&&<BrandThemeSync organizationDefault={organizationBranding.interfaceStyle}/>}
    {can(session,"reaction.track") && <TechnicianLocationTracker userName={session.fullName} />}
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
      <CurrentSectionHeader
        contextName={session.organizationName || roleLabel(session)}
        fullName={session.fullName}
        role={roleLabel(session)}
        canConfigure={canConfigure}
        canBrandPersonalization={canBrandPersonalization}
        brandPersonalizationEnabled={brandPersonalizationEnabled}
        avatarSrc={accountAvatarSrc}
      />
      <div className="workspace-content">{children}</div>
    </main>
  </div>;
}
