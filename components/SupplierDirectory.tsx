"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EntityProfileWorkspace from "@/components/EntityProfileWorkspace";
import ProfileExportMenu from "@/components/ProfileExportMenu";
import RequisitionBuilder, { type RequisitionSelectableItem } from "@/components/RequisitionBuilder";
import FileDropzone from "@/components/FileDropzone";
import PhoneField from "@/components/PhoneField";
import { CountryCityFields, TaxIdentificationTypeSelect } from "@/components/InternationalFields";
import UiIcon from "@/components/UiIcon";
import ConfirmDialog from "@/components/ConfirmDialog";
import MultiSelectDropdown, { type MultiSelectOption } from "@/components/MultiSelectDropdown";
import { countryName } from "@/lib/international-catalog";

export type SupplierDirectoryItem={
  id:string;organization_id:string;organization_name:string;name:string;legal_name:string|null;tax_id:string|null;tax_id_type:string|null;
  country_code:string|null;city:string|null;address:string|null;website:string|null;supplier_type:"materials"|"services"|"both";
  service_category:string|null;contact_name:string|null;contact_title:string|null;email:string|null;phone:string|null;notes:string|null;
  capability_codes:string[];capability_labels:string[];specialty_codes:string[];specialty_labels:string[];
  bank_name:string|null;account_type:string|null;account_number:string|null;account_holder:string|null;account_holder_tax_id:string|null;
  payment_terms_days:number|null;currency_code:string|null;payment_email:string|null;payment_notes:string|null;
  active:boolean;has_logo:boolean;
};
export type SupplierActivity={
  id:string;supplier_id:string;work_order_id:string;order_number:string;order_title:string;description:string;status:string;due_date:string|null;
  site_name:string;location_name:string|null;
};
export type SupplierRequisition={
  id:string;supplier_id:string;number:string;status:string;created_at:string;needed_by:string|null;item_count:number;total_estimated:string;
};
export type SupplierDocument={
  id:string;supplier_id:string;category:string;display_name:string;reference:string|null;expires_at:string|null;file_name:string|null;
  file_mime_type:string|null;archived_at:string|null;created_at:string;
};

function typeLabel(type:SupplierDirectoryItem["supplier_type"]){
  if(type==="services")return "Servicios";
  if(type==="both")return "Materiales + servicios";
  return "Materiales / suministros";
}
function initials(value:string){return value.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase()||"P";}
function statusLabel(status:string){return ({draft:"Borrador",sent:"Enviada",approved:"Aprobada",rejected:"Rechazada",partial:"Parcial",fulfilled:"Atendida",closed:"Cerrada",cancelled:"Cancelada"} as Record<string,string>)[status]||status;}

