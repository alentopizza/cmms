"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import { Avatar } from "@/components/ui-kit/Avatar";
import { Button } from "@/components/ui-kit/Button";
import { Modal } from "@/components/ui-kit/Overlay";

type Section = {
  label: string;
  eyebrow: string;
  icon: UiIconName;
};

const sections: Array<{ match: (pathname: string) => boolean; section: Section }> = [
  { match: pathname => pathname === "/dashboard", section: { label: "Dashboard", eyebrow: "Indicadores", icon: "dashboard" } },
  { match: pathname => pathname.startsWith("/dashboard/companies"), section: { label: "Empresas", eyebrow: "Administración", icon: "company" } },
  { match: pathname => pathname.startsWith("/dashboard/leads"), section: { label: "Leads", eyebrow: "Comercial", icon: "lead" } },
  { match: pathname => pathname.startsWith("/dashboard/locations"), section: { label: "Ubicaciones", eyebrow: "Estructura física", icon: "location" } },
  { match: pathname => pathname.startsWith("/dashboard/suppliers"), section: { label: "Proveedores", eyebrow: "Abastecimiento y terceros", icon: "supplier" } },
  { match: pathname => pathname.startsWith("/dashboard/users"), section: { label: "Usuarios y roles", eyebrow: "Control de acceso", icon: "user" } },
  { match: pathname => pathname.startsWith("/dashboard/crews"), section: { label: "Cuadrillas", eyebrow: "Ejecución operativa", icon: "crew" } },
  { match: pathname => pathname.startsWith("/dashboard/attendance"), section: { label: "Asistencia", eyebrow: "Operación en campo", icon: "attendance" } },
  { match: pathname => pathname.startsWith("/dashboard/reaction"), section: { label: "Reacción", eyebrow: "Coordinación de contingencias", icon: "reaction" } },
  { match: pathname => pathname.startsWith("/dashboard/assets"), section: { label: "Activos y equipos", eyebrow: "Gestión de activos", icon: "asset" } },
  { match: pathname => pathname.startsWith("/dashboard/work-orders"), section: { label: "Órdenes de trabajo", eyebrow: "Operación", icon: "work-order" } },
  { match: pathname => pathname.startsWith("/dashboard/maintenance"), section: { label: "Rutinas", eyebrow: "Planificación", icon: "maintenance" } },
  { match: pathname => pathname.startsWith("/dashboard/inventory"), section: { label: "Inventario", eyebrow: "Repuestos y existencias", icon: "inventory" } },
  { match: pathname => pathname.startsWith("/dashboard/requisitions"), section: { label: "Requisiciones", eyebrow: "Abastecimiento", icon: "requisition" } },
  { match: pathname => pathname.startsWith("/dashboard/reports"), section: { label: "Reportes", eyebrow: "Análisis y exportación", icon: "report" } },
  { match: pathname => pathname.startsWith("/dashboard/settings") || pathname.startsWith("/dashboard/personalization"), section: { label: "Configuración", eyebrow: "Plataforma", icon: "settings" } },
  { match: pathname => pathname.startsWith("/dashboard/brand"), section: { label: "Personalización de marca", eyebrow: "Configuración", icon: "preferences" } },
  { match: pathname => pathname.startsWith("/dashboard/preferences"), section: { label: "Mi configuración", eyebrow: "Cuenta", icon: "preferences" } },
  { match: pathname => pathname.startsWith("/dashboard/help"), section: { label: "Manual / Ayuda", eyebrow: "Centro de ayuda", icon: "help" } },
];

function currentSection(pathname: string) {
  return sections.find(item => item.match(pathname))?.section || { label: "Desweb CMMS", eyebrow: "Plataforma", icon: "dashboard" };
}

export function CurrentSectionHeader({
  contextName,
  fullName,
  role,
  canConfigure,
  canBrandPersonalization=false,
  brandPersonalizationEnabled=false,
  avatarSrc,
}: {
  contextName: string | null;
  fullName: string;
  role: string;
  canConfigure: boolean;
  canBrandPersonalization?: boolean;
  brandPersonalizationEnabled?: boolean;
  avatarSrc?: string | null;
}) {
  const pathname = usePathname();
  const section = currentSection(pathname);
  const contextualEyebrow = pathname.startsWith("/dashboard/settings") && contextName ? "Empresa" : section.eyebrow;

  return <header className="context-header">
    <div id="context-header-mobile-nav" className="context-header-mobile-nav-slot" />
    <div className="context-header-left">
      <div className="context-header-icon" aria-hidden="true"><UiIcon name={section.icon} size={19}/></div>
      <div className="context-header-copy">
        <span>{contextualEyebrow}</span>
        <strong>{section.label}</strong>
        {contextName && <small>{contextName}</small>}
      </div>
    </div>
    <div id="context-header-tools" className="context-header-tools-slot" />
    <div className="context-header-account-zone">
      <Link className="context-header-utility" href="/dashboard/help" title="Manual / Ayuda" aria-label="Manual / Ayuda"><UiIcon name="help" size={17}/></Link>
      {canConfigure && <Link className="context-header-utility" href="/dashboard/settings" title="Configuración" aria-label="Configuración"><UiIcon name="settings" size={17}/></Link>}
      <SidebarAccountMenu fullName={fullName} role={role} canConfigure={canConfigure} canBrandPersonalization={canBrandPersonalization} brandPersonalizationEnabled={brandPersonalizationEnabled} placement="header" avatarSrc={avatarSrc} />
    </div>
  </header>;
}

