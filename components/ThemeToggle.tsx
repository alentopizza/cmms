"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(current);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("desweb-theme", next);
    setTheme(next);
  }

  return <button
    className="theme-toggle"
    type="button"
    onClick={toggleTheme}
    title={theme === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
    aria-label={theme === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
  >
    <span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span>
    <span className="theme-toggle-label">{theme === "light" ? "Oscuro" : "Claro"}</span>
  </button>;
}
