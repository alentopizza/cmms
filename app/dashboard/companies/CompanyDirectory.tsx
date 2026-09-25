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
import { CompanyCard, LocationCard, SubLocationCard, UserCard } from "@/components/business-ui";
import { ContextUserCreateModal, LocationCreateModal } from "@/components/ContextCreateModals";
import CompanyDocumentWorkspace, { type CompanyDocumentItem } from "@/components/CompanyDocumentWorkspace";
import CompanyDocumentCreateModal from "@/components/CompanyDocumentCreateModal";
import { ORGANIZATION_DOCUMENT_CATEGORIES } from "@/lib/organization-document-catalog";
import { Badge } from "@/components/ui-kit/Badge";
import { EmptyState } from "@/components/ui-kit/Feedback";
import { CollectionView } from "@/components/ui-kit/DataControls";
import { StaticDataTable } from "@/components/ui-kit/StaticTable";
import { EntityIdentityCell, ListQuickActions } from "@/components/ui-kit/CollectionIdentity";
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

export type CompanyRelatedSite={
  id:string;organization_id:string;name:string;code:string|null;city:string|null;country:string;address:string|null;active:boolean;
  asset_count:number;sublocation_count:number;has_image:boolean;
};
export type CompanyRelatedLocation={
  id:string;organization_id:string;site_id:string;name:string;code:string|null;type:string;parent_id:string|null;active:boolean;
  asset_count:number;has_image:boolean;
};
export type CompanyRelatedTechnician={
  id:string;organization_id:string;full_name:string;email:string;phone:string|null;active:boolean;has_avatar:boolean;
  access_all_sites:boolean;site_names:string[];
};
export type CompanyRelatedSupplier={id:string;organization_id:string;name:string};
export type CompanyRelatedDocument=CompanyDocumentItem&{organization_id:string};

type ResourceKind = "sites" | "sublocations" | "assets" | "inventory" | "technicians";

