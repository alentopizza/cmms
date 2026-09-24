"use client";

import { Button } from "@/components/ui-kit/Button";
import { Modal } from "@/components/ui-kit/Overlay";

export type ConfirmDialogVariant="default"|"danger";

type Props={
  open:boolean;
  title:string;
  message:string;
  confirmLabel?:string;
  cancelLabel?:string;
  variant?:ConfirmDialogVariant;
  onConfirm:()=>void;
  onCancel:()=>void;
};

export default function ConfirmDialog({
  open,title,message,confirmLabel="Aceptar",cancelLabel="Cancelar",variant="default",onConfirm,onCancel,
}:Props){
  return <Modal
    open={open}
    onClose={onCancel}
    title={title}
    description={message}
    size="sm"
    role="alertdialog"
    eyebrow={variant==="danger"?"Acción delicada":"Confirmación requerida"}
    footer={<>
      <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
      <Button variant={variant==="danger"?"danger":"primary"} onClick={onConfirm}>{confirmLabel}</Button>
    </>}
  />;
}
