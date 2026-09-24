"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import UiIcon, { type UiIconName } from "@/components/UiIcon";

export function Tooltip({content,children,placement="top"}:{content:string;children:ReactNode;placement?:"top"|"bottom"|"left"|"right"}){
  const id=useId();
  return <span className={["ds-tooltip","ds-tooltip-"+placement].join(" ")}>
    <span className="ds-tooltip-anchor" tabIndex={0} aria-describedby={id}>{children}</span>
    <span className="ds-tooltip-content" role="tooltip" id={id}>{content}</span>
  </span>;
}

export type DropdownItemProps={
  label:string;
  icon?:UiIconName;
  danger?:boolean;
  disabled?:boolean;
  onSelect?:()=>void;
};

export function Dropdown({
  trigger,
  items,
  align="end",
  label="Menú",
}:{
  trigger:ReactNode;
  items:DropdownItemProps[];
  align?:"start"|"end";
  label?:string;
}){
  const [open,setOpen]=useState(false);
  const host=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!open)return;
    const pointer=(event:MouseEvent)=>{if(host.current&&!host.current.contains(event.target as Node))setOpen(false);};
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape"){setOpen(false);host.current?.querySelector<HTMLElement>(".ds-dropdown-trigger")?.focus();}};
    document.addEventListener("mousedown",pointer);
    document.addEventListener("keydown",key);
    return()=>{document.removeEventListener("mousedown",pointer);document.removeEventListener("keydown",key);};
  },[open]);

  return <div className="ds-dropdown" ref={host}>
    <button type="button" className="ds-dropdown-trigger" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>
      {trigger}
    </button>
    {open&&<div className={["ds-dropdown-menu","ds-dropdown-"+align].join(" ")} role="menu" aria-label={label}>
      {items.map((item,index)=><button
        type="button"
        role="menuitem"
        key={item.label+index}
        className={item.danger?"danger":""}
        disabled={item.disabled}
        onClick={()=>{item.onSelect?.();setOpen(false);}}
      >
        {item.icon&&<UiIcon name={item.icon} size={15}/>}
        <span>{item.label}</span>
      </button>)}
    </div>}
  </div>;
}
