"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import GeofenceMapPicker from "@/components/GeofenceMapPicker";
import FileDropzone from "@/components/FileDropzone";
import BusinessHoursFields from "@/components/BusinessHoursFields";

type NamedOption = { id: string; name: string };
type OrganizationOption = NamedOption;
type SiteOption = { id: string; organization_id: string; name: string; organization_name?: string };
type LocationOption = { id: string; organization_id: string; site_id: string; name: string; label?: string };
type SupplierOption = { id: string; organization_id: string; name: string };
type AssetOption = { id: string; organization_id: string; site_id: string; name: string; code: string; label?: string };

function ModalShell({
  open,
  title,
  eyebrow,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  eyebrow: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [portalHost,setPortalHost]=useState<HTMLElement|null>(null);

  useEffect(()=>{ setPortalHost(document.body); },[]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("modal-open");
    };
  }, [open, onClose]);

  if (!open || !portalHost) return null;

  return createPortal(<div className="modal-backdrop contextual-create-backdrop" role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className="company-modal contextual-create-modal unified-create-modal" role="dialog" aria-modal="true">
      <header className="modal-header">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button className="modal-close" type="button" aria-label="Cerrar" onClick={onClose}>×</button>
      </header>
      {children}
    </section>
  </div>,portalHost);
}

