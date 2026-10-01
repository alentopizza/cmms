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

export type HeaderNotification={
  id:string;
  title:string;
  context:string;
  createdAt:string;
  href?:string;
  icon:UiIconName;
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

function relativeNotificationTime(value:string){
  const diff=Math.max(0,Date.now()-new Date(value).getTime());
  const minutes=Math.floor(diff/60000);
  if(minutes<1)return "ahora";
  if(minutes<60)return "hace "+minutes+" min";
  const hours=Math.floor(minutes/60);
  if(hours<24)return "hace "+hours+" h";
  const days=Math.floor(hours/24);
  return "hace "+days+" d";
}

function GlobalNotificationBell({
  items,
  storageKey,
}:{
  items:HeaderNotification[];
  storageKey:string;
}){
  const [open,setOpen]=useState(false);
  const [showAll,setShowAll]=useState(false);
  const [readIds,setReadIds]=useState<string[]>([]);
  const wrapperRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    try{
      const raw=window.localStorage.getItem(storageKey);
      const parsed=raw?JSON.parse(raw):[];
      if(Array.isArray(parsed))setReadIds(parsed.filter(item=>typeof item==="string"));
    }catch{}
  },[storageKey]);

  useEffect(()=>{
    if(!open)return;
    const pointer=(event:MouseEvent)=>{if(!wrapperRef.current?.contains(event.target as Node))setOpen(false);};
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
    document.addEventListener("mousedown",pointer);
    document.addEventListener("keydown",key);
    return()=>{document.removeEventListener("mousedown",pointer);document.removeEventListener("keydown",key);};
  },[open]);

  function persist(next:string[]){
    setReadIds(next);
    try{window.localStorage.setItem(storageKey,JSON.stringify(next.slice(-200)));}catch{}
  }
  function markRead(id:string){if(!readIds.includes(id))persist([...readIds,id]);}
  function markAll(){persist([...new Set([...readIds,...items.map(item=>item.id)])]);}

  const unread=items.filter(item=>!readIds.includes(item.id)).length;
  const visible=showAll?items:items.slice(0,5);

  return <div className="global-notifications" ref={wrapperRef}>
    <button
      type="button"
      className={"context-header-utility global-notification-trigger"+(open?" active":"")}
      onClick={()=>setOpen(value=>!value)}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label="Notificaciones"
      title="Notificaciones"
      data-tooltip="Notificaciones"
    >
      <UiIcon name="bell" size={17}/>
      {unread>0&&<span className="global-notification-badge">{unread>99?"99+":unread}</span>}
    </button>
    {open&&<section className="global-notification-popover" role="dialog" aria-label="Notificaciones">
      <header>
        <div><strong>Notificaciones</strong><small>{unread} sin leer</small></div>
        <button type="button" onClick={()=>setOpen(false)} aria-label="Cerrar notificaciones"><UiIcon name="x" size={15}/></button>
      </header>
      <div className="global-notification-list">
        {visible.length?visible.map(item=>{
          const unreadItem=!readIds.includes(item.id);
          const content=<>
            <span className="global-notification-icon"><UiIcon name={item.icon} size={15}/></span>
            <span className="global-notification-copy"><strong>{item.title}</strong><small>{item.context} · {relativeNotificationTime(item.createdAt)}</small></span>
            {unreadItem&&<i aria-label="No leída"/>}
          </>;
          return item.href
            ?<Link key={item.id} href={item.href} className={unreadItem?"unread":""} onClick={()=>{markRead(item.id);setOpen(false);}}>{content}</Link>
            :<button key={item.id} type="button" className={unreadItem?"unread":""} onClick={()=>markRead(item.id)}>{content}</button>;
        }):<div className="global-notification-empty"><UiIcon name="bell" size={20}/><strong>Sin notificaciones recientes</strong><small>La actividad real del sistema aparecerá aquí.</small></div>}
      </div>
      <footer>
        <button type="button" onClick={markAll} disabled={!unread}>Marcar todas como leídas</button>
        {items.length>5&&<button type="button" onClick={()=>setShowAll(value=>!value)}>{showAll?"Ver menos":"Ver todas las notificaciones"}</button>}
      </footer>
    </section>}
  </div>;
}

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
  notifications=[],
  notificationStorageKey="cmms:notifications",
}: {
  contextName: string | null;
  fullName: string;
  role: string;
  canConfigure: boolean;
  canBrandPersonalization?: boolean;
  brandPersonalizationEnabled?: boolean;
  avatarSrc?: string | null;
  notifications?:HeaderNotification[];
  notificationStorageKey?:string;
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
      <GlobalNotificationBell items={notifications} storageKey={notificationStorageKey}/>
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
