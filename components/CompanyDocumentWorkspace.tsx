"use client";

import { useEffect, useMemo, useState } from "react";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import FileDropzone from "@/components/FileDropzone";
import OwnerDeleteButton from "@/components/OwnerDeleteButton";

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

function formatDate(value:string|null){
  if(!value)return "Sin fecha";
  return new Date(value+(value.length===10?"T12:00:00":"")).toLocaleDateString("es-CO");
}
function bytesLabel(value:string|null){
  if(!value)return "";
  const bytes=Number(value);
  if(!Number.isFinite(bytes))return "";
  return bytes>=1024*1024?(bytes/1024/1024).toFixed(1)+" MB":Math.max(1,Math.round(bytes/1024))+" KB";
}
function docState(document:CompanyDocumentItem){
  if(document.archived_at)return {key:"archived",label:"Archivado"};
  if(document.requirement_level==="not_applicable")return {key:"na",label:"No aplica"};
  if(!document.file_name)return {key:document.requirement_level==="required"?"pending":"optional",label:document.requirement_level==="required"?"Pendiente":"Sin archivo"};
  if(!document.expires_at)return {key:"current",label:"Vigente"};
  const expiry=new Date(document.expires_at+"T23:59:59");
  if(expiry.getTime()<Date.now())return {key:"expired",label:"Vencido"};
  const days=Math.ceil((expiry.getTime()-Date.now())/86400000);
  if(days<=30)return {key:"expiring",label:"Próximo a vencer"};
  return {key:"current",label:"Vigente"};
}

