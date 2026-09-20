"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type DashboardNavItem = {
  icon: string;
  label: string;
  href: string;
};

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/dashboard/settings" && pathname.startsWith("/dashboard/personalization")) return true;
  return pathname === href || pathname.startsWith(href + "/");
}

export function SidebarNavigation({ items }: { items: DashboardNavItem[] }) {
  const pathname = usePathname();

  return <nav className="nav" aria-label="Navegación principal">
    {items.map(item => {
      const active = isActive(pathname, item.href);
      return <Link
        key={item.href}
        href={item.href}
        className={active ? "active" : ""}
        aria-current={active ? "page" : undefined}
      >
        <span className="nav-icon">{item.icon}</span>
        <span>{item.label}</span>
      </Link>;
    })}
  </nav>;
}

export function HeaderTabs({ items }: { items: DashboardNavItem[] }) {
  const pathname = usePathname();

  return <nav className="workspace-tabs" aria-label="Secciones del CMMS">
    {items.map(item => {
      const active = isActive(pathname, item.href);
      return <Link
        key={item.href}
        href={item.href}
        className={active ? "active" : ""}
        aria-current={active ? "page" : undefined}
      >
        <span>{item.label}</span>
      </Link>;
    })}
  </nav>;
}