function SupplierDocuments({supplier,documents}:{supplier:SupplierDirectoryItem;documents:SupplierDocument[]}){
  const active=documents.filter(doc=>!doc.archived_at);
  const archived=documents.filter(doc=>Boolean(doc.archived_at));
  return <div className="entity-section-stack">
    <div className="entity-panel">
      <h3><span className="entity-section-icon"><UiIcon name="file"/></span>Agregar documento</h3>
      <form className="form-grid" method="post" action={"/api/suppliers/"+supplier.id+"/documents"} encType="multipart/form-data">
        <div className="field"><label>Tipo</label><select name="category" defaultValue="other">
          <option value="tax">Tributario</option><option value="legal">Legal</option><option value="contract">Contrato</option><option value="insurance">Seguro</option>
          <option value="certification">Certificación</option><option value="catalog">Catálogo</option><option value="quote">Cotización</option><option value="other">Otro</option>
        </select></div>
        <div className="field"><label>Nombre *</label><input name="display_name" required placeholder="Ej. Cámara de comercio"/></div>
        <div className="field"><label>Referencia</label><input name="reference" placeholder="Número, vigencia o referencia"/></div>
        <div className="field"><label>Vence</label><input type="date" name="expires_at"/></div>
        <div className="field form-span-2"><label>Notas</label><input name="notes" placeholder="Observaciones del documento"/></div>
        <div className="form-span-2"><FileDropzone name="file" label="Documento del proveedor" accept=".pdf,image/png,image/jpeg,image/webp" maxSizeMb={10} required kind="document"/></div>
        <div className="form-span-2 form-actions"><button className="button" type="submit">Guardar documento</button></div>
      </form>
    </div>
    <div className="entity-panel">
      <h3><span className="entity-section-icon"><UiIcon name="file"/></span>Documentos vigentes</h3>
      {active.length?<div className="supplier-document-list">{active.map(doc=><article key={doc.id} className="supplier-document-row">
        <div><strong>{doc.display_name}</strong><span>{doc.reference||doc.category}{doc.expires_at?" · vence "+new Date(doc.expires_at+"T12:00:00").toLocaleDateString("es-CO"):""}</span></div>
        <div className="supplier-document-actions">
          {doc.file_name&&<a href={"/api/suppliers/"+supplier.id+"/documents/"+doc.id} title="Descargar"><UiIcon name="download" size={15}/> Descargar</a>}
          <form method="post" action={"/api/suppliers/"+supplier.id+"/documents/"+doc.id}><input type="hidden" name="intent" value="archive"/><button type="submit">Archivar</button></form>
        </div>
      </article>)}</div>:<div className="location-detail-empty">No hay documentos vigentes.</div>}
    </div>
    {archived.length>0&&<div className="entity-panel">
      <h3>Archivados</h3>
      <div className="supplier-document-list">{archived.map(doc=><article key={doc.id} className="supplier-document-row archived">
        <div><strong>{doc.display_name}</strong><span>Archivado</span></div>
        <div className="supplier-document-actions">
          <form method="post" action={"/api/suppliers/"+supplier.id+"/documents/"+doc.id}><input type="hidden" name="intent" value="restore"/><button type="submit">Restaurar</button></form>
          <form method="post" action={"/api/suppliers/"+supplier.id+"/documents/"+doc.id} onSubmit={event=>{if(!window.confirm("¿Eliminar definitivamente este documento?"))event.preventDefault();}}><input type="hidden" name="intent" value="delete"/><button className="danger-text" type="submit">Eliminar</button></form>
        </div>
      </article>)}</div>
    </div>}
  </div>;
}

