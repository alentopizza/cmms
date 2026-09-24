"use client";

import { useEffect, useRef, useState } from "react";

export type MultiSelectOption={value:string;label:string};

export default function MultiSelectDropdown({
  name,
  label,
  options,
  defaultValues=[],
  placeholder="Selecciona una o varias opciones",
  required=false,
  help,
}:{
  name:string;
  label:string;
  options:MultiSelectOption[];
  defaultValues?:string[];
  placeholder?:string;
  required?:boolean;
  help?:string;
}){
  const [open,setOpen]=useState(false);
  const [selected,setSelected]=useState<string[]>(defaultValues);
  const host=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    setSelected(defaultValues);
  },[JSON.stringify(defaultValues)]);

  useEffect(()=>{
    if(!open)return;
    const pointer=(event:MouseEvent)=>{
      if(host.current&&!host.current.contains(event.target as Node))setOpen(false);
    };
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false)};
    document.addEventListener("mousedown",pointer);
    document.addEventListener("keydown",key);
    return()=>{document.removeEventListener("mousedown",pointer);document.removeEventListener("keydown",key)};
  },[open]);

  const labels=options.filter(option=>selected.includes(option.value)).map(option=>option.label);

  function toggle(value:string){
    setSelected(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value]);
  }

  return <div className="field multi-select-field" ref={host}>
    <label>{label}{required?" *":""}</label>
    <button type="button" className={"multi-select-trigger"+(open?" active":"")} onClick={()=>setOpen(value=>!value)} aria-expanded={open}>
      <span>{labels.length?labels.join(", "):placeholder}</span>
      <b aria-hidden="true">⌄</b>
    </button>
    {selected.map(value=><input key={value} type="hidden" name={name} value={value}/>)}
    {required&&<input className="multi-select-required-proxy" aria-hidden="true" tabIndex={-1} required value={selected.join(",")} onChange={()=>{}}/>}
    {open&&<div className="multi-select-popover">
      <div className="multi-select-actions">
        <button type="button" onClick={()=>setSelected(options.map(option=>option.value))}>Seleccionar todo</button>
        <button type="button" onClick={()=>setSelected([])}>Limpiar</button>
      </div>
      <div className="multi-select-options">
        {options.map(option=><label key={option.value} className={selected.includes(option.value)?"active":""}>
          <input type="checkbox" checked={selected.includes(option.value)} onChange={()=>toggle(option.value)}/>
          <span>{option.label}</span>
        </label>)}
      </div>
    </div>}
    {help&&<small>{help}</small>}
  </div>;
}
