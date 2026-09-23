"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import GeofenceMapPicker from "@/components/GeofenceMapPicker";
import BusinessHoursFields from "@/components/BusinessHoursFields";
import FileDropzone from "@/components/FileDropzone";

export type CompanyDirectoryItem = {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  tax_id: string | null;
  timezone: string;
  business_days: number[];
  business_open_time: string;
  business_close_time: string;
  active: boolean;
  admin_email: string | null;
  primary_contact_name: string | null;
  plan_name: string | null;
  profile_completion: number;
  document_count: string;
  pending_document_count: string;
  supplier_count: string;
  site_count: string;
  active_site_count: string;
  asset_count: string;
  sublocation_count: string;
  inventory_item_count: string;
  technician_count: string;
  max_sites: string;
  max_sublocations: string;
  max_assets: string;
  max_inventory_items: string;
  max_technicians: string;
  site_id: string | null;
  site_name: string | null;
  site_code: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  site_latitude: number | null;
  site_longitude: number | null;
  site_geofence_radius_m: number | null;
  site_business_days: number[] | null;
  site_business_open_time: string | null;
  site_business_close_time: string | null;
  has_logo: boolean;
  has_cover: boolean;
};

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

type ResourceKind = "sites" | "sublocations" | "assets" | "inventory" | "technicians";

function ResourceIcon({ kind }: { kind: ResourceKind }) {
  const common = {
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  } as const;

  if (kind === "sites") return <svg {...common}><path d="M4 10.5 12 4l8 6.5"/><path d="M6.5 9.5V20h11V9.5"/><path d="M9.5 20v-6h5v6"/></svg>;
  if (kind === "sublocations") return <svg {...common}><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/><path d="M10 7h4a3 3 0 0 1 3 3v4"/></svg>;
  if (kind === "assets") return <svg {...common}><path d="M5 9.5 12 5l7 4.5-7 4.5-7-4.5Z"/><path d="m5 9.5 7 4.5 7-4.5"/><path d="M5 14.5 12 19l7-4.5"/></svg>;
  if (kind === "inventory") return <svg {...common}><path d="M4 7.5 12 4l8 3.5-8 3.5-8-3.5Z"/><path d="M4 7.5V17l8 3 8-3V7.5"/><path d="M12 11v9"/></svg>;
  return <svg {...common}><circle cx="12" cy="8" r="3.5"/><path d="M5.5 19c.8-3.3 3-5.2 6.5-5.2s5.7 1.9 6.5 5.2"/></svg>;
}

