import "./globals.css";

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
    var systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = saved === "dark" || saved === "light" ? saved : (systemDark ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
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
