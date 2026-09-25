"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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


export type ViewMode="grid"|"list";

export function ViewModeToggle({
  value,
  onChange,
  label="Modo de visualización",
}:{
  value:ViewMode;
  onChange:(value:ViewMode)=>void;
  label?:string;
}){
  return <div className="ds-view-mode-toggle" role="group" aria-label={label}>
    <button
      type="button"
      className={value==="grid"?"active":""}
      aria-pressed={value==="grid"}
      onClick={()=>onChange("grid")}
      title="Vista cuadrícula"
      data-tooltip="Vista cuadrícula"
    ><UiIcon name="dashboard" size={17}/><span className="ds-visually-hidden">Vista cuadrícula</span></button>
    <button
      type="button"
      className={value==="list"?"active":""}
      aria-pressed={value==="list"}
      onClick={()=>onChange("list")}
      title="Vista listado"
      data-tooltip="Vista listado"
    ><UiIcon name="menu" size={17}/><span className="ds-visually-hidden">Vista listado</span></button>
  </div>;
}

export function CollectionView({
  grid,
  list,
  storageKey,
  label="Vista de la colección",
  defaultMode="grid",
  className="",
  toolbarTargetId="context-header-tools",
}:{
  grid:ReactNode;
  list?:ReactNode;
  storageKey:string;
  label?:string;
  defaultMode?:ViewMode;
  className?:string;
  toolbarTargetId?:string;
}){
  const [mode,setMode]=useState<ViewMode>(defaultMode);
  const [toolbarHost,setToolbarHost]=useState<HTMLElement|null>(null);

  useEffect(()=>{
    setToolbarHost(document.getElementById(toolbarTargetId));
    try{
      const saved=window.localStorage.getItem("cmms:view-mode:"+storageKey);
      if(saved==="grid"||saved==="list")setMode(saved);
    }catch{}
  },[storageKey,toolbarTargetId]);

  useEffect(()=>{
    try{window.localStorage.setItem("cmms:view-mode:"+storageKey,mode);}catch{}
    window.dispatchEvent(new CustomEvent("cmms:view-mode-change",{detail:{storageKey,mode}}));
  },[mode,storageKey]);

  const toggle=<ViewModeToggle value={mode} onChange={setMode} label={label}/>;
  const content=mode==="list"&&list!==undefined?list:grid;

  return <div className={["ds-collection-view","is-"+mode,className].filter(Boolean).join(" ")} data-view-mode={mode}>
    {toolbarHost&&createPortal(toggle,toolbarHost)}
    {content}
  </div>;
}
