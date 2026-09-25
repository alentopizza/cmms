"use client";

import { useEffect, useMemo, useState } from "react";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import FileDropzone from "@/components/FileDropzone";
import OwnerDeleteButton from "@/components/OwnerDeleteButton";
import UiIcon from "@/components/UiIcon";
import { Badge, type BadgeVariant } from "@/components/ui-kit/Badge";
import { Button } from "@/components/ui-kit/Button";
import { Search } from "@/components/ui-kit/DataControls";
import { Select } from "@/components/ui-kit/FormControls";
import { EmptyState } from "@/components/ui-kit/Feedback";
import { Drawer, Modal } from "@/components/ui-kit/Overlay";

export type CompanyDocumentItem = {
  id:string;
  category:string;
  requirement_level:"required"|"optional"|"not_applicable";
  display_name:string;
  reference:string|null;
  issue_date:string|null;
  expires_at:string|null;
  notes:string|null;
  file_name:string|null;
  file_mime_type:string|null;
  file_size_bytes:string|null;
  created_at:string;
  updated_at:string;
  uploaded_by_name:string|null;
  archived_at:string|null;
  archived_by_name:string|null;
};

type DocumentStateKey="archived"|"na"|"pending"|"optional"|"current"|"no-expiry"|"expired"|"expiring";

function formatDate(value:string|null,withTime=false){
  if(!value)return "Sin fecha";
  const date=new Date(value+(value.length===10?"T12:00:00":""));
  return withTime?date.toLocaleString("es-CO"):date.toLocaleDateString("es-CO");
}
function bytesLabel(value:string|null){
  if(!value)return "";
  const bytes=Number(value);
  if(!Number.isFinite(bytes))return "";
  return bytes>=1024*1024?(bytes/1024/1024).toFixed(1)+" MB":Math.max(1,Math.round(bytes/1024))+" KB";
}
function docState(document:CompanyDocumentItem):{key:DocumentStateKey;label:string;variant:BadgeVariant}{
  if(document.archived_at)return {key:"archived",label:"Archivado",variant:"neutral"};
  if(document.requirement_level==="not_applicable")return {key:"na",label:"No aplica",variant:"neutral"};
  if(!document.file_name)return document.requirement_level==="required"
    ?{key:"pending",label:"Pendiente",variant:"warning"}
    :{key:"optional",label:"Sin archivo",variant:"neutral"};
  if(!document.expires_at)return {key:"no-expiry",label:"Sin vigencia",variant:"neutral"};
  const expiry=new Date(document.expires_at+"T23:59:59");
  if(expiry.getTime()<Date.now())return {key:"expired",label:"Vencido",variant:"danger"};
  const days=Math.ceil((expiry.getTime()-Date.now())/86400000);
  if(days<=30)return {key:"expiring",label:"Por vencer",variant:"warning"};
  return {key:"current",label:"Vigente",variant:"success"};
}
function typeCode(mime:string|null){
  if(mime==="application/pdf")return "PDF";
  if(mime?.startsWith("image/"))return "IMG";
  return "DOC";
}

