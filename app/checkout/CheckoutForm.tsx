"use client";

import Link from "next/link";
import { useState } from "react";
import { CountryCityFields } from "@/components/InternationalFields";

type Plan = {
  code: "trial" | "basic" | "medium" | "pro";
  name: string;
  description: string | null;
  max_assets: number;
  max_technicians: number;
  max_sites: number;
};

type FieldName = "company_name" | "full_name" | "email" | "password" | "country" | "city" | "site_name" | "general";
type FieldErrors = Partial<Record<FieldName, string>>;

type Draft = {
  company_name: string;
  full_name: string;
  email: string;
  password: string;
  country: string;
  city: string;
  site_name: string;
};

const INITIAL_DRAFT: Draft = {
  company_name: "",
  full_name: "",
  email: "",
  password: "",
  country: "CO",
  city: "",
  site_name: "",
};

export default function CheckoutForm({
  plan,
  existingCompany,
  defaultCountry="CO",
  defaultLocale="es-CO",
}: {
  plan: Plan;
  existingCompany?: { name: string; email: string } | null;
  defaultCountry?: string;
  defaultLocale?: string;
}) {
  const [draft, setDraft] = useState<Draft>({...INITIAL_DRAFT,country:defaultCountry});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  function update(field: keyof Draft, value: string) {
    setDraft(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined, general: undefined }));
  }

  function validate() {
    const next: FieldErrors = {};
    if (!draft.company_name.trim()) next.company_name = "Ingresa el nombre de la empresa.";
    if (!draft.full_name.trim()) next.full_name = "Ingresa el nombre del administrador.";
    if (!draft.email.trim()) next.email = "Ingresa un correo electrónico.";
    else if (!/^\S+@\S+\.\S+$/.test(draft.email.trim())) next.email = "Ingresa un correo válido.";
    if (draft.password.length < 8) next.password = "La contraseña debe tener al menos 8 caracteres.";
    if (!draft.country.trim()) next.country = "Selecciona el país.";
    if (!draft.city.trim()) next.city = "Selecciona la ciudad.";
    if (!draft.site_name.trim()) next.site_name = "Ingresa el nombre de la sede principal.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submitNew(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setErrors({});
    try {
      const body = new FormData();
      body.set("plan_code", plan.code);
      body.set("preferred_locale", defaultLocale);
      Object.entries(draft).forEach(([key, value]) => body.set(key, value));

      const response = await fetch("/api/public/test-checkout", {
        method: "POST",
        headers: { Accept: "application/json" },
        body,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrors(payload?.fields || { general: payload?.message || "No fue posible crear la cuenta." });
        return;
      }

      window.location.assign(payload?.redirect || "/dashboard");
    } catch {
      setErrors({ general: "No fue posible conectar con el servidor. Tus datos permanecen en el formulario; intenta nuevamente." });
    } finally {
      setSaving(false);
    }
  }

  async function submitUpgrade(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const body = new FormData();
      body.set("plan_code", plan.code);
      const response = await fetch("/api/public/test-upgrade", {
        method: "POST",
        headers: { Accept: "application/json" },
        body,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrors({ general: payload?.message || "No fue posible actualizar el plan." });
        return;
      }
      window.location.assign(payload?.redirect || "/dashboard/settings?plan_updated=1");
    } catch {
      setErrors({ general: "No fue posible conectar con el servidor. Intenta nuevamente." });
    } finally {
      setSaving(false);
    }
  }

  if (existingCompany) {
    return <form className="checkout-form" onSubmit={submitUpgrade}>
      {errors.general && <div className="notice error">{errors.general}</div>}
      <div className="checkout-existing-company">
        <span>Empresa que se actualizará</span>
        <strong>{existingCompany.name}</strong>
        <small>{existingCompany.email}</small>
      </div>

      {plan.code === "trial"
        ? <div className="notice error">La prueba gratuita solo se asigna al crear una empresa nueva. Selecciona Básico, Medio o Pro.</div>
        : <>
          <div className="checkout-upgrade-note">
            <strong>Actualizar a {plan.name}</strong>
            <span>Al confirmar, los límites de tu empresa se actualizarán con los recursos incluidos en este plan de prueba comercial.</span>
          </div>
          <button className="button" type="submit" disabled={saving}>{saving ? "Actualizando…" : `Simular compra y activar ${plan.name}`}</button>
        </>}
      <div className="checkout-navigation">
        <Link href="/#planes">← Comparar planes</Link>
        <Link href="/">Ir al Home</Link>
      </div>
    </form>;
  }

  return <form className="checkout-form" onSubmit={submitNew} noValidate>
    {errors.general && <div className="notice error">{errors.general}</div>}

    <div className={`field ${errors.company_name ? "field-error" : ""}`}>
      <label htmlFor="checkout-company">Empresa</label>
      <input id="checkout-company" value={draft.company_name} onChange={event => update("company_name", event.target.value)} placeholder="Ej. Industrias Andina" autoFocus />
      {errors.company_name && <small className="field-error-message">{errors.company_name}</small>}
    </div>

    <div className={`field ${errors.full_name ? "field-error" : ""}`}>
      <label htmlFor="checkout-name">Nombre completo</label>
      <input id="checkout-name" value={draft.full_name} onChange={event => update("full_name", event.target.value)} placeholder="Ej. Laura Gómez" />
      {errors.full_name && <small className="field-error-message">{errors.full_name}</small>}
    </div>

    <div className={`field ${errors.email ? "field-error" : ""}`}>
      <label htmlFor="checkout-email">Correo</label>
      <input id="checkout-email" type="email" value={draft.email} onChange={event => update("email", event.target.value)} placeholder="laura@empresa.com" autoComplete="email" />
      {errors.email && <small className="field-error-message">{errors.email}</small>}
    </div>

    <div className={`field ${errors.password ? "field-error" : ""}`}>
      <label htmlFor="checkout-password">Contraseña</label>
      <input id="checkout-password" type="password" value={draft.password} onChange={event => update("password", event.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
      {errors.password && <small className="field-error-message">{errors.password}</small>}
    </div>

    <div className="checkout-country-city">
      <CountryCityFields
        countryId="checkout-country"
        countryName="country"
        cityId="checkout-city"
        cityName="city"
        countryLabel="País"
        cityLabel="Ciudad"
        countryValue={draft.country}
        cityValue={draft.city}
        onCountryChange={value=>update("country",value)}
        onCityChange={value=>update("city",value)}
        required
      />
      {errors.country && <small className="field-error-message">{errors.country}</small>}
      {errors.city && <small className="field-error-message">{errors.city}</small>}
    </div>

    <div className={`field ${errors.site_name ? "field-error" : ""}`}>
      <label htmlFor="checkout-site">Nombre sede principal</label>
      <input id="checkout-site" value={draft.site_name} onChange={event => update("site_name", event.target.value)} placeholder="Ej. Planta principal" />
      {errors.site_name && <small className="field-error-message">{errors.site_name}</small>}
    </div>

    <button className="button" type="submit" disabled={saving}>{saving ? "Creando cuenta…" : plan.code === "trial" ? "Crear prueba de 15 días" : "Simular compra y crear cuenta"}</button>
    <div className="checkout-navigation">
      <Link href="/#planes">← Volver a planes</Link>
      <Link href="/">Ir al Home</Link>
    </div>
  </form>;
}
