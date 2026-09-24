import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import UiIcon from "@/components/UiIcon";
import { FoundationPreview } from "@/components/ui-kit/FoundationPreview";
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
          <h1>Foundations V2</h1>
          <p>Catálogo vivo de los tokens reales cargados por la aplicación. Esta primera fase documenta y valida Foundations; los primitives interactivos se incorporan en la Fase 2.</p>
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
      </nav>

      <div className="ds-phase-note">
        <strong>Fase 1.</strong> El playground usa los tokens canónicos y componentes compartidos existentes como <code>UiIcon</code>. Buttons, Forms, Cards, Tables, Navigation y Feedback completos se documentarán aquí cuando sean implementados como primitives oficiales.
      </div>

      <FoundationPreview/>
    </div>
  </main>;
}
