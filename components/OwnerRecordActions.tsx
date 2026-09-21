"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import OwnerDeleteButton from "@/components/OwnerDeleteButton";

export type OwnerEditField = {
  name: string;
  label: string;
  value: string | number | boolean | null;
  type?: "text" | "number" | "date" | "textarea" | "select" | "checkbox";
  options?: Array<{ value: string; label: string }>;
};

export default function OwnerRecordActions({
  table,
  id,
  label,
  fields = [],
  deleteRedirectTo,
}: {
  table: string;
  id: string;
  label: string;
  fields?: OwnerEditField[];
  deleteRedirectTo?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.type === "checkbox") values[field.name] = form.get(field.name) === "on";
      else values[field.name] = form.get(field.name) ?? "";
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/platform-owner/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ table, id, values }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "No fue posible guardar los cambios.");
      setEditing(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="owner-record-actions">
    {fields.length > 0 && <button className="text-button" type="button" onClick={() => setEditing(value => !value)}>
      {editing ? "Cerrar edición" : "Editar"}
    </button>}
    <OwnerDeleteButton table={table} id={id} label={label} redirectTo={deleteRedirectTo} />
    {editing && <form className="owner-record-edit-form" onSubmit={submit}>
      <div className="owner-record-edit-head"><strong>Editar {label}</strong><small>Solo Propietario Desweb</small></div>
      {fields.map(field => <div className="field" key={field.name}>
        <label>{field.label}</label>
        {field.type === "select" ? <select name={field.name} defaultValue={String(field.value ?? "")}>
          {(field.options || []).map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select> : field.type === "textarea" ? <textarea name={field.name} defaultValue={String(field.value ?? "")} rows={3} /> :
        field.type === "checkbox" ? <label className="owner-record-checkbox"><input name={field.name} type="checkbox" defaultChecked={Boolean(field.value)} /><span>Activo</span></label> :
        <input name={field.name} type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} defaultValue={String(field.value ?? "")} step={field.type === "number" ? "any" : undefined} />}
      </div>)}
      {error && <div className="notice error">{error}</div>}
      <div className="form-actions"><button className="button secondary" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button></div>
    </form>}
  </div>;
}
