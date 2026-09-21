import Link from "next/link";

export default function DownloadsPage() {
  return <main className="downloads-page">
    <section className="downloads-shell">
      <header className="downloads-header">
        <Link className="marketing-brand" href="/"><span>D</span><strong>DESWEB CMMS</strong></Link>
        <div><Link href="/">Volver a la landing</Link><Link className="button" href="/login">Ingresar</Link></div>
      </header>

      <section className="downloads-hero">
        <span className="eyebrow">Self-hosted · Beta técnica</span>
        <h1>Instala Desweb CMMS en tu propia infraestructura.</h1>
        <p>La edición descargable usa la misma aplicación web, PostgreSQL y migraciones que la versión SaaS. No es una aplicación de escritorio separada.</p>
      </section>

      <section className="downloads-grid">
        <article className="downloads-card featured">
          <div className="downloads-card-icon">◆</div>
          <div>
            <span className="downloads-card-kicker">Recomendado para pruebas internas</span>
            <h2>Paquete self-hosted versionado</h2>
            <p>El repositorio genera paquetes privados desde GitHub Actions. Incluyen el código necesario para construir la aplicación, Docker Compose, instalador y documentación.</p>
          </div>
          <div className="downloads-steps">
            <span>1. GitHub → Actions</span>
            <span>2. Ejecuta “Package self-hosted”</span>
            <span>3. Define una versión, por ejemplo 0.1.0-beta</span>
            <span>4. Descarga el artefacto generado</span>
          </div>
          <div className="notice">Durante la fase beta el paquete se distribuye de forma privada desde el repositorio. Antes de ofrecerlo a clientes crearemos releases comerciales y control de licencia.</div>
        </article>

        <article className="downloads-card">
          <div className="downloads-card-icon">⌘</div>
          <div>
            <span className="downloads-card-kicker">Instalación</span>
            <h2>Docker Compose</h2>
            <p>Requiere Docker/Compose y utiliza PostgreSQL persistente. Las migraciones se ejecutan automáticamente al iniciar la aplicación.</p>
          </div>
          <code>docker compose up -d --build</code>
          <p className="downloads-small">Consulta <strong>docs/INSTALLATION.md</strong> dentro del paquete para configuración, backup, restore y actualizaciones.</p>
        </article>

        <article className="downloads-card">
          <div className="downloads-card-icon">◎</div>
          <div>
            <span className="downloads-card-kicker">Distribución comercial</span>
            <h2>Próximo paso</h2>
            <p>La descarga pública final debe usar paquetes firmados/versionados o una imagen privada de contenedor para clientes con licencia.</p>
          </div>
          <ul>
            <li>versiones estables numeradas;</li>
            <li>licencia self-hosted;</li>
            <li>actualizaciones controladas;</li>
            <li>backup/restore verificado;</li>
            <li>posible activación por licencia.</li>
          </ul>
        </article>
      </section>
    </section>
  </main>;
}
