"use client";

import { useState } from "react";
import { Badge } from "@/components/ui-kit/Badge";
import UiIcon from "@/components/UiIcon";
import { Modal } from "@/components/ui-kit/Overlay";

type Option={
  id:string;
  origin:"SYSTEM"|"CUSTOM";
  code:string;
  label:string;
  description:string|null;
  active:boolean;
  organizationId?:string|null;
  organization_id?:string|null;
};

export default function CatalogAdminPanel({
  catalogKey,
  catalogLabel,
  allowCustom,
  organizationId,
  initialOptions,
  canManage,
  canManageSystem,
}:{
  catalogKey:string;
  catalogLabel:string;
  allowCustom:boolean;
  organizationId:string|null;
  initialOptions:Option[];
  canManage:boolean;
  canManageSystem:boolean;
}){
  const [options,setOptions]=useState(initialOptions);
  const [open,setOpen]=useState(false);
  const [editing,setEditing]=useState<Option|null>(null);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  async function createOption(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!organizationId){setError("Selecciona una empresa antes de crear una opción personalizada.");return;}
    const form=new FormData(event.currentTarget);
    setSaving(true);setError("");
    try{
      const response=await fetch("/api/catalogs/"+encodeURIComponent(catalogKey),{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({organizationId,label:String(form.get("label")||""),description:String(form.get("description")||"")}),
      });
      const data=await response.json().catch(()=>({})) as {option?:Option;error?:string};
      if(response.status===409){setError("Ya existe una opción con ese nombre.");return;}
      if(!response.ok||!data.option){setError("No fue posible crear la opción.");return;}
      setOptions(current=>[...current,data.option!]);
      setOpen(false);
    }finally{setSaving(false);}
  }

  async function saveEdit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!editing)return;
    const form=new FormData(event.currentTarget);
    setSaving(true);setError("");
    try{
      const response=await fetch("/api/catalog-options/"+editing.id,{
        method:"PATCH",headers:{"content-type":"application/json"},
        body:JSON.stringify({label:String(form.get("label")||""),description:String(form.get("description")||"")}),
      });
      const data=await response.json().catch(()=>({})) as {option?:Option;error?:string};
      if(response.status===409){setError("Ya existe una opción con ese nombre.");return;}
      if(!response.ok||!data.option){setError("No fue posible editar la opción.");return;}
      setOptions(current=>current.map(item=>item.id===editing.id?{...item,...data.option}:item));
      setEditing(null);
    }finally{setSaving(false);}
  }

  async function toggle(option:Option){
    const response=await fetch("/api/catalog-options/"+option.id,{
      method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({active:!option.active}),
    });
    if(!response.ok){setError("No fue posible actualizar la opción.");return;}
    setOptions(current=>current.map(item=>item.id===option.id?{...item,active:!item.active}:item));
  }

  return <div className="catalog-admin-detail">
    <div className="section-heading">
      <div><span className="eyebrow">Opciones</span><h2>{catalogLabel}</h2><p className="muted">Las opciones del sistema son globales; las personalizadas pertenecen a la empresa seleccionada.</p></div>
      {canManage&&allowCustom&&<button className="button" type="button" onClick={()=>setOpen(true)} disabled={!organizationId}><UiIcon name="plus" size={15}/> Nueva opción</button>}
    </div>
    {error&&<div className="notice error">{error}</div>}
    <div className="catalog-option-table card">
      <div className="catalog-option-row catalog-option-head"><span>Opción</span><span>Origen</span><span>Estado</span><span>Acciones</span></div>
      {options.map(option=><div className="catalog-option-row" key={option.id}>
        <div><strong>{option.label}</strong><small>{option.description||option.code}</small></div>
        <span><Badge variant={option.origin==="SYSTEM"?"brand":"neutral"}>{option.origin==="SYSTEM"?"Sistema":"Empresa"}</Badge></span>
        <span><Badge variant={option.active?"success":"neutral"}>{option.active?"Activa":"Inactiva"}</Badge></span>
        <span>{canManage&&(option.origin==="CUSTOM"||canManageSystem)
          ?<span className="catalog-option-actions">
              <button className="ds-button ds-button-secondary ds-button-sm" type="button" onClick={()=>setEditing(option)}>Editar</button>
              <button className="ds-button ds-button-secondary ds-button-sm" type="button" onClick={()=>toggle(option)}>{option.active?"Desactivar":"Activar"}</button>
            </span>
          :<small className="muted">Protegida</small>}</span>
      </div>)}
      {!options.length&&<div className="empty-state"><strong>Sin opciones</strong><p>Este catálogo aún no tiene opciones para el contexto actual.</p></div>}
    </div>

    <Modal open={editing!==null} onClose={()=>setEditing(null)} eyebrow="Catálogo configurable" title={"Editar opción · "+catalogLabel} description={editing?.origin==="SYSTEM"?"Opción global del sistema.":"Opción personalizada de la empresa."}>
      {editing&&<form className="form-grid unified-popup-form" onSubmit={saveEdit}>
        <div className="field form-span-2"><label>Nombre *</label><input name="label" required maxLength={120} defaultValue={editing.label} autoFocus/></div>
        <div className="field form-span-2"><label>Descripción</label><textarea name="description" rows={3} defaultValue={editing.description||""}/></div>
        <div className="form-span-2 form-actions"><button className="button secondary" type="button" onClick={()=>setEditing(null)}>Cancelar</button><button className="button" type="submit" disabled={saving}>{saving?"Guardando…":"Guardar cambios"}</button></div>
      </form>}
    </Modal>

    <Modal open={open} onClose={()=>setOpen(false)} eyebrow="Catálogo configurable" title={"Nueva opción · "+catalogLabel} description="La opción será privada de la empresa seleccionada.">
      <form className="form-grid unified-popup-form" onSubmit={createOption}>
        <div className="field form-span-2"><label>Nombre *</label><input name="label" required maxLength={120} autoFocus/></div>
        <div className="field form-span-2"><label>Descripción</label><textarea name="description" rows={3}/></div>
        <div className="field"><label>Estado</label><select disabled defaultValue="active"><option value="active">Activa</option></select></div>
        <div className="form-span-2 form-actions"><button className="button secondary" type="button" onClick={()=>setOpen(false)}>Cancelar</button><button className="button" type="submit" disabled={saving}>{saving?"Creando…":"Crear opción"}</button></div>
      </form>
    </Modal>
  </div>;
}
