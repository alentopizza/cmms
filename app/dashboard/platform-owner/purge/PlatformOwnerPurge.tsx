"use client";

import { useEffect, useMemo, useState } from "react";

type RecordItem = {
  id: string;
  label: string;
  detail: string;
};

type PurgeResult = {
  table: string;
  id: string;
  label: string;
  deletedRows: number;
  deletedByTable: Record<string, number>;
};

export default function PlatformOwnerPurge() {
  const [tables, setTables] = useState<string[]>([]);
  const [table, setTable] = useState("");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [recordId, setRecordId] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loadingTables, setLoadingTables] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PurgeResult | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/platform-owner/purge", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.message || "No fue posible cargar las tablas.");
        if (!active) return;
        setTables(Array.isArray(payload.tables) ? payload.tables : []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "No fue posible cargar las tablas.");
      } finally {
        if (active) setLoadingTables(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!table) {
      setRecords([]);
      setRecordId("");
      return;
    }
    let active = true;
    setLoadingRecords(true);
    setError("");
    setResult(null);
    void (async () => {
      try {
        const response = await fetch("/api/platform-owner/purge?table=" + encodeURIComponent(table), { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.message || "No fue posible cargar los registros.");
        if (!active) return;
        setRecords(Array.isArray(payload.records) ? payload.records : []);
        setRecordId("");
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "No fue posible cargar los registros.");
      } finally {
        if (active) setLoadingRecords(false);
      }
    })();
    return () => { active = false; };
  }, [table]);

  const selected = useMemo(() => records.find(item => item.id === recordId) || null, [records, recordId]);
  const canDelete = Boolean(table && recordId && confirmation === "ELIMINAR" && !deleting);

  async function purge() {
    if (!canDelete || !selected) return;
    setDeleting(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/platform-owner/purge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ table, id: recordId, confirmation }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || "No fue posible completar la eliminación.");
      setResult(payload.result as PurgeResult);
      setConfirmation("");
      setRecordId("");
      const refresh = await fetch("/api/platform-owner/purge?table=" + encodeURIComponent(table), { cache: "no-store" });
      const refreshPayload = await refresh.json();
      if (refresh.ok) setRecords(Array.isArray(refreshPayload.records) ? refreshPayload.records : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible completar la eliminación.");
    } finally {
      setDeleting(false);
    }
  }

  return <section className="section owner-purge-layout">
    <article className="card owner-purge-panel">
      <div className="owner-purge-warning">
        <span aria-hidden="true">!</span>
        <div>
          <strong>Modo destructivo de desarrollo</strong>
          <p>Este flujo elimina el registro seleccionado y dependencias bloqueadas por llaves foráneas RESTRICT/NO ACTION. Las relaciones CASCADE se eliminan por PostgreSQL. No existe recuperación automática.</p>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}
      {result && <div className="notice success">
        Eliminación completada: <strong>{result.label}</strong>. Filas eliminadas detectadas: {result.deletedRows}.
      </div>}

      <div className="form-grid owner-purge-form">
        <div className="field">
          <label htmlFor="purge-table">Tabla *</label>
          <select id="purge-table" value={table} disabled={loadingTables || deleting} onChange={event => {
            setTable(event.target.value);
            setConfirmation("");
          }}>
            <option value="">{loadingTables ? "Cargando tablas…" : "Selecciona una tabla"}</option>
            {tables.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <small>Se muestran tablas públicas que tienen una columna id.</small>
        </div>

        <div className="field">
          <label htmlFor="purge-record">Registro *</label>
          <select id="purge-record" value={recordId} disabled={!table || loadingRecords || deleting} onChange={event => {
            setRecordId(event.target.value);
            setConfirmation("");
          }}>
            <option value="">{loadingRecords ? "Cargando registros…" : records.length ? "Selecciona un registro" : "No hay registros"}</option>
            {records.map(item => <option key={item.id} value={item.id}>{item.label} · {item.id}</option>)}
          </select>
          <small>Se cargan hasta 150 registros por tabla para evitar listados excesivos.</small>
        </div>

        {selected && <div className="owner-purge-target form-span-2">
          <span>Objetivo seleccionado</span>
          <strong>{selected.label}</strong>
          <code>{table} · {selected.id}</code>
          {selected.detail && <small>{selected.detail}</small>}
        </div>}

        <div className="field form-span-2">
          <label htmlFor="purge-confirmation">Confirmación *</label>
          <input
            id="purge-confirmation"
            value={confirmation}
            disabled={!selected || deleting}
            onChange={event => setConfirmation(event.target.value.toUpperCase())}
            placeholder="Escribe ELIMINAR"
            autoComplete="off"
          />
          <small>La palabra debe coincidir exactamente con ELIMINAR.</small>
        </div>
      </div>

      <div className="owner-purge-actions">
        <button className="button danger-secondary" type="button" disabled={!canDelete} onClick={() => void purge()}>
          {deleting ? "Eliminando dependencias…" : "Eliminar universalmente"}
        </button>
      </div>
    </article>

    <aside className="card owner-purge-help">
      <span className="eyebrow">Alcance</span>
      <h2>Qué hace esta herramienta</h2>
      <ul>
        <li>Solo responde a sesiones <strong>platform_owner</strong>.</li>
        <li>Descubre dependencias usando el catálogo real de PostgreSQL.</li>
        <li>Elimina primero las dependencias RESTRICT/NO ACTION.</li>
        <li>Deja que PostgreSQL ejecute relaciones CASCADE/SET NULL.</li>
        <li>Protege la propia cuenta Propietario Desweb.</li>
        <li>Registra una evidencia de la operación en <code>audit_log</code>.</li>
      </ul>
      <p className="muted">Si PostgreSQL detecta un ciclo restrictivo que no puede resolverse de forma segura, la transacción se revierte completa y no queda una eliminación parcial.</p>
    </aside>
  </section>;
}