function TriggerButton({
  label,
  icon = "+",
  secondary = false,
  disabled = false,
  onClick,
}: {
  label: string;
  icon?: string;
  secondary?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return <button className={"button contextual-create-trigger"+(secondary ? " secondary" : "")} type="button" disabled={disabled} onClick={onClick}>
    <span aria-hidden="true">{icon}</span>{label}
  </button>;
}

export function SiteCreateModal({
  organizations,
  fixedOrganizationId,
  fixedOrganizationName,
  returnTo,
  triggerLabel = "Nueva ubicación",
}: {
  organizations: OrganizationOption[];
  fixedOrganizationId?: string;
  fixedOrganizationName?: string;
  returnTo: string;
  triggerLabel?: string;
}) {
  const initial = fixedOrganizationId || (organizations.length === 1 ? organizations[0].id : "");
  const [open,setOpen]=useState(false);
  const [organizationId,setOrganizationId]=useState(initial);

  useEffect(() => {
    if (open) setOrganizationId(initial);
  }, [open, initial]);

  return <>
    <TriggerButton label={triggerLabel} icon="⌂" onClick={() => setOpen(true)} />
    <ModalShell open={open} onClose={() => setOpen(false)} eyebrow="Estructura física" title="Crear ubicación principal" description={fixedOrganizationName ? `Se creará directamente dentro de ${fixedOrganizationName}.` : "Selecciona la empresa y registra su nueva sede."}>
      <form className="company-modal-form" method="post" encType="multipart/form-data" action={organizationId ? `/api/organizations/${organizationId}/sites` : undefined}>
        <input type="hidden" name="return_to" value={returnTo} />
        {!fixedOrganizationId && <div className="field">
          <label>Empresa *</label>
          <select value={organizationId} onChange={event => setOrganizationId(event.target.value)} required>
            <option value="">Selecciona una empresa</option>
            {organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
          </select>
        </div>}
        {fixedOrganizationId && <input type="hidden" name="organization_id" value={fixedOrganizationId} />}
        <div className="form-grid">
          <div className="field"><label>Nombre *</label><input name="name" required autoFocus placeholder="Ej. Sede Bogotá Norte" /></div>
          <div className="field"><label>Código interno</label><input name="code" placeholder="Ej. BOG-01" /><small>Opcional. Referencia corta para OT, reportes e integraciones.</small></div>
          <div className="field"><label>Ciudad *</label><input name="city" required placeholder="Ej. Bogotá" /></div>
          <div className="field"><label>País *</label><input name="country" defaultValue="CO" maxLength={2} required /></div>
          <div className="form-span-2"><GeofenceMapPicker cityHint="" countryHint="CO" /></div>
          <div className="form-span-2"><FileDropzone name="image" label="Foto de la sede" description="Se usará como imagen de referencia de la ubicación." accept="image/png,image/jpeg,image/webp" maxSizeMb={5} kind="image" /></div>
          <div className="field"><label>Contacto</label><input name="contact_name" placeholder="Ej. Iván Garzón" /></div>
          <div className="field"><label>WhatsApp / teléfono</label><input name="contact_phone" placeholder="+57 300 123 4567" /></div>
          <div className="field form-span-2"><label>Correo de contacto</label><input name="contact_email" type="email" placeholder="sede@empresa.com" /></div>
          <BusinessHoursFields title="Horario de atención de la sede" description="Este horario alimenta el filtro operativo de Reacción." />
        </div>
        <footer className="modal-actions">
          <button className="button secondary" type="button" onClick={() => setOpen(false)}>Cancelar</button>
          <button className="button" type="submit" disabled={!organizationId}>Crear ubicación</button>
        </footer>
      </form>
    </ModalShell>
  </>;
}

export function SubLocationCreateModal({
  sites,
  locations,
  fixedSiteId,
  fixedSiteName,
  fixedParentId,
  returnTo,
  triggerLabel = "Nueva sububicación",
  secondary = false,
}: {
  sites: SiteOption[];
  locations: LocationOption[];
  fixedSiteId?: string;
  fixedSiteName?: string;
  fixedParentId?: string;
  returnTo: string;
  triggerLabel?: string;
  secondary?: boolean;
}) {
  const initialSite = fixedSiteId || (sites.length === 1 ? sites[0].id : "");
  const [open,setOpen]=useState(false);
  const [siteId,setSiteId]=useState(initialSite);
  const [parentId,setParentId]=useState(fixedParentId || "");

  useEffect(() => {
    if (!open) return;
    setSiteId(initialSite);
    setParentId(fixedParentId || "");
  }, [open, initialSite, fixedParentId]);

  const visibleLocations=useMemo(() => locations.filter(location => location.site_id===siteId),[locations,siteId]);

  return <>
    <TriggerButton label={triggerLabel} icon="⌁" secondary={secondary} disabled={sites.length===0 && !fixedSiteId} onClick={() => setOpen(true)} />
    <ModalShell open={open} onClose={() => setOpen(false)} eyebrow="Jerarquía física" title="Crear sububicación" description={fixedSiteName ? `La sede ${fixedSiteName} ya está seleccionada.` : "Selecciona la sede; el sistema conservará esa relación al crear el espacio."}>
      <form className="company-modal-form" method="post" encType="multipart/form-data" action={siteId ? `/api/sites/${siteId}/locations` : undefined}>
        <input type="hidden" name="return_to" value={returnTo} />
        <div className="form-grid">
          {!fixedSiteId && <div className="field form-span-2"><label>Ubicación principal *</label><select value={siteId} onChange={event => { setSiteId(event.target.value); setParentId(""); }} required><option value="">Selecciona una sede</option>{sites.map(site=><option key={site.id} value={site.id}>{site.organization_name ? site.organization_name+" · " : ""}{site.name}</option>)}</select></div>}
          <div className="field"><label>Nombre *</label><input name="name" required autoFocus placeholder="Ej. Cuarto de máquinas 2" /></div>
          <div className="field"><label>Código</label><input name="code" placeholder="Ej. CM-02" /></div>
          <div className="field"><label>Ubicación superior</label><select name="parent_id" value={parentId} onChange={event => setParentId(event.target.value)} disabled={Boolean(fixedParentId)}><option value="">{fixedSiteName || sites.find(site=>site.id===siteId)?.name || "Sede"} (nivel principal)</option>{visibleLocations.map(location=><option key={location.id} value={location.id}>{location.label || location.name}</option>)}</select>{fixedParentId && <input type="hidden" name="parent_id" value={fixedParentId} />}</div>
          <div className="field"><label>Tipo</label><select name="type" defaultValue="area"><option value="area">Área</option><option value="floor">Piso</option><option value="room">Habitación</option><option value="department">Departamento</option><option value="zone">Zona</option></select></div>
          <div className="field form-span-2"><label>Descripción</label><input name="description" placeholder="Ej. Nivel -1, acceso por corredor técnico" /></div>
          <div className="form-span-2"><FileDropzone name="image" label="Foto de la sububicación" description="Ayuda a reconocer visualmente el área, piso, habitación o zona." accept="image/png,image/jpeg,image/webp" maxSizeMb={5} kind="image" /></div>
        </div>
        <footer className="modal-actions">
          <button className="button secondary" type="button" onClick={() => setOpen(false)}>Cancelar</button>
          <button className="button" type="submit" disabled={!siteId}>Crear sububicación</button>
        </footer>
      </form>
    </ModalShell>
  </>;
}

export function AssetCreateModal({
  sites,
  locations,
  suppliers,
  fixedSiteId,
  fixedSiteName,
  fixedLocationId,
  fixedLocationName,
  returnTo,
  triggerLabel = "Nuevo activo",
  secondary = false,
}: {
  sites: SiteOption[];
  locations: LocationOption[];
  suppliers: SupplierOption[];
  fixedSiteId?: string;
  fixedSiteName?: string;
  fixedLocationId?: string;
  fixedLocationName?: string;
  returnTo: string;
  triggerLabel?: string;
  secondary?: boolean;
}) {
  const initialSite=fixedSiteId || (sites.length===1 ? sites[0].id : "");
  const [open,setOpen]=useState(false);
  const [siteId,setSiteId]=useState(initialSite);
  const [locationId,setLocationId]=useState(fixedLocationId || "");

  useEffect(() => {
    if (!open) return;
    setSiteId(initialSite);
    setLocationId(fixedLocationId || "");
  }, [open, initialSite, fixedLocationId]);

  const selectedSite=sites.find(site=>site.id===siteId);
  const organizationId=selectedSite?.organization_id || locations.find(location=>location.site_id===siteId)?.organization_id || "";
  const visibleLocations=locations.filter(location=>location.site_id===siteId);
  const visibleSuppliers=suppliers.filter(supplier=>supplier.organization_id===organizationId);

  return <>
    <TriggerButton label={triggerLabel} icon="◇" secondary={secondary} disabled={(sites.length===0 && !fixedSiteId) || suppliers.length===0} onClick={() => setOpen(true)} />
    <ModalShell open={open} onClose={() => setOpen(false)} eyebrow="Registro técnico" title="Crear activo" description={fixedLocationName ? `Quedará asociado directamente a ${fixedLocationName}.` : fixedSiteName ? `La sede ${fixedSiteName} ya está resuelta; solo selecciona la sububicación.` : "Selecciona el contexto físico del activo."}>
      <form className="company-modal-form" method="post" action="/api/assets">
        <input type="hidden" name="return_to" value={returnTo} />
        <div className="form-grid">
          {!fixedSiteId && <div className="field"><label>Sede *</label><select name="site_id" value={siteId} onChange={event=>{setSiteId(event.target.value);setLocationId("");}} required><option value="">Selecciona sede</option>{sites.map(site=><option key={site.id} value={site.id}>{site.organization_name ? site.organization_name+" · " : ""}{site.name}</option>)}</select></div>}
          {fixedSiteId && <input type="hidden" name="site_id" value={fixedSiteId} />}
          {!fixedLocationId && <div className="field"><label>Sububicación *</label><select name="location_id" value={locationId} onChange={event=>setLocationId(event.target.value)} required><option value="">Selecciona sububicación</option>{visibleLocations.map(location=><option key={location.id} value={location.id}>{location.label || location.name}</option>)}</select></div>}
          {fixedLocationId && <input type="hidden" name="location_id" value={fixedLocationId} />}
          <div className="field"><label>Proveedor *</label><select name="supplier_id" required><option value="">Selecciona proveedor</option>{visibleSuppliers.map(supplier=><option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>
          <div className="field"><label>Código *</label><input name="code" required autoFocus placeholder="Ej. HVAC-001" /></div>
          <div className="field"><label>Nombre *</label><input name="name" required placeholder="Ej. Unidad manejadora de aire 01" /></div>
          <div className="field"><label>Criticidad</label><select name="criticality" defaultValue="medium"><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option></select></div>
          <div className="field"><label>Fabricante</label><input name="manufacturer" placeholder="Ej. Carrier" /></div>
          <div className="field"><label>Modelo</label><input name="model" placeholder="Ej. 39HQ-120" /></div>
        </div>
        {visibleSuppliers.length===0 && <div className="notice error">La empresa seleccionada todavía no tiene proveedores activos. Registra uno antes de crear el activo.</div>}
        <footer className="modal-actions">
          <button className="button secondary" type="button" onClick={() => setOpen(false)}>Cancelar</button>
          <button className="button" type="submit" disabled={!siteId || !locationId || visibleSuppliers.length===0}>Crear activo</button>
        </footer>
      </form>
    </ModalShell>
  </>;
}

export function RoutineCreateModal({
  assets,
  fixedAssetId,
  fixedAssetName,
  returnTo,
  triggerLabel = "Nueva rutina",
  secondary = false,
}: {
  assets: AssetOption[];
  fixedAssetId?: string;
  fixedAssetName?: string;
  returnTo: string;
  triggerLabel?: string;
  secondary?: boolean;
}) {
  const initial=fixedAssetId || (assets.length===1 ? assets[0].id : "");
  const [open,setOpen]=useState(false);
  const [assetId,setAssetId]=useState(initial);

  useEffect(() => {
    if (open) setAssetId(initial);
  }, [open, initial]);

  return <>
    <TriggerButton label={triggerLabel} icon="↻" secondary={secondary} disabled={assets.length===0 && !fixedAssetId} onClick={() => setOpen(true)} />
    <ModalShell open={open} onClose={() => setOpen(false)} eyebrow="Mantenimiento preventivo" title="Crear rutina" description={fixedAssetName ? `El activo ${fixedAssetName} ya está seleccionado.` : "Selecciona el activo y define su frecuencia preventiva."}>
      <form className="company-modal-form" method="post" action="/api/maintenance-plans">
        <input type="hidden" name="return_to" value={returnTo} />
        <div className="form-grid">
          {!fixedAssetId && <div className="field form-span-2"><label>Activo *</label><select name="asset_id" value={assetId} onChange={event=>setAssetId(event.target.value)} required><option value="">Selecciona activo</option>{assets.map(asset=><option key={asset.id} value={asset.id}>{asset.label || asset.code+" · "+asset.name}</option>)}</select></div>}
          {fixedAssetId && <input type="hidden" name="asset_id" value={fixedAssetId} />}
          <div className="field form-span-2"><label>Nombre de la rutina *</label><input name="name" required autoFocus placeholder="Ej. Inspección y limpieza mensual de filtros" /></div>
          <div className="field form-span-2"><label>Descripción</label><input name="description" placeholder="Ej. Verificar filtros, correas, vibración y registrar hallazgos" /></div>
          <div className="field"><label>Cada *</label><input name="frequency_value" type="number" min="1" defaultValue="1" required /></div>
          <div className="field"><label>Unidad *</label><select name="frequency_unit" defaultValue="month"><option value="day">Día(s)</option><option value="week">Semana(s)</option><option value="month">Mes(es)</option><option value="year">Año(s)</option></select></div>
          <div className="field"><label>Próxima ejecución</label><input name="next_due_at" type="date" /></div>
          <div className="field"><label>Duración estimada (min)</label><input name="estimated_minutes" type="number" min="0" placeholder="60" /></div>
        </div>
        <footer className="modal-actions">
          <button className="button secondary" type="button" onClick={() => setOpen(false)}>Cancelar</button>
          <button className="button" type="submit" disabled={!assetId}>Crear rutina</button>
        </footer>
      </form>
    </ModalShell>
  </>;
}

export function ContextUserCreateModal({
  organizationId,
  organizationName,
  serviceSuppliers,
  returnTo,
  triggerLabel = "Nuevo usuario",
}: {
  organizationId: string;
  organizationName: string;
  serviceSuppliers: NamedOption[];
  returnTo: string;
  triggerLabel?: string;
}) {
  const [open,setOpen]=useState(false);
  const [role,setRole]=useState("viewer");

  useEffect(() => {
    if (open) setRole("viewer");
  }, [open]);

  return <>
    <TriggerButton label={triggerLabel} icon="◎" secondary onClick={() => setOpen(true)} />
    <ModalShell open={open} onClose={() => setOpen(false)} eyebrow="Control de acceso" title="Crear usuario" description={`La cuenta quedará vinculada directamente a ${organizationName}; no tendrás que seleccionar la empresa nuevamente.`}>
      <form className="company-modal-form" method="post" encType="multipart/form-data" action="/api/users">
        <input type="hidden" name="organization_id" value={organizationId} />
        <input type="hidden" name="access_all_sites" value="true" />
        <input type="hidden" name="return_to" value={returnTo} />
        <div className="form-grid">
          <div className="form-span-2"><FileDropzone name="avatar" label="Foto de perfil" description="Identidad visual del usuario. La biometría facial se enrola por separado con cámara y prueba de vida." accept="image/png,image/jpeg,image/webp" maxSizeMb={5} kind="image" /></div>
          <div className="field"><label>Nombre completo *</label><input name="full_name" required autoFocus placeholder="Ej. Laura Gómez" /></div>
          <div className="field"><label>Correo *</label><input name="email" type="email" required placeholder="laura@empresa.com" /></div>
          <div className="field"><label>Teléfono</label><input name="phone" placeholder="+57 300 123 4567" /></div>
          <div className="field"><label>Contraseña temporal *</label><input name="password" type="password" minLength={8} required autoComplete="new-password" placeholder="Mínimo 8 caracteres" /></div>
          <div className="field"><label>Rol *</label><select name="role" value={role} onChange={event=>setRole(event.target.value)}><option value="admin">Administrador de empresa</option><option value="manager">Manager / Supervisor</option><option value="technician">Técnico</option><option value="requester">Solicitante</option><option value="viewer">Consulta</option><option value="provider">Proveedor de servicios</option><option value="external">Colaborador externo</option></select></div>
          {(role==="provider" || role==="external") && <div className="field"><label>Proveedor de servicios {role==="provider"?"*":"(opcional)"}</label><select name="external_supplier_id" required={role==="provider"}><option value="">Selecciona proveedor</option>{serviceSuppliers.map(supplier=><option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>}
        </div>
        <aside className="role-permission-note"><div className="role-permission-icon">i</div><div><strong>Empresa preseleccionada</strong><p>El usuario tendrá inicialmente acceso a todas las sedes de {organizationName}. El alcance puede ajustarse posteriormente desde Usuarios.</p></div></aside>
        <footer className="modal-actions">
          <button className="button secondary" type="button" onClick={() => setOpen(false)}>Cancelar</button>
          <button className="button" type="submit">Crear usuario</button>
        </footer>
      </form>
    </ModalShell>
  </>;
}


export function LocationCreateModal({
  organizations,
  sites,
  locations,
  fixedOrganizationId,
  fixedOrganizationName,
  returnTo,
  autoOpen = false,
  initialKind = "site",
}: {
  organizations: OrganizationOption[];
  sites: SiteOption[];
  locations: LocationOption[];
  fixedOrganizationId?: string;
  fixedOrganizationName?: string;
  returnTo: string;
  autoOpen?: boolean;
  initialKind?: "site" | "sub";
}) {
  const initialOrganization=fixedOrganizationId || (organizations.length===1 ? organizations[0].id : "");
  const initialSite=sites.length===1 ? sites[0].id : "";
  const [open,setOpen]=useState(autoOpen);
  const [kind,setKind]=useState<"site"|"sub">(initialKind);
  const [organizationId,setOrganizationId]=useState(initialOrganization);
  const [siteId,setSiteId]=useState(initialSite);
  const [parentId,setParentId]=useState("");

  useEffect(()=>{
    if(autoOpen) setOpen(true);
  },[autoOpen]);

  useEffect(()=>{
    if(!open) return;
    setKind(initialKind);
    setOrganizationId(initialOrganization);
    setSiteId(initialSite);
    setParentId("");
  },[open,initialOrganization,initialSite,initialKind]);

  const visibleSites=sites.filter(site=>!organizationId || site.organization_id===organizationId);
  const resolvedSiteId=visibleSites.some(site=>site.id===siteId) ? siteId : (visibleSites.length===1 ? visibleSites[0].id : "");
  const visibleLocations=locations.filter(location=>location.site_id===resolvedSiteId);

  return <>
    <TriggerButton label="Agregar" icon="⌂" onClick={()=>setOpen(true)} />
    <ModalShell open={open} onClose={()=>setOpen(false)} eyebrow="Estructura física" title="Agregar ubicación" description="Crea una sede principal o una sububicación manteniendo la relación correcta con la empresa.">
      <div className="location-create-switch" role="tablist" aria-label="Tipo de ubicación">
        <button type="button" className={kind==="site"?"active":""} onClick={()=>setKind("site")}><strong>Ubicación principal</strong><span>Sede, planta o punto operativo</span></button>
        <button type="button" className={kind==="sub"?"active":""} onClick={()=>setKind("sub")}><strong>Sububicación</strong><span>Área, piso, cuarto o zona interna</span></button>
      </div>

      {kind==="site" ? <form className="company-modal-form" method="post" encType="multipart/form-data" action={organizationId ? `/api/organizations/${organizationId}/sites` : undefined}>
        <input type="hidden" name="return_to" value={returnTo} />
        {!fixedOrganizationId && <div className="field"><label>Empresa *</label><select value={organizationId} onChange={event=>setOrganizationId(event.target.value)} required><option value="">Selecciona una empresa</option>{organizations.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}</select></div>}
        {fixedOrganizationId && <input type="hidden" name="organization_id" value={fixedOrganizationId} />}
        <div className="form-grid">
          <div className="field"><label>Nombre *</label><input name="name" required autoFocus placeholder="Ej. Sede Bogotá Norte" /></div>
          <div className="field"><label>Código interno</label><input name="code" placeholder="Ej. BOG-01" /><small>Opcional. Referencia corta para OT, reportes e integraciones.</small></div>
          <div className="field"><label>Ciudad *</label><input name="city" required placeholder="Ej. Bogotá" /></div>
          <div className="field"><label>País *</label><input name="country" defaultValue="CO" maxLength={2} required placeholder="CO" /></div>
          <div className="form-span-2"><GeofenceMapPicker cityHint="" countryHint="CO" /></div>
          <div className="form-span-2"><FileDropzone name="image" label="Foto de la sede" description="Se usará como portada de la tarjeta de ubicación." accept="image/png,image/jpeg,image/webp" maxSizeMb={5} kind="image" /></div>
          <div className="field"><label>Contacto</label><input name="contact_name" placeholder="Ej. Iván Garzón" /></div>
          <div className="field"><label>WhatsApp / teléfono</label><input name="contact_phone" placeholder="+57 300 123 4567" /></div>
          <div className="field form-span-2"><label>Correo de contacto</label><input name="contact_email" type="email" placeholder="sede@empresa.com" /></div>
        </div>
        {fixedOrganizationName && <div className="modal-context-note">Empresa seleccionada: <strong>{fixedOrganizationName}</strong></div>}
        <footer className="modal-actions"><button className="button secondary" type="button" onClick={()=>setOpen(false)}>Cancelar</button><button className="button" type="submit" disabled={!organizationId}>Crear ubicación</button></footer>
      </form> :
      <form className="company-modal-form" method="post" encType="multipart/form-data" action={resolvedSiteId ? `/api/sites/${resolvedSiteId}/locations` : undefined}>
        <input type="hidden" name="return_to" value={returnTo} />
        <div className="form-grid">
          <div className="field form-span-2"><label>Ubicación principal *</label><select value={resolvedSiteId} onChange={event=>{setSiteId(event.target.value);setParentId("");}} required><option value="">Selecciona una sede</option>{visibleSites.map(site=><option key={site.id} value={site.id}>{site.organization_name ? site.organization_name+" · " : ""}{site.name}</option>)}</select></div>
          <div className="field"><label>Nombre *</label><input name="name" required placeholder="Ej. Cuarto de máquinas 2" /></div>
          <div className="field"><label>Código</label><input name="code" placeholder="Ej. CM-02" /></div>
          <div className="field"><label>Ubicación superior</label><select name="parent_id" value={parentId} onChange={event=>setParentId(event.target.value)}><option value="">Nivel principal de la sede</option>{visibleLocations.map(location=><option key={location.id} value={location.id}>{location.label || location.name}</option>)}</select></div>
          <div className="field"><label>Tipo</label><select name="type" defaultValue="area"><option value="area">Área</option><option value="floor">Piso</option><option value="room">Habitación</option><option value="department">Departamento</option><option value="zone">Zona</option></select></div>
          <div className="field form-span-2"><label>Descripción</label><input name="description" placeholder="Ej. Nivel -1, acceso por corredor técnico" /></div>
          <div className="form-span-2"><FileDropzone name="image" label="Foto de la sububicación" description="Ayuda a reconocer visualmente el área, piso, habitación o zona." accept="image/png,image/jpeg,image/webp" maxSizeMb={5} kind="image" /></div>
        </div>
        <footer className="modal-actions"><button className="button secondary" type="button" onClick={()=>setOpen(false)}>Cancelar</button><button className="button" type="submit" disabled={!resolvedSiteId}>Crear sububicación</button></footer>
      </form>}
    </ModalShell>
  </>;
}