export default function CompanyDirectory({
  companies,
  sites,
  locations,
  technicians,
  documents,
  serviceSuppliers,
  canManageResources,
  canManageLocations,
  canManageUsers,
  canDelete,
  initialCompanyId,
  initialTab,
}: {
  companies: CompanyDirectoryItem[];
  sites: CompanyRelatedSite[];
  locations: CompanyRelatedLocation[];
  technicians: CompanyRelatedTechnician[];
  documents: CompanyRelatedDocument[];
  serviceSuppliers: CompanyRelatedSupplier[];
  canManageResources: boolean;
  canManageLocations: boolean;
  canManageUsers: boolean;
  canDelete: boolean;
  initialCompanyId?: string;
  initialTab?: string;
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

  useEffect(()=>{
    if(!initialCompanyId)return;
    const company=companies.find(item=>item.id===initialCompanyId);
    if(company)setSelected(company);
  },[initialCompanyId,companies]);

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

  const selectedSites=selected?sites.filter(item=>item.organization_id===selected.id):[];
  const selectedLocations=selected?locations.filter(item=>item.organization_id===selected.id):[];
  const selectedTechnicians=selected?technicians.filter(item=>item.organization_id===selected.id):[];
  const selectedDocuments=selected?documents.filter(item=>item.organization_id===selected.id):[];
  const selectedServiceSuppliers=selected?serviceSuppliers.filter(item=>item.organization_id===selected.id):[];
  const selectedReturnTo=selected?"/dashboard/companies?company="+encodeURIComponent(selected.id):"/dashboard/companies";

  return <div className="phase6-company-directory">
    {!selected&&<CollectionView storageKey="companies" label="Vista de empresas" grid={<div className="company-card-grid company-card-grid-compact" data-collection-grid>
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
    </div>} list={<StaticDataTable
      className="company-directory-list"
      caption="Listado de empresas"
      columns={[
        {key:"company",label:"Empresa",width:"30%"},
        {key:"status",label:"Estado"},
        {key:"plan",label:"Plan"},
        {key:"city",label:"Ciudad / País"},
        {key:"sites",label:"Ubicaciones",align:"end"},
        {key:"assets",label:"Activos",align:"end"},
        {key:"technicians",label:"Técnicos",align:"end"},
        {key:"actions",label:"Acciones",align:"end"},
      ]}
      rows={companies.map(company=>({
        id:company.id,
        recordProps:{
          "data-module-record":true,
          "data-status":company.active?"active":"inactive",
          "data-search":[company.name,company.legal_name,company.tax_id,company.city,company.country,company.plan_name,company.site_name].filter(Boolean).join(" "),
          "data-filter-plan":company.plan_name||"",
          "data-filter-plan-label":company.plan_name||"",
          "data-filter-country":company.legal_country||company.country||"",
          "data-filter-country-label":company.legal_country||company.country||"",
          "data-filter-city":company.legal_city||company.city||"",
          "data-filter-city-label":company.legal_city||company.city||"",
        },
        cells:{
          company:<EntityIdentityCell
            imageSrc={company.has_logo?"/api/organizations/"+company.id+"/assets/logo":null}
            imageAlt={company.has_logo?"Logo de "+company.name:""}
            fallback={initials(company.name)}
            icon="company"
            variant="logo"
            title={company.name}
            subtitle={company.legal_name||company.tax_id||"Empresa registrada"}
            meta={company.billing_email||company.primary_contact_email||null}
          />,
          status:<Badge variant={company.active?"success":"neutral"}>{company.active?"Activa":"Inactiva"}</Badge>,
          plan:company.plan_name||"Sin plan",
          city:(company.city||company.legal_city||"Sin ciudad")+" · "+countryLabel(company.legal_country||company.country),
          sites:Number(company.site_count)||0,
          assets:Number(company.asset_count)||0,
          technicians:Number(company.technician_count)||0,
          actions:<ListQuickActions>
            <button type="button" className="ds-list-action primary" onClick={()=>{setSelected(company);setEditing(false);}} title="Ver empresa" data-tooltip="Ver empresa" aria-label={"Ver empresa "+company.name}><UiIcon name="eye" size={16}/></button>
          </ListQuickActions>,
        },
      }))}
    />}/>} 

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
        initialTab={initialCompanyId===selected.id?initialTab:undefined}
        fullWidthTabIds={["documents"]}
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
          {id:"locations",label:"Ubicaciones",action:canManageLocations?<LocationCreateModal
            organizations={[{id:selected.id,name:selected.name,country:selected.legal_country||selected.country||"CO"}]}
            sites={selectedSites.map(site=>({id:site.id,organization_id:site.organization_id,name:site.name,organization_name:selected.name}))}
            locations={selectedLocations.map(location=>({id:location.id,organization_id:location.organization_id,site_id:location.site_id,name:location.name,label:location.name}))}
            fixedOrganizationId={selected.id}
            fixedOrganizationName={selected.name}
            returnTo={selectedReturnTo+"&tab=locations"}
          />:undefined,content:<div className="entity-section-stack company-related-tab company-locations-tab">
            <StatTiles className="entity-stat-grid" items={[
              {label:"Ubicaciones",value:selected.site_count+"/"+selected.max_sites,hint:"registradas / cupo"},
              {label:"Activas",value:selected.active_site_count,tone:"success"},
              {label:"Sububicaciones",value:selected.sublocation_count+"/"+selected.max_sublocations,hint:"registradas / cupo"},
            ]}/>
            {selectedSites.length||selectedLocations.length?<div className="company-related-location-grid">
              {selectedSites.map(site=><LocationCard
                key={site.id}
                name={site.name}
                organization={selected.name}
                location={(site.city||"Ciudad sin registrar")+" · "+site.country}
                address={site.address||"Dirección sin registrar"}
                active={site.active}
                coverSrc={site.has_image?"/api/sites/"+site.id+"/image":null}
                logoSrc={selected.has_logo?"/api/organizations/"+selected.id+"/assets/logo":null}
                fallback={initials(selected.name)}
                onOpen={()=>router.push("/dashboard/locations/"+site.id)}
                resources={<div className="company-related-location-metrics"><span><strong>{site.asset_count}</strong><small>Activos</small></span><span><strong>{site.sublocation_count}</strong><small>Sububicaciones</small></span></div>}
              />)}
              {selectedLocations.map(location=><SubLocationCard
                key={location.id}
                name={location.name}
                type={location.type}
                assetCount={location.asset_count}
                imageSrc={location.has_image?"/api/locations/"+location.id+"/image":null}
                organizationLogoSrc={selected.has_logo?"/api/organizations/"+selected.id+"/assets/logo":null}
                fallback={initials(selected.name)}
                onOpen={()=>router.push("/dashboard/locations/"+location.site_id)}
              />)}
            </div>:<EmptyState icon="file" title="Aún no hay ubicaciones" description="Crea una ubicación principal o sububicación para comenzar la estructura física de esta empresa."/>}
          </div>},
          {id:"documents",label:"Documentos",action:<CompanyDocumentCreateModal organizationId={selected.id} organizationName={selected.name} returnTo={selectedReturnTo+"&tab=documents"}/>,content:<div className="entity-section-stack company-documents-tab company-documents-management-tab">
            <CompanyDocumentWorkspace
              organizationId={selected.id}
              documents={selectedDocuments}
              categories={ORGANIZATION_DOCUMENT_CATEGORIES}
              owner={canDelete}
              returnTo={selectedReturnTo+"&tab=documents"}
            />
          </div>},
          {id:"technicians",label:"Técnicos",action:canManageUsers?<ContextUserCreateModal
            organizationId={selected.id}
            organizationName={selected.name}
            serviceSuppliers={selectedServiceSuppliers.map(item=>({id:item.id,name:item.name}))}
            countryCode={selected.legal_country||selected.country||"CO"}
            initialRole="technician"
            triggerLabel="Nuevo técnico"
            secondary={false}
            lockRole
            returnTo={selectedReturnTo+"&tab=technicians"}
          />:undefined,content:<div className="entity-section-stack company-technicians-tab company-related-tab">
            <StatTiles className="entity-stat-grid" items={[
              {label:"Técnicos",value:selected.technician_count+"/"+selected.max_technicians,hint:"registrados / cupo"},
              {label:"Cupos disponibles",value:String(Math.max(0,Number(selected.max_technicians)-Number(selected.technician_count))),tone:Number(selected.technician_count)<Number(selected.max_technicians)?"success":"warning"},
              {label:"Ocupación",value:(Number(selected.max_technicians)>0?Math.min(100,Math.round(Number(selected.technician_count)/Number(selected.max_technicians)*100)):0)+"%",tone:Number(selected.technician_count)<Number(selected.max_technicians)?"success":"warning"},
            ]}/>
            {selectedTechnicians.length?<div className="company-technician-card-grid">
              {selectedTechnicians.map(technician=><UserCard key={technician.id} className={"company-technician-card"+(technician.active?"":" inactive")}>
                <div className="company-technician-card-main">
                  <span className="company-technician-avatar">{technician.has_avatar?<img src={"/api/users/"+technician.id+"/avatar"} alt=""/>:initials(technician.full_name)}</span>
                  <div className="company-technician-copy">
                    <div><strong>{technician.full_name}</strong><Badge variant={technician.active?"success":"neutral"}>{technician.active?"Activo":"Inactivo"}</Badge></div>
                    <span>Técnico</span>
                    <small>{technician.email}</small>
                    <em><UiIcon name="location" size={12}/>{technician.access_all_sites?"Todas las sedes":technician.site_names.length?technician.site_names.join(", "):"Sin sedes asignadas"}</em>
                  </div>
                </div>
                <div className="company-technician-actions">
                  <Link href="/dashboard/users" title="Abrir perfil de usuario"><UiIcon name="user" size={15}/><span>Ver perfil</span></Link>
                  {technician.phone&&<a href={"https://wa.me/"+technician.phone.replace(/\D/g,"")} target="_blank" rel="noreferrer" title="Abrir WhatsApp"><UiIcon name="whatsapp" size={15}/></a>}
                  {technician.phone&&<a href={"tel:"+technician.phone.replace(/[^+\d]/g,"")} title="Llamar técnico"><UiIcon name="phone" size={15}/></a>}
                </div>
              </UserCard>)}
            </div>:<EmptyState icon="file" title="Aún no hay técnicos vinculados" description="Crea un técnico desde esta empresa para conservar automáticamente la relación y el alcance inicial."/>}
          </div>},
        ]}
      />
    </section>}

  </div>;
}