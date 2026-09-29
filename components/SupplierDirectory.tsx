"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import EntityProfileWorkspace from "@/components/EntityProfileWorkspace";
import ProfileExportMenu from "@/components/ProfileExportMenu";
import type { RequisitionSelectableItem } from "@/components/RequisitionBuilder";
import FileDropzone from "@/components/FileDropzone";
import PhoneField from "@/components/PhoneField";
import { CountryCityFields, TaxIdentificationTypeSelect } from "@/components/InternationalFields";
import UiIcon from "@/components/UiIcon";
import ConfirmDialog from "@/components/ConfirmDialog";
import MultiSelectDropdown, { type MultiSelectOption } from "@/components/MultiSelectDropdown";
import RequisitionExportMenu from "@/components/RequisitionExportMenu";
import { countryDefinition, countryName } from "@/lib/international-catalog";
import type { SupplierCommercialAnalytics, SupplierCommercialTrend, SupplierRequisitionPerformance } from "@/lib/supplier-analytics";
import { SupplierCard } from "@/components/business-ui";
import { Alert, EmptyState, Spinner } from "@/components/ui-kit/Feedback";
import { CollectionView } from "@/components/ui-kit/DataControls";
import { StaticDataTable } from "@/components/ui-kit/StaticTable";
import { EntityIdentityCell, ListQuickActions } from "@/components/ui-kit/CollectionIdentity";
import { Badge } from "@/components/ui-kit/Badge";
import { StatTiles } from "@/components/ui-kit/Metrics";

const RequisitionBuilder=dynamic(()=>import("@/components/RequisitionBuilder"),{
  loading:()=> <Spinner label="Cargando requisición"/>,
});
const BulkImportModal=dynamic(()=>import("@/components/BulkImportModal"));

export type SupplierDirectoryItem={
  id:string;organization_id:string;organization_name:string;organization_country:string|null;code:string|null;name:string;legal_name:string|null;tax_id:string|null;tax_id_type:string|null;
  country_code:string|null;city:string|null;supplier_type:"materials"|"services"|"both";service_category:string|null;contact_name:string|null;email:string|null;phone:string|null;
  capability_codes:string[];capability_labels:string[];specialty_codes:string[];specialty_labels:string[];
  activity_count:number;active_activity_count:number;item_count:number;active_item_count:number;
  requisition_count:number;directory_requisition_count:number;open_requisition_count:number;document_count:number;active_document_count:number;
  active:boolean;has_logo:boolean;
  address?:string|null;website?:string|null;contact_title?:string|null;notes?:string|null;
  bank_name?:string|null;account_type?:string|null;account_number?:string|null;account_holder?:string|null;account_holder_tax_id?:string|null;
  payment_terms_days?:number|null;currency_code?:string|null;payment_email?:string|null;payment_notes?:string|null;
};
export type SupplierActivity={
  id:string;supplier_id:string;work_order_id:string;order_number:string;order_title:string;description:string;status:string;due_date:string|null;
  site_name:string;location_name:string|null;
};
export type SupplierRequisition={
  id:string;supplier_id:string;number:string;status:string;created_at:string;needed_by:string|null;item_count:number;total_estimated:string;
  quantity_requested:string;quantity_received:string;quantity_returned:string;return_count:number;document_count:number;document_pending_review:number;document_disputed:number;approval_required:boolean;approval_state:"not_required"|"pending"|"approved"|"rejected";
};
export type SupplierDocument={
  id:string;supplier_id:string;category:string;display_name:string;reference:string|null;expires_at:string|null;file_name:string|null;
  file_mime_type:string|null;archived_at:string|null;created_at:string;
};
type InventorySiteOption={id:string;organization_id:string;name:string};
type InventoryLocationOption={id:string;organization_id:string;site_id:string;name:string;label:string};
type InventoryCategoryOption={id:string;organization_id:string;name:string};
type InventoryWarehouseOption={id:string;organization_id:string;site_id:string|null;location_id:string|null;name:string};