function DocumentViewer({
  document:item,
  organizationId,
  mode="context",
  onMore,
}:{
  document:CompanyDocumentItem;
  organizationId:string;
  mode?:"context"|"modal";
  onMore?:()=>void;
}){
  const [zoom,setZoom]=useState(100);
  const [fit,setFit]=useState(true);
  const [rotation,setRotation]=useState(0);
  const [previewLoading,setPreviewLoading]=useState(false);
  const [previewError,setPreviewError]=useState(false);

  useEffect(()=>{
    setZoom(100);
    setFit(true);
    setRotation(0);
    setPreviewError(false);
    setPreviewLoading(Boolean(item.file_name));
  },[item.id,item.file_name]);

  const previewUrl=item.file_name?"/api/organizations/"+organizationId+"/documents/"+item.id+"?inline=1":"";
  const downloadUrl=item.file_name?"/api/organizations/"+organizationId+"/documents/"+item.id:"";
  const pdfPreviewUrl=item.file_mime_type==="application/pdf"&&previewUrl
    ?previewUrl+"#zoom="+(fit?"page-width":zoom)
    :previewUrl;

  function printDocument(){
    if(!previewUrl)return;
    const win=window.open(previewUrl,"_blank");
    if(win)window.setTimeout(()=>{try{win.print();}catch{}},900);
  }

  return <div className={"company-document-viewer company-document-viewer-"+mode}>
    <div className="company-document-viewer-toolbar" aria-label={mode==="modal"?"Controles del visor completo":"Controles de previsualización"}>
      <div className="company-document-viewer-group" data-toolbar-group="view">
        <button type="button" className="document-viewer-icon" onClick={()=>{setFit(false);setZoom(value=>Math.max(50,value-10));}} disabled={!item.file_name} title="Alejar documento" data-tooltip="Zoom -"><UiIcon name="zoom-out" size={16}/></button>
        <span className="company-document-zoom-value">{fit?"Ajustado":zoom+"%"}</span>
        <button type="button" className="document-viewer-icon" onClick={()=>{setFit(false);setZoom(value=>Math.min(200,value+10));}} disabled={!item.file_name} title="Acercar documento" data-tooltip="Zoom +"><UiIcon name="zoom-in" size={16}/></button>
        <button type="button" className="document-viewer-icon" onClick={()=>setFit(true)} disabled={!item.file_name} title="Ajustar documento al panel" data-tooltip="Ajustar a pantalla"><UiIcon name="fit" size={16}/></button>
        <button type="button" className="document-viewer-icon" onClick={()=>setRotation(value=>(value+90)%360)} disabled={!item.file_mime_type?.startsWith("image/")} title={item.file_mime_type?.startsWith("image/")?"Rotar imagen":"La rotación PDF está disponible en los controles nativos del visor"} data-tooltip="Rotar"><UiIcon name="rotate" size={16}/></button>
      </div>
      <div className="company-document-viewer-group company-document-viewer-actions" data-toolbar-group="document">
        {item.file_name&&<a className="document-viewer-icon" href={downloadUrl} title="Descargar documento" data-tooltip="Descargar documento"><UiIcon name="download" size={16}/></a>}
        <button type="button" className="document-viewer-icon" disabled={!item.file_name} onClick={printDocument} title="Imprimir documento" data-tooltip="Imprimir documento"><UiIcon name="print" size={16}/></button>
        {onMore&&<button type="button" className="document-viewer-icon" onClick={onMore} title="Más acciones" data-tooltip="Más acciones"><UiIcon name="more" size={16}/></button>}
      </div>
    </div>

    <div className={"company-document-file-preview-v2"+(previewLoading?" loading":"")}>
      {previewLoading&&item.file_name&&<div className="company-document-preview-loader"><span className="ds-spinner ds-spinner-md"/><strong>Cargando previsualización…</strong></div>}
      {previewError?<EmptyState icon="file" title="No fue posible cargar la previsualización" description="Puedes descargar el archivo original o volver a intentarlo seleccionando el documento."/>:
      !item.file_name?<EmptyState icon="file" title="Documento no disponible" description="Este requisito todavía no tiene un archivo adjunto."/>:
      item.file_mime_type==="application/pdf"
        ?<iframe key={pdfPreviewUrl} src={pdfPreviewUrl} title={"Vista previa de "+item.display_name} onLoad={()=>setPreviewLoading(false)} onError={()=>{setPreviewLoading(false);setPreviewError(true);}}/>
        :item.file_mime_type?.startsWith("image/")
          ?<div className="company-document-image-stage"><img key={previewUrl} src={previewUrl} alt={"Vista previa de "+item.display_name} style={{transform:"rotate("+rotation+"deg) scale("+(fit?1:zoom/100)+")"}} onLoad={()=>setPreviewLoading(false)} onError={()=>{setPreviewLoading(false);setPreviewError(true);}}/></div>
          :<EmptyState icon="file" title={item.file_name} description="Este formato no dispone de previsualización integrada. Usa Descargar para abrir el archivo original."/>}
    </div>
  </div>;
}

