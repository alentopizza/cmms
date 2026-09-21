"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function OwnerDeleteButton({
  table,
  id,
  label,
  redirectTo,
  className = "text-button text-danger",
}: {
  table: string;
  id: string;
  label: string;
  redirectTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function runDelete() {
    setDeleting(true);
    setError("");
    try {
      const response = await fetch("/api/platform-owner/purge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          table,
          id,
          confirmation: "ELIMINAR",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "No fue posible eliminar el registro.");

      setOpen(false);
      if (redirectTo) {
        window.location.assign(redirectTo);
        return;
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible eliminar el registro.");
    } finally {
      setDeleting(false);
    }
  }

  return <>
    <button className={className} type="button" disabled={deleting} onClick={() => setOpen(true)}>
      {deleting ? "Eliminando…" : "Eliminar"}
    </button>
    {error && <span className="owner-inline-delete-error">{error}</span>}
    <ConfirmDialog
      open={open}
      title={"Eliminar " + label}
      message={"Esta acción es exclusiva del Propietario Desweb y eliminará también las dependencias necesarias. No se puede deshacer."}
      confirmLabel="Eliminar definitivamente"
      variant="danger"
      onCancel={() => {
        if (!deleting) setOpen(false);
      }}
      onConfirm={() => void runDelete()}
    />
  </>;
}
