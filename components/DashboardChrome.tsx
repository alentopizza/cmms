"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Section = {
  label: string;
  eyebrow: string;
  icon: string;
};

const sections: Array<{ match: (pathname: string) => boolean; section: Section }> = [
  { match: pathname => pathname === "/dashboard", section: { label: "Dashboard", eyebrow: "Indicadores", icon: "▦" } },
  { match: pathname => pathname.startsWith("/dashboard/companies"), section: { label: "Empresas", eyebrow: "Administración", icon: "◫" } },
  { match: pathname => pathname.startsWith("/dashboard/leads"), section: { label: "Leads", eyebrow: "Comercial", icon: "✦" } },
  { match: pathname => pathname.startsWith("/dashboard/locations"), section: { label: "Ubicaciones", eyebrow: "Estructura física", icon: "⌂" } },
  { match: pathname => pathname.startsWith("/dashboard/suppliers"), section: { label: "Proveedores", eyebrow: "Abastecimiento y terceros", icon: "▣" } },
  { match: pathname => pathname.startsWith("/dashboard/users"), section: { label: "Usuarios y roles", eyebrow: "Control de acceso", icon: "◎" } },
  { match: pathname => pathname.startsWith("/dashboard/crews"), section: { label: "Cuadrillas", eyebrow: "Ejecución operativa", icon: "◉" } },
  { match: pathname => pathname.startsWith("/dashboard/attendance"), section: { label: "Asistencia", eyebrow: "Operación en campo", icon: "◌" } },
  { match: pathname => pathname.startsWith("/dashboard/reaction"), section: { label: "Reacción", eyebrow: "Coordinación de contingencias", icon: "⌖" } },
  { match: pathname => pathname.startsWith("/dashboard/assets"), section: { label: "Activos y equipos", eyebrow: "Gestión de activos", icon: "◇" } },
  { match: pathname => pathname.startsWith("/dashboard/work-orders"), section: { label: "Órdenes de trabajo", eyebrow: "Operación", icon: "✓" } },
  { match: pathname => pathname.startsWith("/dashboard/maintenance"), section: { label: "Rutinas", eyebrow: "Planificación", icon: "↻" } },
  { match: pathname => pathname.startsWith("/dashboard/inventory"), section: { label: "Inventario", eyebrow: "Repuestos y existencias", icon: "▤" } },
  { match: pathname => pathname.startsWith("/dashboard/settings") || pathname.startsWith("/dashboard/personalization"), section: { label: "Configuración", eyebrow: "Plataforma", icon: "⚙" } },
  { match: pathname => pathname.startsWith("/dashboard/preferences"), section: { label: "Mi configuración", eyebrow: "Cuenta", icon: "◐" } },
  { match: pathname => pathname.startsWith("/dashboard/help"), section: { label: "Manual / Ayuda", eyebrow: "Centro de ayuda", icon: "?" } },
];

function currentSection(pathname: string) {
  return sections.find(item => item.match(pathname))?.section || { label: "Desweb CMMS", eyebrow: "Plataforma", icon: "D" };
}

export function CurrentSectionHeader({
  contextName,
  fullName,
  role,
  canConfigure,
}: {
  contextName: string | null;
  fullName: string;
  role: string;
  canConfigure: boolean;
}) {
  const pathname = usePathname();
  const section = currentSection(pathname);
  const contextualEyebrow = pathname.startsWith("/dashboard/settings") && contextName ? "Empresa" : section.eyebrow;

  return <header className="context-header">
    <div id="context-header-mobile-nav" className="context-header-mobile-nav-slot" />
    <div className="context-header-left">
      <div className="context-header-icon" aria-hidden="true">{section.icon}</div>
      <div className="context-header-copy">
        <span>{contextualEyebrow}</span>
        <strong>{section.label}</strong>
        {contextName && <small>{contextName}</small>}
      </div>
    </div>
    <div className="context-header-account-zone">
      <Link className="context-header-utility" href="/dashboard/help" title="Manual / Ayuda" aria-label="Manual / Ayuda">?</Link>
      {canConfigure && <Link className="context-header-utility" href="/dashboard/settings" title="Configuración" aria-label="Configuración">⚙</Link>}
      <SidebarAccountMenu fullName={fullName} role={role} canConfigure={canConfigure} placement="header" />
    </div>
    <div id="context-header-tools" className="context-header-tools-slot" />
  </header>;
}

export function SidebarAccountMenu({
  fullName,
  role,
  canConfigure,
  collapsed = false,
  placement = "sidebar",
}: {
  fullName: string;
  role: string;
  canConfigure: boolean;
  collapsed?: boolean;
  placement?: "sidebar" | "header";
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "U";

  const accountClass = placement === "header" ? "header-account" : "sidebar-account";
  return <div className={accountClass + (collapsed ? " collapsed" : "")} ref={wrapperRef}>
    {open && <div className={placement === "header" ? "header-account-popover" : "sidebar-account-popover"} role="menu">
      <div className={placement === "header" ? "header-account-popover-head" : "sidebar-account-popover-head"}>
        <span>{fullName}</span>
        <small>{role}</small>
      </div>
      <Link role="menuitem" href="/dashboard/preferences" onClick={() => setOpen(false)}>
        <span className="account-menu-icon">◐</span>
        <span><strong>Mi configuración</strong><small>Apariencia y preferencias personales</small></span>
      </Link>
      <Link role="menuitem" href="/dashboard/help" onClick={() => setOpen(false)}>
        <span className="account-menu-icon">?</span>
        <span><strong>Manual / Ayuda</strong><small>Guías según tu rol y alcance</small></span>
      </Link>
      {canConfigure && <Link role="menuitem" href="/dashboard/settings" onClick={() => setOpen(false)}>
        <span className="account-menu-icon">⚙</span>
        <span><strong>Configuración</strong><small>Cuenta, empresa y plataforma</small></span>
      </Link>}
      <form method="post" action="/api/auth/logout">
        <button type="submit" role="menuitem">
          <span className="account-menu-icon">↪</span>
          <span><strong>Cerrar sesión</strong><small>Salir de Desweb CMMS</small></span>
        </button>
      </form>
    </div>}

    <button
      className={`${placement === "header" ? "header-account-trigger" : "sidebar-account-trigger"} ${open ? "active" : ""}`}
      type="button"
      onClick={() => setOpen(value => !value)}
      aria-expanded={open}
      aria-haspopup="menu"
      title={collapsed ? fullName + " · " + role : undefined}
    >
      <span className={placement === "header" ? "header-account-avatar" : "sidebar-account-avatar"}>{initials}</span>
      {!collapsed && <span className={placement === "header" ? "header-account-copy" : "sidebar-account-copy"}>
        <strong>{fullName}</strong>
        <small>{role}</small>
      </span>}
      {!collapsed && <span className={placement === "header" ? "header-account-chevron" : "sidebar-account-chevron"} aria-hidden="true">{open ? "⌃" : "⌄"}</span>}
    </button>
  </div>;
}
