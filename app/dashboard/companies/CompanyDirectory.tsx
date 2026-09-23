"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import GeofenceMapPicker from "@/components/GeofenceMapPicker";
import BusinessHoursFields from "@/components/BusinessHoursFields";
import FileDropzone from "@/components/FileDropzone";
import PhoneField from "@/components/PhoneField";
import EntityProfileWorkspace from "@/components/EntityProfileWorkspace";
import ProfileExportMenu from "@/components/ProfileExportMenu";
import UiIcon from "@/components/UiIcon";

export type CompanyDirectoryItem = {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  tax_id: string | null;
  tax_id_type: string | null;
  legal_address: string | null;
  legal_city: string | null;
  legal_country: string | null;
  phone: string | null;
  billing_email: string | null;
  website: string | null;
  primary_contact_title: string | null;
  primary_contact_phone: string | null;
  primary_contact_email: string | null;
  internal_notes: string | null;
  timezone: string;
  business_days: number[];
  business_open_time: string;
  business_close_time: string;
  business_schedule: import("@/lib/business-hours").BusinessDaySchedule[];
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
  site_business_schedule: import("@/lib/business-hours").BusinessDaySchedule[] | null;
  has_logo: boolean;
  has_cover: boolean;
};

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return <div className="entity-info-field"><span>{label}</span><strong>{value}</strong></div>;
}

