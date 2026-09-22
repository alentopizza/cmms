"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SidebarAccountMenu } from "@/components/DashboardChrome";
import type { DashboardNavItem } from "@/components/DashboardNavigation";

export type ReorderableNavItem = DashboardNavItem & { id: string };

type Props = {
  items: ReorderableNavItem[];
  initialOrder: string[];
  initialCollapsed: boolean;
  persistentUser: boolean;
  sidebarLogo: string;
  productName: string;
  fullName: string;
  role: string;
  canConfigure: boolean;
  showDeswebBranding: boolean;
  mobileNavigationMode: "drawer" | "field";
};

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/dashboard/settings" && pathname.startsWith("/dashboard/personalization")) return true;
  return pathname === href || pathname.startsWith(href + "/");
}

function normalizeOrder(items: ReorderableNavItem[], preferred: string[]) {
  const visibleIds = new Set(items.map(item => item.id));
  const ordered = preferred.filter(id => visibleIds.has(id));
  for (const item of items) {
    if (!ordered.includes(item.id)) ordered.push(item.id);
  }
  return ordered;
}

function reorder<T>(list: T[], from: number, to: number) {
  const copy = [...list];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

export default function DashboardSidebar({
  items,
  initialOrder,
  initialCollapsed,
  persistentUser,
  sidebarLogo,
  productName,
  fullName,
  role,
  canConfigure,
  showDeswebBranding,
  mobileNavigationMode,
}: Props) {
  const pathname = usePathname();
  const defaultOrder = useMemo(() => items.map(item => item.id), [items]);
  const [order, setOrder] = useState(() => normalizeOrder(items, initialOrder));
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [mobileMenuHost, setMobileMenuHost] = useState<HTMLElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (persistentUser) return;
    try {
      const stored = window.localStorage.getItem("cmms-sidebar-preferences");
      if (!stored) return;
      const parsed = JSON.parse(stored) as { order?: string[]; collapsed?: boolean };
      if (Array.isArray(parsed.order)) setOrder(normalizeOrder(items, parsed.order));
      if (typeof parsed.collapsed === "boolean") setCollapsed(parsed.collapsed);
    } catch {
      // Ignore malformed local bootstrap preferences.
    }
  }, [items, persistentUser]);

  useEffect(() => {
    setOrder(current => normalizeOrder(items, current));
  }, [items]);

  useEffect(() => {
    setMobileMenuHost(document.getElementById("context-header-mobile-nav"));
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setMobileMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen && !mobileMoreOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setMobileMoreOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.toggle("dashboard-drawer-open", mobileOpen);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("dashboard-drawer-open");
    };
  }, [mobileOpen,mobileMoreOpen]);

  const orderedItems = useMemo(() => {
    const byId = new Map(items.map(item => [item.id, item]));
    return order.map(id => byId.get(id)).filter((item): item is ReorderableNavItem => Boolean(item));
  }, [items, order]);

  const mobileFieldItems = useMemo(() => {
    const priority = ["dashboard", "work_orders", "attendance", "assets"];
    const byId = new Map(orderedItems.map(item => [item.id, item]));
    return priority.map(id => byId.get(id)).filter((item): item is ReorderableNavItem => Boolean(item));
  }, [orderedItems]);

  const mobileSecondaryItems = useMemo(() => {
    const primaryIds = new Set(mobileFieldItems.map(item => item.id));
    return orderedItems.filter(item => !primaryIds.has(item.id) && item.id !== "help");
  }, [orderedItems, mobileFieldItems]);

  const mobileFieldHasOtherActive = mobileNavigationMode === "field" &&
    (mobileSecondaryItems.some(item => isActive(pathname,item.href)) || pathname.startsWith("/dashboard/help"));

  function persist(nextOrder = order, nextCollapsed = collapsed) {
    if (!persistentUser) {
      try {
        window.localStorage.setItem("cmms-sidebar-preferences", JSON.stringify({
          order: nextOrder,
          collapsed: nextCollapsed,
        }));
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
      return;
    }

    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const response = await fetch("/api/dashboard/preferences", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ order: nextOrder, collapsed: nextCollapsed }),
        });
        if (!response.ok) throw new Error("save_failed");
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 220);
  }

  function changeCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    persist(order, next);
  }

  function handleSidebarControl() {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches && mobileOpen) {
      setMobileOpen(false);
      return;
    }
    changeCollapsed();
  }

  function moveItem(id: string, direction: -1 | 1) {
    const from = order.indexOf(id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= order.length) return;
    const next = reorder(order, from, to);
    setOrder(next);
    persist(next, collapsed);
  }

  function dropOn(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    const from = order.indexOf(draggedId);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = reorder(order, from, to);
    setOrder(next);
    setDraggedId(null);
    persist(next, collapsed);
  }

  function resetOrder() {
    const next = normalizeOrder(items, defaultOrder);
    setOrder(next);
    persist(next, collapsed);
  }

  return <>
    {mobileMenuHost && createPortal(
      <button
        className={"dashboard-mobile-menu" + (mobileNavigationMode === "field" ? " field-hidden" : "")}
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir navegación"
        aria-expanded={mobileOpen}
        aria-controls="dashboard-navigation-drawer"
      >
        <span className="dashboard-mobile-menu-lines" aria-hidden="true">
          <i /><i /><i />
        </span>
      </button>,
      mobileMenuHost,
    )}

    {mobileNavigationMode === "field" && <nav className="field-mobile-nav" aria-label="Navegación móvil del técnico">
      <div className="field-mobile-nav-shell">
        {mobileFieldItems.map(item => {
          const active=isActive(pathname,item.href);
          return <Link
            key={item.id}
            href={item.href}
            className={"field-mobile-nav-item" + (active ? " active" : "")}
            aria-current={active ? "page" : undefined}
            onClick={() => setMobileOpen(false)}
          >
            <span className="field-mobile-nav-icon">{item.icon}</span>
            <small>{item.label}</small>
          </Link>;
        })}
        <button
          type="button"
          className={"field-mobile-nav-item field-mobile-nav-more" + (mobileFieldHasOtherActive || mobileMoreOpen ? " active" : "")}
          onClick={()=>setMobileMoreOpen(true)}
          aria-expanded={mobileMoreOpen}
          aria-controls="field-mobile-more-sheet"
          aria-label="Abrir opciones y módulos secundarios"
        >
          <span className="field-mobile-nav-icon">•••</span>
          <small>Más</small>
        </button>
      </div>
    </nav>}

    {mobileNavigationMode === "field" && mobileMoreOpen && <>
      <button
        className="field-mobile-more-overlay"
        type="button"
        aria-label="Cerrar opciones"
        onClick={() => setMobileMoreOpen(false)}
      />
      <section id="field-mobile-more-sheet" className="field-mobile-more-sheet" role="dialog" aria-modal="true" aria-label="Más opciones">
        <div className="field-mobile-more-handle" aria-hidden="true" />
        <header className="field-mobile-more-head">
          <div className="field-mobile-more-avatar">{fullName.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase() || "U"}</div>
          <div><strong>{fullName}</strong><small>{role}</small></div>
          <button type="button" onClick={()=>setMobileMoreOpen(false)} aria-label="Cerrar">×</button>
        </header>

        {mobileSecondaryItems.length > 0 && <div className="field-mobile-more-section">
          <span className="field-mobile-more-label">Módulos secundarios</span>
          <div className="field-mobile-more-grid">
            {mobileSecondaryItems.map(item=>{
              const active=isActive(pathname,item.href);
              return <Link key={item.id} href={item.href} className={"field-mobile-more-action"+(active?" active":"")} onClick={()=>setMobileMoreOpen(false)}>
                <span>{item.icon}</span><strong>{item.label}</strong>
              </Link>;
            })}
          </div>
        </div>}

        <div className="field-mobile-more-section">
          <span className="field-mobile-more-label">Cuenta y sistema</span>
          <div className="field-mobile-more-account">
            <Link href="/dashboard/preferences" onClick={()=>setMobileMoreOpen(false)}>
              <span>◐</span><div><strong>Mi configuración</strong><small>Apariencia y preferencias personales</small></div>
            </Link>
            <Link href="/dashboard/help" onClick={()=>setMobileMoreOpen(false)}>
              <span>?</span><div><strong>Manual / Ayuda</strong><small>Guías según tu rol y alcance</small></div>
            </Link>
            {canConfigure && <Link href="/dashboard/settings" onClick={()=>setMobileMoreOpen(false)}>
              <span>⚙</span><div><strong>Configuración</strong><small>Empresa, cuenta y preferencias</small></div>
            </Link>}
            <form method="post" action="/api/auth/logout">
              <button type="submit">
                <span>↪</span><div><strong>Cerrar sesión</strong><small>Salir de Desweb CMMS</small></div>
              </button>
            </form>
          </div>
        </div>
      </section>
    </>}

    {mobileOpen && <button
      className="dashboard-sidebar-overlay"
      type="button"
      aria-label="Cerrar navegación"
      onClick={() => setMobileOpen(false)}
    />}

    <aside
      id="dashboard-navigation-drawer"
      className={"sidebar smart-sidebar" + (collapsed ? " collapsed" : "") + (mobileOpen ? " mobile-open" : "")}
      aria-label="Navegación principal"
    >
      <div className="smart-sidebar-rail" aria-hidden="true" />
      <div className="smart-sidebar-top">
        <Link href="/dashboard" className="smart-sidebar-brand" aria-label={productName}>
          <img src={sidebarLogo} alt={productName} />
        </Link>
        <button
          className="smart-sidebar-collapse"
          type="button"
          onClick={handleSidebarControl}
          aria-label={mobileOpen ? "Cerrar navegación" : collapsed ? "Expandir menú" : "Contraer menú"}
        >
          <span aria-hidden="true">{mobileOpen ? "×" : collapsed ? "›" : "‹"}</span>
        </button>
      </div>

      <div className="smart-sidebar-product">
        <span className="smart-sidebar-product-mark">D</span>
        <div>
          <small>PLATAFORMA</small>
          <strong>{productName}</strong>
        </div>
      </div>

      <div className="smart-sidebar-tools">
        <button
          className={"smart-sidebar-tool" + (organizing ? " active" : "")}
          type="button"
          onClick={() => setOrganizing(value => !value)}
          title={organizing ? "Finalizar organización" : "Organizar módulos"}
          aria-pressed={organizing}
        >
          <span aria-hidden="true">↕</span>
          <span className="smart-sidebar-tool-label">{organizing ? "Listo" : "Organizar"}</span>
        </button>
        {organizing && <button className="smart-sidebar-tool" type="button" onClick={resetOrder} title="Restaurar orden original">
          <span aria-hidden="true">↺</span>
          <span className="smart-sidebar-tool-label">Restaurar</span>
        </button>}
      </div>

      <nav className={"smart-sidebar-nav" + (organizing ? " organizing" : "")} aria-label="Navegación principal">
        {orderedItems.map((item, index) => {
          const active = isActive(pathname, item.href);
          return <div
            key={item.id}
            className={"smart-sidebar-item-wrap" + (draggedId === item.id ? " dragging" : "")}
            draggable={organizing}
            onDragStart={event => {
              if (!organizing) return;
              setDraggedId(item.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", item.id);
            }}
            onDragOver={event => {
              if (organizing) event.preventDefault();
            }}
            onDrop={event => {
              event.preventDefault();
              dropOn(item.id);
            }}
            onDragEnd={() => setDraggedId(null)}
          >
            <Link
              href={item.href}
              className={"smart-sidebar-link" + (active ? " active" : "")}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              onClick={event => {
                if (organizing) {
                  event.preventDefault();
                  return;
                }
                setMobileOpen(false);
              }}
            >
              <span className="smart-sidebar-icon">{item.icon}</span>
              <span className="smart-sidebar-label">{item.label}</span>
              {organizing && <span className="smart-sidebar-drag" aria-hidden="true">⋮⋮</span>}
            </Link>

            {organizing && <div className="smart-sidebar-reorder-buttons" aria-label={"Mover " + item.label}>
              <button type="button" onClick={() => moveItem(item.id, -1)} disabled={index === 0} aria-label={"Subir " + item.label}>↑</button>
              <button type="button" onClick={() => moveItem(item.id, 1)} disabled={index === orderedItems.length - 1} aria-label={"Bajar " + item.label}>↓</button>
            </div>}
          </div>;
        })}
      </nav>

      <div className="smart-sidebar-save-state" aria-live="polite">
        {saveState === "saving" && "Guardando orden…"}
        {saveState === "saved" && "Preferencia guardada"}
        {saveState === "error" && "No se pudo guardar"}
      </div>

      <div className="sidebar-bottom smart-sidebar-bottom">
        <SidebarAccountMenu
          fullName={fullName}
          role={role}
          canConfigure={canConfigure}
          collapsed={collapsed && !mobileOpen}
        />
        {showDeswebBranding && <div className="sidebar-signature smart-sidebar-signature">
          <span>DESWEB</span>
          <small>Desarrollo de Soluciones</small>
        </div>}
      </div>
    </aside>
  </>;
}
