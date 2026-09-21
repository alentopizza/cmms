import Link from "next/link";

export default function DownloadsPage() {
  return <main className="downloads-page downloads-page-pro">
    <section className="downloads-shell downloads-shell-pro">
      <header className="downloads-header downloads-header-pro">
        <Link className="marketing-brand marketing-brand-pro" href="/">
          <span className="marketing-brand-mark">D</span>
          <span className="marketing-brand-copy"><strong>DESWEB</strong><small>CMMS · Self-hosted</small></span>
        </Link>
        <div>
          <Link href="/">Landing</Link>
          <Link href="/login">Acceso</Link>
          <Link className="button" href="/checkout?plan=pro">Ver plan Pro</Link>
        </div>
      </header>

      <section className="downloads-hero downloads-hero-pro">
        <div>
          <div className="marketing-beta-pill"><i /> Edición self-hosted · Beta privada</div>
          <h1>La misma plataforma CMMS, instalada en tu propia infraestructura.</h1>
          <p>Desweb CMMS self-hosted conserva la arquitectura web del SaaS: aplicación Next.js, PostgreSQL persistente, migraciones versionadas y despliegue con Docker Compose.</p>
          <div className="downloads-hero-actions">
            <a className="button" href="#obtener">Cómo obtener el paquete</a>
            <Link className="button secondary" href="/">Volver al producto</Link>
          </div>
        </div>
        <div className="downloads-architecture" aria-hidden="true">
          <div className="downloads-arch-node strong"><span>DESWEB CMMS</span><small>Next.js</small></div>
          <i>→</i>
          <div className="downloads-arch-node"><span>PostgreSQL</span><small>Datos persistentes</small></div>
          <i>→</i>
          <div className="downloads-arch-node"><span>Docker</span><small>Infraestructura propia</small></div>
        </div>
      </section>

      <section className="downloads-benefits">
        <article><span>⌂</span><div><strong>Infraestructura propia</strong><p>Despliega la aplicación dentro de tu servidor, VPS o entorno on-premise.</p></div></article>
        <article><span>↻</span><div><strong>Migraciones controladas</strong><p>Las actualizaciones mantienen un historial de esquema versionado.</p></div></article>
        <article><span>▣</span><div><strong>Datos persistentes</strong><p>PostgreSQL mantiene la información fuera del ciclo de vida del contenedor.</p></div></article>
        <article><span>✓</span><div><strong>Mismo producto</strong><p>No mantenemos una segunda aplicación: SaaS y self-hosted comparten código base.</p></div></article>
      </section>

      <section id="obtener" className="downloads-grid downloads-grid-pro">
        <article className="downloads-card featured downloads-package-card">
          <div className="downloads-card-headline">
            <span className="downloads-card-icon">◆</span>
            <div><span className="downloads-card-kicker">Paquete de instalación</span><h2>ZIP + TAR.GZ versionados</h2></div>
          </div>
          <p>Durante la beta los binarios se generan de forma privada desde el repositorio para validar instalación, actualización y soporte antes de abrir la distribución comercial.</p>
          <div className="downloads-package-list">
            <div><span>01</span><div><strong>Abre GitHub Actions</strong><small>Repositorio alentopizza/cmms</small></div></div>
            <div><span>02</span><div><strong>Ejecuta Package self-hosted</strong><small>Define una versión como 0.1.0-beta</small></div></div>
            <div><span>03</span><div><strong>Descarga el artefacto</strong><small>Obtendrás ZIP y TAR.GZ</small></div></div>
            <div><span>04</span><div><strong>Configura e instala</strong><small>Usa .env + Docker Compose</small></div></div>
          </div>
          <div className="downloads-private-note"><strong>Distribución privada durante beta.</strong><span>La descarga pública se habilitará cuando definamos licencia, releases y control de actualizaciones.</span></div>
        </article>

        <article className="downloads-card">
          <div className="downloads-card-headline">
            <span className="downloads-card-icon">⌘</span>
            <div><span className="downloads-card-kicker">Instalación</span><h2>Docker Compose</h2></div>
          </div>
          <p>Después de configurar las variables de entorno, el despliegue base se inicia con un solo comando.</p>
          <code>docker compose up -d --build</code>
          <div className="downloads-checks"><span>✓ PostgreSQL healthcheck</span><span>✓ Migraciones automáticas</span><span>✓ Aplicación en puerto 3000</span></div>
        </article>

        <article className="downloads-card">
          <div className="downloads-card-headline">
            <span className="downloads-card-icon">◎</span>
            <div><span className="downloads-card-kicker">Licenciamiento</span><h2>Edición comercial</h2></div>
          </div>
          <p>La versión final descargable estará ligada a un modelo de licencia self-hosted y releases controlados.</p>
          <ul>
            <li>versiones estables y notas de release;</li>
            <li>derechos de actualización y soporte;</li>
            <li>control de instalaciones autorizadas;</li>
            <li>posible activación por licencia;</li>
            <li>backups y restauración documentados.</li>
          </ul>
        </article>
      </section>

      <section className="downloads-cta">
        <div><span className="eyebrow">¿SaaS o self-hosted?</span><h2>Podemos adaptar la distribución al entorno de tu empresa.</h2><p>Para la mayoría de clientes el SaaS será el camino más simple. Self-hosted está pensado para organizaciones con requisitos de infraestructura propios.</p></div>
        <Link className="button" href="/#planes">Comparar planes</Link>
      </section>
    </section>
  </main>;
}
