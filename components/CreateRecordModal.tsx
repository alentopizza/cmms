"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui-kit/Button";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import { Modal } from "@/components/ui-kit/Overlay";

export default function CreateRecordModal({
  title,
  eyebrow,
  description,
  triggerLabel,
  icon="+",
  iconName,
  disabled=false,
  children,
}:{
  title:string;
  eyebrow:string;
  description?:string;
  triggerLabel:string;
  icon?:string;
  iconName?:UiIconName;
  disabled?:boolean;
  children:ReactNode;
}){
  const [open,setOpen]=useState(false);

  return <>
    <Button className="module-add-button" disabled={disabled} onClick={()=>setOpen(true)}>
      <span className="module-add-button-icon" aria-hidden="true">{iconName?<UiIcon name={iconName} size={15}/>:icon}</span>
      <span>{triggerLabel}</span>
    </Button>
    <Modal
      open={open}
      onClose={()=>setOpen(false)}
      title={title}
      eyebrow={eyebrow}
      description={description}
      size="lg"
      className="unified-create-modal"
      headerClassName="unified-create-modal-header"
      bodyClassName="unified-create-modal-body"
    >
      {children}
    </Modal>
  </>;
}
