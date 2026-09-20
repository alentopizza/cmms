import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getCustomizationSummary, logoOnDarkSrc, logoOnLightSrc } from "@/lib/customization";

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

  return <>
    <header className="page-header">
      <div>
        <span className="eyebrow">Configuración visual</span>
        <h1 className="page-title">Personalización</h1>
        <p className="muted">Administra la identidad visual global de esta instalación de Desweb CMMS.</p>
      </div>
    </header>

    {params.saved === "1" && <div className="notice success section">Los cambios de personalización fueron guardados.</div>}
    {params.error && <div className="notice error section">{params.error}</div>}

    <section className="card section customization-intro">
      <div>
        <h2>Marca y recursos gráficos</h2>
        <p className="muted">Los archivos se almacenan en PostgreSQL, por lo que permanecen disponibles después de cada nueva implementación.</p>
      </div>
      <div className="customization-badge">Global</div>
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
        <div className="field">
          <label htmlFor="logo_on_light">Reemplazar logo</label>
          <input id="logo_on_light" name="logo_on_light" type="file" accept=".png,.webp,.svg,.jpg,.jpeg,image/png,image/webp,image/svg+xml,image/jpeg" />
        </div>
        {customization.hasLogoOnLight &&
          <button className="button secondary" type="submit" name="reset" value="logo-on-light">Restablecer logo</button>}
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
        <div className="field">
          <label htmlFor="logo_on_dark">Reemplazar logo</label>
          <input id="logo_on_dark" name="logo_on_dark" type="file" accept=".png,.webp,.svg,.jpg,.jpeg,image/png,image/webp,image/svg+xml,image/jpeg" />
        </div>
        {customization.hasLogoOnDark &&
          <button className="button secondary" type="submit" name="reset" value="logo-on-dark">Restablecer logo</button>}
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
        <div className="field">
          <label htmlFor="favicon">Reemplazar favicon</label>
          <input id="favicon" name="favicon" type="file" accept=".ico,.png,.webp,.svg,image/x-icon,image/png,image/webp,image/svg+xml" />
        </div>
        {customization.hasFavicon &&
          <button className="button secondary" type="submit" name="reset" value="favicon">Restablecer favicon</button>}
      </article>

      <div className="customization-savebar">
        <div><strong>Guardar archivos seleccionados</strong><span>Máximo 2 MB por archivo.</span></div>
        <button className="button" type="submit">Guardar personalización</button>
      </div>
    </form>
  </>;
}
