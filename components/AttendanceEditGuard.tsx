"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui-kit/Overlay";
import UiIcon from "@/components/UiIcon";

export default function AttendanceEditGuard({
  title,
  description,
  triggerLabel="Editar",
  children,
}:{
  title:string;
  description:string;
  triggerLabel?:string;
  children:ReactNode;
}){
  const [warningOpen,setWarningOpen]=useState(false);
  const [editOpen,setEditOpen]=useState(false);
  const [saveOpen,setSaveOpen]=useState(false);
  const [form,setForm]=useState<HTMLFormElement|null>(null);

  function beginEdit(){
    setWarningOpen(false);
    setEditOpen(true);
  }

  function requestSave(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    setForm(event.currentTarget);
    setSaveOpen(true);
  }

  function confirmSave(){
    setSaveOpen(false);
    form?.submit();
  }

  return <>
    <button className="button secondary" type="button" onClick={()=>setWarningOpen(true)}>
      <UiIcon name="edit" size={14}/>{triggerLabel}
    </button>

    <Modal
      open={warningOpen}
      onClose={()=>setWarningOpen(false)}
      title={"Editar "+title}
      eyebrow="Advertencia"
      description="Los cambios se aplicarán a la operación de asistencia de esta empresa."
      size="sm"
      footer={<>
        <button className="button secondary" type="button" onClick={()=>setWarningOpen(false)}>Cancelar</button>
        <button className="button" type="button" onClick={beginEdit}>Continuar a edición</button>
      </>}
    >
      <p className="muted">{description}</p>
    </Modal>

    <Modal
      open={editOpen}
      onClose={()=>setEditOpen(false)}
      title={title}
      eyebrow="Configuración de asistencia"
      description={description}
      size="lg"
      className="attendance-inline-edit-modal"
    >
      <div onSubmitCapture={event=>{
        const target=event.target;
        if(target instanceof HTMLFormElement)requestSave(event as unknown as React.FormEvent<HTMLFormElement>);
      }}>{children}</div>
    </Modal>

    <Modal
      open={saveOpen}
      onClose={()=>setSaveOpen(false)}
      title="Confirmar cambios"
      eyebrow="Guardar configuración"
      description="Revisa la información antes de guardar. Esta acción modifica la configuración vigente de Asistencia."
      size="sm"
      footer={<>
        <button className="button secondary" type="button" onClick={()=>setSaveOpen(false)}>Volver a revisar</button>
        <button className="button" type="button" onClick={confirmSave}>Guardar cambios</button>
      </>}
    >
      <p className="muted">Los cambios entrarán en vigor inmediatamente según las reglas actuales del módulo.</p>
    </Modal>
  </>;
}