export default function CompanyDocumentWorkspace({
  organizationId,
  documents,
  categories,
  owner,
  returnTo="",
}:{
  organizationId:string;
  documents:CompanyDocumentItem[];
  categories:Record<string,string>;
  owner:boolean;
  returnTo?:string;
}){
  const [view,setView]=useState<"active"|"archived">("active");
  const [selectedId,setSelectedId]=useState("");
  const [viewerDocumentId,setViewerDocumentId]=useState("");
  const [editing,setEditing]=useState(false);
  const [search,setSearch]=useState("");
  const [category,setCategory]=useState("all");
  const [validity,setValidity]=useState("all");
  const [sort,setSort]=useState("newest");
  const [zoom,setZoom]=useState(100);
  const [fit,setFit]=useState(true);
  const [rotation,setRotation]=useState(0);
  const [previewLoading,setPreviewLoading]=useState(false);
  const [previewError,setPreviewError]=useState(false);

  const active=useMemo(()=>documents.filter(item=>!item.archived_at),[documents]);
  const archived=useMemo(()=>documents.filter(item=>Boolean(item.archived_at)),[documents]);
  const source=view==="active"?active:archived;

  const visible=useMemo(()=>{
    const term=search.trim().toLowerCase();
    const filtered=source.filter(item=>{
      const state=docState(item);
      if(term&&!([item.display_name,item.file_name,item.reference,categories[item.category]||item.category].filter(Boolean).join(" ").toLowerCase().includes(term)))return false;
      if(category!=="all"&&item.category!==category)return false;
      if(validity!=="all"){
        if(validity==="no-expiry"&&!(item.file_name&&!item.expires_at))return false;
        else if(validity!=="no-expiry"&&state.key!==validity)return false;
      }
      return true;
    });
    return [...filtered].sort((a,b)=>{
      if(sort==="name")return a.display_name.localeCompare(b.display_name,"es");
      if(sort==="expiry")return (a.expires_at||"9999-12-31").localeCompare(b.expires_at||"9999-12-31");
      return new Date(b.created_at).getTime()-new Date(a.created_at).getTime();
    });
  },[source,search,category,validity,sort,categories]);

  const selected=visible.find(item=>item.id===selectedId)||visible[0]||null;
  const viewerDocument=documents.find(item=>item.id===viewerDocumentId)||null;
  const viewerDescription=viewerDocument
    ?viewerDocument.file_name
      ?[typeCode(viewerDocument.file_mime_type),bytesLabel(viewerDocument.file_size_bytes),formatDate(viewerDocument.created_at,true)].filter(Boolean).join(" · ")
      :"Requisito sin archivo adjunto"
    :undefined;

  useEffect(()=>{
    if(!visible.length){setSelectedId("");setEditing(false);return;}
    if(!visible.some(item=>item.id===selectedId)){
      setSelectedId(visible[0].id);
      setEditing(false);
    }
  },[visible,selectedId]);

  function selectDocument(id:string){
    setSelectedId(id);setEditing(false);
  }
  function openDocument(id:string){
    setSelectedId(id);
    setEditing(false);
    setViewerDocumentId(id);
  }
  function openDocumentActions(id:string){
    setSelectedId(id);
    setViewerDocumentId("");
    setEditing(true);
  }

  const categoryOptions=[
    {value:"all",label:"Todos los tipos"},
    ...Object.entries(categories).map(([value,label])=>({value,label})),
  ];
  const validityOptions=[
    {value:"all",label:"Todas las vigencias"},
    {value:"current",label:"Vigentes"},
    {value:"expiring",label:"Por vencer"},
    {value:"expired",label:"Vencidos"},
    {value:"pending",label:"Pendientes"},
    {value:"no-expiry",label:"Sin vigencia"},
  ];

  return <div className="company-document-workspace company-document-workspace-v2">
    <section className="company-document-preview-panel" aria-label="Previsualización del documento seleccionado">
      {!selected?<EmptyState icon="file" title={source.length?"Sin coincidencias":"No hay documentos"} description={source.length?"Ajusta la búsqueda o los filtros para seleccionar un documento.":"Aún no se han cargado documentos para esta empresa."}/>:
      <>
        <header className="company-document-preview-title">
          <span className={"company-document-type-icon type-"+typeCode(selected.file_mime_type).toLowerCase()} aria-hidden="true">{typeCode(selected.file_mime_type)}</span>
          <div>
            <strong>{selected.file_name||selected.display_name}</strong>
            <small>{selected.file_name?([bytesLabel(selected.file_size_bytes),selected.uploaded_by_name?"Cargado por "+selected.uploaded_by_name:null,formatDate(selected.created_at,true)].filter(Boolean).join(" · ")):"Requisito sin archivo adjunto"}</small>
          </div>
          <Badge variant={docState(selected).variant}>{docState(selected).label}</Badge>
        </header>

        <DocumentViewer document={selected} organizationId={organizationId} mode="context" onMore={()=>setEditing(true)}/>

      </>}
    </section>

    <section className="company-document-list-panel">
      <header className="company-document-list-head">
        <div className="company-document-list-title">
          <span aria-hidden="true"><UiIcon name="file" size={24}/></span>
          <div><h3>Documentos</h3><p>Gestión y control de documentos de la empresa.</p></div>
        </div>
        <div className="company-document-view-switch" role="tablist" aria-label="Estado de documentos">
          <button type="button" className={view==="active"?"active":""} onClick={()=>setView("active")}>Vigentes <b>{active.length}</b></button>
          <button type="button" className={view==="archived"?"active":""} onClick={()=>setView("archived")}>Archivados <b>{archived.length}</b></button>
        </div>
      </header>

      <div className="company-document-filterbar">
        <Search value={search} onValueChange={setSearch} placeholder="Buscar documentos..." ariaLabel="Buscar documentos"/>
        <Select aria-label="Tipo de documento" placeholder="" value={category} onChange={event=>setCategory(event.target.value)} options={categoryOptions}/>
        <Select aria-label="Vigencia del documento" placeholder="" value={validity} onChange={event=>setValidity(event.target.value)} options={validityOptions}/>
        <Select aria-label="Orden de documentos" placeholder="" value={sort} onChange={event=>setSort(event.target.value)} options={[
          {value:"newest",label:"Más recientes"},{value:"name",label:"Nombre A–Z"},{value:"expiry",label:"Próximo vencimiento"},
        ]}/>
      </div>

      {!visible.length?<EmptyState icon="file" title={source.length?"No hay resultados":"No hay documentos"} description={source.length?"No encontramos documentos con los filtros seleccionados.":view==="active"?"Aún no se han cargado documentos para esta empresa.":"No hay documentos archivados."}/>:
      <div className="company-document-table-wrap">
        <table className="company-document-table">
          <thead><tr><th>Tipo</th><th>Nombre del documento</th><th>Fecha de cargue</th><th>Vigencia</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>{visible.map(document=>{
            const state=docState(document);
            const isSelected=selected?.id===document.id;
            return <tr key={document.id} className={isSelected?"selected":""} aria-selected={isSelected} tabIndex={0} onClick={()=>selectDocument(document.id)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();selectDocument(document.id);}}}>
              <td><span className="company-document-type-cell"><span className={"company-document-mini-type type-"+typeCode(document.file_mime_type).toLowerCase()}>{typeCode(document.file_mime_type)}</span>{categories[document.category]||document.category}</span></td>
              <td><strong>{document.file_name||document.display_name}</strong>{document.reference&&<small>Ref. {document.reference}</small>}</td>
              <td>{formatDate(document.created_at,true)}</td>
              <td>{document.expires_at?formatDate(document.expires_at):document.file_name?"Sin vigencia":"—"}</td>
              <td><Badge variant={state.variant}>{state.label}</Badge></td>
              <td>
                <div className="company-document-row-actions" onClick={event=>event.stopPropagation()}>
                  <button type="button" onClick={()=>openDocument(document.id)} title="Ver documento" data-tooltip="Ver documento"><UiIcon name="eye" size={15}/></button>
                  {document.file_name&&<a href={"/api/organizations/"+organizationId+"/documents/"+document.id} title="Descargar documento" data-tooltip="Descargar documento"><UiIcon name="download" size={15}/></a>}
                  <button type="button" onClick={()=>openDocumentActions(document.id)} title="Más acciones" data-tooltip="Más acciones"><UiIcon name="more" size={15}/></button>
                </div>
              </td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
      <footer className="company-document-list-foot">Mostrando {visible.length} de {source.length} documentos</footer>
    </section>

    <Modal
      open={Boolean(viewerDocument)}
      onClose={()=>setViewerDocumentId("")}
      title={viewerDocument?.file_name||viewerDocument?.display_name||"Documento"}
      description={viewerDescription}
      size="lg"
      className="company-document-modal"
      bodyClassName="company-document-modal-body"
    >
      {viewerDocument&&<>
        <div className="company-document-modal-summary">
          <span className={"company-document-type-icon type-"+typeCode(viewerDocument.file_mime_type).toLowerCase()} aria-hidden="true">{typeCode(viewerDocument.file_mime_type)}</span>
          <div>
            <strong>{categories[viewerDocument.category]||viewerDocument.category}</strong>
            <small>{viewerDocument.expires_at?"Vigencia hasta "+formatDate(viewerDocument.expires_at):viewerDocument.file_name?"Sin fecha de vencimiento":"Sin archivo adjunto"}</small>
          </div>
          <Badge variant={docState(viewerDocument).variant}>{docState(viewerDocument).label}</Badge>
        </div>
        <DocumentViewer document={viewerDocument} organizationId={organizationId} mode="modal" onMore={()=>openDocumentActions(viewerDocument.id)}/>
      </>}
    </Modal>

    <Drawer open={editing&&Boolean(selected)} onClose={()=>setEditing(false)} title={selected?.display_name||"Documento"} description="Editar información, archivo y estado del documento.">
      {selected&&<div className="company-document-drawer-content">
        {!selected.archived_at&&<form className="company-document-preview-edit" method="post" action={"/api/organizations/"+organizationId+"/documents/"+selected.id} encType="multipart/form-data">
          {returnTo&&<input type="hidden" name="return_to" value={returnTo}/>}
          <div className="field"><label>Categoría</label><select name="category" defaultValue={selected.category}>{Object.entries(categories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
          <div className="field"><label>Nivel</label><select name="requirement_level" defaultValue={selected.requirement_level}><option value="required">Requerido</option><option value="optional">Opcional</option><option value="not_applicable">No aplica</option></select></div>
          <div className="field form-span-2"><label>Nombre</label><input name="display_name" defaultValue={selected.display_name} required/></div>
          <div className="field"><label>Referencia</label><input name="reference" defaultValue={selected.reference||""}/></div>
          <div className="field"><label>Emisión</label><input name="issue_date" type="date" defaultValue={selected.issue_date||""}/></div>
          <div className="field"><label>Vencimiento</label><input name="expires_at" type="date" defaultValue={selected.expires_at||""}/></div>
          <div className="form-span-2"><FileDropzone name="file" label="Reemplazar archivo" description="Déjalo sin seleccionar para conservar el archivo actual." accept="application/pdf,image/png,image/jpeg,image/webp" maxSizeMb={10} kind="document" compact existingFileName={selected.file_name}/></div>
          <div className="field form-span-2"><label>Observaciones</label><textarea name="notes" rows={3} defaultValue={selected.notes||""}/></div>
          <div className="form-span-2 form-actions"><Button type="button" variant="secondary" onClick={()=>setEditing(false)}>Cancelar</Button><Button type="submit" iconLeft="check">Guardar cambios</Button></div>
        </form>}
        <div className="company-document-drawer-actions">
          {!selected.archived_at
            ?<form method="post" action={"/api/organizations/"+organizationId+"/documents/"+selected.id}>
                <input type="hidden" name="intent" value="archive"/>{returnTo&&<input type="hidden" name="return_to" value={returnTo}/>}
                <ConfirmSubmitButton className="ds-button ds-button-secondary ds-button-md" confirmation={"¿Seguro que quieres archivar “"+selected.display_name+"”? Podrás restaurarlo después."}>Archivar documento</ConfirmSubmitButton>
              </form>
            :<form method="post" action={"/api/organizations/"+organizationId+"/documents/"+selected.id}>
                <input type="hidden" name="intent" value="restore"/>{returnTo&&<input type="hidden" name="return_to" value={returnTo}/>}
                <Button type="submit" variant="secondary" iconLeft="reset">Restaurar documento</Button>
              </form>}
          {owner&&<OwnerDeleteButton table="organization_documents" id={selected.id} label={selected.display_name} redirectTo={returnTo||undefined} className="ds-button ds-button-danger ds-button-md" tooltip="Eliminar definitivamente el documento"/>}
        </div>
      </div>}
    </Drawer>
  </div>;
}
