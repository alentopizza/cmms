"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";

export type CompanyDirectoryItem = {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  tax_id: string | null;
  timezone: string;
  active: boolean;
  site_count: string;
  active_site_count: string;
  asset_count: string;
  sublocation_count: string;
  inventory_item_count: string;
  technician_count: string;
  max_sites: string;
  max_sublocations: string;
  max_assets: string;
  max_inventory_items: string;
  max_technicians: string;
  site_id: string | null;
  site_name: string | null;
  site_code: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  has_logo: boolean;
  has_cover: boolean;
};

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

export default function CompanyDirectory({
  companies,
  canManageResources,
}: {
  companies: CompanyDirectoryItem[];
  canManageResources: boolean;
}) {
  const [selected, setSelected] = useState<CompanyDirectoryItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmation, setConfirmation] = useState<"save" | "delete" | null>(null);
  const pendingForm = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !editing) setSelected(null);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("modal-open");
    };
  }, [selected, editing]);

  function close() {
    setConfirmation(null);
    pendingForm.current = null;
    setEditing(false);
    setSelected(null);
  }

  function requestConfirmation(kind: "save" | "delete", event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    pendingForm.current = event.currentTarget;
    setConfirmation(kind);
  }

  function cancelConfirmation() {
    setConfirmation(null);
    pendingForm.current = null;
  }

  function submitConfirmedForm() {
    const form = pendingForm.current;
    setConfirmation(null);
    pendingForm.current = null;
    form?.submit();
  }

  if (companies.length === 0) {
    return <div className="card empty-state"><strong>Aún no hay empresas registradas.</strong><span>Usa el botón “Nueva empresa” para crear la primera.</span></div>;
  }

  return <>
    <div className="company-card-grid">
      {companies.map(company => <article className="company-visual-card" key={company.id}>
        <button className="company-card-button" type="button" onClick={() => {
          setSelected(company);
          setEditing(false);
        }} aria-label={`Ver detalle de ${company.name}`}>
          <div className={`company-card-cover ${company.has_cover ? "" : "company-card-cover-fallback"}`}>
            {company.has_cover && <img src={`/api/organizations/${company.id}/assets/cover`} alt={`Punto de referencia de ${company.name}`} />}
            <span className={`status-badge company-card-status ${company.active ? "status-active" : "status-inactive"}`}>
              <span aria-hidden="true" />{company.active ? "Activa" : "Inactiva"}
            </span>
          </div>

          <div className="company-card-logo">
            {company.has_logo
              ? <img src={`/api/organizations/${company.id}/assets/logo`} alt={`Logo de ${company.name}`} />
              : <span>{initials(company.name)}</span>}
          </div>

          <div className="company-card-content">
            <h3>{company.name}</h3>
            <div className="company-card-location">
              <span>Sede: {company.site_name || "Sin sede principal"}</span>
              <span>{company.city ? `${company.city} · ${company.country || "CO"}` : "Ciudad sin registrar"}</span>
              <span>{company.address || "Dirección sin registrar"}</span>
            </div>

            <div className="company-card-metrics">
              <div><strong>{company.active_site_count}</strong><span>Sedes activas</span><small>{company.site_count} registradas</small></div>
              <div><strong>{company.asset_count}</strong><span>Activos</span><small>Equipos vinculados</small></div>
            </div>

            <span className="company-card-action">Ver detalle <span aria-hidden="true">→</span></span>
          </div>
        </button>
      </article>)}
    </div>

    <ConfirmDialog
      open={confirmation === "save"}
      title="Guardar cambios"
      message="¿Deseas guardar los cambios realizados en esta empresa y su sede principal?"
      confirmLabel="Guardar cambios"
      onCancel={cancelConfirmation}
      onConfirm={submitConfirmedForm}
    />

    <ConfirmDialog
      open={confirmation === "delete"}
      title="Eliminar empresa"
      message="Esta acción eliminará también sus sedes y la información relacionada. No se puede deshacer."
      confirmLabel="Sí, eliminar"
      variant="danger"
      onCancel={cancelConfirmation}
      onConfirm={submitConfirmedForm}
    />

    {selected && <div className="modal-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !editing) close();
    }}>
      <section className="company-modal company-detail-modal" role="dialog" aria-modal="true" aria-labelledby="company-detail-title">
        <header className="company-detail-hero">
          <div className={`company-detail-cover ${selected.has_cover ? "" : "company-card-cover-fallback"}`}>
            {selected.has_cover && <img src={`/api/organizations/${selected.id}/assets/cover`} alt={`Portada de ${selected.name}`} />}
          </div>
          <div className="company-detail-logo">
            {selected.has_logo
              ? <img src={`/api/organizations/${selected.id}/assets/logo`} alt={`Logo de ${selected.name}`} />
              : <span>{initials(selected.name)}</span>}
          </div>
          <button className="modal-close company-detail-close" type="button" aria-label="Cerrar" onClick={close}>×</button>
        </header>

        <div className="company-detail-modal-heading">
          <div>
            <span className={`status-badge ${selected.active ? "status-active" : "status-inactive"}`}><span aria-hidden="true" />{selected.active ? "Empresa activa" : "Empresa inactiva"}</span>
            <h2 id="company-detail-title">{selected.name}</h2>
            <p>{selected.site_name || "Sin sede principal"} · {selected.city || "Ciudad sin registrar"}</p>
          </div>
          <span className="locked-badge"><span aria-hidden="true">{editing ? "✎" : "🔒"}</span>{editing ? "Modo edición" : "Información protegida"}</span>
        </div>

        <form className="company-detail-form" method="post" action={`/api/organizations/${selected.id}`} encType="multipart/form-data" onSubmit={event => requestConfirmation("save", event)}>
          <input type="hidden" name="intent" value="update" />
          <input type="hidden" name="return_to" value="directory" />
          <input type="hidden" name="primary_site_id" value={selected.site_id || ""} />

          <div className="modal-section">
            <div className="modal-section-title"><strong>Información de la empresa</strong><span>{editing ? "Campos habilitados" : "Solo lectura"}</span></div>
            <div className="form-grid">
              <div className="field"><label htmlFor="detail-name">Nombre comercial</label><input id="detail-name" name="name" defaultValue={selected.name} readOnly={!editing} /></div>
              <div className="field"><label htmlFor="detail-legal">Razón social</label><input id="detail-legal" name="legal_name" defaultValue={selected.legal_name || ""} readOnly={!editing} /></div>
              <div className="field"><label htmlFor="detail-tax">NIT / Identificación</label><input id="detail-tax" name="tax_id" defaultValue={selected.tax_id || ""} readOnly={!editing} /></div>
              <div className="field"><label htmlFor="detail-slug">Identificador</label><input id="detail-slug" name="slug" defaultValue={selected.slug} readOnly={!editing} /></div>
              <div className="field form-span-2"><label htmlFor="detail-timezone">Zona horaria</label>
                <select id="detail-timezone" name="timezone" defaultValue={selected.timezone} disabled={!editing}>
                  <option value="America/Bogota">Colombia · America/Bogota</option>
                  <option value="America/Lima">Perú · America/Lima</option>
                  <option value="America/Mexico_City">México · America/Mexico_City</option>
                  <option value="America/New_York">Estados Unidos · America/New_York</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
          </div>

          <div className="modal-section">
            <div className="modal-section-title"><strong>Sede principal</strong><span>{editing ? "Editable" : "Solo lectura"}</span></div>
            <div className="form-grid">
              <div className="field"><label htmlFor="detail-site-name">Nombre de sede</label><input id="detail-site-name" name="site_name" defaultValue={selected.site_name || ""} readOnly={!editing} /></div>
              <div className="field"><label htmlFor="detail-site-code">Código</label><input id="detail-site-code" name="site_code" defaultValue={selected.site_code || ""} readOnly={!editing} /></div>
              <div className="field form-span-2"><label htmlFor="detail-address">Dirección</label><input id="detail-address" name="address" defaultValue={selected.address || ""} readOnly={!editing} /></div>
              <div className="field"><label htmlFor="detail-city">Ciudad</label><input id="detail-city" name="city" defaultValue={selected.city || ""} readOnly={!editing} /></div>
              <div className="field"><label htmlFor="detail-country">País</label><input id="detail-country" name="country" defaultValue={selected.country || "CO"} maxLength={2} readOnly={!editing} /></div>
            </div>
          </div>

          {canManageResources && <div className="modal-section company-resource-section">
            <div className="modal-section-title">
              <strong>Recursos asignados</strong>
              <span>{editing ? "Editable solo por Superadministrador" : "Plan y consumo actual"}</span>
            </div>
            <p className="muted resource-help">Estos cupos controlan la capacidad operativa de la empresa. El Administrador de empresa no puede modificarlos.</p>

            <div className="company-resource-grid">
              <div className="company-resource-item">
                <div className="company-resource-item-head"><span>Ubicaciones principales</span><strong>{selected.site_count} / {selected.max_sites}</strong></div>
                <div className="company-resource-track"><span style={{ width: `${Math.min(100, Number(selected.max_sites) > 0 ? (Number(selected.site_count) / Number(selected.max_sites)) * 100 : 0)}%` }} /></div>
                {editing && <div className="field"><label htmlFor="detail-max-sites">Cupo asignado</label><input id="detail-max-sites" name="max_sites" type="number" min="1" defaultValue={selected.max_sites} required /></div>}
              </div>

              <div className="company-resource-item">
                <div className="company-resource-item-head"><span>Sububicaciones</span><strong>{selected.sublocation_count} / {selected.max_sublocations}</strong></div>
                <div className="company-resource-track"><span style={{ width: `${Math.min(100, Number(selected.max_sublocations) > 0 ? (Number(selected.sublocation_count) / Number(selected.max_sublocations)) * 100 : 0)}%` }} /></div>
                {editing && <div className="field"><label htmlFor="detail-max-sublocations">Cupo asignado</label><input id="detail-max-sublocations" name="max_sublocations" type="number" min="0" defaultValue={selected.max_sublocations} required /></div>}
              </div>

              <div className="company-resource-item">
                <div className="company-resource-item-head"><span>Activos</span><strong>{selected.asset_count} / {selected.max_assets}</strong></div>
                <div className="company-resource-track"><span style={{ width: `${Math.min(100, Number(selected.max_assets) > 0 ? (Number(selected.asset_count) / Number(selected.max_assets)) * 100 : 0)}%` }} /></div>
                {editing && <div className="field"><label htmlFor="detail-max-assets">Cupo asignado</label><input id="detail-max-assets" name="max_assets" type="number" min="0" defaultValue={selected.max_assets} required /></div>}
              </div>

              <div className="company-resource-item">
                <div className="company-resource-item-head"><span>Artículos de inventario</span><strong>{selected.inventory_item_count} / {selected.max_inventory_items}</strong></div>
                <div className="company-resource-track"><span style={{ width: `${Math.min(100, Number(selected.max_inventory_items) > 0 ? (Number(selected.inventory_item_count) / Number(selected.max_inventory_items)) * 100 : 0)}%` }} /></div>
                {editing && <div className="field"><label htmlFor="detail-max-inventory">Cupo asignado</label><input id="detail-max-inventory" name="max_inventory_items" type="number" min="0" defaultValue={selected.max_inventory_items} required /></div>}
              </div>

              <div className="company-resource-item">
                <div className="company-resource-item-head"><span>Técnicos</span><strong>{selected.technician_count} / {selected.max_technicians}</strong></div>
                <div className="company-resource-track"><span style={{ width: `${Math.min(100, Number(selected.max_technicians) > 0 ? (Number(selected.technician_count) / Number(selected.max_technicians)) * 100 : 0)}%` }} /></div>
                {editing && <div className="field"><label htmlFor="detail-max-technicians">Cupo asignado</label><input id="detail-max-technicians" name="max_technicians" type="number" min="0" defaultValue={selected.max_technicians} required /></div>}
              </div>
            </div>
          </div>}

          {editing && <div className="modal-section">
            <div className="modal-section-title"><strong>Actualizar imágenes</strong><span>Opcional</span></div>
            <div className="form-grid">
              <div className="field"><label htmlFor="detail-logo">Logo</label><input id="detail-logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" /><small>PNG, JPG o WebP · cuadrado · 800 × 800 px recomendado · máximo 2 MB.</small></div>
              <div className="field"><label htmlFor="detail-cover">Foto de portada</label><input id="detail-cover" name="cover" type="file" accept="image/png,image/jpeg,image/webp" /><small>PNG, JPG o WebP · horizontal · 1600 × 700 px recomendado · máximo 5 MB.</small></div>
            </div>
          </div>}

          {editing && <footer className="modal-actions detail-edit-actions">
            <button className="button secondary" type="button" onClick={() => setEditing(false)}>Cancelar edición</button>
            <button className="button" type="submit">Guardar cambios</button>
          </footer>}
        </form>

        {!editing && <footer className="company-detail-actions">
          <div>
            <form method="post" action={`/api/organizations/${selected.id}`} onSubmit={event => requestConfirmation("delete", event)}>
              <input type="hidden" name="intent" value="delete" />
              <button className="button danger-secondary" type="submit">Eliminar empresa</button>
            </form>
          </div>
          <div>
            <Link className="button secondary" href={`/dashboard/companies/${selected.id}`}>Administrar sedes</Link>
            <button className="button" type="button" onClick={() => setEditing(true)}>Editar información</button>
          </div>
        </footer>}
      </section>
    </div>}
  </>;
}
