"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function CreateRecordModal({
  title,
  eyebrow,
  description,
  triggerLabel,
  icon = "+",
  disabled = false,
  children,
}: {
  title: string;
  eyebrow: string;
  description?: string;
  triggerLabel: string;
  icon?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [open,setOpen]=useState(false);
  const [portalHost,setPortalHost]=useState<HTMLElement|null>(null);

  useEffect(()=>{ setPortalHost(document.body); },[]);

  useEffect(()=>{
    if(!open) return;
    const key=(event:KeyboardEvent)=>{ if(event.key==="Escape") setOpen(false); };
    document.addEventListener("keydown",key);
    document.body.classList.add("modal-open");
    return ()=>{
      document.removeEventListener("keydown",key);
      document.body.classList.remove("modal-open");
    };
  },[open]);

  return <>
    <button className="button module-add-button" type="button" disabled={disabled} onClick={()=>setOpen(true)}>
      <span className="module-add-button-icon" aria-hidden="true">{icon}</span>
      <span>{triggerLabel}</span>
    </button>
    {open && portalHost && createPortal(<div className="modal-backdrop unified-create-backdrop" role="presentation" onMouseDown={event=>{
      if(event.target===event.currentTarget) setOpen(false);
    }}>
      <section className="company-modal unified-create-modal" role="dialog" aria-modal="true">
        <header className="modal-header unified-create-modal-header">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="modal-close" type="button" aria-label="Cerrar" onClick={()=>setOpen(false)}>×</button>
        </header>
        <div className="unified-create-modal-body">{children}</div>
      </section>
    </div>,portalHost)}
  </>;
}
