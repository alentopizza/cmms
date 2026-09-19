import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthenticated())) redirect("/login");
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand">Deswel CMMS</div>
      <nav className="nav">
        <Link href="/dashboard">Resumen</Link>
        <Link href="/dashboard/companies">Empresas y sedes</Link>
        <Link href="/dashboard/assets">Activos y equipos</Link>
        <Link href="/dashboard/work-orders">Órdenes de trabajo</Link>
        <Link href="/dashboard/maintenance">Preventivos</Link>
        <Link href="/dashboard/inventory">Inventario</Link>
      </nav>
    </aside>
    <main className="main">
      <div className="topbar"><div><strong>CMMS</strong><div className="muted">cmms.deswel.cloud</div></div>
      <form method="post" action="/api/auth/logout"><button className="button secondary">Salir</button></form></div>
      {children}
    </main>
  </div>;
}
