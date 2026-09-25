import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getCustomizationSummary, logoOnDarkSrc, logoOnLightSrc } from "@/lib/customization";
import FileDropzone from "@/components/FileDropzone";
import UiIcon from "@/components/UiIcon";
import { Alert } from "@/components/ui-kit/Feedback";
import { Badge } from "@/components/ui-kit/Badge";
import { Button } from "@/components/ui-kit/Button";

function formatSize(bytes: number) {
  if (!bytes) return "Predeterminado";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default async function PersonalizationPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session, "personalization.manage")) redirect("/dashboard");

  const params = await searchParams;
  const customization = await getCustomizationSummary();

  return <div className="phase10-personalization">
    <header className="page-header">
      <div>
        <span className="eyebrow">Configuración visual</span>
        <h1 className="page-title">Personalización</h1>
        <p className="muted">Administra la identidad visual global de esta instalación de Desweb CMMS.</p>
      </div>
    </header>

    {params.saved==="1"&&<div className="section"><Alert variant="success" title="Personalización guardada">Los cambios de personalización fueron guardados.</Alert></div>}
    {params.error&&<div className="section"><Alert variant="danger" title="No fue posible guardar la personalización">{params.error}</Alert></div>}

    <section className="card section customization-intro">
      <div className="phase10-customization-intro-copy">
        <span className="phase10-customization-intro-icon" aria-hidden="true"><UiIcon name="preferences" size={20}/></span>
        <div><h2>Marca y recursos gráficos</h2>
        <p className="muted">Los archivos se almacenan en PostgreSQL, por lo que permanecen disponibles después de cada nueva implementación.</p></div>
      </div>
      <Badge variant="brand" icon="company">Global</Badge>
    </section>

    <form className="section customization-grid" method="post" action="/api/customization" encType="multipart/form-data">
      <article className="card customization-card">
        <div>
          <span className="eyebrow">Logo 01</span>
          <h2>Logo para fondos claros</h2>
          <p className="muted">Usa la versión oscura del logotipo. Recomendado: PNG, WebP o SVG transparente.</p>
        </div>
        <div className="asset-preview asset-preview-light">
          <img src={logoOnLightSrc(customization)} alt="Logo para fondos claros" />
        </div>
        <div className="asset-meta">
          <span>{customization.logoOnLightName || "Logo predeterminado"}</span>
          <span>{formatSize(customization.logoOnLightSize)}</span>
        </div>
        <FileDropzone id="logo_on_light" name="logo_on_light" label="Reemplazar logo" description="Versión para fondos claros. Recomendado: transparente." accept=".png,.webp,.svg,.jpg,.jpeg,image/png,image/webp,image/svg+xml,image/jpeg" maxSizeMb={2} kind="image" existingFileName={customization.logoOnLightName} compact />
        {customization.hasLogoOnLight &&
          <Button variant="secondary" type="submit" name="reset" value="logo-on-light" iconLeft="reset">Restablecer logo</Button>}
      </article>

      <article className="card customization-card">
        <div>
          <span className="eyebrow">Logo 02</span>
          <h2>Logo para fondos oscuros</h2>
          <p className="muted">Usa la versión blanca/clara del logotipo para sidebar y modo oscuro.</p>
        </div>
        <div className={`asset-preview asset-preview-dark ${customization.hasLogoOnDark ? "" : "asset-preview-fallback"}`}>
          <img src={logoOnDarkSrc(customization)} alt="Logo para fondos oscuros" />
        </div>
        <div className="asset-meta">
          <span>{customization.logoOnDarkName || "Aún no personalizado"}</span>
          <span>{formatSize(customization.logoOnDarkSize)}</span>
        </div>
        <FileDropzone id="logo_on_dark" name="logo_on_dark" label="Reemplazar logo" description="Versión clara/negativa para fondos oscuros." accept=".png,.webp,.svg,.jpg,.jpeg,image/png,image/webp,image/svg+xml,image/jpeg" maxSizeMb={2} kind="image" existingFileName={customization.logoOnDarkName} compact />
        {customization.hasLogoOnDark &&
          <Button variant="secondary" type="submit" name="reset" value="logo-on-dark" iconLeft="reset">Restablecer logo</Button>}
      </article>

      <article className="card customization-card">
        <div>
          <span className="eyebrow">Navegador</span>
          <h2>Favicon</h2>
          <p className="muted">Icono mostrado en la pestaña del navegador. Recomendado: SVG o PNG cuadrado de 64×64 o 128×128.</p>
        </div>
        <div className="favicon-preview">
          <img src="/api/customization/assets/favicon" alt="Favicon actual" />
        </div>
        <div className="asset-meta">
          <span>{customization.faviconName || "Favicon Desweb predeterminado"}</span>
          <span>{formatSize(customization.faviconSize)}</span>
        </div>
        <FileDropzone id="favicon" name="favicon" label="Reemplazar favicon" description="Cuadrado · 64×64 o 128×128 px recomendado." accept=".ico,.png,.webp,.svg,image/x-icon,image/png,image/webp,image/svg+xml" maxSizeMb={2} kind="image" existingFileName={customization.faviconName} compact />
        {customization.hasFavicon &&
          <Button variant="secondary" type="submit" name="reset" value="favicon" iconLeft="reset">Restablecer favicon</Button>}
      </article>

      <div className="customization-savebar">
        <div><strong>Guardar archivos seleccionados</strong><span>Máximo 2 MB por archivo.</span></div>
        <Button type="submit" iconLeft="check">Guardar personalización</Button>
      </div>
    </form>
  </div>;
}
