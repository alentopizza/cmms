"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import UiIcon from "@/components/UiIcon";

export type AdvancedSelectOption={value:string;label:string;disabled?:boolean};

type MultiSelectProps={
  name?:string;
  label?:string;
  options:AdvancedSelectOption[];
  defaultValues?:string[];
  value?:string[];
  onChange?:(values:string[])=>void;
  placeholder?:string;
  required?:boolean;
  helperText?:string;
  errorMessage?:string;
  disabled?:boolean;
  searchable?:boolean;
  loading?:boolean;
};

export function MultiSelect({
  name,label,options,defaultValues=[],value,onChange,placeholder="Selecciona una o varias opciones",
  required=false,helperText,errorMessage,disabled=false,searchable=true,loading=false,
}:MultiSelectProps){
  const id=useId().replace(/:/g,"");
  const [open,setOpen]=useState(false);
  const [internal,setInternal]=useState(defaultValues);
  const [query,setQuery]=useState("");
  const host=useRef<HTMLDivElement>(null);
  const selected=value??internal;

  useEffect(()=>{if(value===undefined)setInternal(defaultValues);},[JSON.stringify(defaultValues),value]);

  useEffect(()=>{
    if(!open)return;
    const pointer=(event:MouseEvent)=>{if(host.current&&!host.current.contains(event.target as Node))setOpen(false);};
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape"){setOpen(false);host.current?.querySelector<HTMLElement>(".ds-multiselect-trigger")?.focus();}};
    document.addEventListener("mousedown",pointer);
    document.addEventListener("keydown",key);
    return()=>{document.removeEventListener("mousedown",pointer);document.removeEventListener("keydown",key);};
  },[open]);

  const visible=useMemo(()=>{
    const normalized=query.trim().toLocaleLowerCase("es");
    return normalized?options.filter(option=>option.label.toLocaleLowerCase("es").includes(normalized)):options;
  },[options,query]);

  const labels=options.filter(option=>selected.includes(option.value)).map(option=>option.label);
  const feedback=errorMessage||helperText;

  function commit(next:string[]){
    if(value===undefined)setInternal(next);
    onChange?.(next);
  }
  function toggle(option:string){
    commit(selected.includes(option)?selected.filter(item=>item!==option):[...selected,option]);
  }

  return <div className={["ds-field","ds-multiselect",errorMessage?"ds-field-error":""].filter(Boolean).join(" ")} ref={host}>
    {label&&<label className="ds-field-label" id={id+"-label"}>{label}{required&&<span aria-hidden="true"> *</span>}</label>}
    <button
      type="button"
      className="ds-multiselect-trigger"
      aria-labelledby={label?id+"-label":undefined}
      aria-expanded={open}
      aria-haspopup="listbox"
      disabled={disabled}
      onClick={()=>setOpen(current=>!current)}
    >
      <span className={labels.length?"":"placeholder"}>{labels.length?labels.join(", "):placeholder}</span>
      {loading?<span className="ds-spinner ds-spinner-sm" aria-hidden="true"/>:<UiIcon name="chevron-down" size={15}/>}
    </button>

    {name&&selected.map(item=><input key={item} type="hidden" name={name} value={item}/>)}
    {required&&<input className="ds-required-proxy" tabIndex={-1} aria-hidden="true" required value={selected.join(",")} onChange={()=>{}}/>}

    {open&&<div className="ds-multiselect-popover">
      {searchable&&<label className="ds-multiselect-search">
        <UiIcon name="search" size={15}/>
        <input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar…" autoFocus aria-label="Buscar opciones"/>
      </label>}
      <div className="ds-multiselect-actions">
        <button type="button" onClick={()=>commit(options.filter(option=>!option.disabled).map(option=>option.value))}>Seleccionar todo</button>
        <button type="button" onClick={()=>commit([])}>Limpiar</button>
      </div>
      <div className="ds-multiselect-options" role="listbox" aria-multiselectable="true">
        {visible.map(option=><label key={option.value} className={selected.includes(option.value)?"active":""}>
          <input type="checkbox" disabled={option.disabled} checked={selected.includes(option.value)} onChange={()=>toggle(option.value)}/>
          <span>{option.label}</span>
        </label>)}
        {!visible.length&&<p className="ds-multiselect-empty">No hay coincidencias.</p>}
      </div>
    </div>}
    {feedback&&<small className="ds-field-feedback" role={errorMessage?"alert":undefined}>{errorMessage&&<UiIcon name="error" size={13}/>}<span>{feedback}</span></small>}
  </div>;
}

