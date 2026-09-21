"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = theme;
  localStorage.setItem("desweb-theme", theme);
}

export default function MarketingThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setTheme(current);
  }, []);

  return <button
    type="button"
    className="marketing-theme-toggle"
    onClick={() => {
      const next = theme === "dark" ? "light" : "dark";
      setTheme(next);
      applyTheme(next);
    }}
    aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
    title={theme === "dark" ? "Tema claro" : "Tema oscuro"}
  >
    <span aria-hidden="true">{theme === "dark" ? "☀" : "◐"}</span>
    <small>{theme === "dark" ? "Claro" : "Oscuro"}</small>
  </button>;
}
