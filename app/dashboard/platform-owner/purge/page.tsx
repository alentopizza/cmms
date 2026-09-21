import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isPlatformOwner } from "@/lib/permissions";
import PlatformOwnerPurge from "./PlatformOwnerPurge";

export default async function PlatformOwnerPurgePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isPlatformOwner(session)) redirect("/dashboard");

  return <>
    <header className="page-header">
      <div>
        <span className="eyebrow">Propietario Desweb</span>
        <h1 className="page-title">Eliminación universal</h1>
        <p className="muted">Herramienta exclusiva de desarrollo para eliminar registros y sus dependencias aunque tengan historial relacionado.</p>
      </div>
      <div className="brand-pill"><span /> Solo Platform Owner</div>
    </header>
    <PlatformOwnerPurge />
  </>;
}
