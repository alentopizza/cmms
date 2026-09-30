"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import UiIcon from "@/components/UiIcon";
import { Modal } from "@/components/ui-kit/Overlay";

export type ConfigurableCatalogOption={
  id:string;
  code:string;
  label:string;
  description?:string|null;
  origin:"SYSTEM"|"CUSTOM";
  active:boolean;
};

export default function ConfigurableCatalogSelect({
  name,
  label,
  catalog,
  organizationId,
  defaultValue="",
  placeholder="Selecciona una opción",
  required=false,
  allowCreate=false,
  allowManage=false,
  submitValue="code",
  help,
}:{
  name:string;
  label:string;
  catalog:string;
  organizationId?:string;
  defaultValue?:string;
  placeholder?:string;
  required?:boolean;
  allowCreate?:boolean;
  allowManage?:boolean;
  submitValue?:"code"|"label";
  help?:string;
}){
  const host=useRef<HTMLDivElement>(null);
  const [open,setOpen]=useState(false);
  const [createOpen,setCreateOpen]=useState(false);
  const [options,setOptions]=useState<ConfigurableCatalogOption[]>([]);
  const [selected,setSelected]=useState(defaultValue);
  const [search,setSearch]=useState("");
  const [canCreate,setCanCreate]=useState(false);
  const [loading,setLoading]=useState(false);
  const [creating,setCreating]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>setSelected(defaultValue),[defaultValue]);

  useEffect(()=>{
    let cancelled=false;
    const controller=new AbortController();
    setLoading(true);
    setError("");
    const qs=organizationId?"?organization_id="+encodeURIComponent(organizationId):"";
    fetch("/api/catalogs/"+encodeURIComponent(catalog)+qs,{signal:controller.signal})
      .then(async response=>{
        if(!response.ok)throw new Error("No fue posible cargar el catálogo.");
        return response.json() as Promise<{options:ConfigurableCatalogOption[];canCreate:boolean}>;
      })
      .then(data=>{
        if(cancelled)return;
        setOptions(data.options.filter(option=>option.active));
        setCanCreate(Boolean(data.canCreate));
      })
      .catch(err=>{if(!cancelled&&err?.name!=="AbortError")setError("No fue posible cargar las opciones.");})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;controller.abort();};
  },[catalog,organizationId]);

  useEffect(()=>{
    if(!open)return;
    const pointer=(event:MouseEvent)=>{
      if(host.current&&!host.current.contains(event.target as Node))setOpen(false);
    };
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
    document.addEventListener("mousedown",pointer);
    document.addEventListener("keydown",key);
    return()=>{document.removeEventListener("mousedown",pointer);document.removeEventListener("keydown",key);};
  },[open]);

  const chosen=options.find(option=>(submitValue==="code"?option.code:option.label)===selected);
  const filtered=useMemo(()=>{
    const term=search.trim().toLocaleLowerCase("es");
    if(!term)return options;
    return options.filter(option=>(option.label+" "+option.code).toLocaleLowerCase("es").includes(term));
  },[options,search]);

  function choose(option:ConfigurableCatalogOption){
    setSelected(submitValue==="code"?option.code:option.label);
    setOpen(false);
    setSearch("");
  }

  async function createOption(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!organizationId){setError("Selecciona primero la empresa o sede.");return;}
    const form=new FormData(event.currentTarget);
    const optionLabel=String(form.get("label")||"").trim();
    if(!optionLabel)return;
    setCreating(true);
    setError("");
    try{
      const response=await fetch("/api/catalogs/"+encodeURIComponent(catalog),{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({organizationId,label:optionLabel,description:String(form.get("description")||"").trim()}),
      });
      const data=await response.json().catch(()=>({})) as {option?:ConfigurableCatalogOption;error?:string};
      if(response.status===409){setError("Ya existe una opción con ese nombre.");return;}
      if(!response.ok||!data.option){setError("No fue posible crear la opción.");return;}
      setOptions(current=>[...current,data.option!].sort((a,b)=>a.label.localeCompare(b.label,"es")));
      setSelected(submitValue==="code"?data.option.code:data.option.label);
      setCreateOpen(false);
      setOpen(false);
      setSearch("");
    }finally{
      setCreating(false);
    }
  }

  const mayCreate=allowCreate&&canCreate;

  return <div className="field configurable-catalog-field" ref={host}>
    <label>{label}{required?" *":""}</label>
    <input type="hidden" name={name} value={selected}/>
    {required&&<input className="multi-select-required-proxy" aria-hidden="true" tabIndex={-1} required value={selected} onChange={()=>{}}/>}
    <button className={"multi-select-trigger configurable-catalog-trigger"+(open?" active":"")} type="button" onClick={()=>setOpen(value=>!value)} aria-expanded={open}>
      <span>{chosen?.label||selected||placeholder}</span>
      <b aria-hidden="true">⌄</b>
    </button>
    {open&&<div className="multi-select-popover configurable-catalog-popover">
      <div className="configurable-catalog-search">
        <UiIcon name="search" size={15}/>
        <input value={search} onChange={event=>setSearch(event.target.value)} placeholder={"Buscar "+label.toLowerCase()+"..."} autoFocus/>
      </div>
      <div className="multi-select-options configurable-catalog-options">
        {loading&&<span className="configurable-catalog-empty">Cargando opciones…</span>}
        {!loading&&filtered.map(option=><button type="button" key={option.id} className={chosen?.id===option.id?"active":""} onClick={()=>choose(option)}>
          <span><strong>{option.label}</strong><small>{option.origin==="SYSTEM"?"Sistema":"Empresa"}</small></span>
          {chosen?.id===option.id&&<UiIcon name="check" size={14}/>}
        </button>)}
        {!loading&&!filtered.length&&<span className="configurable-catalog-empty">No hay coincidencias.</span>}
      </div>
      {(mayCreate||allowManage)&&<div className="configurable-catalog-actions">
        {mayCreate&&<button type="button" onClick={()=>{setOpen(false);setCreateOpen(true);}}><UiIcon name="plus" size={14}/> Crear nueva opción</button>}
        {allowManage&&<a href={"/dashboard/settings/catalogs?catalog="+encodeURIComponent(catalog)}><UiIcon name="settings" size={14}/> Administrar catálogo</a>}
      </div>}
    </div>}
    {help&&<small>{help}</small>}
    {error&&<small className="form-error">{error}</small>}

    <Modal open={createOpen} onClose={()=>setCreateOpen(false)} title={"Nueva opción · "+label} eyebrow="Catálogo configurable" description="La nueva opción quedará disponible únicamente para esta empresa.">
      <form className="form-grid unified-popup-form" onSubmit={createOption}>
        <div className="field form-span-2"><label>Nombre *</label><input name="label" required autoFocus maxLength={120}/></div>
        <div className="field form-span-2"><label>Descripción</label><textarea name="description" rows={3}/></div>
        <div className="field"><label>Estado</label><select defaultValue="active" disabled><option value="active">Activa</option></select></div>
        <div className="form-span-2 form-actions">
          <button className="button secondary" type="button" onClick={()=>setCreateOpen(false)}>Cancelar</button>
          <button className="button" type="submit" disabled={creating}>{creating?"Creando…":"Crear opción"}</button>
        </div>
      </form>
    </Modal>
  </div>;
}