type SupplierStatisticsData={
  operational:{
    supplier_return_count:number;supplier_return_quantity:string;procurement_document_count:number;
    procurement_document_pending:number;procurement_document_disputed:number;
  };
  commercial:SupplierCommercialAnalytics|null;
  trends:SupplierCommercialTrend[];
  requisitions:SupplierRequisitionPerformance[];
};
type SupplierInventoryData={
  items:RequisitionSelectableItem[];
  sites:InventorySiteOption[];
  locations:InventoryLocationOption[];
  categories:InventoryCategoryOption[];
  warehouses:InventoryWarehouseOption[];
};
type SupplierRequisitionData={requisitions:SupplierRequisition[];items:RequisitionSelectableItem[]};
type SupplierDataView="general"|"statistics"|"documents"|"activities"|"inventory"|"requisitions";

function dataViewForTab(tab:string):SupplierDataView|null{
  if(tab==="financial")return "general";
  if(["general","statistics","documents","activities","inventory","requisitions"].includes(tab))return tab as SupplierDataView;
  return null;
}

function typeLabel(type:SupplierDirectoryItem["supplier_type"]){
  if(type==="services")return "Servicios";
  if(type==="both")return "Materiales + servicios";
  return "Materiales / suministros";
}
function initials(value:string){return value.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase()||"P";}
function statusLabel(status:string){return ({draft:"Borrador",sent:"Enviada",approved:"Aprobada",rejected:"Rechazada",partial:"Parcial",fulfilled:"Atendida",closed:"Cerrada",cancelled:"Cancelada"} as Record<string,string>)[status]||status;}
function approvalLabel(status:string){return ({not_required:"No requerida",pending:"Pendiente",approved:"Aprobada",rejected:"Rechazada"} as Record<string,string>)[status]||status;}