type SearchSelectProps={
  name?:string;
  label?:string;
  options:AdvancedSelectOption[];
  value?:string;
  defaultValue?:string;
  onChange?:(value:string)=>void;
  placeholder?:string;
  helperText?:string;
  errorMessage?:string;
  disabled?:boolean;
  loading?:boolean;
};

export function SearchSelect({
  name,label,options,value,defaultValue="",onChange,placeholder="Selecciona…",helperText,errorMessage,disabled=false,loading=false,
}:SearchSelectProps){
  const [internal,setInternal]=useState(defaultValue);
  const [query,setQuery]=useState("");
  const [open,setOpen]=useState(false);
  const host=useRef<HTMLDivElement>(null);
  const selected=value??internal;
  const selectedOption=options.find(option=>option.value===selected);

  useEffect(()=>{
    if(!open)return;
    const pointer=(event:MouseEvent)=>{if(host.current&&!host.current.contains(event.target as Node))setOpen(false);};
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
    document.addEventListener("mousedown",pointer);
    document.addEventListener("keydown",key);
    return()=>{document.removeEventListener("mousedown",pointer);document.removeEventListener("keydown",key);};
  },[open]);

  const visible=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase("es");
    return q?options.filter(option=>option.label.toLocaleLowerCase("es").includes(q)):options;
  },[options,query]);

  function commit(next:string){
    if(value===undefined)setInternal(next);
    onChange?.(next);
    setOpen(false);
    setQuery("");
  }

  return <div className={["ds-field","ds-search-select",errorMessage?"ds-field-error":""].filter(Boolean).join(" ")} ref={host}>
    {label&&<span className="ds-field-label">{label}</span>}
    <button className="ds-multiselect-trigger" type="button" disabled={disabled} aria-expanded={open} aria-haspopup="listbox" onClick={()=>setOpen(current=>!current)}>
      <span className={selectedOption?"":"placeholder"}>{selectedOption?.label||placeholder}</span>
      {loading?<span className="ds-spinner ds-spinner-sm"/>:<UiIcon name="chevron-down" size={15}/>}
    </button>
    {name&&<input type="hidden" name={name} value={selected}/>}
    {open&&<div className="ds-multiselect-popover">
      <label className="ds-multiselect-search"><UiIcon name="search" size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} autoFocus placeholder="Buscar…" aria-label="Buscar opciones"/></label>
      <div className="ds-multiselect-options" role="listbox">
        {visible.map(option=><button type="button" role="option" aria-selected={selected===option.value} disabled={option.disabled} key={option.value} onClick={()=>commit(option.value)}>{option.label}</button>)}
        {!visible.length&&<p className="ds-multiselect-empty">No hay coincidencias.</p>}
      </div>
    </div>}
    {(errorMessage||helperText)&&<small className="ds-field-feedback" role={errorMessage?"alert":undefined}>{errorMessage&&<UiIcon name="error" size={13}/>}<span>{errorMessage||helperText}</span></small>}
  </div>;
}

export function AsyncSelect({
  loadOptions,
  minimumQueryLength=2,
  ...props
}:Omit<SearchSelectProps,"options"|"loading">&{
  loadOptions:(query:string)=>Promise<AdvancedSelectOption[]>;
  minimumQueryLength?:number;
}){
  const [options,setOptions]=useState<AdvancedSelectOption[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  // The consumer may explicitly preload by passing minimumQueryLength=0.
  useEffect(()=>{
    if(minimumQueryLength>0)return;
    let active=true;
    setLoading(true);
    loadOptions("").then(result=>{if(active)setOptions(result);}).catch(()=>{if(active)setError("No fue posible cargar las opciones.");}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[loadOptions,minimumQueryLength]);

  return <SearchSelect {...props} options={options} loading={loading} errorMessage={props.errorMessage||error} />;
}
