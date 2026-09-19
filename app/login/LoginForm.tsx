"use client";

import { useState } from "react";

function MailIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h17v11h-17z"/><path d="m4 7 8 6 8-6"/></svg>;
}

function LockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>;
}

function EyeIcon({ off = false }: { off?: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/>
    <circle cx="12" cy="12" r="2.5"/>
    {off && <path d="M4 4l16 16"/>}
  </svg>;
}

export default function LoginForm({ hasError }: { hasError: boolean }) {
  const [showPassword, setShowPassword] = useState(false);

  return <form className="login-form" method="post" action="/api/auth/login">
    {hasError && <div className="login-error">El correo o la contraseña no son correctos.</div>}

    <div className="login-field">
      <label htmlFor="email">Correo electrónico</label>
      <div className="login-input-wrap">
        <span className="login-input-icon"><MailIcon /></span>
        <input id="email" name="email" type="email" autoComplete="email" placeholder="tu@empresa.com" required autoFocus />
      </div>
    </div>

    <div className="login-field">
      <label htmlFor="password">Contraseña</label>
      <div className="login-input-wrap">
        <span className="login-input-icon"><LockIcon /></span>
        <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Ingresa tu contraseña" required />
        <button className="password-toggle" type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
          <EyeIcon off={showPassword} />
        </button>
      </div>
    </div>

    <button className="login-submit" type="submit">
      Iniciar sesión
      <span aria-hidden="true">→</span>
    </button>
  </form>;
}