function pct(value:number|null,digits=1){return value==null?"Sin muestra":new Intl.NumberFormat("es-CO",{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(value)+"%";}
function days(value:number|null){return value==null?"Sin muestra":new Intl.NumberFormat("es-CO",{maximumFractionDigits:1,minimumFractionDigits:1}).format(value)+" días";}
function varianceCopy(value:number|null){
  if(value==null)return "Sin costo estimado comparable";
  if(Math.abs(value)<0.05)return "En línea con el estimado";
  return value>0?"Sobre el costo estimado":"Por debajo del costo estimado";
}
function monthLabel(value:string){
  const [year,month]=value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO",{month:"short",year:"2-digit"}).format(new Date(year,month-1,1));
}

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
  suppliers,capabilityOptions,specialtyOptions,canInventoryWrite,initialSelectedId="",initialTab="general",
}:{
  suppliers:SupplierDirectoryItem[];
  capabilityOptions:MultiSelectOption[];
  specialtyOptions:MultiSelectOption[];
  canInventoryWrite:boolean;
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
  const [detailsBySupplier,setDetailsBySupplier]=useState<Record<string,Partial<SupplierDirectoryItem>>>({});
  const [statisticsBySupplier,setStatisticsBySupplier]=useState<Record<string,SupplierStatisticsData>>({});
  const [documentsBySupplier,setDocumentsBySupplier]=useState<Record<string,SupplierDocument[]>>({});
  const [activitiesBySupplier,setActivitiesBySupplier]=useState<Record<string,SupplierActivity[]>>({});
  const [inventoryBySupplier,setInventoryBySupplier]=useState<Record<string,SupplierInventoryData>>({});
  const [requisitionsBySupplier,setRequisitionsBySupplier]=useState<Record<string,SupplierRequisitionData>>({});
  const [loadingKeys,setLoadingKeys]=useState<Record<string,boolean>>({});
  const [loadErrors,setLoadErrors]=useState<Record<string,string>>({});
  const selected=suppliers.find(item=>item.id===selectedId)||null;
  const selectedDetail=selected?{...selected,...(detailsBySupplier[selected.id]||{})}:null;
  const selectedStatistics=selectedId?statisticsBySupplier[selectedId]||null:null;
  const selectedDocs=selectedId?documentsBySupplier[selectedId]||[]:[];
  const selectedActivities=selectedId?activitiesBySupplier[selectedId]||[]:[];
  const selectedInventory=selectedId?inventoryBySupplier[selectedId]||null:null;
  const selectedRequisitionData=selectedId?requisitionsBySupplier[selectedId]||null:null;
  const selectedInventoryItems=selectedInventory?.items||[];
  const selectedRequisitionItems=selectedRequisitionData?.items||[];
  const selectedActiveRequisitionItems=useMemo(()=>selectedRequisitionItems.filter(item=>item.active!==false),[selectedRequisitionItems]);
  const selectedReqs=selectedRequisitionData?.requisitions||[];
  const selectedCommercial=selectedStatistics?.commercial||null;
  const selectedCommercialTrend=selectedStatistics?.trends||[];
  const selectedCommercialReqs=selectedStatistics?.requisitions||[];

  function open(id:string,tab="general",edit=false){
    setSelectedId(id);
    setPreferredTab(tab);
    setEditing(edit);
    setFinancialEditing(false);
    window.scrollTo({top:0,behavior:"smooth"});
  }

  useEffect(()=>{
    if(!selectedId)return;
    const view=dataViewForTab(preferredTab);
    if(!view)return;
    const loaded=view==="general"?Object.prototype.hasOwnProperty.call(detailsBySupplier,selectedId)
      :view==="statistics"?Object.prototype.hasOwnProperty.call(statisticsBySupplier,selectedId)
      :view==="documents"?Object.prototype.hasOwnProperty.call(documentsBySupplier,selectedId)
      :view==="activities"?Object.prototype.hasOwnProperty.call(activitiesBySupplier,selectedId)
      :view==="inventory"?Object.prototype.hasOwnProperty.call(inventoryBySupplier,selectedId)
      :Object.prototype.hasOwnProperty.call(requisitionsBySupplier,selectedId);
    if(loaded)return;

    const key=selectedId+":"+view;
    const controller=new AbortController();
    setLoadingKeys(previous=>({...previous,[key]:true}));
    setLoadErrors(previous=>({...previous,[key]:""}));
    const url=view==="documents"
      ?"/api/suppliers/"+selectedId+"/documents"
      :"/api/suppliers/"+selectedId+"?view="+encodeURIComponent(view);

    fetch(url,{headers:{Accept:"application/json"},signal:controller.signal})
      .then(async response=>{
        const payload=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(payload?.message||"No fue posible cargar la información del proveedor.");
        if(view==="general")setDetailsBySupplier(previous=>({...previous,[selectedId]:payload?.supplier||{}}));
        else if(view==="statistics")setStatisticsBySupplier(previous=>({...previous,[selectedId]:payload as SupplierStatisticsData}));
        else if(view==="documents")setDocumentsBySupplier(previous=>({...previous,[selectedId]:Array.isArray(payload?.documents)?payload.documents:[]}));
        else if(view==="activities")setActivitiesBySupplier(previous=>({...previous,[selectedId]:Array.isArray(payload?.activities)?payload.activities:[]}));
        else if(view==="inventory")setInventoryBySupplier(previous=>({...previous,[selectedId]:{
          items:Array.isArray(payload?.items)?payload.items:[],
          sites:Array.isArray(payload?.sites)?payload.sites:[],
          locations:Array.isArray(payload?.locations)?payload.locations:[],
          categories:Array.isArray(payload?.categories)?payload.categories:[],
          warehouses:Array.isArray(payload?.warehouses)?payload.warehouses:[],
        }}));
        else setRequisitionsBySupplier(previous=>({...previous,[selectedId]:{
          requisitions:Array.isArray(payload?.requisitions)?payload.requisitions:[],
          items:Array.isArray(payload?.items)?payload.items:[],
        }}));
      })
      .catch(error=>{
        if(error instanceof DOMException&&error.name==="AbortError")return;
        setLoadErrors(previous=>({...previous,[key]:error instanceof Error?error.message:"No fue posible cargar la información del proveedor."}));
      })
      .finally(()=>setLoadingKeys(previous=>({...previous,[key]:false})));

    return()=>controller.abort();
  },[
    selectedId,preferredTab,detailsBySupplier,statisticsBySupplier,documentsBySupplier,
    activitiesBySupplier,inventoryBySupplier,requisitionsBySupplier,
  ]);

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
    return <div className="phase8-supplier-directory"><section className="supplier-directory-modern">
      {suppliers.length?<CollectionView storageKey="suppliers" label="Vista de proveedores" grid={<div className="supplier-profile-grid" data-collection-grid>{suppliers.map(s=>{
        const supplierItems=s.active_item_count;
        const supplierActivities=s.active_activity_count;
        const supplierReqs=s.directory_requisition_count;
        return <SupplierCard
          key={s.id}
          name={s.name}
          subtitle={s.legal_name||s.organization_name}
          location={[s.city,countryName(s.country_code)].filter(Boolean).join(" · ")||null}
          specialty={(s.specialty_labels||[]).join(" · ")||s.service_category||null}
          type={(s.capability_labels||[]).join(" · ")||typeLabel(s.supplier_type)}
          status={s.active?"active":"inactive"}
          logoSrc={s.has_logo?"/api/suppliers/"+s.id+"/logo":null}
          fallback={initials(s.name)}
          contact={s.contact_name||null}
          phone={s.phone||null}
          email={s.email||null}
          metrics={[
            {label:"Actividades",value:supplierActivities,icon:"activity"},
            {label:"Suministros",value:supplierItems,icon:"inventory"},
            {label:"Requisiciones",value:supplierReqs,icon:"requisition"},
          ]}
          onOpen={()=>open(s.id)}
          recordProps={{
            "data-module-record":true,"data-status":s.active?"active":"inactive",
            "data-search":[s.name,s.legal_name,s.organization_name,s.tax_id,s.city,...(s.capability_labels||[]),...(s.specialty_labels||[]),s.contact_name,s.email].filter(Boolean).join(" "),
            "data-filter-organization":s.organization_id,"data-filter-organization-label":s.organization_name,
            "data-filter-capability":(s.capability_codes||[]).join("|"),"data-filter-capability-label":(s.capability_labels||[]).join("|"),
            "data-filter-specialty":(s.specialty_codes||[]).join("|"),"data-filter-specialty-label":(s.specialty_labels||[]).join("|"),
            "data-filter-country":s.country_code||"","data-filter-country-label":countryName(s.country_code)||s.country_code||"",
          }}
          actions={<>
            <button className="supplier-card-primary-action-v3" type="button" onClick={()=>open(s.id)}>
              <UiIcon name="file" size={16}/><span>Ver ficha</span><UiIcon name="chevron-right" size={16}/>
            </button>
            <button className="supplier-card-quick-action-v3" type="button" onClick={()=>open(s.id,"general",true)} title="Editar proveedor" data-tooltip="Editar proveedor" aria-label="Editar proveedor"><UiIcon name="edit" size={16}/></button>
            {(s.supplier_type==="materials"||s.supplier_type==="both")&&<button className="supplier-card-quick-action-v3" type="button" onClick={()=>open(s.id,"requisitions")} title="Crear requisición" data-tooltip="Crear requisición" aria-label="Crear requisición"><UiIcon name="plus" size={16}/></button>}
            {s.phone&&<a className="supplier-card-quick-action-v3" href={"https://wa.me/"+s.phone.replace(/\D/g,"")} target="_blank" rel="noreferrer" title="Contactar por WhatsApp" data-tooltip="Contactar por WhatsApp" aria-label="Contactar por WhatsApp"><UiIcon name="whatsapp" size={16}/></a>}
            <button type="button" className="supplier-card-quick-action-v3 danger" title="Eliminar proveedor" data-tooltip="Eliminar proveedor" aria-label="Eliminar proveedor" onClick={()=>setDeleteCandidate(s)}><UiIcon name="trash" size={16}/></button>
          </>}
        />;
      })}</div>} list={<StaticDataTable
        className="supplier-directory-list"
        caption="Listado de proveedores"
        columns={[
          {key:"supplier",label:"Proveedor",width:"28%"},
          {key:"status",label:"Estado"},
          {key:"organization",label:"Empresa"},
          {key:"type",label:"Tipo"},
          {key:"specialty",label:"Especialidad"},
          {key:"items",label:"Suministros",align:"end"},
          {key:"requisitions",label:"Req. abiertas",align:"end"},
          {key:"actions",label:"Acciones",align:"end"},
        ]}
        rows={suppliers.map(s=>{
          const supplierItems=s.active_item_count;
          const supplierReqs=s.directory_requisition_count;
          return {
            id:s.id,
            recordProps:{
              "data-module-record":true,"data-status":s.active?"active":"inactive",
              "data-search":[s.name,s.legal_name,s.organization_name,s.tax_id,s.city,...(s.capability_labels||[]),...(s.specialty_labels||[]),s.contact_name,s.email].filter(Boolean).join(" "),
              "data-filter-organization":s.organization_id,"data-filter-organization-label":s.organization_name,
              "data-filter-capability":(s.capability_codes||[]).join("|"),"data-filter-capability-label":(s.capability_labels||[]).join("|"),
              "data-filter-specialty":(s.specialty_codes||[]).join("|"),"data-filter-specialty-label":(s.specialty_labels||[]).join("|"),
              "data-filter-country":s.country_code||"","data-filter-country-label":countryName(s.country_code)||s.country_code||"",
            },
            cells:{
              supplier:<EntityIdentityCell
                imageSrc={s.has_logo?"/api/suppliers/"+s.id+"/logo":null}
                imageAlt={s.has_logo?"Logo de "+s.name:""}
                fallback={initials(s.name)}
                icon="supplier"
                variant="logo"
                title={s.name}
                subtitle={(s.specialty_labels||[]).join(" · ")||s.service_category||typeLabel(s.supplier_type)}
                meta={[s.city,countryName(s.country_code)].filter(Boolean).join(" · ")||s.legal_name||null}
              />,
              status:<Badge variant={s.active?"success":"neutral"}>{s.active?"Activo":"Inactivo"}</Badge>,
              organization:s.organization_name,
              type:(s.capability_labels||[]).join(" · ")||typeLabel(s.supplier_type),
              specialty:(s.specialty_labels||[]).join(" · ")||s.service_category||"—",
              items:supplierItems,
              requisitions:supplierReqs,
              actions:<ListQuickActions>
                <button className="ds-list-action primary" type="button" onClick={()=>open(s.id)} title="Ver ficha" data-tooltip="Ver ficha" aria-label={"Ver ficha de "+s.name}><UiIcon name="eye" size={16}/></button>
                <button className="ds-list-action" type="button" onClick={()=>open(s.id,"general",true)} title="Editar proveedor" data-tooltip="Editar proveedor" aria-label="Editar proveedor"><UiIcon name="edit" size={16}/></button>
                {(s.supplier_type==="materials"||s.supplier_type==="both")&&<button className="ds-list-action" type="button" onClick={()=>open(s.id,"requisitions")} title="Crear requisición" data-tooltip="Crear requisición" aria-label="Crear requisición"><UiIcon name="plus" size={16}/></button>}
                {s.phone&&<a className="ds-list-action whatsapp" href={"https://wa.me/"+s.phone.replace(/\D/g,"")} target="_blank" rel="noreferrer" title="Contactar por WhatsApp" data-tooltip="Contactar por WhatsApp" aria-label="Contactar por WhatsApp"><UiIcon name="whatsapp" size={16}/></a>}
                <button type="button" className="ds-list-action danger" title="Eliminar proveedor" data-tooltip="Eliminar proveedor" aria-label="Eliminar proveedor" onClick={()=>setDeleteCandidate(s)}><UiIcon name="trash" size={16}/></button>
              </ListQuickActions>,
            },
          };
        })}
      />}/>:<EmptyState icon="file" title="Aún no hay proveedores" description="Registra el primero para asociar servicios, suministros y requisiciones."/>}
      {deleteError&&<div className="section"><Alert variant="danger" title="No fue posible eliminar el proveedor">{deleteError}</Alert></div>}
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
    /></div>;
  }

  const detail=selectedDetail||selected;
  const activeActivities=selected.active_activity_count;
  const openReqs=selected.open_requisition_count;
  const activeDocs=selected.active_document_count;
  const selectedItems=selectedInventoryItems;
  const selectedActiveItems=selectedActiveRequisitionItems;
  const inventorySites=selectedInventory?.sites||[];
  const inventoryLocations=selectedInventory?.locations||[];
  const inventoryCategories=selectedInventory?.categories||[];
  const inventoryWarehouses=selectedInventory?.warehouses||[];
  const demandSupplierId=selected.id;

  function demandContent(view:SupplierDataView,content:ReactNode){
    const loaded=view==="general"?Object.prototype.hasOwnProperty.call(detailsBySupplier,demandSupplierId)
      :view==="statistics"?Object.prototype.hasOwnProperty.call(statisticsBySupplier,demandSupplierId)
      :view==="documents"?Object.prototype.hasOwnProperty.call(documentsBySupplier,demandSupplierId)
      :view==="activities"?Object.prototype.hasOwnProperty.call(activitiesBySupplier,demandSupplierId)
      :view==="inventory"?Object.prototype.hasOwnProperty.call(inventoryBySupplier,demandSupplierId)
      :Object.prototype.hasOwnProperty.call(requisitionsBySupplier,demandSupplierId);
    if(loaded)return content;
    const key=demandSupplierId+":"+view;
    const error=loadErrors[key];
    return <div className="entity-panel supplier-demand-state">
      {error?<Alert variant="danger" title="No fue posible cargar la sección">{error}</Alert>:<Spinner label={loadingKeys[key]?"Cargando información del proveedor…":"Preparando información del proveedor…"}/>}
    </div>;
  }

  const general=editing?<form className="entity-edit-form" method="post" action={"/api/suppliers/"+detail.id} encType="multipart/form-data">
    <input type="hidden" name="intent" value="update"/>
    <div className="entity-panel"><h3><span className="entity-section-icon"><UiIcon name="company"/></span>Editar proveedor</h3><div className="form-grid">
      <div className="field"><label>Nombre comercial *</label><input name="name" defaultValue={detail.name} required/></div>
      <div className="field"><label>Razón social *</label><input name="legal_name" defaultValue={detail.legal_name||""} required/></div>
      <MultiSelectDropdown name="capability_codes" label="Tipo de proveedor" options={capabilityOptions} defaultValues={detail.capability_codes||[]} required help="Puedes seleccionar múltiples capacidades normalizadas."/>
      <MultiSelectDropdown name="specialty_codes" label="Categoría / especialidad" options={specialtyOptions} defaultValues={detail.specialty_codes||[]} help="Catálogo estándar para mantener consistencia en filtros, importaciones y exportaciones."/>
      <TaxIdentificationTypeSelect id="supplier-edit-tax-type" name="tax_id_type" countryInputId="supplier-edit-country" countryCode={detail.country_code||"CO"} defaultValue={detail.tax_id_type||""}/>
      <div className="field"><label>Número de identificación</label><input name="tax_id" defaultValue={detail.tax_id||""}/></div>
      <CountryCityFields countryId="supplier-edit-country" countryName="country_code" cityId="supplier-edit-city" cityName="city" defaultCountry={detail.country_code||"CO"} defaultCity={detail.city||""} required/>
      <div className="field form-span-2"><label>Dirección *</label><input name="address" defaultValue={detail.address||""} required/></div>
      <div className="field"><label>Sitio web</label><input type="url" name="website" defaultValue={detail.website||""}/></div>
      <div className="field"><label>Contacto principal</label><input name="contact_name" defaultValue={detail.contact_name||""}/></div>
      <div className="field"><label>Cargo</label><input name="contact_title" defaultValue={detail.contact_title||""}/></div>
      <div className="field"><label>Correo</label><input type="email" name="email" defaultValue={detail.email||""}/></div>
      <PhoneField name="phone" label="Teléfono / WhatsApp" countryCode={detail.country_code||"CO"} countryInputId="supplier-edit-country" defaultValue={detail.phone}/>
      <div className="field"><label>Estado</label><select name="active" defaultValue={detail.active?"on":"off"}><option value="on">Activo</option><option value="off">Inactivo</option></select></div>
      <div className="field form-span-2"><label>Notas</label><textarea name="notes" rows={3} defaultValue={detail.notes||""}/></div>
      <div className="form-span-2"><FileDropzone name="logo" label="Logo del proveedor" accept="image/png,image/jpeg,image/webp" maxSizeMb={5} kind="image" existingPreviewUrl={detail.has_logo?"/api/suppliers/"+detail.id+"/logo":null} description="Puedes reemplazar el logo actual."/></div>
      <div className="form-span-2 form-actions"><button className="button secondary" type="button" onClick={()=>setEditing(false)}>Cancelar</button><button className="button" type="submit">Guardar cambios</button></div>
    </div></div>
  </form>:<div className="entity-section-stack">
    <div className="entity-approved-columns">
      <div className="entity-approved-column">
        <div className="entity-panel"><h3><span className="entity-section-icon"><UiIcon name="company"/></span>Datos del proveedor</h3><div className="entity-info-grid">
          <div className="entity-info-field"><span>Nombre comercial</span><strong>{detail.name}</strong></div>
          <div className="entity-info-field"><span>Razón social</span><strong>{detail.legal_name||"Sin registrar"}</strong></div>
          <div className="entity-info-field"><span>Tipo</span><strong>{(detail.capability_labels||[]).join(", ")||typeLabel(detail.supplier_type)}</strong></div>
          <div className="entity-info-field"><span>Especialidad / categoría</span><strong>{(detail.specialty_labels||[]).join(", ")||detail.service_category||"Sin registrar"}</strong></div>
          <div className="entity-info-field"><span>Identificación</span><strong>{detail.tax_id?(detail.tax_id_type||"ID")+" "+detail.tax_id:"Sin registrar"}</strong></div>
          <div className="entity-info-field"><span>País</span><strong>{countryName(detail.country_code)||"Sin registrar"}</strong></div>
          <div className="entity-info-field"><span>Ciudad</span><strong>{detail.city||"Sin registrar"}</strong></div>
          <div className="entity-info-field"><span>Dirección</span><strong>{detail.address||"Sin registrar"}</strong></div>
          <div className="entity-info-field"><span>Sitio web</span><strong>{detail.website?<a href={detail.website} target="_blank" rel="noreferrer">{detail.website}</a>:"Sin registrar"}</strong></div>
        </div></div>
        <div className="entity-panel"><h3><span className="entity-section-icon"><UiIcon name="phone"/></span>Contacto</h3><div className="entity-info-grid">
          <div className="entity-info-field"><span>Contacto principal</span><strong>{detail.contact_name||"Sin registrar"}</strong></div>
          <div className="entity-info-field"><span>Cargo</span><strong>{detail.contact_title||"Sin registrar"}</strong></div>
          <div className="entity-info-field"><span>Correo</span><strong>{detail.email?<a href={"mailto:"+detail.email}>{detail.email}</a>:"Sin registrar"}</strong></div>
          <div className="entity-info-field"><span>Teléfono / WhatsApp</span><strong>{detail.phone||"Sin registrar"}</strong></div>
        </div></div>
        <div className="entity-panel entity-approved-notes"><h3><span className="entity-section-icon"><UiIcon name="file"/></span>Notas adicionales</h3><p>{detail.notes||"Sin notas registradas para este proveedor."}</p></div>
      </div>
      <div className="entity-approved-column">
        <div className="entity-panel supplier-capability-panel"><h3><span className="entity-section-icon"><UiIcon name="activity"/></span>Relación operativa</h3>
          <div className="supplier-capability-list">
            <span className={(detail.supplier_type==="services"||detail.supplier_type==="both")?"enabled":""}><UiIcon name="work-order"/> Servicios y actividades<b>{selected.activity_count}</b></span>
            <span className={(detail.supplier_type==="materials"||detail.supplier_type==="both")?"enabled":""}><UiIcon name="asset"/> Inventarios y suministros<b>{selected.item_count}</b></span>
            <span className="enabled"><UiIcon name="file"/> Requisiciones<b>{selected.requisition_count}</b></span>
            <span className="enabled"><UiIcon name="file"/> Documentos<b>{activeDocs}</b></span>
          </div>
        </div>
        <div className="entity-panel"><h3><span className="entity-section-icon"><UiIcon name="check"/></span>Estado comercial</h3><div className="entity-info-grid">
          <div className="entity-info-field"><span>Estado</span><strong>{detail.active?"Proveedor activo":"Proveedor inactivo"}</strong></div>
          <div className="entity-info-field"><span>Empresa cliente</span><strong>{detail.organization_name}</strong></div>
          <div className="entity-info-field"><span>Actividades abiertas</span><strong>{activeActivities}</strong></div>
          <div className="entity-info-field"><span>Requisiciones abiertas</span><strong>{openReqs}</strong></div>
        </div></div>
      </div>
    </div>
  </div>;

  return <div className="phase8-supplier-directory"><EntityProfileWorkspace
    eyebrow="Directorio de proveedores"
    headingLabel="Proveedor"
    headingIcon="company"
    title={selected.name}
    subtitle={selected.organization_name}
    breadcrumbs={[{label:"Inicio",href:"/dashboard"},{label:"Proveedores",onClick:()=>{setSelectedId("");setEditing(false);}},{label:selected.name}]}
    imageSrc={selected.has_logo?"/api/suppliers/"+selected.id+"/logo":null}
    fallback={initials(selected.name)}
    status={<Badge variant={selected.active?"success":"neutral"}>{selected.active?"Activo":"Inactivo"}</Badge>}
    meta={[(selected.capability_labels||[]).join(" · ")||typeLabel(selected.supplier_type),selected.tax_id?(selected.tax_id_type||"ID")+" "+selected.tax_id:"Sin identificación",[selected.city,countryName(selected.country_code)].filter(Boolean).join(" · ")]}
    stats={[
      {label:"Actividades",value:activeActivities,icon:"work-order",hint:"activas"},
      {label:"Suministros",value:selected.active_item_count,icon:"asset"},
      {label:"Requisiciones",value:selected.requisition_count,icon:"file",hint:openReqs+" abiertas"},
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
      <ProfileExportMenu entity="supplier" id={selected.id} documentLabel="Ficha del proveedor"/>
      <button className="button danger-secondary entity-action-button" type="button" onClick={()=>setDeleteCandidate(selected)}><UiIcon name="trash"/><span>Eliminar</span></button>
    </>}
    initialTab={preferredTab}
    onTabChange={setPreferredTab}
    tabs={[
      {id:"general",label:"Información general",content:demandContent("general",general)},
      {id:"statistics",label:"Estadísticas",content:demandContent("statistics",<div className="entity-section-stack supplier-commercial-analytics">
        <StatTiles className="entity-stat-grid" items={[
          {label:"Actividades totales",value:String(selected.activity_count),hint:activeActivities+" activas"},
          {label:"Suministros asociados",value:String(selected.active_item_count),hint:(selected.item_count-selected.active_item_count)+" inactivos conservados"},
          {label:"Requisiciones",value:String(selected.requisition_count),hint:openReqs+" abiertas"},
          {label:"Documentos vigentes",value:String(activeDocs),hint:(selected.document_count-activeDocs)+" archivados"},
          {label:"Devoluciones a proveedor",value:String(selectedStatistics?.operational?.supplier_return_count||0),hint:Number(selectedStatistics?.operational?.supplier_return_quantity||0).toLocaleString("es-CO")+" unidades registradas",tone:(selectedStatistics?.operational?.supplier_return_count||0)>0?"warning":"default"},
          {label:"Documentos de compra",value:String(selectedStatistics?.operational?.procurement_document_count||0),hint:(selectedStatistics?.operational?.procurement_document_disputed||0)>0?(selectedStatistics?.operational?.procurement_document_disputed||0)+" en disputa":(selectedStatistics?.operational?.procurement_document_pending||0)>0?(selectedStatistics?.operational?.procurement_document_pending||0)+" pendientes de revisión":"Sin pendientes",tone:(selectedStatistics?.operational?.procurement_document_disputed||0)>0?"danger":(selectedStatistics?.operational?.procurement_document_pending||0)>0?"warning":"success"},
        ]}/>

        <div className="entity-panel supplier-commercial-panel">
          <div className="entity-panel-heading-row">
            <div>
              <h3><span className="entity-section-icon"><UiIcon name="activity"/></span>Desempeño comercial · últimos 12 meses</h3>
              <p className="entity-panel-copy">Indicadores calculados con recepciones físicas enlazadas a requisiciones. No son una calificación del proveedor: muestran evidencia operativa disponible y el tamaño de la muestra.</p>
            </div>
            <span className="supplier-analytics-sample">{selectedCommercial?.received_requisitions||0} requisiciones con recepción</span>
          </div>