export default function CompanyDocumentWorkspace({
  organizationId,
  documents,
  categories,
  owner,
}:{
  organizationId:string;
  documents:CompanyDocumentItem[];
  categories:Record<string,string>;
  owner:boolean;
}){
  const [view,setView]=useState<"active"|"archived">("active");
  const [selectedId,setSelectedId]=useState("");
  const [editing,setEditing]=useState(false);

  const active=useMemo(()=>documents.filter(item=>!item.archived_at),[documents]);
  const archived=useMemo(()=>documents.filter(item=>Boolean(item.archived_at)),[documents]);
  const visible=view==="active"?active:archived;
  const selected=visible.find(item=>item.id===selectedId)||visible[0]||null;

  useEffect(()=>{
    if(!visible.some(item=>item.id===selectedId)){
      setSelectedId(visible[0]?.id||"");
      setEditing(false);
    }
  },[view,visible,selectedId]);

  const previewUrl=selected?.file_name
    ? "/api/organizations/"+organizationId+"/documents/"+selected.id+"?inline=1"
    : "";
  const downloadUrl=selected?.file_name
    ? "/api/organizations/"+organizationId+"/documents/"+selected.id
    : "";

  return <div className="company-document-workspace">
    <div className="company-document-browser">
      <div className="company-document-tabs" role="tablist" aria-label="Estado de documentos">
        <button type="button" className={view==="active"?"active":""} onClick={()=>setView("active")}>
          Vigentes <b>{active.length}</b>
        </button>
        <button type="button" className={view==="archived"?"active":""} onClick={()=>setView("archived")}>
          Archivados <b>{archived.length}</b>
        </button>
      </div>

      {visible.length===0
        ? <div className="company-documents-empty">
            <strong>{view==="active"?"No hay documentos vigentes.":"No hay documentos archivados."}</strong>
            <span>{view==="active"?"Agrega un requisito o restaura uno archivado.":"Los documentos archivados aparecerán aquí y podrán restaurarse."}</span>
          </div>
        : <div className="company-document-list modern">
            {visible.map(document=>{
              const state=docState(document);
              const rowClass="company-document-row"+(selected?.id===document.id?" selected":"");
              return <button
                type="button"
                key={document.id}
                className={rowClass}
                onClick={()=>{setSelectedId(document.id);setEditing(false);}}
              >
                <span className="company-document-row-icon" aria-hidden="true">
                  {document.file_mime_type==="application/pdf"?"PDF":document.file_mime_type?.startsWith("image/")?"IMG":"DOC"}
                </span>
                <span className="company-document-row-copy">
                  <small>{categories[document.category]||document.category}</small>
                  <strong>{document.display_name}</strong>
                  <em>{document.file_name||"Sin archivo"}{document.file_size_bytes?" · "+bytesLabel(document.file_size_bytes):""}</em>
                </span>
                <span className={"company-document-state document-state-"+state.key}>{state.label}</span>
              </button>;
            })}
          </div>}
    </div>

    <aside className="company-document-preview-card">
      {!selected
        ? <div className="company-document-preview-empty">
            <span>▤</span>
            <strong>Selecciona un documento</strong>
            <p>Aquí verás su vista previa, información y acciones disponibles.</p>
          </div>
        : <>
          <header className="company-document-preview-head">
            <div>
              <span>{categories[selected.category]||selected.category}</span>
              <h3>{selected.display_name}</h3>
              <small>{selected.reference?"Ref. "+selected.reference:"Sin referencia"}</small>
            </div>
            <span className={"company-document-state document-state-"+docState(selected).key}>{docState(selected).label}</span>
          </header>

          <div className="company-document-file-preview">
            {!selected.file_name
              ? <div className="company-document-no-file"><span>▤</span><strong>Sin archivo adjunto</strong><small>Puedes editar el requisito y cargar un PDF o una imagen.</small></div>
              : selected.file_mime_type==="application/pdf"
                ? <iframe src={previewUrl} title={"Vista previa de "+selected.display_name} />
                : selected.file_mime_type?.startsWith("image/")
                  ? <img src={previewUrl} alt={"Vista previa de "+selected.display_name} />
                  : <div className="company-document-no-file"><span>DOC</span><strong>{selected.file_name}</strong><small>Usa Descargar para abrir este tipo de archivo.</small></div>}
          </div>

          <div className="company-document-preview-meta">
            <div><span>Archivo</span><strong>{selected.file_name||"Sin archivo"}</strong></div>
            <div><span>Emisión</span><strong>{formatDate(selected.issue_date)}</strong></div>
            <div><span>Vencimiento</span><strong>{formatDate(selected.expires_at)}</strong></div>
            <div><span>Actualizado</span><strong>{formatDate(selected.updated_at)}</strong></div>
            {selected.archived_at&&<div className="form-span-2"><span>Archivado</span><strong>{formatDate(selected.archived_at)+(selected.archived_by_name?" · por "+selected.archived_by_name:"")}</strong></div>}
          </div>

          {selected.notes&&<div className="company-document-preview-notes"><span>Observaciones</span><p>{selected.notes}</p></div>}

          <div className="company-document-action-pills">
            {selected.file_name&&<a className="document-action-pill download" href={downloadUrl} title="Descargar el archivo original" data-tooltip="Descargar"><i>↓</i><span>Descargar</span></a>}
            {!selected.archived_at&&<button className="document-action-pill edit" type="button" onClick={()=>setEditing(current=>!current)} title="Editar información o reemplazar el archivo" data-tooltip="Editar"><i>✎</i><span>Editar</span></button>}
            {!selected.archived_at
              ? <form method="post" action={"/api/organizations/"+organizationId+"/documents/"+selected.id}>
                  <input type="hidden" name="intent" value="archive"/>
                  <ConfirmSubmitButton className="document-action-pill archive" title="Archivar el documento sin eliminarlo" data-tooltip="Archivar" confirmation={"¿Seguro que quieres archivar “"+selected.display_name+"”? Podrás restaurarlo después."}>
                    <i>↧</i><span>Archivar</span>
                  </ConfirmSubmitButton>
                </form>
              : <form method="post" action={"/api/organizations/"+organizationId+"/documents/"+selected.id}>
                  <input type="hidden" name="intent" value="restore"/>
                  <button className="document-action-pill restore" type="submit" title="Restaurar el documento a la ficha vigente" data-tooltip="Restaurar"><i>↥</i><span>Restaurar</span></button>
                </form>}
            {owner&&<OwnerDeleteButton
              table="organization_documents"
              id={selected.id}
              label={selected.display_name}
              className="document-action-pill delete"
              tooltip="Eliminar definitivamente el documento"
              icon="×"
            />}
          </div>

          {editing&&!selected.archived_at&&<form className="company-document-preview-edit" method="post" action={"/api/organizations/"+organizationId+"/documents/"+selected.id} encType="multipart/form-data">
            <div className="field"><label>Categoría</label><select name="category" defaultValue={selected.category}>{Object.entries(categories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
            <div className="field"><label>Nivel</label><select name="requirement_level" defaultValue={selected.requirement_level}><option value="required">Requerido</option><option value="optional">Opcional</option><option value="not_applicable">No aplica</option></select></div>
            <div className="field form-span-2"><label>Nombre</label><input name="display_name" defaultValue={selected.display_name} required/></div>
            <div className="field"><label>Referencia</label><input name="reference" defaultValue={selected.reference||""}/></div>
            <div className="field"><label>Emisión</label><input name="issue_date" type="date" defaultValue={selected.issue_date||""}/></div>
            <div className="field"><label>Vencimiento</label><input name="expires_at" type="date" defaultValue={selected.expires_at||""}/></div>
            <div className="form-span-2"><FileDropzone name="file" label="Reemplazar archivo" description="Déjalo sin seleccionar para conservar el archivo actual." accept="application/pdf,image/png,image/jpeg,image/webp" maxSizeMb={10} kind="document" compact existingFileName={selected.file_name}/></div>
            <div className="field form-span-2"><label>Observaciones</label><textarea name="notes" rows={3} defaultValue={selected.notes||""}/></div>
            <div className="form-span-2 form-actions"><button className="button secondary" type="button" onClick={()=>setEditing(false)}>Cancelar</button><button className="button" type="submit">Guardar cambios</button></div>
          </form>}
        </>}
    </aside>
  </div>;
}
