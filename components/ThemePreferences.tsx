"use client";

import { useEffect, useState } from "react";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import { Badge } from "@/components/ui-kit/Badge";

type ThemePreference = "light" | "dark" | "system";

function applyPreference(preference: ThemePreference) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = preference === "system" ? (systemDark ? "dark" : "light") : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  localStorage.setItem("desweb-theme", preference);
}

export default function ThemePreferences() {
  const [preference, setPreference] = useState<ThemePreference>("light");

  useEffect(() => {
    const saved = localStorage.getItem("desweb-theme");
    const current: ThemePreference = saved === "light" || saved === "dark" || saved === "system" ? saved : "light";
    setPreference(current);
    applyPreference(current);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      if (localStorage.getItem("desweb-theme") === "system") applyPreference("system");
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const options: Array<{ value: ThemePreference; title: string; description: string; icon: UiIconName }> = [
    { value: "light", title: "Claro", description: "Interfaz luminosa para espacios con buena iluminación.", icon: "sun" },
    { value: "dark", title: "Oscuro", description: "Reduce el brillo y resalta superficies operativas.", icon: "moon" },
    { value: "system", title: "Sistema", description: "Sigue automáticamente la apariencia de tu dispositivo.", icon: "system" },
  ];

  return <div className="theme-preference-grid">
    {options.map(option => <button
      key={option.value}
      type="button"
      className={`theme-preference-card ${preference === option.value ? "active" : ""}`}
      onClick={() => {
        setPreference(option.value);
        applyPreference(option.value);
      }}
      aria-pressed={preference === option.value}
    >
      <span className="theme-preference-icon" aria-hidden="true"><UiIcon name={option.icon} size={19}/></span>
      <span className="theme-preference-copy">
        <strong>{option.title}</strong>
        <small>{option.description}</small>
      </span>
      <span className="theme-preference-check" aria-hidden="true">{preference === option.value ? <Badge variant="success">Activo</Badge> : null}</span>
    </button>)}
  </div>;
}