function CompanyMetric({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return <div className="entity-stat-card"><small>{label}</small><strong>{value}</strong>{hint && <span>{hint}</span>}</div>;
}

function companyScheduleLabel(company: CompanyDirectoryItem) {
  const rows=(company.business_schedule||[]).filter(row=>row.enabled);
  if(!rows.length) return "Sin horario activo";
  const ranges=Array.from(new Set(rows.map(row=>row.openTime.slice(0,5)+"–"+row.closeTime.slice(0,5))));
  return ranges.length===1 ? ranges[0]+" · "+rows.length+" días/semana" : "Horario variable · "+rows.length+" días/semana";
}

function countryLabel(code:string|null){
  if(!code) return "Sin registrar";
  const map:Record<string,string>={CO:"Colombia",PE:"Perú",EC:"Ecuador",MX:"México",CL:"Chile",AR:"Argentina",US:"Estados Unidos",PA:"Panamá",CR:"Costa Rica"};
  return map[code.toUpperCase()]||code;
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
    if (!selected || editing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
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
      let submittedSchedule = selected?.business_schedule || [];
      const submittedScheduleValue = formData.get("business_schedule_json");
      if (typeof submittedScheduleValue === "string" && submittedScheduleValue) {
        try {
          const parsed = JSON.parse(submittedScheduleValue);
          if (Array.isArray(parsed)) submittedSchedule = parsed;
        } catch {
          // Server validation remains authoritative; keep current local value if parsing fails.
        }
      }
      const activeSchedule = submittedSchedule.filter(item => item?.enabled);
      const representativeSchedule = activeSchedule[0];
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
        business_schedule: submittedSchedule,
        business_days: activeSchedule.map(item => Number(item.day)),
        business_open_time: representativeSchedule?.openTime || current.business_open_time,
        business_close_time: representativeSchedule?.closeTime || current.business_close_time,
        primary_contact_name: String(formData.get("primary_contact_name") || "") || null,
        admin_email: String(formData.get("admin_email") || "") || null,
        site_name: formData.has("site_name") ? (String(formData.get("site_name") || "") || null) : current.site_name,
        site_code: formData.has("site_code") ? (String(formData.get("site_code") || "") || null) : current.site_code,
        city: formData.has("city") ? (String(formData.get("city") || "") || null) : current.city,
        country: formData.has("country") ? (String(formData.get("country") || "") || null) : current.country,
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
    {!selected&&<div className="company-card-grid company-card-grid-compact">
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
    </div>}

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

    {selected&&<section className="section entity-page-detail company-entity-page">
      <EntityProfileWorkspace
        eyebrow="Administración"
        headingLabel="Empresa"
        headingIcon="company"
        breadcrumbs={[
          {label:"Inicio",href:"/dashboard"},
          {label:"Empresas",onClick:close},
          {label:selected.name},
        ]}
        title={selected.name}
        subtitle={selected.legal_name||selected.name}
        meta={[
          selected.tax_id?"Identificación "+selected.tax_id:"Identificación sin registrar",
          (selected.city||"Ciudad sin registrar")+(selected.country?" · "+selected.country:""),
        ]}
        coverSrc={selected.has_cover?"/api/organizations/"+selected.id+"/assets/cover?v="+assetVersion:null}
        imageSrc={selected.has_logo?"/api/organizations/"+selected.id+"/assets/logo?v="+assetVersion:null}
        imageAlt={"Logo de "+selected.name}
        fallback={initials(selected.name)}
        status={<span className={"status-badge "+(selected.active?"status-active":"status-inactive")}><i />{selected.active?"Activa":"Inactiva"}</span>}
        stats={[
          {label:"Ubicaciones",value:selected.site_count+"/"+selected.max_sites,icon:"location"},
          {label:"Activos",value:selected.asset_count+"/"+selected.max_assets,icon:"asset"},
          {label:"Técnicos",value:selected.technician_count+"/"+selected.max_technicians,icon:"user"},
          {label:"Documentos",value:selected.document_count,icon:"file",hint:selected.pending_document_count+" pendientes"},
        ]}
        toolbarActions={<>
          {!editing&&<button className="button secondary entity-action-button" type="button" onClick={requestEditConfirmation}><UiIcon name="edit"/> <span>Editar</span></button>}
          {editing&&<button className="button secondary entity-action-button" type="button" onClick={cancelEditing}><UiIcon name="edit"/> <span>Cancelar edición</span></button>}
          <Link className="button secondary entity-action-button entity-action-wide" href={"/dashboard/companies/"+selected.id}><UiIcon name="file"/> <span>Ficha completa</span></Link>
          <ProfileExportMenu entity="organization" id={selected.id}/>
          {canDelete&&!editing&&<form method="post" action={"/api/organizations/"+selected.id} onSubmit={event=>requestConfirmation("delete",event)}>
            <input type="hidden" name="intent" value="delete"/>
            <button className="button danger-secondary entity-action-button" type="submit"><UiIcon name="trash"/> <span>Eliminar</span></button>
          </form>}
        </>}
        quickActions={<>
          <Link href="/dashboard/locations"><UiIcon name="location"/> Ubicaciones</Link>
          <Link href="/dashboard/assets"><UiIcon name="asset"/> Activos</Link>
          <Link href="/dashboard/users"><UiIcon name="user"/> Usuarios</Link>
          <Link href={"/dashboard/companies/"+selected.id}><UiIcon name="file"/> Ficha completa</Link>
        </>}
        tabs={[
          {id:"general",label:"Información general",content:editing?<form
            ref={editFormRef}
            className="entity-section-stack company-inline-edit-form"
            method="post"
            action={"/api/organizations/"+selected.id}
            encType="multipart/form-data"
            onSubmit={event=>requestConfirmation("save",event)}
          >
            {saveError&&<div className="notice error">{saveError}</div>}
            {saveSuccess&&<div className="company-save-success" role="status" aria-live="polite">
              <span className="company-save-success-icon" aria-hidden="true">✓</span>
              <div><strong>Cambios guardados correctamente</strong><p>{saveSuccess.message}</p></div>
              <button type="button" aria-label="Cerrar confirmación" onClick={()=>setSaveSuccess(null)}>×</button>
            </div>}
            <input type="hidden" name="intent" value="update"/>
            <input type="hidden" name="return_to" value="directory"/>
            <input type="hidden" name="profile_v2" value="1"/>
            <input type="hidden" name="primary_site_id" value={selected.site_id||""}/>
            <div className="entity-panel">
              <h3>Datos de la empresa</h3>
              <div className="form-grid">
                <div className="field"><label>Nombre comercial</label><input name="name" defaultValue={selected.name} required/></div>
                <div className="field"><label>Razón social</label><input name="legal_name" defaultValue={selected.legal_name||""}/></div>
                <div className="field"><label>Tipo de identificación</label><input name="tax_id_type" defaultValue={selected.tax_id_type||""} placeholder="NIT, RUC, RFC..."/></div>
                <div className="field"><label>NIT / Identificación</label><input name="tax_id" defaultValue={selected.tax_id||""}/></div>
                <div className="field form-span-2"><label>Dirección administrativa / fiscal</label><input name="legal_address" defaultValue={selected.legal_address||""}/></div>
                <div className="field"><label>Ciudad administrativa</label><input name="legal_city" defaultValue={selected.legal_city||""}/></div>
                <div className="field"><label>País</label><input id="directory-company-country" name="legal_country" maxLength={2} defaultValue={selected.legal_country||"CO"}/></div>
                <PhoneField name="phone" label="Teléfono principal" countryCode={selected.legal_country||"CO"} countryInputId="directory-company-country" defaultValue={selected.phone}/>
                <div className="field"><label>Sitio web</label><input type="url" name="website" defaultValue={selected.website||""} placeholder="https://..."/></div>
                <div className="field"><label>Correo administrativo</label><input type="email" name="admin_email" defaultValue={selected.admin_email||""}/></div>
                <div className="field"><label>Correo de facturación</label><input type="email" name="billing_email" defaultValue={selected.billing_email||""}/></div>
                <div className="form-divider form-span-2"><span>Contacto principal</span></div>
                <div className="field"><label>Nombre</label><input name="primary_contact_name" defaultValue={selected.primary_contact_name||""}/></div>
                <div className="field"><label>Cargo</label><input name="primary_contact_title" defaultValue={selected.primary_contact_title||""}/></div>
                <PhoneField name="primary_contact_phone" label="Teléfono del contacto" countryCode={selected.legal_country||"CO"} countryInputId="directory-company-country" defaultValue={selected.primary_contact_phone}/>
                <div className="field"><label>Correo del contacto</label><input type="email" name="primary_contact_email" defaultValue={selected.primary_contact_email||""}/></div>
                <div className="field"><label>Identificador</label><input name="slug" defaultValue={selected.slug} required/></div>
                <div className="field"><label>Zona horaria</label><select name="timezone" defaultValue={selected.timezone}>
                  <option value="America/Bogota">Colombia · America/Bogota</option>
                  <option value="America/Lima">Perú · America/Lima</option>
                  <option value="America/Mexico_City">México · America/Mexico_City</option>
                  <option value="America/New_York">Estados Unidos · America/New_York</option>
                </select></div>
                <div className="field form-span-2"><label>Notas internas</label><textarea name="internal_notes" rows={3} defaultValue={selected.internal_notes||""} placeholder="Información administrativa o comercial relevante."/></div>
                <BusinessHoursFields
                  days={selected.business_days}
                  openTime={selected.business_open_time}
                  closeTime={selected.business_close_time}
                  schedule={selected.business_schedule}
                  title="Horario general de atención"
                  description="Este horario representa la atención general de la empresa."
                />
              </div>
            </div>

            {selected.site_id&&<div className="entity-panel">
              <h3>Sede principal y geocerca</h3>
              <div className="form-grid">
                <div className="field"><label>Nombre de sede</label><input name="site_name" defaultValue={selected.site_name||""}/></div>
                <div className="field"><label>Código interno</label><input name="site_code" defaultValue={selected.site_code||""}/></div>
                <div className="field"><label>Ciudad</label><input name="city" defaultValue={selected.city||""}/></div>
                <div className="field"><label>País</label><input name="country" defaultValue={selected.country||"CO"} maxLength={2}/></div>
              </div>
              <GeofenceMapPicker
                initialAddress={selected.address}
                initialLatitude={selected.site_latitude}
                initialLongitude={selected.site_longitude}
                initialRadius={selected.site_geofence_radius_m||250}
                cityHint={selected.city}
                countryHint={selected.country}
                markerImageUrl={selected.has_logo?"/api/organizations/"+selected.id+"/assets/logo":null}
                markerLabel={selected.name}
              />
            </div>}

            {canManageResources&&<div className="entity-panel">
              <h3>Cupos asignados</h3>
              <div className="form-grid">
                <div className="field"><label>Ubicaciones</label><input name="max_sites" type="number" min="1" defaultValue={selected.max_sites}/></div>
                <div className="field"><label>Sububicaciones</label><input name="max_sublocations" type="number" min="0" defaultValue={selected.max_sublocations}/></div>
                <div className="field"><label>Activos</label><input name="max_assets" type="number" min="0" defaultValue={selected.max_assets}/></div>
                <div className="field"><label>Inventario</label><input name="max_inventory_items" type="number" min="0" defaultValue={selected.max_inventory_items}/></div>
                <div className="field"><label>Técnicos</label><input name="max_technicians" type="number" min="0" defaultValue={selected.max_technicians}/></div>
              </div>
            </div>}

            <div className="entity-panel">
              <h3>Identidad visual</h3>
              <div className="company-upload-grid">
                <FileDropzone name="logo" label="Actualizar logo" description="Cuadrado · 800 × 800 px recomendado." accept="image/png,image/jpeg,image/webp" maxSizeMb={2} kind="image" existingFileName={selected.has_logo?"Logo actual":null} existingPreviewUrl={selected.has_logo?"/api/organizations/"+selected.id+"/assets/logo?v="+assetVersion:null} compact/>
                <FileDropzone name="cover" label="Actualizar portada" description="Horizontal · 1600 × 700 px recomendado." accept="image/png,image/jpeg,image/webp" maxSizeMb={5} kind="image" existingFileName={selected.has_cover?"Portada actual":null} existingPreviewUrl={selected.has_cover?"/api/organizations/"+selected.id+"/assets/cover?v="+assetVersion:null} compact/>
              </div>
            </div>

            <div className="form-actions company-inline-save-actions">
              <button className="button secondary" type="button" disabled={saving} onClick={cancelEditing}>Cancelar</button>
              <button className="button" type="submit" disabled={saving}>{saving?"Guardando…":"Guardar cambios"}</button>
            </div>
          </form>:<div className="entity-section-stack">
            {saveSuccess&&<div className="company-save-success" role="status" aria-live="polite">
              <span className="company-save-success-icon" aria-hidden="true">✓</span>
              <div><strong>Cambios guardados correctamente</strong><p>{saveSuccess.message}</p>{saveSuccess.files.length>0&&<div className="company-save-success-files">{saveSuccess.files.map(file=><span key={file}>✓ {file}</span>)}</div>}</div>
              <button type="button" aria-label="Cerrar confirmación" onClick={()=>setSaveSuccess(null)}>×</button>
            </div>}
            <div className="entity-approved-general-grid">
              <div className="entity-panel entity-approved-data-panel">
                <h3><span className="entity-section-icon"><UiIcon name="company"/></span>Datos de la empresa</h3>
                <div className="entity-info-grid">
                  <DetailField label="Nombre comercial" value={selected.name}/>
                  <DetailField label="Razón social" value={selected.legal_name||"Sin registrar"}/>
                  <DetailField label={(selected.tax_id_type||"NIT")+" / Identificación"} value={selected.tax_id||"Sin registrar"}/>
                  <DetailField label="Plan" value={selected.plan_name||"Sin plan"}/>
                  <DetailField label="Dirección administrativa / fiscal" value={selected.legal_address||"Sin registrar"}/>
                  <DetailField label="Ciudad administrativa" value={selected.legal_city||"Sin registrar"}/>
                  <DetailField label="País" value={countryLabel(selected.legal_country)}/>
                  <DetailField label="Horario general" value={companyScheduleLabel(selected)}/>
                  <DetailField label="Zona horaria" value={selected.timezone}/>
                  <DetailField label="Sitio web" value={selected.website?<a href={selected.website} target="_blank" rel="noreferrer">{selected.website}</a>:"Sin registrar"}/>
                </div>
              </div>
              <div className="entity-panel entity-approved-map-panel">
                <h3><span className="entity-section-icon"><UiIcon name="location"/></span>Sede principal en el mapa</h3>
                {selected.site_id?<GeofenceMapPicker initialAddress={selected.address} initialLatitude={selected.site_latitude} initialLongitude={selected.site_longitude} initialRadius={selected.site_geofence_radius_m||250} cityHint={selected.city} countryHint={selected.country} readOnly addressRequired={false} coordinateRequired={false} markerImageUrl={selected.has_logo?"/api/organizations/"+selected.id+"/assets/logo":null} markerLabel={selected.name}/>:<div className="location-detail-empty">Aún no hay una sede principal configurada.</div>}
              </div>
            </div>
            <div className="entity-panel-grid entity-approved-secondary-grid">
              <div className="entity-panel">
                <h3><span className="entity-section-icon"><UiIcon name="phone"/></span>Contacto</h3>
                <div className="entity-info-grid">
                  <DetailField label="Teléfono principal" value={selected.phone||"Sin registrar"}/>
                  <DetailField label="Correo administrativo" value={selected.admin_email||"Sin registrar"}/>
                  <DetailField label="Correo de facturación" value={selected.billing_email||"Sin registrar"}/>
                  <DetailField label="Contacto principal" value={selected.primary_contact_name||"Sin registrar"}/>
                  <DetailField label="Cargo" value={selected.primary_contact_title||"Sin registrar"}/>
                  <DetailField label="Teléfono del contacto" value={selected.primary_contact_phone||"Sin registrar"}/>
                  <div className="form-span-2"><DetailField label="Correo del contacto" value={selected.primary_contact_email||"Sin registrar"}/></div>
                </div>
              </div>
              <div className="entity-panel">
                <h3><span className="entity-section-icon"><UiIcon name="check"/></span>Estado del perfil</h3>
                <div className="entity-info-grid">
                  <DetailField label="Completitud" value={selected.profile_completion+"%"}/>
                  <DetailField label="Estado" value={selected.active?"Empresa activa":"Empresa inactiva"}/>
                  <DetailField label="Documentos registrados" value={selected.document_count}/>
                  <DetailField label="Pendientes documentales" value={selected.pending_document_count}/>
                  <DetailField label="Sede principal" value={selected.site_name||"Sin registrar"}/>
                  <DetailField label="Geocerca" value={selected.site_latitude!==null&&selected.site_longitude!==null?"Configurada":"Pendiente"}/>
                </div>
              </div>
            </div>
            <div className="entity-panel entity-approved-notes">
              <h3><span className="entity-section-icon"><UiIcon name="file"/></span>Notas adicionales</h3>
              <p>{selected.internal_notes||"Sin notas internas registradas."}</p>
            </div>
          </div>},
          {id:"statistics",label:"Estadísticas",content:<div className="entity-section-stack">
            <div className="entity-stat-grid">
              <CompanyMetric label="Ubicaciones" value={selected.site_count+"/"+selected.max_sites} hint="usadas / asignadas"/>
              <CompanyMetric label="Sububicaciones" value={selected.sublocation_count+"/"+selected.max_sublocations} hint="usadas / asignadas"/>
              <CompanyMetric label="Activos" value={selected.asset_count+"/"+selected.max_assets} hint="usados / asignados"/>
              <CompanyMetric label="Inventario" value={selected.inventory_item_count+"/"+selected.max_inventory_items} hint="usados / asignados"/>
              <CompanyMetric label="Técnicos" value={selected.technician_count+"/"+selected.max_technicians} hint="usados / asignados"/>
              <CompanyMetric label="Perfil" value={selected.profile_completion+"%"} hint="completitud"/>
            </div>
          </div>},
          {id:"locations",label:"Ubicaciones",content:<div className="entity-section-stack">
            <div className="entity-two-column">
              <div className="entity-panel"><h3>Sede principal</h3><div className="entity-info-grid">
                <DetailField label="Nombre" value={selected.site_name||"Sin sede principal"}/>
                <DetailField label="Código" value={selected.site_code||"Sin código"}/>
                <DetailField label="Ciudad" value={selected.city||"Sin registrar"}/>
                <DetailField label="País" value={selected.country||"Sin registrar"}/>
                <DetailField label="Dirección" value={selected.address||"Sin registrar"}/>
                <DetailField label="Ubicaciones activas" value={selected.active_site_count}/>
              </div></div>
              <div className="entity-panel"><h3>Mapa y geocerca</h3>
                {selected.site_id?<GeofenceMapPicker
                  initialAddress={selected.address}
                  initialLatitude={selected.site_latitude}
                  initialLongitude={selected.site_longitude}
                  initialRadius={selected.site_geofence_radius_m||250}
                  cityHint={selected.city}
                  countryHint={selected.country}
                  readOnly
                  addressRequired={false}
                  coordinateRequired={false}
                  markerImageUrl={selected.has_logo?"/api/organizations/"+selected.id+"/assets/logo":null}
                  markerLabel={selected.name}
                />:<p className="entity-panel-copy">La empresa aún no tiene una sede principal configurada.</p>}
              </div>
            </div>
            <Link className="button secondary entity-tab-cta" href="/dashboard/locations">Abrir módulo de ubicaciones</Link>
          </div>},
          {id:"documents",label:"Documentos",content:<div className="entity-section-stack">
            <div className="entity-stat-grid">
              <CompanyMetric label="Documentos vigentes" value={selected.document_count}/>
              <CompanyMetric label="Pendientes / vencidos" value={selected.pending_document_count}/>
              <CompanyMetric label="Perfil" value={selected.profile_completion+"%"}/>
            </div>
            <div className="entity-panel"><h3>Expediente empresarial</h3><p className="entity-panel-copy">La gestión completa de documentos, archivo, restauración, vista previa y eliminación protegida permanece en la ficha empresarial.</p><Link className="button secondary entity-tab-cta" href={"/dashboard/companies/"+selected.id}>Abrir expediente documental</Link></div>
          </div>},
          {id:"technicians",label:"Técnicos",content:<div className="entity-section-stack">
            <div className="entity-stat-grid"><CompanyMetric label="Técnicos" value={selected.technician_count+"/"+selected.max_technicians} hint="registrados / cupo"/></div>
            <div className="entity-panel"><h3>Personal de la empresa</h3><p className="entity-panel-copy">Consulta o administra los usuarios y técnicos vinculados a esta empresa desde el directorio de acceso.</p><Link className="button secondary entity-tab-cta" href="/dashboard/users">Abrir usuarios y técnicos</Link></div>
          </div>},
          {id:"life",label:"Hoja de vida",content:<div className="entity-section-stack">
            <div className="entity-panel"><h3>Hoja de vida de la empresa</h3><p className="entity-panel-copy">Consolida identidad empresarial, contacto, recursos, documentos y estructura principal en un formato autorizado para compartir.</p></div>
            <ProfileExportMenu entity="organization" id={selected.id} label="Exportar hoja de vida"/>
          </div>},
        ]}
      />
    </section>}

  </>;
}