export default function SupplierDirectory({
  suppliers,activities,items,requisitions,documents,capabilityOptions,specialtyOptions,initialSelectedId="",initialTab="general",
}:{
  suppliers:SupplierDirectoryItem[];
  activities:SupplierActivity[];
  items:RequisitionSelectableItem[];
  requisitions:SupplierRequisition[];
  documents:SupplierDocument[];
  capabilityOptions:MultiSelectOption[];
  specialtyOptions:MultiSelectOption[];
  initialSelectedId?:string;
  initialTab?:string;
}){
  const [selectedId,setSelectedId]=useState(initialSelectedId);
  const [editing,setEditing]=useState(false);
  const [financialEditing,setFinancialEditing]=useState(false);
  const router=useRouter();
  const [preferredTab,setPreferredTab]=useState(initialTab||"general");
  const [deleteCandidate,setDeleteCandidate]=useState<SupplierDirectoryItem|null>(null);
  const [deleteError,setDeleteError]=useState("");
  const selected=suppliers.find(item=>item.id===selectedId)||null;

  const selectedActivities=useMemo(()=>activities.filter(item=>item.supplier_id===selectedId),[activities,selectedId]);
  const selectedItems=useMemo(()=>items.filter(item=>item.supplier_id===selectedId),[items,selectedId]);
  const selectedReqs=useMemo(()=>requisitions.filter(item=>item.supplier_id===selectedId),[requisitions,selectedId]);
  const selectedDocs=useMemo(()=>documents.filter(item=>item.supplier_id===selectedId),[documents,selectedId]);

  function open(id:string,tab="general",edit=false){
    setSelectedId(id);
    setPreferredTab(tab);
    setEditing(edit);
    setFinancialEditing(false);
    window.scrollTo({top:0,behavior:"smooth"});
  }

  async function confirmSupplierDelete(){
    if(!deleteCandidate)return;
    const supplier=deleteCandidate;
    setDeleteCandidate(null);
    setDeleteError("");
    try{
      const body=new FormData();
      body.set("intent","delete");
      const response=await fetch("/api/suppliers/"+supplier.id,{method:"POST",body});
      if(response.redirected){
        window.location.assign(response.url);
        return;
      }
      if(!response.ok)throw new Error("No fue posible eliminar el proveedor.");
      setSelectedId("");
      router.refresh();
    }catch(error){
      setDeleteError(error instanceof Error?error.message:"No fue posible eliminar el proveedor.");
    }
  }

  if(!selected){
    return <><section className="section supplier-directory-modern">
      <div className="section-heading"><div><span className="eyebrow">Directorio</span><h2>Proveedores registrados</h2><p className="muted">Abre una tarjeta para consultar su operación, suministros y requisiciones sin salir del módulo.</p></div></div>
      {suppliers.length?<div className="supplier-profile-grid">{suppliers.map(s=>{
        const supplierItems=items.filter(item=>item.supplier_id===s.id).length;
        const supplierActivities=activities.filter(item=>item.supplier_id===s.id&&["pending","in_progress"].includes(item.status)).length;
        const supplierReqs=requisitions.filter(item=>item.supplier_id===s.id&& !["closed","cancelled"].includes(item.status)).length;
        return <article className={"supplier-directory-card-v2 "+(s.active?"":"inactive")} key={s.id} data-module-record data-status={s.active?"active":"inactive"} data-search={[s.name,s.legal_name,s.organization_name,s.tax_id,s.city,...(s.capability_labels||[]),...(s.specialty_labels||[]),s.contact_name,s.email].filter(Boolean).join(" ")}
          data-filter-organization={s.organization_id} data-filter-organization-label={s.organization_name}
          data-filter-capability={(s.capability_codes||[]).join("|")} data-filter-capability-label={(s.capability_labels||[]).join("|")}
          data-filter-specialty={(s.specialty_codes||[]).join("|")} data-filter-specialty-label={(s.specialty_labels||[]).join("|")}
          data-filter-country={s.country_code||""} data-filter-country-label={countryName(s.country_code)||s.country_code||""}>
          <button type="button" className="supplier-card-open" onClick={()=>open(s.id)} aria-label={"Abrir ficha de "+s.name}>
            <span className="supplier-card-banner" aria-hidden="true">
              <span className={"supplier-card-state "+(s.active?"active":"inactive")}>{s.active?"Activo":"Inactivo"}</span>
            </span>
            <span className="supplier-card-logo-row">
              <span className="supplier-card-logo">{s.has_logo?<img src={"/api/suppliers/"+s.id+"/logo"} alt="" />:<b>{initials(s.name)}</b>}</span>
              <span className="supplier-card-type">{(s.capability_labels||[]).join(" · ")||typeLabel(s.supplier_type)}</span>
            </span>
            <span className="supplier-card-copy-v2">
              <strong>{s.name}</strong>
              <span>{s.legal_name||s.organization_name}</span>
              <small>{[s.city,countryName(s.country_code)].filter(Boolean).join(" · ")||"Ubicación sin registrar"}</small>
              <em>{(s.specialty_labels||[]).join(" · ")||s.service_category||"Especialidad sin registrar"}</em>
            </span>
            <span className="supplier-card-contact-v2">
              <span><UiIcon name="user" size={12}/><b>{s.contact_name||"Sin contacto"}</b></span>
              <span><UiIcon name="phone" size={12}/><b>{s.phone||"Sin teléfono"}</b></span>
            </span>
            <span className="supplier-card-metrics-v2">
              <span><strong>{supplierActivities}</strong><small>Actividades</small></span>
              <span><strong>{supplierItems}</strong><small>Suministros</small></span>
              <span><strong>{supplierReqs}</strong><small>Requisiciones</small></span>
            </span>
          </button>
          <div className="supplier-card-actions-v2">
            <button className="supplier-card-primary-action" type="button" onClick={()=>open(s.id)}><UiIcon name="file" size={14}/> Ver ficha</button>
            <button className="supplier-card-icon-action" type="button" onClick={()=>open(s.id,"general",true)} title="Editar proveedor"><UiIcon name="edit" size={14}/></button>
            {(s.supplier_type==="materials"||s.supplier_type==="both")&&<button className="supplier-card-icon-action" type="button" onClick={()=>open(s.id,"requisitions")} title="Crear requisición"><UiIcon name="plus" size={14}/></button>}
            {s.phone&&<a className="supplier-card-icon-action" href={"https://wa.me/"+s.phone.replace(/\D/g,"")} target="_blank" rel="noreferrer" title="Abrir WhatsApp"><UiIcon name="whatsapp" size={14}/></a>}
            <button type="button" className="supplier-card-icon-action danger" title="Eliminar proveedor" onClick={()=>setDeleteCandidate(s)}><UiIcon name="trash" size={14}/></button>
          </div>
        </article>;
      })}</div>:<div className="card empty-state"><strong>Aún no hay proveedores.</strong><span>Registra el primero para asociar servicios, suministros y requisiciones.</span></div>}
      {deleteError&&<div className="notice error section">{deleteError}</div>}
    </section>
    <ConfirmDialog
      open={Boolean(deleteCandidate)}
      title="Eliminar proveedor"
      message={deleteCandidate?"Vas a eliminar definitivamente a "+deleteCandidate.name+". Esta acción solo se completará si no tiene inventario, actividades ni requisiciones relacionadas.":"Confirma la eliminación del proveedor."}
      confirmLabel="Eliminar proveedor"
      cancelLabel="Conservar"
      variant="danger"
      onConfirm={confirmSupplierDelete}
      onCancel={()=>setDeleteCandidate(null)}
    /></>;
  }

  const activeActivities=selectedActivities.filter(item=>["pending","in_progress"].includes(item.status)).length;
  const openReqs=selectedReqs.filter(item=>!["closed","cancelled","fulfilled"].includes(item.status)).length;
  const activeDocs=selectedDocs.filter(item=>!item.archived_at).length;

  const general=editing?<form className="entity-edit-form" method="post" action={"/api/suppliers/"+selected.id} encType="multipart/form-data">
    <input type="hidden" name="intent" value="update"/>
    <div className="entity-panel"><h3><span className="entity-section-icon"><UiIcon name="company"/></span>Editar proveedor</h3><div className="form-grid">
      <div className="field"><label>Nombre comercial *</label><input name="name" defaultValue={selected.name} required/></div>
      <div className="field"><label>Razón social *</label><input name="legal_name" defaultValue={selected.legal_name||""} required/></div>
      <MultiSelectDropdown name="capability_codes" label="Tipo de proveedor" options={capabilityOptions} defaultValues={selected.capability_codes||[]} required help="Puedes seleccionar múltiples capacidades normalizadas."/>
      <MultiSelectDropdown name="specialty_codes" label="Categoría / especialidad" options={specialtyOptions} defaultValues={selected.specialty_codes||[]} help="Catálogo estándar para mantener consistencia en filtros, importaciones y exportaciones."/>
      <TaxIdentificationTypeSelect id="supplier-edit-tax-type" name="tax_id_type" countryInputId="supplier-edit-country" countryCode={selected.country_code||"CO"} defaultValue={selected.tax_id_type||""}/>
      <div className="field"><label>Número de identificación</label><input name="tax_id" defaultValue={selected.tax_id||""}/></div>
      <CountryCityFields countryId="supplier-edit-country" countryName="country_code" cityId="supplier-edit-city" cityName="city" defaultCountry={selected.country_code||"CO"} defaultCity={selected.city||""} required/>
      <div className="field form-span-2"><label>Dirección *</label><input name="address" defaultValue={selected.address||""} required/></div>
      <div className="field"><label>Sitio web</label><input type="url" name="website" defaultValue={selected.website||""}/></div>
      <div className="field"><label>Contacto principal</label><input name="contact_name" defaultValue={selected.contact_name||""}/></div>
      <div className="field"><label>Cargo</label><input name="contact_title" defaultValue={selected.contact_title||""}/></div>
      <div className="field"><label>Correo</label><input type="email" name="email" defaultValue={selected.email||""}/></div>
      <PhoneField name="phone" label="Teléfono / WhatsApp" countryCode={selected.country_code||"CO"} countryInputId="supplier-edit-country" defaultValue={selected.phone}/>
      <div className="field"><label>Estado</label><select name="active" defaultValue={selected.active?"on":"off"}><option value="on">Activo</option><option value="off">Inactivo</option></select></div>
      <div className="field form-span-2"><label>Notas</label><textarea name="notes" rows={3} defaultValue={selected.notes||""}/></div>
      <div className="form-span-2"><FileDropzone name="logo" label="Logo del proveedor" accept="image/png,image/jpeg,image/webp" maxSizeMb={5} kind="image" existingPreviewUrl={selected.has_logo?"/api/suppliers/"+selected.id+"/logo":null} description="Puedes reemplazar el logo actual."/></div>
      <div className="form-span-2 form-actions"><button className="button secondary" type="button" onClick={()=>setEditing(false)}>Cancelar</button><button className="button" type="submit">Guardar cambios</button></div>
    </div></div>
  </form>:<div className="entity-section-stack">
    <div className="entity-approved-columns">
      <div className="entity-approved-column">
        <div className="entity-panel"><h3><span className="entity-section-icon"><UiIcon name="company"/></span>Datos del proveedor</h3><div className="entity-info-grid">
          <div className="entity-info-field"><span>Nombre comercial</span><strong>{selected.name}</strong></div>
          <div className="entity-info-field"><span>Razón social</span><strong>{selected.legal_name||"Sin registrar"}</strong></div>
          <div className="entity-info-field"><span>Tipo</span><strong>{(selected.capability_labels||[]).join(", ")||typeLabel(selected.supplier_type)}</strong></div>
          <div className="entity-info-field"><span>Especialidad / categoría</span><strong>{(selected.specialty_labels||[]).join(", ")||selected.service_category||"Sin registrar"}</strong></div>
          <div className="entity-info-field"><span>Identificación</span><strong>{selected.tax_id?(selected.tax_id_type||"ID")+" "+selected.tax_id:"Sin registrar"}</strong></div>
          <div className="entity-info-field"><span>País</span><strong>{countryName(selected.country_code)||"Sin registrar"}</strong></div>
          <div className="entity-info-field"><span>Ciudad</span><strong>{selected.city||"Sin registrar"}</strong></div>
          <div className="entity-info-field"><span>Dirección</span><strong>{selected.address||"Sin registrar"}</strong></div>
          <div className="entity-info-field"><span>Sitio web</span><strong>{selected.website?<a href={selected.website} target="_blank" rel="noreferrer">{selected.website}</a>:"Sin registrar"}</strong></div>
        </div></div>
        <div className="entity-panel"><h3><span className="entity-section-icon"><UiIcon name="phone"/></span>Contacto</h3><div className="entity-info-grid">
          <div className="entity-info-field"><span>Contacto principal</span><strong>{selected.contact_name||"Sin registrar"}</strong></div>
          <div className="entity-info-field"><span>Cargo</span><strong>{selected.contact_title||"Sin registrar"}</strong></div>
          <div className="entity-info-field"><span>Correo</span><strong>{selected.email?<a href={"mailto:"+selected.email}>{selected.email}</a>:"Sin registrar"}</strong></div>
          <div className="entity-info-field"><span>Teléfono / WhatsApp</span><strong>{selected.phone||"Sin registrar"}</strong></div>
        </div></div>
        <div className="entity-panel entity-approved-notes"><h3><span className="entity-section-icon"><UiIcon name="file"/></span>Notas adicionales</h3><p>{selected.notes||"Sin notas registradas para este proveedor."}</p></div>
      </div>
      <div className="entity-approved-column">
        <div className="entity-panel supplier-capability-panel"><h3><span className="entity-section-icon"><UiIcon name="activity"/></span>Relación operativa</h3>
          <div className="supplier-capability-list">
            <span className={(selected.supplier_type==="services"||selected.supplier_type==="both")?"enabled":""}><UiIcon name="work-order"/> Servicios y actividades<b>{selectedActivities.length}</b></span>
            <span className={(selected.supplier_type==="materials"||selected.supplier_type==="both")?"enabled":""}><UiIcon name="asset"/> Inventarios y suministros<b>{selectedItems.length}</b></span>
            <span className="enabled"><UiIcon name="file"/> Requisiciones<b>{selectedReqs.length}</b></span>
            <span className="enabled"><UiIcon name="file"/> Documentos<b>{activeDocs}</b></span>
          </div>
        </div>
        <div className="entity-panel"><h3><span className="entity-section-icon"><UiIcon name="check"/></span>Estado comercial</h3><div className="entity-info-grid">
          <div className="entity-info-field"><span>Estado</span><strong>{selected.active?"Proveedor activo":"Proveedor inactivo"}</strong></div>
          <div className="entity-info-field"><span>Empresa cliente</span><strong>{selected.organization_name}</strong></div>
          <div className="entity-info-field"><span>Actividades abiertas</span><strong>{activeActivities}</strong></div>
          <div className="entity-info-field"><span>Requisiciones abiertas</span><strong>{openReqs}</strong></div>
        </div></div>
      </div>
    </div>
  </div>;

  return <><EntityProfileWorkspace
    eyebrow="Directorio de proveedores"
    headingLabel="Proveedor"
    headingIcon="company"
    title={selected.name}
    subtitle={selected.organization_name}
    breadcrumbs={[{label:"Inicio",href:"/dashboard"},{label:"Proveedores",onClick:()=>{setSelectedId("");setEditing(false);}},{label:selected.name}]}
    imageSrc={selected.has_logo?"/api/suppliers/"+selected.id+"/logo":null}
    fallback={initials(selected.name)}
    status={<span className={"status-badge "+(selected.active?"status-active":"status-inactive")}><i/>{selected.active?"Activo":"Inactivo"}</span>}
    meta={[(selected.capability_labels||[]).join(" · ")||typeLabel(selected.supplier_type),selected.tax_id?(selected.tax_id_type||"ID")+" "+selected.tax_id:"Sin identificación",[selected.city,countryName(selected.country_code)].filter(Boolean).join(" · ")]}
    stats={[
      {label:"Actividades",value:activeActivities,icon:"work-order",hint:"activas"},
      {label:"Suministros",value:selectedItems.length,icon:"asset"},
      {label:"Requisiciones",value:selectedReqs.length,icon:"file",hint:openReqs+" abiertas"},
      {label:"Documentos",value:activeDocs,icon:"file"},
    ]}
    quickActions={<>
      {(selected.supplier_type==="services"||selected.supplier_type==="both")&&<button type="button" onClick={()=>setPreferredTab("activities")}><UiIcon name="work-order"/> Actividades</button>}
      {(selected.supplier_type==="materials"||selected.supplier_type==="both")&&<button type="button" onClick={()=>setPreferredTab("inventory")}><UiIcon name="asset"/> Suministros</button>}
      {(selected.supplier_type==="materials"||selected.supplier_type==="both")&&<button type="button" onClick={()=>setPreferredTab("requisitions")}><UiIcon name="plus"/> Requisición</button>}
      {selected.phone&&<a href={"https://wa.me/"+selected.phone.replace(/\D/g,"")} target="_blank" rel="noreferrer"><UiIcon name="whatsapp"/> WhatsApp</a>}
    </>}
    toolbarActions={<>
      <button className="button secondary entity-action-button" type="button" onClick={()=>{setFinancialEditing(false);setEditing(value=>!value);setPreferredTab("general");}}><UiIcon name="edit"/><span>{editing?"Cancelar edición":"Editar"}</span></button>
      {(selected.supplier_type==="materials"||selected.supplier_type==="both")&&<button className="button secondary entity-action-button entity-action-wide" type="button" onClick={()=>setPreferredTab("requisitions")}><UiIcon name="plus"/><span>Nueva requisición</span></button>}
      <ProfileExportMenu entity="supplier" id={selected.id}/>
      <button className="button danger-secondary entity-action-button" type="button" onClick={()=>setDeleteCandidate(selected)}><UiIcon name="trash"/><span>Eliminar</span></button>
    </>}
    initialTab={preferredTab}
    tabs={[
      {id:"general",label:"Información general",content:general},
      {id:"statistics",label:"Estadísticas",content:<div className="entity-section-stack"><div className="entity-stat-grid">
        <div className="entity-stat-card"><small>Actividades totales</small><strong>{selectedActivities.length}</strong><span>{activeActivities} activas</span></div>
        <div className="entity-stat-card"><small>Suministros asociados</small><strong>{selectedItems.length}</strong><span>artículos de inventario</span></div>
        <div className="entity-stat-card"><small>Requisiciones</small><strong>{selectedReqs.length}</strong><span>{openReqs} abiertas</span></div>
        <div className="entity-stat-card"><small>Documentos vigentes</small><strong>{activeDocs}</strong><span>{selectedDocs.length-activeDocs} archivados</span></div>
      </div></div>},
      {id:"documents",label:"Documentos",content:<SupplierDocuments supplier={selected} documents={selectedDocs}/>},
      {id:"financial",label:"Información financiera",content:financialEditing
        ?<form className="entity-panel form-grid" method="post" action={"/api/suppliers/"+selected.id}>
          <input type="hidden" name="intent" value="financial"/>
          <div className="field"><label>Banco</label><input name="bank_name" defaultValue={selected.bank_name||""} placeholder="Ej. Bancolombia"/></div>
          <div className="field"><label>Tipo de cuenta</label><select name="account_type" defaultValue={selected.account_type||""}><option value="">Selecciona</option><option value="savings">Ahorros</option><option value="checking">Corriente</option><option value="other">Otra</option></select></div>
          <div className="field"><label>Número de cuenta</label><input name="account_number" defaultValue={selected.account_number||""} autoComplete="off"/></div>
          <div className="field"><label>Titular de la cuenta</label><input name="account_holder" defaultValue={selected.account_holder||selected.legal_name||""}/></div>
          <div className="field"><label>Identificación del titular</label><input name="account_holder_tax_id" defaultValue={selected.account_holder_tax_id||selected.tax_id||""}/></div>
          <div className="field"><label>Moneda</label><select name="currency_code" defaultValue={selected.currency_code||"COP"}><option value="COP">COP · Peso colombiano</option><option value="USD">USD · Dólar estadounidense</option><option value="EUR">EUR · Euro</option><option value="MXN">MXN · Peso mexicano</option><option value="PEN">PEN · Sol peruano</option><option value="CLP">CLP · Peso chileno</option></select></div>
          <div className="field"><label>Plazo de pago (días)</label><input name="payment_terms_days" type="number" min="0" max="365" defaultValue={selected.payment_terms_days??""}/></div>
          <div className="field"><label>Correo para pagos</label><input name="payment_email" type="email" defaultValue={selected.payment_email||""}/></div>
          <div className="field form-span-2"><label>Observaciones de pago</label><textarea name="payment_notes" rows={3} defaultValue={selected.payment_notes||""} placeholder="Condiciones, referencia, instrucciones administrativas."/></div>
          <div className="form-span-2 form-actions">
            <button className="button secondary" type="button" onClick={()=>setFinancialEditing(false)}>Cancelar</button>
            <button className="button" type="submit">Guardar información financiera</button>
          </div>
        </form>
        :<div className="entity-panel">
          <div className="entity-panel-heading-row">
            <div>
              <h3><span className="entity-section-icon"><UiIcon name="company"/></span>Datos para pagos</h3>
              <p className="entity-panel-copy">Información administrativa usada para preparar pagos al proveedor. El número de cuenta se muestra enmascarado.</p>
            </div>
            <button className="button secondary entity-financial-edit-button" type="button" onClick={()=>setFinancialEditing(true)}><UiIcon name="edit" size={15}/> Editar</button>
          </div>
          <div className="entity-info-grid entity-financial-summary">
            <div className="entity-info-field"><span>Banco</span><strong>{selected.bank_name||"Sin registrar"}</strong></div>
            <div className="entity-info-field"><span>Tipo de cuenta</span><strong>{selected.account_type==="savings"?"Ahorros":selected.account_type==="checking"?"Corriente":selected.account_type==="other"?"Otra":"Sin registrar"}</strong></div>
            <div className="entity-info-field"><span>Número de cuenta</span><strong>{selected.account_number?("•••• "+selected.account_number.slice(-4)):"Sin registrar"}</strong></div>
            <div className="entity-info-field"><span>Titular</span><strong>{selected.account_holder||"Sin registrar"}</strong></div>
            <div className="entity-info-field"><span>Identificación titular</span><strong>{selected.account_holder_tax_id||"Sin registrar"}</strong></div>
            <div className="entity-info-field"><span>Moneda</span><strong>{selected.currency_code||"COP"}</strong></div>
            <div className="entity-info-field"><span>Plazo de pago</span><strong>{selected.payment_terms_days!=null?selected.payment_terms_days+" días":"Sin registrar"}</strong></div>
            <div className="entity-info-field"><span>Correo de pagos</span><strong>{selected.payment_email||"Sin registrar"}</strong></div>
            <div className="entity-info-field entity-financial-notes"><span>Observaciones</span><strong>{selected.payment_notes||"Sin observaciones"}</strong></div>
          </div>
        </div>},

      ...((selected.supplier_type==="services"||selected.supplier_type==="both")?[{id:"activities",label:"Actividades",content:<div className="supplier-activity-list">
        {selectedActivities.length?selectedActivities.map(activity=><article className="supplier-activity-row" key={activity.id}>
          <span className={"activity-status activity-status-"+activity.status}>{activity.status}</span>
          <div><strong>{activity.description}</strong><span>OT #{activity.order_number} · {activity.order_title}</span><small>{activity.site_name}{activity.location_name?" · "+activity.location_name:""}{activity.due_date?" · compromiso "+new Date(activity.due_date+"T12:00:00").toLocaleDateString("es-CO"):""}</small></div>
          <Link href={"/dashboard/work-orders/"+activity.work_order_id}>Ver OT</Link>
        </article>):<div className="location-detail-empty">No hay actividades asignadas a este proveedor de servicios.</div>}
      </div>}]:[]),
      ...((selected.supplier_type==="materials"||selected.supplier_type==="both")?[{id:"inventory",label:"Inventarios / suministros",content:<div className="entity-section-stack">
        <div className="supplier-supply-grid">{selectedItems.length?selectedItems.map(item=><article className="supplier-supply-card" key={item.id}>
          <div><small>{item.sku}</small><strong>{item.name}</strong><span>{item.site_name||"Sin sede"}{item.location_name?" · "+item.location_name:""}</span></div>
          <div><span>Existencia</span><strong>{item.quantity} {item.unit}</strong></div>
          <div><span>Costo ref.</span><strong>{item.unit_cost}</strong></div>
        </article>):<div className="location-detail-empty">No hay suministros asociados a este proveedor.</div>}</div>
      </div>}]:[]),
      {id:"requisitions",label:"Requisiciones",content:<div className="entity-section-stack">
        {(selected.supplier_type==="materials"||selected.supplier_type==="both")&&<div className="entity-panel"><RequisitionBuilder items={selectedItems} returnTo={"/dashboard/suppliers?supplier="+selected.id+"&tab=requisitions"} title="Nueva requisición al proveedor" description="Selecciona los insumos y cantidades que deseas solicitar a este proveedor."/></div>}
        <div className="entity-panel"><h3>Historial de requisiciones</h3>{selectedReqs.length?<div className="supplier-requisition-list">{selectedReqs.map(req=><Link key={req.id} href={"/dashboard/requisitions/"+req.id}>
          <span>REQ-{req.number.padStart(6,"0")}</span><strong>{statusLabel(req.status)}</strong><small>{req.item_count} ítems · {new Date(req.created_at).toLocaleDateString("es-CO")}</small><UiIcon name="chevron-right" size={14}/>
        </Link>)}</div>:<div className="location-detail-empty">Aún no hay requisiciones para este proveedor.</div>}</div>
      </div>},
    ]}
  />
  {deleteError&&<div className="notice error section">{deleteError}</div>}
  <ConfirmDialog
    open={Boolean(deleteCandidate)}
    title="Eliminar proveedor"
    message={deleteCandidate?"Vas a eliminar definitivamente a "+deleteCandidate.name+". Esta acción solo se completará si no tiene inventario, actividades ni requisiciones relacionadas.":"Confirma la eliminación del proveedor."}
    confirmLabel="Eliminar proveedor"
    cancelLabel="Conservar"
    variant="danger"
    onConfirm={confirmSupplierDelete}
    onCancel={()=>setDeleteCandidate(null)}
  /></>;
}