export default function CompanyDirectory({
  companies,
  canManageResources,
  canDelete,
}: {
  companies: CompanyDirectoryItem[];
  canManageResources: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<CompanyDirectoryItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmation, setConfirmation] = useState<"edit" | "save" | "delete" | null>(null);
  const [pendingForm, setPendingForm] = useState<HTMLFormElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState<{ message: string; files: string[] } | null>(null);
  const [assetVersion, setAssetVersion] = useState(0);
  const editFormRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !editing) setSelected(null);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("modal-open");
    };
  }, [selected, editing]);

  function close() {
    setConfirmation(null);
    setPendingForm(null);
    setSaveError("");
    setSaveSuccess(null);
    setEditing(false);
    setSelected(null);
  }

  function requestConfirmation(kind: "save" | "delete", event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingForm(event.currentTarget);
    setSaveError("");
    setConfirmation(kind);
  }

  function cancelConfirmation() {
    setConfirmation(null);
    setPendingForm(null);
  }

  function requestEditConfirmation() {
    setSaveError("");
    setSaveSuccess(null);
    setConfirmation("edit");
  }

  function confirmEditing() {
    setConfirmation(null);
    setSaveError("");
    setEditing(true);
  }

  function cancelEditing() {
    editFormRef.current?.reset();
    setSaveError("");
    setEditing(false);
  }

  async function submitConfirmedForm() {
    const form = pendingForm;
    setConfirmation(null);
    if (!form || saving) return;

    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSaveError(payload?.message || "No fue posible guardar los cambios.");
        return;
      }

      const formData = new FormData(form);
      const selectedId = selected?.id || "";
      const uploadedFiles = ["logo", "cover"]
        .map(key => formData.get(key))
        .filter((value): value is File => value instanceof File && value.size > 0)
        .map(file => file.name);
      setSelected(current => current && current.id === selectedId ? {
        ...current,
        name: String(formData.get("name") || current.name),
        legal_name: String(formData.get("legal_name") || "") || null,
        tax_id: String(formData.get("tax_id") || "") || null,
        timezone: String(formData.get("timezone") || current.timezone),
        primary_contact_name: String(formData.get("primary_contact_name") || "") || null,
        admin_email: String(formData.get("admin_email") || "") || null,
        site_name: String(formData.get("site_name") || "") || null,
        site_code: String(formData.get("site_code") || "") || null,
        city: String(formData.get("city") || "") || null,
        country: String(formData.get("country") || "") || null,
        address: String(formData.get("address") || "") || null,
        site_latitude: Number(formData.get("latitude") || current.site_latitude),
        site_longitude: Number(formData.get("longitude") || current.site_longitude),
        site_geofence_radius_m: Number(formData.get("geofence_radius_m") || current.site_geofence_radius_m || 250),
        has_logo: current.has_logo || (() => {
          const value = formData.get("logo");
          return value instanceof File && value.size > 0;
        })(),
        has_cover: current.has_cover || (() => {
          const value = formData.get("cover");
          return value instanceof File && value.size > 0;
        })(),
      } : current);
      setAssetVersion(Date.now());
      setSaveSuccess({
        message: payload?.message || "Los cambios se guardaron correctamente.",
        files: uploadedFiles,
      });
      setEditing(false);
      form.reset();
      router.refresh();
    } finally {
      setSaving(false);
      setPendingForm(null);
    }
  }

  if (companies.length === 0) {
    return <div className="card empty-state"><strong>Aún no hay empresas registradas.</strong><span>Usa el botón “Nueva empresa” para crear la primera.</span></div>;
  }

  return <>
    <div className="company-card-grid company-card-grid-compact">
      {companies.map(company => {
        const resources: Array<{
          kind: ResourceKind;
          label: string;
          current: number;
          max: number;
          href: string;
        }> = [
          { kind: "sites", label: "Ubicaciones", current: Number(company.site_count) || 0, max: Number(company.max_sites) || 0, href: "/dashboard/locations" },
          { kind: "sublocations", label: "Sububicaciones", current: Number(company.sublocation_count) || 0, max: Number(company.max_sublocations) || 0, href: "/dashboard/locations" },
          { kind: "assets", label: "Activos", current: Number(company.asset_count) || 0, max: Number(company.max_assets) || 0, href: "/dashboard/assets" },
          { kind: "inventory", label: "Inventario", current: Number(company.inventory_item_count) || 0, max: Number(company.max_inventory_items) || 0, href: "/dashboard/inventory" },
          { kind: "technicians", label: "Técnicos", current: Number(company.technician_count) || 0, max: Number(company.max_technicians) || 0, href: "/dashboard/users" },
        ];

        return <article
          className="company-visual-card company-visual-card-v2 company-compact-card"
          key={company.id}
          data-module-record
          data-status={company.active ? "active" : "inactive"}
          data-search={[company.name,company.legal_name,company.tax_id,company.city,company.country,company.plan_name,company.site_name].filter(Boolean).join(" ")}
        >
          <button className="company-card-button company-card-main-action" type="button" onClick={() => {
            setSelected(company);
            setEditing(false);
          }} aria-label={`Ver detalle de ${company.name}`}>
            <div className={`company-card-cover ${company.has_cover ? "" : "company-card-cover-fallback"}`}>
              {company.has_cover && <img src={`/api/organizations/${company.id}/assets/cover`} alt={`Punto de referencia de ${company.name}`} />}
            </div>

            <div className="company-card-logo">
              {company.has_logo
                ? <img src={`/api/organizations/${company.id}/assets/logo`} alt={`Logo de ${company.name}`} />
                : <span>{initials(company.name)}</span>}
            </div>

            <div className="company-card-content company-card-content-compact">
              <div className="company-card-heading-row company-card-heading-centered">
                <h3>{company.name}</h3>
                <span className="company-plan-pill company-plan-pill-card">{company.plan_name || "Sin plan"}</span>
              </div>
              <div className="company-card-primary-status">
                <span className={company.active ? "company-state-dot active" : "company-state-dot"} aria-hidden="true">✓</span>
                <span>{company.active ? "Activa" : "Inactiva"}</span>
              </div>
              <small className="company-card-location-compact">{company.city || "Ciudad sin registrar"}{company.country ? ` · ${company.country}` : ""}</small>
            </div>
          </button>

          <nav className="company-resource-actions" aria-label={`Recursos de ${company.name}`}>
            {resources.map(resource => <Link
              key={resource.kind}
              href={resource.href}
              className="company-resource-action"
              title={resource.label}
              data-tooltip={resource.label}
              aria-label={`${resource.label}: ${resource.current} usados de ${resource.max} asignados. Abrir módulo.`}
            >
              <span className="company-resource-action-icon"><ResourceIcon kind={resource.kind} /></span>
              <strong>{resource.current}/{resource.max}</strong>
            </Link>)}
          </nav>

          <div className="company-card-footer-meta company-card-footer-compact">
            <span>{company.profile_completion}% perfil</span>
            <span>{company.pending_document_count} pendientes</span>
          </div>
        </article>;
      })}
    </div>

    <ConfirmDialog
      open={confirmation === "edit"}
      title="Editar empresa"
      message="¿Seguro que quieres habilitar la edición de esta empresa? Los campos permanecerán protegidos hasta que confirmes."
      confirmLabel="Sí, editar empresa"
      onCancel={cancelConfirmation}
      onConfirm={confirmEditing}
    />

    <ConfirmDialog
      open={confirmation === "save"}
      title="Guardar cambios"
      message="¿Deseas guardar los cambios realizados en esta empresa y su sede principal?"
      confirmLabel="Guardar cambios"
      onCancel={cancelConfirmation}
      onConfirm={submitConfirmedForm}
    />

    <ConfirmDialog
      open={confirmation === "delete"}
      title="Eliminar empresa"
      message="Esta acción eliminará también sus sedes y la información relacionada. No se puede deshacer."
      confirmLabel="Sí, eliminar"
      variant="danger"
      onCancel={cancelConfirmation}
      onConfirm={submitConfirmedForm}
    />

    {selected && <div className="modal-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !editing) close();
    }}>
      <section className="company-modal company-detail-modal company-profile-modal" role="dialog" aria-modal="true" aria-labelledby="company-detail-title">
        <header className="company-profile-hero">
          <div className={`company-detail-cover ${selected.has_cover ? "" : "company-card-cover-fallback"}`}>
            {selected.has_cover && <img src={`/api/organizations/${selected.id}/assets/cover?v=${assetVersion}`} alt={`Portada de ${selected.name}`} />}
          </div>
          <div className="company-profile-hero-shade" aria-hidden="true" />
          <button className="modal-close company-detail-close" type="button" aria-label="Cerrar" onClick={close}>×</button>
        </header>

        <section className="company-profile-identity">
          <div className="company-profile-logo">
            {selected.has_logo
              ? <img src={`/api/organizations/${selected.id}/assets/logo?v=${assetVersion}`} alt={`Logo de ${selected.name}`} />
              : <span>{initials(selected.name)}</span>}
          </div>

          <div className="company-profile-copy">
            <div className="company-profile-badges">
              <span className={`status-badge ${selected.active ? "status-active" : "status-inactive"}`}><span aria-hidden="true" />{selected.active ? "Empresa activa" : "Empresa inactiva"}</span>
              <span className="company-plan-pill">{selected.plan_name || "Sin plan"}</span>
              <span className="locked-badge"><span aria-hidden="true">{editing ? "✎" : "🔒"}</span>{editing ? "Modo edición" : "Protegida"}</span>
            </div>
            <h2 id="company-detail-title">{selected.name}</h2>
            <p>{selected.legal_name || selected.name}{selected.tax_id ? ` · Identificación ${selected.tax_id}` : ""}</p>
            <small>{selected.site_name || "Sin sede principal"} · {selected.city || "Ciudad sin registrar"}{selected.country ? ` · ${selected.country}` : ""}</small>
          </div>

          <div className="company-profile-actions" aria-label="Acciones rápidas">
            <Link href="/dashboard/locations" className="company-profile-action"><span aria-hidden="true">⌂</span><b>Ubicaciones</b></Link>
            <Link href="/dashboard/assets" className="company-profile-action"><span aria-hidden="true">◇</span><b>Activos</b></Link>
            <Link href="/dashboard/users" className="company-profile-action"><span aria-hidden="true">◎</span><b>Usuarios</b></Link>
            <Link href={`/dashboard/companies/${selected.id}`} className="company-profile-action"><span aria-hidden="true">▤</span><b>Ficha completa</b></Link>
          </div>
        </section>

        <div className="company-profile-summary">
          <div><span>Perfil</span><strong>{selected.profile_completion}%</strong><small>completitud</small></div>
          <div><span>Ubicaciones</span><strong>{selected.site_count}/{selected.max_sites}</strong><small>usadas / asignadas</small></div>
          <div><span>Activos</span><strong>{selected.asset_count}/{selected.max_assets}</strong><small>usados / asignados</small></div>
          <div><span>Documentos</span><strong>{selected.document_count}</strong><small>{selected.pending_document_count} pendientes</small></div>
        </div>

        {saveSuccess && <div className="company-save-success" role="status" aria-live="polite">
          <span className="company-save-success-icon" aria-hidden="true">✓</span>
          <div>
            <strong>Cambios guardados correctamente</strong>
            <p>{saveSuccess.message}</p>
            {saveSuccess.files.length > 0 && <div className="company-save-success-files">
              {saveSuccess.files.map(file => <span key={file}>✓ {file}</span>)}
            </div>}
          </div>
          <button type="button" aria-label="Cerrar confirmación" onClick={() => setSaveSuccess(null)}>×</button>
        </div>}

        <form ref={editFormRef} className="company-detail-form company-profile-form" method="post" action={`/api/organizations/${selected.id}`} encType="multipart/form-data" onSubmit={event => requestConfirmation("save", event)}>
          {saveError && <div className="notice error">{saveError}</div>}
          <input type="hidden" name="intent" value="update" />
          <input type="hidden" name="return_to" value="directory" />
          <input type="hidden" name="primary_site_id" value={selected.site_id || ""} />

          <details className="company-detail-accordion" open>
            <summary>
              <span className="company-detail-accordion-icon" aria-hidden="true">▤</span>
              <span><strong>Información general</strong><small>Identidad legal, zona horaria y datos base de la empresa.</small></span>
              <i aria-hidden="true">⌄</i>
            </summary>
            <div className="company-detail-accordion-body">
              <div className={`company-profile-contact-strip ${editing ? "editing" : ""}`}>
                {editing ? <>
                  <div className="field company-profile-contact-edit">
                    <label htmlFor="detail-primary-contact">Contacto principal</label>
                    <input id="detail-primary-contact" name="primary_contact_name" defaultValue={selected.primary_contact_name || ""} placeholder="Nombre del contacto principal" />
                  </div>
                  <div className="field company-profile-contact-edit">
                    <label htmlFor="detail-admin-email">Correo administrativo</label>
                    <input id="detail-admin-email" name="admin_email" type="email" defaultValue={selected.admin_email || ""} placeholder="correo@empresa.com" />
                  </div>
                </> : <>
                  <div><span>Contacto principal</span><strong>{selected.primary_contact_name || "Sin registrar"}</strong></div>
                  <div><span>Correo administrativo</span><strong>{selected.admin_email || "Sin registrar"}</strong></div>
                </>}
              </div>
              <div className="form-grid">
                <div className="field"><label htmlFor="detail-name">Nombre comercial</label><input id="detail-name" name="name" defaultValue={selected.name} readOnly={!editing} /></div>
                <div className="field"><label htmlFor="detail-legal">Razón social</label><input id="detail-legal" name="legal_name" defaultValue={selected.legal_name || ""} readOnly={!editing} /></div>
                <div className="field"><label htmlFor="detail-tax">NIT / Identificación</label><input id="detail-tax" name="tax_id" defaultValue={selected.tax_id || ""} readOnly={!editing} /></div>
                <div className="field"><label htmlFor="detail-slug">Identificador</label><input id="detail-slug" name="slug" defaultValue={selected.slug} readOnly={!editing} /></div>
                <div className="field form-span-2"><label htmlFor="detail-timezone">Zona horaria</label>
                  <select id="detail-timezone" name="timezone" defaultValue={selected.timezone} disabled={!editing}>
                    <option value="America/Bogota">Colombia · America/Bogota</option>
                    <option value="America/Lima">Perú · America/Lima</option>
                    <option value="America/Mexico_City">México · America/Mexico_City</option>
                    <option value="America/New_York">Estados Unidos · America/New_York</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
                <BusinessHoursFields
                  days={selected.business_days}
                  openTime={selected.business_open_time}
                  closeTime={selected.business_close_time}
                  disabled={!editing}
                  title="Horario general de atención"
                  description="Reacción usa este horario para el estado abierto/cerrado de la empresa."
                />
              </div>
            </div>
          </details>

          <details className="company-detail-accordion" open>
            <summary>
              <span className="company-detail-accordion-icon" aria-hidden="true">⌖</span>
              <span><strong>Sede principal y cobertura</strong><small>Dirección operativa y base para mapa, geocerca y asistencia biométrica.</small></span>
              <i aria-hidden="true">⌄</i>
            </summary>
            <div className="company-detail-accordion-body company-site-coverage-body">
              <div className="company-site-map-block">
                <GeofenceMapPicker
                  initialAddress={selected.address}
                  initialLatitude={selected.site_latitude}
                  initialLongitude={selected.site_longitude}
                  initialRadius={selected.site_geofence_radius_m || 250}
                  cityHint={selected.city}
                  countryHint={selected.country}
                  readOnly={!editing}
                  addressRequired
                  coordinateRequired
                  markerImageUrl={selected.has_logo?`/api/organizations/${selected.id}/assets/logo`:null}
                  markerLabel={selected.name}
                  className="company-site-geofence"
                />
              </div>

              <div className="company-site-info-grid">
                <div className="company-site-info-card">
                  <span>Identidad de sede</span>
                  <div className="company-site-info-fields">
                    <div className="field"><label htmlFor="detail-site-name">Nombre de sede</label><input id="detail-site-name" name="site_name" defaultValue={selected.site_name || ""} readOnly={!editing} /></div>
                    <div className="field"><label htmlFor="detail-site-code">Código interno</label><input id="detail-site-code" name="site_code" defaultValue={selected.site_code || ""} readOnly={!editing} /><small>Opcional. Referencia corta para OT, reportes e integraciones.</small></div>
                  </div>
                </div>

                <div className="company-site-info-card">
                  <span>Ubicación administrativa</span>
                  <div className="company-site-info-fields">
                    <div className="field"><label htmlFor="detail-city">Ciudad</label><input id="detail-city" name="city" defaultValue={selected.city || ""} readOnly={!editing} /></div>
                    <div className="field"><label htmlFor="detail-country">País</label><input id="detail-country" name="country" defaultValue={selected.country || "CO"} maxLength={2} readOnly={!editing} /></div>
                  </div>
                </div>
              </div>
            </div>
          </details>

          {canManageResources && <details className="company-detail-accordion">
            <summary>
              <span className="company-detail-accordion-icon" aria-hidden="true">◫</span>
              <span><strong>Recursos y consumo</strong><small>Cupos del plan y capacidad operativa utilizada.</small></span>
              <i aria-hidden="true">⌄</i>
            </summary>
            <div className="company-detail-accordion-body">
              <p className="muted resource-help">El Administrador de empresa puede consultar estos cupos; solo el Superadministrador puede modificarlos.</p>
              <div className="company-resource-grid">
                <div className="company-resource-item">
                  <div className="company-resource-item-head"><span>Ubicaciones principales</span><strong>{selected.site_count} / {selected.max_sites}</strong></div>
                  <div className="company-resource-track"><span style={{ width: `${Math.min(100, Number(selected.max_sites) > 0 ? (Number(selected.site_count) / Number(selected.max_sites)) * 100 : 0)}%` }} /></div>
                  {editing && <div className="field"><label htmlFor="detail-max-sites">Cupo asignado</label><input id="detail-max-sites" name="max_sites" type="number" min="1" defaultValue={selected.max_sites} required /></div>}
                </div>
                <div className="company-resource-item">
                  <div className="company-resource-item-head"><span>Sububicaciones</span><strong>{selected.sublocation_count} / {selected.max_sublocations}</strong></div>
                  <div className="company-resource-track"><span style={{ width: `${Math.min(100, Number(selected.max_sublocations) > 0 ? (Number(selected.sublocation_count) / Number(selected.max_sublocations)) * 100 : 0)}%` }} /></div>
                  {editing && <div className="field"><label htmlFor="detail-max-sublocations">Cupo asignado</label><input id="detail-max-sublocations" name="max_sublocations" type="number" min="0" defaultValue={selected.max_sublocations} required /></div>}
                </div>
                <div className="company-resource-item">
                  <div className="company-resource-item-head"><span>Activos</span><strong>{selected.asset_count} / {selected.max_assets}</strong></div>
                  <div className="company-resource-track"><span style={{ width: `${Math.min(100, Number(selected.max_assets) > 0 ? (Number(selected.asset_count) / Number(selected.max_assets)) * 100 : 0)}%` }} /></div>
                  {editing && <div className="field"><label htmlFor="detail-max-assets">Cupo asignado</label><input id="detail-max-assets" name="max_assets" type="number" min="0" defaultValue={selected.max_assets} required /></div>}
                </div>
                <div className="company-resource-item">
                  <div className="company-resource-item-head"><span>Inventario</span><strong>{selected.inventory_item_count} / {selected.max_inventory_items}</strong></div>
                  <div className="company-resource-track"><span style={{ width: `${Math.min(100, Number(selected.max_inventory_items) > 0 ? (Number(selected.inventory_item_count) / Number(selected.max_inventory_items)) * 100 : 0)}%` }} /></div>
                  {editing && <div className="field"><label htmlFor="detail-max-inventory">Cupo asignado</label><input id="detail-max-inventory" name="max_inventory_items" type="number" min="0" defaultValue={selected.max_inventory_items} required /></div>}
                </div>
                <div className="company-resource-item">
                  <div className="company-resource-item-head"><span>Técnicos</span><strong>{selected.technician_count} / {selected.max_technicians}</strong></div>
                  <div className="company-resource-track"><span style={{ width: `${Math.min(100, Number(selected.max_technicians) > 0 ? (Number(selected.technician_count) / Number(selected.max_technicians)) * 100 : 0)}%` }} /></div>
                  {editing && <div className="field"><label htmlFor="detail-max-technicians">Cupo asignado</label><input id="detail-max-technicians" name="max_technicians" type="number" min="0" defaultValue={selected.max_technicians} required /></div>}
                </div>
              </div>
            </div>
          </details>}

          <details className="company-detail-accordion">
            <summary>
              <span className="company-detail-accordion-icon" aria-hidden="true">▧</span>
              <span><strong>Documentación y cumplimiento</strong><small>Estado documental y pendientes de la empresa.</small></span>
              <i aria-hidden="true">⌄</i>
            </summary>
            <div className="company-detail-accordion-body">
              <div className="company-doc-summary">
                <div><strong>{selected.document_count}</strong><span>Documentos registrados</span></div>
                <div><strong>{selected.pending_document_count}</strong><span>Pendientes o vencidos</span></div>
                <div><strong>{selected.profile_completion}%</strong><span>Perfil completo</span></div>
              </div>
              <Link className="button secondary company-profile-inline-action" href={`/dashboard/companies/${selected.id}`}>Abrir documentación completa</Link>
            </div>
          </details>

          <details className="company-detail-accordion">
            <summary>
              <span className="company-detail-accordion-icon" aria-hidden="true">◉</span>
              <span><strong>Identidad visual</strong><small>Logo corporativo y fotografía de referencia.</small></span>
              <i aria-hidden="true">⌄</i>
            </summary>
            <div className="company-detail-accordion-body">
              <div className="company-profile-assets">
                <div><span>Logo</span><div className="company-profile-asset-preview logo">{selected.has_logo ? <img src={`/api/organizations/${selected.id}/assets/logo?v=${assetVersion}`} alt="" /> : <b>{initials(selected.name)}</b>}</div></div>
                <div><span>Portada</span><div className="company-profile-asset-preview cover">{selected.has_cover ? <img src={`/api/organizations/${selected.id}/assets/cover?v=${assetVersion}`} alt="" /> : <b>Sin portada</b>}</div></div>
              </div>
              {editing && <div className="form-grid">
                <FileDropzone name="logo" label="Actualizar logo" description="Cuadrado · 800 × 800 px recomendado." accept="image/png,image/jpeg,image/webp" maxSizeMb={2} kind="image" existingFileName={selected.has_logo ? "Logo actual" : null} existingPreviewUrl={selected.has_logo ? `/api/organizations/${selected.id}/assets/logo?v=${assetVersion}` : null} compact />
                <FileDropzone name="cover" label="Actualizar portada" description="Horizontal · 1600 × 700 px recomendado." accept="image/png,image/jpeg,image/webp" maxSizeMb={5} kind="image" existingFileName={selected.has_cover ? "Portada actual" : null} existingPreviewUrl={selected.has_cover ? `/api/organizations/${selected.id}/assets/cover?v=${assetVersion}` : null} compact />
              </div>}
            </div>
          </details>

          {editing && <footer className="modal-actions detail-edit-actions company-profile-edit-actions">
            <button className="button secondary" type="button" disabled={saving} onClick={cancelEditing}>Cancelar edición</button>
            <button className="button" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button>
          </footer>}
        </form>

        {!editing && <footer className="company-detail-actions company-profile-footer">
          <div>
            {canDelete && <form method="post" action={`/api/organizations/${selected.id}`} onSubmit={event => requestConfirmation("delete", event)}>
              <input type="hidden" name="intent" value="delete" />
              <button className="button danger-secondary" type="submit">Eliminar empresa</button>
            </form>}
          </div>
          <div>
            <Link className="button secondary" href={`/dashboard/companies/${selected.id}`}>Ficha completa</Link>
            <button className="button" type="button" onClick={requestEditConfirmation}>Editar empresa</button>
          </div>
        </footer>}
      </section>
    </div>}
  </>;
}
