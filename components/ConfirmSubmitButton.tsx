"use client";

import { useRef, useState } from "react";
import ConfirmDialog, { type ConfirmDialogVariant } from "@/components/ConfirmDialog";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  confirmation: string;
  confirmationTitle?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
};

export default function ConfirmSubmitButton({
  confirmation,
  confirmationTitle = "Confirmar acción",
  confirmLabel = "Aceptar",
  cancelLabel = "Cancelar",
  variant = "default",
  onClick,
  ...props
}: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  return <>
    <button
      {...props}
      ref={buttonRef}
      onClick={event => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        setOpen(true);
      }}
    />

    <ConfirmDialog
      open={open}
      title={confirmationTitle}
      message={confirmation}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      variant={variant}
      onCancel={() => setOpen(false)}
      onConfirm={() => {
        const button = buttonRef.current;
        const form = button?.form;
        setOpen(false);
        if (form && button) form.requestSubmit(button);
      }}
    />
  </>;
}
