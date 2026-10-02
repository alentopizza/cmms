"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import OwnerDeleteButton from "@/components/OwnerDeleteButton";
import UiIcon from "@/components/UiIcon";

export type OwnerEditField = {
  name:string;
  label:string;
  value:string|number|boolean|null;
  type?:"text"|"number"|"date"|"textarea"|"select"|"checkbox";
  options?:Array<{value:string;label:string}>;
};

export default function OwnerRecordActions({
  table,id,label,fields=[],deleteRedirectTo,compact=false,className="",children,editOverlay=true,afterSaveReopenKey,
}:{
  table:string;id:string;label:string;fields?:OwnerEditField[];deleteRedirectTo?:string;compact?:boolean;className?:string;children?:ReactNode;
  editOverlay?:boolean;afterSaveReopenKey?:string;
}) {
  const [editing,setEditing]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    if(!compact||!editing)return;
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"&&!saving){event.preventDefault();setEditing(false);}
    };
    document.addEventListener("keydown",onKey);
    return()=>document.removeEventListener("keydown",onKey);
  },[compact,editing,saving]);

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    const values:Record<string,unknown>={};
    for(const field of fields)values[field.name]=field.type==="checkbox"?form.get(field.name)==="on":form.get(field.name)??"";
    setSaving(true);setError("");
    try{
      const response=await fetch("/api/platform-owner/records",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({table,id,values})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload?.message||"No fue posible guardar los cambios.");
      if(afterSaveReopenKey){
        try{window.sessionStorage.setItem("cmms:record-detail-reopen",afterSaveReopenKey);}catch{}
      }
      setEditing(false);
      window.location.reload();
    }catch(cause){
      setError(cause instanceof Error?cause.message:"No fue posible guardar los cambios.");
    }finally{
      setSaving(false);
    }
  }

  const editor=<form
    className={["owner-record-edit-form",compact?"owner-record-edit-dialog":""].filter(Boolean).join(" ")}
    onSubmit={submit}
    role={compact?"dialog":undefined}
    aria-modal={compact?true:undefined}
    aria-label={compact?"Editar "+label:undefined}
  >
    <div className="owner-record-edit-head">
      <strong>Editar {label}</strong>
      <small>Solo Propietario Desweb</small>
      {compact&&<button className="owner-record-edit-close" type="button" onClick={()=>{if(!saving)setEditing(false);}} aria-label="Cerrar edición" title="Cerrar"><UiIcon name="x" size={16}/></button>}
    </div>
    {fields.map(field=><div className="field" key={field.name}>
      <label>{field.label}</label>
      {field.type==="select"?<select name={field.name} defaultValue={String(field.value??"")}>{(field.options||[]).map(option=><option value={option.value} key={option.value}>{option.label}</option>)}</select>
      :field.type==="textarea"?<textarea name={field.name} defaultValue={String(field.value??"")} rows={3}/>
      :field.type==="checkbox"?<label className="owner-record-checkbox"><input name={field.name} type="checkbox" defaultChecked={Boolean(field.value)}/><span>Activo</span></label>
      :<input name={field.name} type={field.type==="number"?"number":field.type==="date"?"date":"text"} defaultValue={String(field.value??"")} step={field.type==="number"?"any":undefined}/>}
    </div>)}
    {error&&<div className="notice error">{error}</div>}
    <div className="form-actions">
      {compact&&<button className="button secondary" type="button" disabled={saving} onClick={()=>setEditing(false)}>Cancelar</button>}
      <button className="button secondary" type="submit" disabled={saving}>{saving?"Guardando…":"Guardar cambios"}</button>
    </div>
  </form>;

  const compactEditor=compact&&editing&&typeof document!=="undefined"
    ?createPortal(
      editOverlay
        ?<div className="owner-record-edit-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!saving)setEditing(false);}}>{editor}</div>
        :<div className="owner-record-edit-layer-nested" role="presentation">{editor}</div>,
      document.body
    )
    :null;

  return <>
    <div className={["owner-record-actions",compact?"owner-record-actions-compact":"",className].filter(Boolean).join(" ")}>
      {children}
      {fields.length>0&&(compact
        ?<button className="ds-list-action" type="button" onClick={()=>setEditing(true)} data-tooltip="Editar" aria-label={"Editar "+label}><UiIcon name="edit" size={15}/><span className="ds-visually-hidden">Editar</span></button>
        :<button className="text-button" type="button" onClick={()=>setEditing(value=>!value)}>{editing?"Cerrar edición":"Editar"}</button>)}
      <OwnerDeleteButton table={table} id={id} label={label} redirectTo={deleteRedirectTo} className={compact?"ds-list-action danger":"text-button text-danger"} tooltip={compact?"Eliminar":undefined} iconName={compact?"trash":undefined} iconOnly={compact}/>
      {!compact&&editing&&editor}
    </div>
    {compactEditor}
  </>;
}
