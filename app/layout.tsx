import "./globals.css";
import "./design-tokens.css";
import "./ui-kit-core.css";
import "./data-ui.css";
import "./business-ui.css";
import "./phase6-modules.css";
import "./phase7-modules.css";
import "./phase8-modules.css";
import "./shell-v2.css";

export const metadata = {
  title: "Desweb CMMS",
  description: "Sistema multiempresa de gestión de mantenimiento",
  icons: {
    icon: "/api/customization/assets/favicon",
    shortcut: "/api/customization/assets/favicon",
  },
};

const themeScript = `
(function () {
  try {
    var saved = localStorage.getItem("desweb-theme");
    var preference = saved === "dark" || saved === "light" || saved === "system" ? saved : "light";
    var systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = preference === "system" ? (systemDark ? "dark" : "light") : preference;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreference = preference;
  } catch (_) {
    document.documentElement.dataset.theme = "light";
  }
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
    <body>{children}</body>
  </html>;
}
