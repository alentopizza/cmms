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
  name,label,catalog,organizationId,defaultValue="",defaultValues,placeholder="Selecciona una opción",
  required=false,allowCreate=false,allowManage=false,submitValue="code",multiple=false,help,
}:{
  name:string;label:string;catalog:string;organizationId?:string;defaultValue?:string;defaultValues?:string[];
  placeholder?:string;required?:boolean;allowCreate?:boolean;allowManage?:boolean;submitValue?:"code"|"label";
  multiple?:boolean;help?:string;
}){
  const host=useRef<HTMLDivElement>(null);
  const initial=multiple?(defaultValues||[]).filter(Boolean):[defaultValue].filter(Boolean);
  const [open,setOpen]=useState(false);
  const [createOpen,setCreateOpen]=useState(false);
  const [options,setOptions]=useState<ConfigurableCatalogOption[]>([]);
  const [selected,setSelected]=useState<string[]>(initial);
  const [search,setSearch]=useState("");
  const [canCreate,setCanCreate]=useState(false);
  const [loading,setLoading]=useState(false);
  const [creating,setCreating]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>setSelected(multiple?(defaultValues||[]).filter(Boolean):[defaultValue].filter(Boolean)),[multiple,defaultValue,JSON.stringify(defaultValues||[])]);

  useEffect(()=>{
    let cancelled=false;
    const controller=new AbortController();
    setLoading(true);setError("");
    const qs=organizationId?"?organization_id="+encodeURIComponent(organizationId):"";
    fetch("/api/catalogs/"+encodeURIComponent(catalog)+qs,{signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error("catalog");return response.json() as Promise<{options:ConfigurableCatalogOption[];canCreate:boolean}>;})
      .then(data=>{if(!cancelled){setOptions(data.options.filter(option=>option.active));setCanCreate(Boolean(data.canCreate));}})
      .catch(err=>{if(!cancelled&&err?.name!=="AbortError")setError("No fue posible cargar las opciones.");})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;controller.abort();};
  },[catalog,organizationId]);

  useEffect(()=>{
    if(!open)return;
    const pointer=(event:MouseEvent)=>{if(host.current&&!host.current.contains(event.target as Node))setOpen(false);};
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
    document.addEventListener("mousedown",pointer);document.addEventListener("keydown",key);
    return()=>{document.removeEventListener("mousedown",pointer);document.removeEventListener("keydown",key);};
  },[open]);

  const optionValue=(option:ConfigurableCatalogOption)=>submitValue==="code"?option.code:option.label;
  const chosen=options.filter(option=>selected.includes(optionValue(option)));
  const filtered=useMemo(()=>{
    const term=search.trim().toLocaleLowerCase("es");
    if(!term)return options;
    return options.filter(option=>(option.label+" "+option.code).toLocaleLowerCase("es").includes(term));
  },[options,search]);

  function choose(option:ConfigurableCatalogOption){
    const value=optionValue(option);
    if(multiple){
      setSelected(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value]);
      return;
    }
    setSelected([value]);setOpen(false);setSearch("");
  }

  async function createOption(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!organizationId){setError("Selecciona primero la empresa o sede.");return;}
    const form=new FormData(event.currentTarget);
    const optionLabel=String(form.get("label")||"").trim();
    if(!optionLabel)return;
    setCreating(true);setError("");
    try{
      const response=await fetch("/api/catalogs/"+encodeURIComponent(catalog),{
        method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({organizationId,label:optionLabel,description:String(form.get("description")||"").trim()}),
      });
      const data=await response.json().catch(()=>({})) as {option?:ConfigurableCatalogOption;error?:string};
      if(response.status===409){setError("Ya existe una opción con ese nombre.");return;}
      if(!response.ok||!data.option){setError("No fue posible crear la opción.");return;}
      setOptions(current=>[...current,data.option!].sort((a,b)=>a.label.localeCompare(b.label,"es")));
      const value=optionValue(data.option);
      setSelected(current=>multiple?[...new Set([...current,value])]:[value]);
      setCreateOpen(false);setOpen(false);setSearch("");
    }finally{setCreating(false);}
  }

  const mayCreate=allowCreate&&canCreate;
  const display=chosen.length?chosen.map(option=>option.label).join(", "):(selected.length?selected.join(", "):placeholder);

  return <div className="field configurable-catalog-field" ref={host}>
    <label>{label}{required?" *":""}</label>
    {selected.map(value=><input key={value} type="hidden" name={name} value={value}/>)}
    {required&&<input className="multi-select-required-proxy" aria-hidden="true" tabIndex={-1} required value={selected.join(",")} onChange={()=>{}}/>}
    <button className={"multi-select-trigger configurable-catalog-trigger"+(open?" active":"")} type="button" onClick={()=>setOpen(value=>!value)} aria-expanded={open}>
      <span>{display}</span><b aria-hidden="true">⌄</b>
    </button>
    {open&&<div className="multi-select-popover configurable-catalog-popover">
      <div className="configurable-catalog-search"><UiIcon name="search" size={15}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder={"Buscar "+label.toLowerCase()+"..."} autoFocus/></div>
      <div className="multi-select-options configurable-catalog-options">
        {loading&&<span className="configurable-catalog-empty">Cargando opciones…</span>}
        {!loading&&filtered.map(option=>{
          const active=selected.includes(optionValue(option));
          return <button type="button" key={option.id} className={active?"active":""} onClick={()=>choose(option)}>
            <span><strong>{option.label}</strong><small>{option.origin==="SYSTEM"?"Sistema":"Empresa"}</small></span>
            {active&&<UiIcon name="check" size={14}/>}
          </button>;
        })}
        {!loading&&!filtered.length&&<span className="configurable-catalog-empty">No hay coincidencias.</span>}
      </div>
      {(mayCreate||allowManage||multiple)&&<div className="configurable-catalog-actions">
        {multiple&&<button type="button" onClick={()=>{setOpen(false);setSearch("");}}><UiIcon name="check" size={14}/> Aplicar selección</button>}
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
        <div className="form-span-2 form-actions"><button className="button secondary" type="button" onClick={()=>setCreateOpen(false)}>Cancelar</button><button className="button" type="submit" disabled={creating}>{creating?"Creando…":"Crear opción"}</button></div>
      </form>
    </Modal>
  </div>;
}
