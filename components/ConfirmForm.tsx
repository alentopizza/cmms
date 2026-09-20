"use client";

import { useRef, useState, type FormHTMLAttributes } from "react";
import ConfirmationDialog, { type ConfirmationOptions } from "./ConfirmationDialog";

type Props = Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit"> & ConfirmationOptions;

export default function ConfirmForm({ title, message, confirmLabel, danger, children, ...props }: Props) {
  const form = useRef<HTMLFormElement>(null);
  const submitter = useRef<HTMLButtonElement | HTMLInputElement | null>(null);
  const approved = useRef(false);
  const submitting = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  return <>
    <form {...props} ref={form} aria-busy={pending} onSubmit={event => {
      if (submitting.current) { event.preventDefault(); return; }
      if (approved.current) {
        approved.current = false;
        submitting.current = true;
        setPending(true);
        return;
      }
      event.preventDefault();
      submitter.current = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | HTMLInputElement | null;
      setConfirming(true);
    }}>
      {children}
      {pending && <span className="confirmation-pending" role="status">Procesando…</span>}
    </form>
    {confirming && <ConfirmationDialog title={title} message={message} confirmLabel={confirmLabel} danger={danger}
      onCancel={() => setConfirming(false)} onConfirm={() => {
        setConfirming(false);
        if (!form.current?.reportValidity()) return;
        approved.current = true;
        form.current.requestSubmit(submitter.current || undefined);
        approved.current = false;
      }} />}
  </>;
}
