"use client";

import { useState } from "react";

type Fields = "full_name" | "company_name" | "email" | "phone" | "interest" | "message" | "general";
type Errors = Partial<Record<Fields,string>>;

export default function MarketingLeadForm() {
  const [errors,setErrors]=useState<Errors>({});
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setErrors({});
    setSent(false);

    const form = event.currentTarget;
    const body = new FormData(form);

    try {
      const response = await fetch("/api/public/leads", {
        method:"POST",
        headers:{Accept:"application/json"},
        body,
      });
      const payload = await response.json().catch(()=>({}));

      if (!response.ok) {
        setErrors(payload?.fields || {general:payload?.message || "No fue posible enviar tu solicitud."});
        return;
      }

      form.reset();
      setSent(true);
    } catch {
      setErrors({general:"No fue posible conectar con el servidor. Intenta nuevamente."});
    } finally {
      setSending(false);
    }
  }

  return <form className="marketing-lead-form" onSubmit={submit} noValidate>
    {sent && <div className="marketing-lead-success">Recibimos tu solicitud. Un asesor podrá revisar este lead desde la plataforma.</div>}
    {errors.general && <div className="marketing-lead-error">{errors.general}</div>}

    <div className="marketing-lead-grid">
      <label className={errors.full_name ? "has-error" : ""}>
        <span>Nombre completo *</span>
        <input name="full_name" placeholder="Ej. Laura Gómez" />
        {errors.full_name && <small>{errors.full_name}</small>}
      </label>
      <label className={errors.company_name ? "has-error" : ""}>
        <span>Empresa *</span>
        <input name="company_name" placeholder="Ej. Industrias Andina" />
        {errors.company_name && <small>{errors.company_name}</small>}
      </label>
      <label className={errors.email ? "has-error" : ""}>
        <span>Correo corporativo *</span>
        <input name="email" type="email" placeholder="laura@empresa.com" />
        {errors.email && <small>{errors.email}</small>}
      </label>
      <label className={errors.phone ? "has-error" : ""}>
        <span>Teléfono</span>
        <input name="phone" placeholder="+57 300 000 0000" />
        {errors.phone && <small>{errors.phone}</small>}
      </label>
      <label className="marketing-lead-span-2">
        <span>¿Qué te interesa? *</span>
        <select name="interest" defaultValue="">
          <option value="" disabled>Selecciona una opción</option>
          <option value="demo">Solicitar una demostración</option>
          <option value="trial">Prueba de 15 días</option>
          <option value="basic">Plan Básico</option>
          <option value="medium">Plan Medio</option>
          <option value="pro">Plan Pro / marca blanca</option>
          <option value="self_hosted">Instalación self-hosted</option>
          <option value="other">Otro requerimiento</option>
        </select>
        {errors.interest && <small>{errors.interest}</small>}
      </label>
      <label className="marketing-lead-span-2">
        <span>Cuéntanos sobre tu operación</span>
        <textarea name="message" rows={5} placeholder="Número de sedes, activos, técnicos o cualquier necesidad particular." />
        {errors.message && <small>{errors.message}</small>}
      </label>
    </div>

    <button className="button marketing-lead-submit" type="submit" disabled={sending}>{sending ? "Enviando…" : "Quiero que me contacte un asesor"}</button>
    <p>Al enviar este formulario registraremos tus datos como oportunidad comercial para que el equipo de Desweb pueda contactarte.</p>
  </form>;
}
