"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import UiIcon, { type UiIconName } from "@/components/UiIcon";

export default function OwnerDeleteButton({
  table,
  id,
  label,
  redirectTo,
  className = "text-button text-danger",
  tooltip,
  icon,
  iconName,
  iconOnly=false,
}: {
  table: string;
  id: string;
  label: string;
  redirectTo?: string;
  className?: string;
  tooltip?: string;
  icon?: string;
  iconName?: UiIconName;
  iconOnly?: boolean;
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
    <button
      className={className}
      type="button"
      disabled={deleting}
      data-tooltip={tooltip}
      onClick={() => setOpen(true)}
    >
      {iconName && <UiIcon name={iconName} size={15}/>}
      {icon && <i aria-hidden="true">{icon}</i>}
      <span className={iconOnly?"ds-visually-hidden":undefined}>{deleting ? "Eliminando…" : "Eliminar"}</span>
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
