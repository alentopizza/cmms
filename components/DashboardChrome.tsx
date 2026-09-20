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
  { match: pathname => pathname === "/dashboard", section: { label: "Resumen", eyebrow: "Visión general", icon: "▦" } },
  { match: pathname => pathname.startsWith("/dashboard/companies"), section: { label: "Empresas", eyebrow: "Administración", icon: "◫" } },
  { match: pathname => pathname.startsWith("/dashboard/locations"), section: { label: "Ubicaciones", eyebrow: "Estructura física", icon: "⌂" } },
  { match: pathname => pathname.startsWith("/dashboard/users"), section: { label: "Usuarios y roles", eyebrow: "Control de acceso", icon: "◎" } },
  { match: pathname => pathname.startsWith("/dashboard/assets"), section: { label: "Activos y equipos", eyebrow: "Gestión de activos", icon: "◇" } },
  { match: pathname => pathname.startsWith("/dashboard/work-orders"), section: { label: "Órdenes de trabajo", eyebrow: "Operación", icon: "✓" } },
  { match: pathname => pathname.startsWith("/dashboard/maintenance"), section: { label: "Preventivos", eyebrow: "Planificación", icon: "↻" } },
  { match: pathname => pathname.startsWith("/dashboard/inventory"), section: { label: "Inventario", eyebrow: "Repuestos y existencias", icon: "▤" } },
  { match: pathname => pathname.startsWith("/dashboard/settings") || pathname.startsWith("/dashboard/personalization"), section: { label: "Configuración", eyebrow: "Plataforma", icon: "⚙" } },
];

function currentSection(pathname: string) {
  return sections.find(item => item.match(pathname))?.section || { label: "Desweb CMMS", eyebrow: "Plataforma", icon: "D" };
}

export function CurrentSectionHeader({ organizationName }: { organizationName: string | null }) {
  const pathname = usePathname();
  const section = currentSection(pathname);

  return <header className="context-header">
    <div className="context-header-icon" aria-hidden="true">{section.icon}</div>
    <div className="context-header-copy">
      <span>{section.eyebrow}</span>
      <strong>{section.label}</strong>
      {organizationName && <small>{organizationName}</small>}
    </div>
  </header>;
}

export function SidebarAccountMenu({
  fullName,
  role,
  canConfigure,
}: {
  fullName: string;
  role: string;
  canConfigure: boolean;
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

  return <div className="sidebar-account" ref={wrapperRef}>
    {open && <div className="sidebar-account-popover" role="menu">
      <div className="sidebar-account-popover-head">
        <span>{fullName}</span>
        <small>{role}</small>
      </div>
      {canConfigure && <Link role="menuitem" href="/dashboard/settings" onClick={() => setOpen(false)}>
        <span className="account-menu-icon">⚙</span>
        <span><strong>Configuración</strong><small>Apariencia y plataforma</small></span>
      </Link>}
      <form method="post" action="/api/auth/logout">
        <button type="submit" role="menuitem">
          <span className="account-menu-icon">↪</span>
          <span><strong>Cerrar sesión</strong><small>Salir de Desweb CMMS</small></span>
        </button>
      </form>
    </div>}

    <button
      className={`sidebar-account-trigger ${open ? "active" : ""}`}
      type="button"
      onClick={() => setOpen(value => !value)}
      aria-expanded={open}
      aria-haspopup="menu"
    >
      <span className="sidebar-account-avatar">{initials}</span>
      <span className="sidebar-account-copy">
        <strong>{fullName}</strong>
        <small>{role}</small>
      </span>
      <span className="sidebar-account-chevron" aria-hidden="true">{open ? "⌃" : "⌄"}</span>
    </button>
  </div>;
}
