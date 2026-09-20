"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

export type ConfirmDialogVariant = "default" | "danger";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Aceptar",
  cancelLabel = "Cancelar",
  variant = "default",
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => cancelRef.current?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("confirm-dialog-open");

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("confirm-dialog-open");
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, onCancel]);

  if (!open || typeof document === "undefined") return null;

  const isDanger = variant === "danger";

  return createPortal(
    <div
      className="confirm-dialog-backdrop"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className={`confirm-dialog confirm-dialog-${variant}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="confirm-dialog-mark" aria-hidden="true">
          {isDanger ? "!" : "✓"}
        </div>

        <div className="confirm-dialog-content">
          <span className="confirm-dialog-kicker">
            {isDanger ? "Acción delicada" : "Confirmación requerida"}
          </span>
          <h2 id={titleId}>{title}</h2>
          <p id={descriptionId}>{message}</p>
        </div>

        <div className="confirm-dialog-actions">
          <button ref={cancelRef} className="button secondary" type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`button ${isDanger ? "confirm-dialog-danger-action" : ""}`}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
