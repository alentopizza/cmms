"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

export type ConfirmationOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
};

export default function ConfirmationDialog({ title = "Guardar cambios", message, confirmLabel = "Sí, guardar cambios", danger = false, onCancel, onConfirm }: ConfirmationOptions & { onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const dialog = ref.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    // Safest action is focused first. Native modal dialog traps keyboard focus.
    dialog.querySelector<HTMLButtonElement>("[data-cancel]")?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(<dialog ref={ref} className={`confirmation-dialog ${danger ? "confirmation-danger" : ""}`} aria-labelledby={titleId} aria-describedby={messageId}
    onCancel={event => { event.preventDefault(); onCancel(); }}
    onKeyDown={event => { if (event.key === "Escape") event.stopPropagation(); }}>
    <div className="confirmation-content">
      <div className="confirmation-symbol" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {danger ? <><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" /></> : <><path d="M5 3h12l4 4v14H3V3h2zM7 3v6h10V3M7 21v-8h10v8" /></>}
        </svg>
      </div>
      <span className="eyebrow">{danger ? "Acción irreversible" : "Confirmar cambios"}</span>
      <h2 id={titleId}>{title}</h2>
      <p id={messageId}>{message}</p>
    </div>
    <footer className="confirmation-actions">
      <button type="button" className="button secondary" data-cancel onClick={onCancel}>Cancelar</button>
      <button type="button" className={`button ${danger ? "confirmation-delete" : ""}`} onClick={onConfirm}>{confirmLabel}</button>
    </footer>
  </dialog>, document.body);
}
