import "./globals.css";

export const metadata = {
  title: "Deswel CMMS",
  description: "Sistema multiempresa de gestión de mantenimiento",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
