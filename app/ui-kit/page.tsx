import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import UiIcon from "@/components/UiIcon";
import { FoundationPreview } from "@/components/ui-kit/FoundationPreview";
import { CorePrimitivesPreview } from "@/components/ui-kit/CorePrimitivesPreview";
import { DataPatternsPreview } from "@/components/ui-kit/DataPatternsPreview";
import { BusinessCardsPreview } from "@/components/business-ui";
import "./ui-kit.css";

export const dynamic="force-dynamic";

export default async function UiKitPage(){
  const session=await getSession();
  if(!session)redirect("/login");

  return <main className="ds-ui-kit-page">
    <div className="ds-ui-kit-shell">
      <header className="ds-ui-kit-hero">
        <div className="ds-ui-kit-hero-copy">
          <span>DESWEB CMMS · UI Kit</span>
          <h1>DESWEB UI Kit V2</h1>
          <p>Catálogo vivo de Foundations y UI Core reales. Los ejemplos usan los mismos primitives y tokens que deben consumir los módulos del ERP.</p>
        </div>
        <Link className="ds-ui-kit-back" href="/dashboard">
          <UiIcon name="home" size={16}/>
          Volver al ERP
        </Link>
      </header>

      <nav className="ds-ui-kit-nav" aria-label="Secciones del UI Kit">
        <a href="#colors">Color</a>
        <a href="#typography">Tipografía</a>
        <a href="#spacing">Spacing</a>
        <a href="#radius">Radius / Shadows</a>
        <a href="#motion">Motion</a>
        <a href="#buttons">Buttons</a>
        <a href="#forms">Forms</a>
        <a href="#cards">Cards</a>
        <a href="#navigation">Navigation</a>
        <a href="#overlays">Overlays</a>
        <a href="#feedback">Feedback</a>
        <a href="#data-controls">Search / Filters</a>
        <a href="#tables">DataTable</a>
        <a href="#metrics">KPI</a>
        <a href="#charts">Charts</a>
        <a href="#progress">Timeline / Progress</a>
        <a href="#business-cards">Business UI</a>
      </nav>

      <div className="ds-phase-note">
        <strong>Fase 8.</strong> Proveedores, Usuarios, Cuadrillas y Asistencia ya consumen Business UI, feedback/estados V2, métricas y tablas compartidas, preservando expedientes, biometría, geocercas, privacidad y relaciones de compras.
      </div>

      <FoundationPreview/>
      <CorePrimitivesPreview/>
      <DataPatternsPreview/>
      <BusinessCardsPreview/>
    </div>
  </main>;
}
