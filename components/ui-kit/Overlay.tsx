"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import UiIcon from "@/components/UiIcon";
import { IconButton } from "@/components/ui-kit/Button";

type OverlaySize="sm"|"md"|"lg";

function useOverlay(open:boolean,onClose:()=>void){
  const panelRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    if(!open)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const timer=window.setTimeout(()=>{
      const target=panelRef.current?.querySelector<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
      target?.focus();
    },0);
    const key=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();onClose();return;}
      if(event.key!=="Tab"||!panelRef.current)return;
      const focusable=Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'));
      if(!focusable.length)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener("keydown",key);
    document.body.classList.add("ds-overlay-open");
    return()=>{
      window.clearTimeout(timer);
      document.removeEventListener("keydown",key);
      document.body.classList.remove("ds-overlay-open");
      if(previous?.isConnected)previous.focus();
    };
  },[open,onClose]);
  return panelRef;
}

export function Modal({
  open,onClose,title,description,children,footer,size="md",closeLabel="Cerrar",role="dialog",
}:{
  open:boolean;onClose:()=>void;title:string;description?:string;children?:ReactNode;footer?:ReactNode;size?:OverlaySize;closeLabel?:string;role?:"dialog"|"alertdialog";
}){
  const titleId=useId(),descriptionId=useId();
  const ref=useOverlay(open,onClose);
  if(!open||typeof document==="undefined")return null;
  return createPortal(<div className="ds-overlay-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section ref={ref as React.RefObject<HTMLElement>} className={["ds-modal","ds-modal-"+size].join(" ")} role={role} aria-modal="true" aria-labelledby={titleId} aria-describedby={description?descriptionId:undefined}>
      <header className="ds-overlay-header">
        <div><h2 id={titleId}>{title}</h2>{description&&<p id={descriptionId}>{description}</p>}</div>
        <IconButton icon="x" label={closeLabel} variant="ghost" onClick={onClose}/>
      </header>
      {children&&<div className="ds-overlay-body">{children}</div>}
      {footer&&<footer className="ds-overlay-footer">{footer}</footer>}
    </section>
  </div>,document.body);
}

export function Drawer({
  open,onClose,title,description,children,footer,side="right",
}:{
  open:boolean;onClose:()=>void;title:string;description?:string;children?:ReactNode;footer?:ReactNode;side?:"left"|"right";
}){
  const titleId=useId(),descriptionId=useId();
  const ref=useOverlay(open,onClose);
  if(!open||typeof document==="undefined")return null;
  return createPortal(<div className="ds-overlay-backdrop ds-drawer-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <aside ref={ref as React.RefObject<HTMLElement>} className={["ds-drawer","ds-drawer-"+side].join(" ")} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description?descriptionId:undefined}>
      <header className="ds-overlay-header">
        <div><h2 id={titleId}>{title}</h2>{description&&<p id={descriptionId}>{description}</p>}</div>
        <IconButton icon="x" label="Cerrar" variant="ghost" onClick={onClose}/>
      </header>
      {children&&<div className="ds-overlay-body">{children}</div>}
      {footer&&<footer className="ds-overlay-footer">{footer}</footer>}
    </aside>
  </div>,document.body);
}
