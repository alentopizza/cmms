"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import GeofenceMapPicker from "@/components/GeofenceMapPicker";
import BusinessHoursFields from "@/components/BusinessHoursFields";
import FileDropzone from "@/components/FileDropzone";
import PhoneField from "@/components/PhoneField";
import { CountryCityFields, CountryTimezoneSelect, TaxIdentificationTypeSelect } from "@/components/InternationalFields";

export default function NewCompanyModal({ error, autoOpen = false, defaultCountry = "CO", defaultLocale = "es-CO" }: { error?: string; autoOpen?: boolean; defaultCountry?: string; defaultLocale?: string }) {
  const [open, setOpen] = useState(Boolean(error) || autoOpen);
  const [portalHost,setPortalHost]=useState<HTMLElement|null>(null);

  useEffect(()=>{ setPortalHost(document.body); },[]);
  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

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

  const errorMessages: Record<string, string> = {
    required: "Completa los campos obligatorios.",
    "image-required": "Debes cargar el logo de la empresa.",
    "image-type": "Las imágenes deben ser PNG, JPG o WebP.",
    "image-size": "Una de las imágenes supera el tamaño permitido.",
    "site-geofence": "Valida la dirección de la sede en el mapa y define su radio permitido.",
    "business-hours": "La hora de cierre debe ser posterior a la hora de apertura.",
    "business-days": "Selecciona al menos un día de atención.",
    plan: "Selecciona un plan válido.",
  };
  const errorMessage = error ? errorMessages[error] || "No se pudo crear la empresa." : "";

  return <>
    <button className="button company-new-button module-add-button" type="button" onClick={() => setOpen(true)}>
      <span className="module-add-button-icon" aria-hidden="true">◫</span>
      Agregar
    </button>

    {open && portalHost && createPortal(<div className="modal-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) setOpen(false);
    }}>
      <section className="company-modal unified-create-modal" role="dialog" aria-modal="true" aria-labelledby="new-company-title">
        <header className="modal-header">
          <div>
            <span className="eyebrow">Nuevo registro</span>
            <h2 id="new-company-title">Crear empresa</h2>
            <p>Registra la empresa, su sede principal y el logo que identificará su tarjeta.</p>
          </div>
          <button className="modal-close" type="button" aria-label="Cerrar" onClick={() => setOpen(false)}>×</button>
        </header>

        {errorMessage && <div className="notice error modal-error">{errorMessage}</div>}

        <form className="company-modal-form" method="post" action="/api/organizations" encType="multipart/form-data">
          <input type="hidden" name="preferred_locale" value={defaultLocale} />
          <div className="modal-section">
            <div className="modal-section-title"><strong>Identidad visual</strong><span>Logo obligatorio · portada opcional</span></div>
            <div className="company-upload-grid">
              <FileDropzone
                name="logo"
                label="Logo de la empresa"
                description="Imagen cuadrada recomendada: 800 × 800 px. Se usa como identidad visual en tarjetas y mapas."
                accept="image/png,image/jpeg,image/webp"
                maxSizeMb={2}
                required
                kind="image"
              />
              <FileDropzone
                name="cover"
                label="Foto de portada / punto de referencia"
                description="Imagen horizontal recomendada: 1600 × 700 px."
                accept="image/png,image/jpeg,image/webp"
                maxSizeMb={5}
                kind="image"
              />
            </div>
          </div>

          <div className="modal-section">
            <div className="modal-section-title"><strong>Información de la empresa</strong><span>Datos generales</span></div>
            <div className="form-grid">
              <div className="field"><label htmlFor="new-company-name">Nombre comercial</label><input id="new-company-name" name="name" required placeholder="Ej. The Shop Colombia" /></div>
              <div className="field"><label htmlFor="new-company-legal">Razón social</label><input id="new-company-legal" name="legal_name" placeholder="Ej. The Shop Colombia S.A.S." /></div>
              <CountryCityFields countryId="new-company-legal-country" countryName="legal_country" cityId="new-company-legal-city" cityName="legal_city" countryLabel="País administrativo / fiscal" cityLabel="Ciudad administrativa" defaultCountry={defaultCountry} defaultCity="" required />
              <TaxIdentificationTypeSelect id="new-company-tax-type" countryInputId="new-company-legal-country" countryCode={defaultCountry} name="tax_id_type" required />
              <div className="field"><label htmlFor="new-company-tax">Número de identificación</label><input id="new-company-tax" name="tax_id" placeholder="Número fiscal / tributario" /></div>
              <PhoneField name="phone" label="Teléfono principal" countryCode={defaultCountry} countryInputId="new-company-legal-country" />
              <CountryTimezoneSelect id="new-company-timezone" countryInputId="new-company-legal-country" countryCode={defaultCountry} defaultValue="" />
              <BusinessHoursFields title="Horario general de atención" description="Se usa en Reacción para identificar si la empresa está abierta en este momento." />
            </div>
          </div>

          <div className="modal-section">
            <div className="modal-section-title"><strong>Plan de la empresa</strong><span>Suscripción mensual</span></div>
            <p className="muted resource-help">El plan define los cupos iniciales. Los ajustes comerciales especiales pueden hacerse después desde la edición de la empresa.</p>
            <div className="plan-choice-grid">
              <label className="plan-choice"><input type="radio" name="plan_code" value="trial" /><span><strong>Prueba</strong><small>15 días · 1 sede · 25 activos · 2 técnicos</small></span></label>
              <label className="plan-choice"><input type="radio" name="plan_code" value="basic" /><span><strong>Básico</strong><small>3 sedes · 150 activos · 5 técnicos</small></span></label>
              <label className="plan-choice"><input type="radio" name="plan_code" value="medium" defaultChecked /><span><strong>Medio</strong><small>10 sedes · 750 activos · 20 técnicos</small></span></label>
              <label className="plan-choice"><input type="radio" name="plan_code" value="pro" /><span><strong>Pro</strong><small>30 sedes · 3000 activos · 75 técnicos · marca blanca</small></span></label>
            </div>
          </div>

          <div className="modal-section">
            <div className="modal-section-title"><strong>Sede principal</strong><span>Primer punto de operación</span></div>
            <div className="form-grid">
              <div className="field"><label htmlFor="new-company-site">Nombre de la sede</label><input id="new-company-site" name="site_name" required placeholder="Ej. Sede Bogotá" /></div>
              <div className="field"><label htmlFor="new-company-code">Código interno de sede</label><input id="new-company-code" name="site_code" defaultValue="MAIN" placeholder="Ej. MAIN o BOG-01" /><small>Opcional. Es una referencia corta para identificar la sede en OT, reportes e integraciones; no es la dirección.</small></div>
              <CountryCityFields countryId="new-company-country" countryName="country" cityId="new-company-city" cityName="city" defaultCountry={defaultCountry} defaultCity="" required />
              <div className="form-span-2"><GeofenceMapPicker cityHint="Bogotá" countryHint="CO" /></div>
              <BusinessHoursFields prefix="site_business_" title="Horario de la sede principal" description="Puede ser diferente del horario general de la empresa." />
            </div>
          </div>

          <footer className="modal-actions">
            <button className="button secondary" type="button" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="button" type="submit">Crear empresa</button>
          </footer>
        </form>
      </section>
    </div>,portalHost)}
  </>;
}