export function SidebarAccountMenu({
  fullName,
  role,
  canConfigure,
  canBrandPersonalization=false,
  brandPersonalizationEnabled=false,
  collapsed = false,
  placement = "sidebar",
  avatarSrc = null,
}: {
  fullName: string;
  role: string;
  canConfigure: boolean;
  canBrandPersonalization?: boolean;
  brandPersonalizationEnabled?: boolean;
  collapsed?: boolean;
  placement?: "sidebar" | "header";
  avatarSrc?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [logoutConfirm,setLogoutConfirm]=useState(false);
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
        <span className="account-menu-icon"><UiIcon name="preferences" size={17}/></span>
        <span><strong>Mi configuración</strong><small>Apariencia y preferencias personales</small></span>
      </Link>
      <Link role="menuitem" href="/dashboard/help" onClick={() => setOpen(false)}>
        <span className="account-menu-icon"><UiIcon name="help" size={17}/></span>
        <span><strong>Manual / Ayuda</strong><small>Guías según tu rol y alcance</small></span>
      </Link>
      {canBrandPersonalization && <Link role="menuitem" className="account-menu-brand" href="/dashboard/brand" onClick={() => setOpen(false)}>
        <span className="account-menu-icon"><UiIcon name="preferences" size={17}/></span>
        <span><strong>Personalización de marca <em>PRO</em></strong><small>{brandPersonalizationEnabled?"Colores, logo y apariencia del sistema":"Disponible con Plan Pro"}</small></span>
        <UiIcon name="chevron-right" size={14}/>
      </Link>}
      {canConfigure && <Link role="menuitem" href="/dashboard/settings" onClick={() => setOpen(false)}>
        <span className="account-menu-icon"><UiIcon name="settings" size={17}/></span>
        <span><strong>Configuración</strong><small>Cuenta, empresa y plataforma</small></span>
      </Link>}
      <button type="button" role="menuitem" className="account-menu-logout" onClick={()=>{setOpen(false);setLogoutConfirm(true);}}>
        <span className="account-menu-icon"><UiIcon name="logout" size={17}/></span>
        <span><strong>Cerrar sesión</strong><small>Salir de Desweb CMMS</small></span>
      </button>
    </div>}

    <button
      className={`${placement === "header" ? "header-account-trigger" : "sidebar-account-trigger"} ${open ? "active" : ""}`}
      type="button"
      onClick={() => setOpen(value => !value)}
      aria-expanded={open}
      aria-haspopup="menu"
      title={collapsed ? fullName + " · " + role : undefined}
    >
      <span className={placement === "header" ? "header-account-avatar" : "sidebar-account-avatar"}><Avatar src={avatarSrc} initials={initials} size="sm"/></span>
      {!collapsed && <span className={placement === "header" ? "header-account-copy" : "sidebar-account-copy"}>
        <strong>{fullName}</strong>
        <small>{role}</small>
      </span>}
      {!collapsed && <span className={placement === "header" ? "header-account-chevron" : "sidebar-account-chevron"} aria-hidden="true"><UiIcon name={open ? "chevron-up" : "chevron-down"} size={14}/></span>}
    </button>

    <Modal
      open={logoutConfirm}
      onClose={()=>setLogoutConfirm(false)}
      title="¿Cerrar sesión?"
      description="Se cerrará tu sesión actual de Desweb CMMS. Deberás iniciar sesión nuevamente para continuar."
      size="sm"
      role="alertdialog"
      className="logout-confirm-modal"
      footer={<>
        <Button variant="secondary" onClick={()=>setLogoutConfirm(false)}>Cancelar</Button>
        <form method="post" action="/api/auth/logout"><Button type="submit" variant="danger" iconLeft="logout">Cerrar sesión</Button></form>
      </>}
    >
      <div className="logout-confirm-icon"><UiIcon name="logout" size={28}/></div>
    </Modal>
  </div>;
}
