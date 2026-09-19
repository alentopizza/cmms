"use client";

import { useEffect, useState } from "react";

export default function NewCompanyModal({ error }: { error?: string }) {
  const [open, setOpen] = useState(Boolean(error));
  const [logoPreview, setLogoPreview] = useState("");
  const [coverPreview, setCoverPreview] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("modal-open");
    };
  }, [open]);

  function previewFile(file: File | undefined, setter: (value: string) => void) {
    if (!file) return setter("");
    setter(URL.createObjectURL(file));
  }

  const errorMessages: Record<string, string> = {
    required: "Completa los campos obligatorios.",
    "image-required": "Debes cargar el logo y la foto de portada.",
    "image-type": "Las imágenes deben ser PNG, JPG o WebP.",
    "image-size": "Una de las imágenes supera el tamaño permitido.",
  };
  const errorMessage = error ? errorMessages[error] || "No se pudo crear la empresa." : "";

  return <>
    <button className="button company-new-button" type="button" onClick={() => setOpen(true)}>
      <span aria-hidden="true">＋</span>
      Nueva empresa
    </button>

    {open && <div className="modal-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) setOpen(false);
    }}>
      <section className="company-modal" role="dialog" aria-modal="true" aria-labelledby="new-company-title">
        <header className="modal-header">
          <div>
            <span className="eyebrow">Nuevo registro</span>
            <h2 id="new-company-title">Crear empresa</h2>
            <p>Registra la empresa, su sede principal y las imágenes que identificarán su tarjeta.</p>
          </div>
          <button className="modal-close" type="button" aria-label="Cerrar" onClick={() => setOpen(false)}>×</button>
        </header>

        {errorMessage && <div className="notice error modal-error">{errorMessage}</div>}

        <form className="company-modal-form" method="post" action="/api/organizations" encType="multipart/form-data">
          <div className="modal-section">
            <div className="modal-section-title"><strong>Identidad visual</strong><span>PNG, JPG o WebP</span></div>
            <div className="company-upload-grid">
              <label className="company-upload company-upload-logo">
                <span className="company-upload-preview">
                  {logoPreview ? <img src={logoPreview} alt="Vista previa del logo" /> : <span aria-hidden="true">LOGO</span>}
                </span>
                <strong>Cargar logo</strong>
                <small>PNG, JPG o WebP · cuadrada · 800 × 800 px recomendado · máximo 2 MB</small>
                <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" required onChange={event => previewFile(event.target.files?.[0], setLogoPreview)} />
              </label>

              <label className="company-upload company-upload-cover">
                <span className="company-upload-preview">
                  {coverPreview ? <img src={coverPreview} alt="Vista previa de la portada" /> : <span aria-hidden="true">FOTO DE PORTADA</span>}
                </span>
                <strong>Cargar foto del punto de referencia</strong>
                <small>PNG, JPG o WebP · horizontal · 1600 × 700 px recomendado · máximo 5 MB</small>
                <input type="file" name="cover" accept="image/png,image/jpeg,image/webp" required onChange={event => previewFile(event.target.files?.[0], setCoverPreview)} />
              </label>
            </div>
          </div>

          <div className="modal-section">
            <div className="modal-section-title"><strong>Información de la empresa</strong><span>Datos generales</span></div>
            <div className="form-grid">
              <div className="field"><label htmlFor="new-company-name">Nombre comercial</label><input id="new-company-name" name="name" required placeholder="Centro Médico Madrid" /></div>
              <div className="field"><label htmlFor="new-company-legal">Razón social</label><input id="new-company-legal" name="legal_name" placeholder="Nombre legal de la empresa" /></div>
              <div className="field"><label htmlFor="new-company-tax">NIT / Identificación</label><input id="new-company-tax" name="tax_id" placeholder="900.000.000-0" /></div>
              <div className="field"><label htmlFor="new-company-timezone">Zona horaria</label>
                <select id="new-company-timezone" name="timezone" defaultValue="America/Bogota">
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
            <div className="modal-section-title"><strong>Sede principal</strong><span>Primer punto de operación</span></div>
            <div className="form-grid">
              <div className="field"><label htmlFor="new-company-site">Nombre de la sede</label><input id="new-company-site" name="site_name" required placeholder="Sede principal" /></div>
              <div className="field"><label htmlFor="new-company-code">Código</label><input id="new-company-code" name="site_code" defaultValue="MAIN" placeholder="MAIN" /></div>
              <div className="field form-span-2"><label htmlFor="new-company-address">Dirección</label><input id="new-company-address" name="address" placeholder="Carrera 12 #34-56, Barrio El Porvenir" /></div>
              <div className="field"><label htmlFor="new-company-city">Ciudad</label><input id="new-company-city" name="city" required placeholder="Bogotá" /></div>
              <div className="field"><label htmlFor="new-company-country">País</label><input id="new-company-country" name="country" defaultValue="CO" maxLength={2} required /></div>
            </div>
          </div>

          <footer className="modal-actions">
            <button className="button secondary" type="button" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="button" type="submit">Crear empresa</button>
          </footer>
        </form>
      </section>
    </div>}
  </>;
}
