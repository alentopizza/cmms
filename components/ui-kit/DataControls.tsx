"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import UiIcon from "@/components/UiIcon";

export function Search({
  value,
  defaultValue="",
  onValueChange,
  placeholder="Buscar…",
  ariaLabel="Buscar",
  busy=false,
  compact=false,
  className="",
}:{
  value?:string;
  defaultValue?:string;
  onValueChange?:(value:string)=>void;
  placeholder?:string;
  ariaLabel?:string;
  busy?:boolean;
  compact?:boolean;
  className?:string;
}){
  const [internal,setInternal]=useState(defaultValue);
  const current=value===undefined?internal:value;
  function update(next:string){
    if(value===undefined)setInternal(next);
    onValueChange?.(next);
  }
  return <div className={["ds-search",compact?"ds-search-compact":"",className].filter(Boolean).join(" ")} role="search">
    <UiIcon name="search" size={16}/>
    <input
      type="search"
      value={current}
      onChange={event=>update(event.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-busy={busy||undefined}
    />
    {busy?<span className="ds-spinner ds-spinner-sm" aria-hidden="true"/>:current&&<button type="button" onClick={()=>update("")} aria-label="Limpiar búsqueda"><UiIcon name="x" size={14}/></button>}
  </div>;
}

export function FilterPanel({
  children,
  activeCount=0,
  label="Filtros",
  onClear,
  align="end",
  className="",
}:{
  children:ReactNode;
  activeCount?:number;
  label?:string;
  onClear?:()=>void;
  align?:"start"|"end";
  className?:string;
}){
  const [open,setOpen]=useState(false);
  const host=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    if(!open)return;
    const pointer=(event:MouseEvent)=>{
      if(host.current&&!host.current.contains(event.target as Node))setOpen(false);
    };
    const key=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){
        setOpen(false);
        host.current?.querySelector<HTMLElement>(".ds-filter-trigger")?.focus();
      }
    };
    document.addEventListener("mousedown",pointer);
    document.addEventListener("keydown",key);
    return()=>{document.removeEventListener("mousedown",pointer);document.removeEventListener("keydown",key);};
  },[open]);

  return <div className={["ds-filter",className].filter(Boolean).join(" ")} ref={host}>
    <button
      type="button"
      className={"ds-filter-trigger"+(activeCount?" active":"")}
      onClick={()=>setOpen(value=>!value)}
      aria-expanded={open}
      aria-haspopup="dialog"
    >
      <UiIcon name="filter" size={16}/>
      <span>{label}</span>
      {activeCount>0&&<strong aria-label={activeCount+" filtros activos"}>{activeCount}</strong>}
      <UiIcon name="chevron-down" size={14}/>
    </button>
    {open&&<div className={"ds-filter-popover ds-filter-"+align} role="dialog" aria-label={label}>
      <header className="ds-filter-head">
        <div><strong>{label}</strong><small>{activeCount?activeCount+" activos":"Sin filtros activos"}</small></div>
        <button type="button" onClick={()=>setOpen(false)} aria-label="Cerrar filtros"><UiIcon name="x" size={16}/></button>
      </header>
      <div className="ds-filter-body">{children}</div>
      {onClear&&<footer className="ds-filter-footer">
        <button type="button" onClick={onClear} disabled={activeCount===0}>Limpiar filtros</button>
      </footer>}
    </div>}
  </div>;
}

export function FilterGroup({label,children}:{label:string;children:ReactNode}){
  return <section className="ds-filter-group">
    <span>{label}</span>
    <div>{children}</div>
  </section>;
}
