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
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import { CompanyCard } from "@/components/business-ui";
import { Badge } from "@/components/ui-kit/Badge";
import { EmptyState } from "@/components/ui-kit/Feedback";
import { StatTiles } from "@/components/ui-kit/Metrics";
import { CountryCityFields, CountryTimezoneSelect, TaxIdentificationTypeSelect } from "@/components/InternationalFields";

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
    return <EmptyState icon="file" title="Aún no hay empresas registradas" description="Usa Nueva empresa para crear el primer registro de la plataforma."/>;
  }

  return <div className="phase6-company-directory">
    {!selected&&<div className="company-card-grid company-card-grid-compact">
      {companies.map(company => {
        const resources: Array<{
          kind: ResourceKind;
          label: string;
          current: number;
          max: number;
          href: string;
          icon: UiIconName;
        }> = [
          { kind: "sites", label: "Ubicaciones", current: Number(company.site_count) || 0, max: Number(company.max_sites) || 0, href: "/dashboard/locations", icon:"location" },
          { kind: "sublocations", label: "Sububicaciones", current: Number(company.sublocation_count) || 0, max: Number(company.max_sublocations) || 0, href: "/dashboard/locations", icon:"sublocation" },
          { kind: "assets", label: "Activos", current: Number(company.asset_count) || 0, max: Number(company.max_assets) || 0, href: "/dashboard/assets", icon:"asset" },
          { kind: "inventory", label: "Inventario", current: Number(company.inventory_item_count) || 0, max: Number(company.max_inventory_items) || 0, href: "/dashboard/inventory", icon:"inventory" },
          { kind: "technicians", label: "Técnicos", current: Number(company.technician_count) || 0, max: Number(company.max_technicians) || 0, href: "/dashboard/users", icon:"user" },
        ];

        return <CompanyCard
          key={company.id}
          name={company.name}
          plan={company.plan_name||"Sin plan"}
          location={(company.city||"Ciudad sin registrar")+(company.country?" · "+company.country:"")}
          active={company.active}
          coverSrc={company.has_cover?"/api/organizations/"+company.id+"/assets/cover":null}
          logoSrc={company.has_logo?"/api/organizations/"+company.id+"/assets/logo":null}
          fallback={initials(company.name)}
          profileCompletion={company.profile_completion}
          pendingDocuments={Number(company.pending_document_count)||0}
          resources={resources.map(resource=>({label:resource.label,current:resource.current,max:resource.max,href:resource.href,icon:resource.icon}))}
          onOpen={()=>{setSelected(company);setEditing(false);}}
          recordProps={{
            "data-module-record":true,
            "data-status":company.active?"active":"inactive",
            "data-search":[company.name,company.legal_name,company.tax_id,company.city,company.country,company.plan_name,company.site_name].filter(Boolean).join(" "),
            "data-filter-plan":company.plan_name||"","data-filter-plan-label":company.plan_name||"",
            "data-filter-country":company.legal_country||company.country||"","data-filter-country-label":company.legal_country||company.country||"",
            "data-filter-city":company.legal_city||company.city||"","data-filter-city-label":company.legal_city||company.city||"",
          }}
        />;
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
        status={<Badge variant={selected.active?"success":"neutral"}>{selected.active?"Activa":"Inactiva"}</Badge>}
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
              <span className="company-save-success-icon" aria-hidden="true"><UiIcon name="check" size={17}/></span>
              <div><strong>Cambios guardados correctamente</strong><p>{saveSuccess.message}</p></div>
              <button type="button" aria-label="Cerrar confirmación" onClick={()=>setSaveSuccess(null)}><UiIcon name="x" size={14}/></button>
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
                <TaxIdentificationTypeSelect id="directory-company-tax-type" name="tax_id_type" countryInputId="directory-company-country" countryCode={selected.legal_country||"CO"} defaultValue={selected.tax_id_type||""} required />
                <div className="field"><label>Número de identificación</label><input name="tax_id" defaultValue={selected.tax_id||""}/></div>
                <div className="field form-span-2"><label>Dirección administrativa / fiscal</label><input name="legal_address" defaultValue={selected.legal_address||""}/></div>
                <CountryCityFields countryId="directory-company-country" countryName="legal_country" cityId="directory-company-city" cityName="legal_city" countryLabel="País" cityLabel="Ciudad administrativa" defaultCountry={selected.legal_country||"CO"} defaultCity={selected.legal_city||""} required />
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
                <CountryTimezoneSelect id="directory-company-timezone" name="timezone" countryInputId="directory-company-country" countryCode={selected.legal_country||"CO"} defaultValue={selected.timezone} />
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
                <CountryCityFields countryId="directory-site-country" countryName="country" cityId="directory-site-city" cityName="city" defaultCountry={selected.country||selected.legal_country||"CO"} defaultCity={selected.city||""} required />
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
            <div className="entity-approved-columns">
              <div className="entity-approved-column">
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
                <div className="entity-panel entity-approved-notes">
                  <h3><span className="entity-section-icon"><UiIcon name="file"/></span>Notas adicionales</h3>
                  <p>{selected.internal_notes||"Sin notas internas registradas."}</p>
                </div>
              </div>
              <div className="entity-approved-column entity-approved-map-column">
                <div className="entity-panel entity-approved-map-panel">
                  <h3><span className="entity-section-icon"><UiIcon name="location"/></span>Sede principal en el mapa</h3>
                  {selected.site_id?<GeofenceMapPicker initialAddress={selected.address} initialLatitude={selected.site_latitude} initialLongitude={selected.site_longitude} initialRadius={selected.site_geofence_radius_m||250} cityHint={selected.city} countryHint={selected.country} readOnly addressRequired={false} coordinateRequired={false} markerImageUrl={selected.has_logo?"/api/organizations/"+selected.id+"/assets/logo":null} markerLabel={selected.name} className="entity-profile-geofence"/>:<div className="location-detail-empty">Aún no hay una sede principal configurada.</div>}
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
            </div>
          </div>},
          {id:"statistics",label:"Estadísticas",content:<div className="entity-section-stack">
            <StatTiles className="entity-stat-grid" items={[
              {label:"Ubicaciones",value:selected.site_count+"/"+selected.max_sites,hint:"usadas / asignadas"},
              {label:"Sububicaciones",value:selected.sublocation_count+"/"+selected.max_sublocations,hint:"usadas / asignadas"},
              {label:"Activos",value:selected.asset_count+"/"+selected.max_assets,hint:"usados / asignados"},
              {label:"Inventario",value:selected.inventory_item_count+"/"+selected.max_inventory_items,hint:"usados / asignados"},
              {label:"Técnicos",value:selected.technician_count+"/"+selected.max_technicians,hint:"usados / asignados"},
              {label:"Perfil",value:selected.profile_completion+"%",hint:"completitud",tone:selected.profile_completion>=80?"success":"warning"},
            ]}/>
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
          {id:"documents",label:"Documentos",content:<div className="entity-section-stack company-documents-tab">
            <StatTiles className="entity-stat-grid" items={[
              {label:"Documentos vigentes",value:selected.document_count},
              {label:"Pendientes / vencidos",value:selected.pending_document_count,tone:Number(selected.pending_document_count)>0?"warning":"success"},
              {label:"Perfil",value:selected.profile_completion+"%",tone:selected.profile_completion>=80?"success":"warning"},
            ]}/>
            <section className="company-document-gateway" aria-labelledby={"company-documents-title-"+selected.id}>
              <span className="company-document-gateway-icon" aria-hidden="true"><UiIcon name="file" size={22}/></span>
              <div className="company-document-gateway-copy">
                <span className="eyebrow">Expediente empresarial</span>
                <h3 id={"company-documents-title-"+selected.id}>Documentos y cumplimiento</h3>
                <p>Administra requisitos, archivos vigentes y archivados, vencimientos, vista previa, restauración y eliminación protegida desde la ficha completa de la empresa.</p>
                <div className="company-document-gateway-status">
                  <Badge variant="brand" icon="file">{selected.document_count} vigentes</Badge>
                  <Badge variant={Number(selected.pending_document_count)>0?"warning":"success"} icon={Number(selected.pending_document_count)>0?"warning":"check"}>
                    {selected.pending_document_count} pendientes / vencidos
                  </Badge>
                </div>
              </div>
              <Link className="ds-button ds-button-secondary ds-button-md company-document-gateway-action" href={"/dashboard/companies/"+selected.id}>
                <UiIcon name="file" size={16}/>
                <span>Abrir expediente</span>
                <UiIcon name="chevron-right" size={14}/>
              </Link>
            </section>
          </div>},
          {id:"technicians",label:"Técnicos",content:<div className="entity-section-stack company-technicians-tab">
            <StatTiles className="entity-stat-grid" items={[
              {label:"Técnicos",value:selected.technician_count+"/"+selected.max_technicians,hint:"registrados / cupo"},
              {label:"Cupos disponibles",value:String(Math.max(0,Number(selected.max_technicians)-Number(selected.technician_count))),tone:Number(selected.technician_count)<Number(selected.max_technicians)?"success":"warning"},
              {label:"Ocupación",value:(Number(selected.max_technicians)>0?Math.min(100,Math.round(Number(selected.technician_count)/Number(selected.max_technicians)*100)):0)+"%",tone:Number(selected.technician_count)<Number(selected.max_technicians)?"success":"warning"},
            ]}/>
            <section className="company-staff-gateway" aria-labelledby={"company-staff-title-"+selected.id}>
              <span className="company-staff-gateway-icon" aria-hidden="true"><UiIcon name="user" size={22}/></span>
              <div className="company-staff-gateway-copy">
                <span className="eyebrow">Personal de la empresa</span>
                <h3 id={"company-staff-title-"+selected.id}>Usuarios y técnicos vinculados</h3>
                <p>Consulta y administra usuarios, técnicos, roles, datos de contacto y acceso operativo desde el directorio de personas.</p>
                <div className="company-staff-gateway-status">
                  <Badge variant="brand" icon="user">{selected.technician_count} técnicos registrados</Badge>
                  <Badge variant={Number(selected.technician_count)<Number(selected.max_technicians)?"success":"warning"} icon={Number(selected.technician_count)<Number(selected.max_technicians)?"check":"warning"}>
                    {Math.max(0,Number(selected.max_technicians)-Number(selected.technician_count))} cupos disponibles
                  </Badge>
                </div>
              </div>
              <Link className="ds-button ds-button-secondary ds-button-md company-staff-gateway-action" href="/dashboard/users">
                <UiIcon name="user" size={16}/>
                <span>Abrir usuarios y técnicos</span>
                <UiIcon name="chevron-right" size={14}/>
              </Link>
            </section>
          </div>},
        ]}
      />
    </section>}

  </div>;
}