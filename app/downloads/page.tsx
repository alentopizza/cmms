import Link from "next/link";

export default function DownloadsPage() {
  return <main className="downloads-page downloads-page-pro downloads-page-compact">
    <section className="downloads-shell downloads-shell-pro downloads-shell-compact">
      <header className="downloads-header downloads-header-pro">
        <Link className="marketing-brand marketing-brand-pro" href="/">
          <span className="marketing-brand-mark">D</span>
          <span className="marketing-brand-copy"><strong>DESWEB</strong><small>Instalación propia</small></span>
        </Link>
        <div>
          <Link href="/">Inicio</Link>
          <Link href="/login">Acceso</Link>
        </div>
      </header>

      <section className="downloads-compact-hero">
        <div className="downloads-compact-copy">
          <span className="marketing-beta-pill"><i /> Instalación propia · Beta</span>
          <h1>Desweb CMMS en tu propia infraestructura.</h1>
          <p>Descarga un paquete listo para instalar con Docker Compose, PostgreSQL persistente y migraciones automáticas. Es la misma plataforma web que operamos en SaaS, preparada para ejecutarse en tu servidor.</p>

          <div className="downloads-direct-actions">
            <a className="button downloads-direct-button" href="/downloads/desweb-cmms-latest.tar.gz" download>
              Descargar paquete
            </a>
            <Link className="button secondary" href="/#contacto">Hablar con un asesor</Link>
          </div>

          <div className="downloads-direct-meta">
            <span><b>Formato</b><small>.tar.gz</small></span>
            <span><b>Requiere</b><small>Docker + Compose v2</small></span>
            <span><b>Base de datos</b><small>PostgreSQL 17</small></span>
            <span><b>Estado</b><small>Beta técnica</small></span>
          </div>
        </div>

        <div className="downloads-compact-panel">
          <div className="downloads-install-icon">⌘</div>
          <span>Instalación rápida</span>
          <code>tar -xzf desweb-cmms-latest.tar.gz</code>
          <code>cd desweb-cmms-*</code>
          <code>cp .env.example .env</code>
          <code>./install.sh</code>
          <p>El paquete incluye runtime compilado, Dockerfile, Docker Compose, migraciones y guía de instalación.</p>
        </div>
      </section>

      <section className="downloads-compact-info">
        <article>
          <span>01</span>
          <div><strong>Descarga</strong><p>El botón inicia la descarga directamente desde cmms.desweb.cloud.</p></div>
        </article>
        <article>
          <span>02</span>
          <div><strong>Configura</strong><p>Edita el archivo .env con dominio, credenciales y secreto de autenticación.</p></div>
        </article>
        <article>
          <span>03</span>
          <div><strong>Instala</strong><p>Ejecuta el instalador y Docker levantará la aplicación y PostgreSQL.</p></div>
        </article>
      </section>

      <section className="downloads-compact-note">
        <div>
          <span className="eyebrow">Importante</span>
          <h2>Distribución beta</h2>
          <p>Esta descarga está pensada para validación técnica. Antes de distribución comercial masiva añadiremos licencia, control de versiones y proceso formal de actualizaciones.</p>
        </div>
        <Link className="button secondary" href="/">Volver a la landing</Link>
      </section>
    </section>
  </main>;
}
