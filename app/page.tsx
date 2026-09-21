import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getActivePlans } from "@/lib/billing";
import { getCustomizationSummary, logoOnDarkSrc, logoOnLightSrc } from "@/lib/customization";
import MarketingLeadForm from "@/components/MarketingLeadForm";

const features = [
  { icon: "◇", title: "Activos bajo control", text: "Centraliza equipos, ubicación, criticidad y estado operativo en una sola vista." },
  { icon: "✓", title: "Órdenes de trabajo", text: "Organiza solicitudes, prioridades, responsables y ejecución con trazabilidad." },
  { icon: "↻", title: "Mantenimiento preventivo", text: "Planifica rutinas para anticiparte a fallas y reducir paradas no programadas." },
  { icon: "▤", title: "Inventario técnico", text: "Controla repuestos, consumos y disponibilidad para que el mantenimiento no se detenga." },
  { icon: "◎", title: "Roles y sedes", text: "Define qué puede ver y hacer cada usuario según su empresa, rol y sedes autorizadas." },
  { icon: "⌁", title: "SaaS o self-hosted", text: "Opera en la nube con Desweb o instala la plataforma en infraestructura propia." },
];

const faqs = [
  { q: "¿Qué es un CMMS?", a: "Es una plataforma para organizar activos, órdenes de trabajo, mantenimiento preventivo, inventario, ubicaciones y usuarios de mantenimiento desde un mismo sistema." },
  { q: "¿Puedo probar Desweb CMMS antes de contratar?", a: "Sí. El plan de prueba habilita 15 días con recursos limitados para que puedas validar el flujo real de la plataforma." },
  { q: "¿Puedo manejar varias sedes?", a: "Sí. La plataforma es multiempresa y multisedes, y permite controlar el acceso de cada usuario según rol y sedes autorizadas." },
  { q: "¿Qué sucede cuando consumo los recursos de mi plan?", a: "Configuración muestra el consumo y genera alertas al acercarse al límite. La creación de nuevos recursos se bloquea al alcanzar la capacidad efectiva del plan." },
  { q: "¿El plan Pro permite usar mi propia marca?", a: "Sí. Pro habilita personalización por empresa para nombre de plataforma, colores y logos, además de mayor capacidad operativa." },
  { q: "¿Existe una versión instalable?", a: "Sí. La edición self-hosted utiliza la misma aplicación web con PostgreSQL y Docker Compose. Durante la beta su distribución es privada y controlada." },
];

const workflow = [
  { step: "01", title: "Registra tu operación", text: "Crea empresa, sedes, ubicaciones y usuarios." },
  { step: "02", title: "Carga tus activos", text: "Organiza equipos y define dónde están instalados." },
  { step: "03", title: "Gestiona el mantenimiento", text: "Opera OT, preventivos, técnicos e inventario." },
  { step: "04", title: "Escala según tu plan", text: "Aumenta capacidad sin cambiar tu forma de trabajo." },
];

function formatCapacity(value: number) {
  return new Intl.NumberFormat("es-CO").format(value);
}

export default async function Home() {
  const session = await getSession();
  const [plans, customization] = await Promise.all([getActivePlans(), getCustomizationSummary()]);
  const lightLogo = logoOnLightSrc(customization);
  const darkLogo = customization.hasLogoOnDark ? logoOnDarkSrc(customization) : lightLogo;
  const darkLogoNeedsPlate = !customization.hasLogoOnDark;

  return <main className="marketing-page marketing-page-pro">
    <section className="marketing-top marketing-top-floating">
      <nav className="marketing-nav marketing-nav-pro marketing-nav-floating">
        <Link className="marketing-header-logo" href="/" aria-label="Desweb CMMS">
          <img src={lightLogo} alt="Desweb - Desarrollo de Soluciones" />
          <span>CMMS</span>
        </Link>

        <div className="marketing-nav-links marketing-nav-links-floating">
          <a href="#solucion">Solución</a>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#planes">Planes</a>
          <a href="#preguntas">Preguntas</a>
          <a href="#contacto">Contacto</a>
          <Link href="/downloads">Self-hosted</Link>
        </div>

        <div className="marketing-nav-actions marketing-nav-actions-floating">
          {session
            ? <Link className="marketing-login-link" href="/dashboard">Ir al panel</Link>
            : <Link className="marketing-login-link" href="/login">Iniciar sesión</Link>}
          <Link className="button marketing-nav-cta" href="/checkout?plan=trial">Probar 15 días</Link>
        </div>
      </nav>
    </section>

    <section className="marketing-hero marketing-hero-pro">
      <div className="marketing-hero-grid">
        <div className="marketing-hero-copy marketing-hero-copy-pro">
          <div className="marketing-beta-pill"><i /> Plataforma CMMS multiempresa · SaaS + self-hosted</div>
          <h1>El centro de control para un mantenimiento <em>más inteligente.</em></h1>
          <p>Conecta activos, sedes, órdenes de trabajo, mantenimiento preventivo, inventario y equipos técnicos en una experiencia visual diseñada para operar, medir y escalar.</p>
          <div className="marketing-hero-actions">
            <Link className="button marketing-primary-cta" href="/checkout?plan=trial">Iniciar prueba gratis</Link>
            <a className="button secondary marketing-secondary-cta" href="#solucion">Explorar plataforma</a>
          </div>
          <div className="marketing-hero-proof">
            <span><b>15 días</b><small>de prueba</small></span>
            <span><b>Multiempresa</b><small>y multisedes</small></span>
            <span><b>Pro</b><small>con marca blanca</small></span>
          </div>
        </div>

        <div className="marketing-product-stage" aria-label="Vista ilustrativa de Desweb CMMS">
          <div className="marketing-product-glow" />
          <div className="marketing-product-window">
            <div className="marketing-product-window-head">
              <div className="marketing-window-dots"><i /><i /><i /></div>
              <span>cmms.desweb.cloud</span>
              <b>DESWEB CMMS</b>
            </div>
            <div className="marketing-product-body">
              <aside className="marketing-product-sidebar">
                <div className="marketing-product-logo">D</div>
                <span className="active">▦ <b>Resumen</b></span>
                <span>◇ <b>Activos</b></span>
                <span>✓ <b>Órdenes</b></span>
                <span>↻ <b>Preventivos</b></span>
                <span>▤ <b>Inventario</b></span>
              </aside>
              <div className="marketing-product-main">
                <div className="marketing-product-title">
                  <div><small>VISIÓN GENERAL</small><strong>Resumen operativo</strong></div>
                  <span>Empresa activa</span>
                </div>
                <div className="marketing-mini-metrics">
                  <article><span>Activos disponibles</span><strong>148</strong><small>96.8% disponibilidad</small></article>
                  <article><span>OT abiertas</span><strong>12</strong><small>4 alta prioridad</small></article>
                  <article><span>Preventivos</span><strong>91%</strong><small>cumplimiento mensual</small></article>
                </div>
                <div className="marketing-product-grid">
                  <article className="marketing-chart-card">
                    <div><span>Órdenes de trabajo</span><b>Últimos 7 días</b></div>
                    <div className="marketing-bars">
                      {[34,62,48,78,56,88,70].map((height,index)=><i key={index} style={{height:`${height}%`}} />)}
                    </div>
                    <div className="marketing-chart-foot"><span><i /> Completadas</span><strong>32 OT</strong></div>
                  </article>
                  <article className="marketing-health-card">
                    <span>Estado de activos</span>
                    <div className="marketing-health-ring"><strong>97%</strong></div>
                    <small>Operación saludable</small>
                  </article>
                </div>
              </div>
            </div>
          </div>
          <div className="marketing-float-card marketing-float-card-one"><span>✓</span><div><strong>OT #1048 completada</strong><small>Compresor principal</small></div></div>
          <div className="marketing-float-card marketing-float-card-two"><span>↻</span><div><strong>Preventivo programado</strong><small>Próximo: 22 sep.</small></div></div>
        </div>
      </div>
    </section>

    <section className="marketing-trust-strip">
      <div><span>CMMS</span><strong>Una plataforma para toda la operación de mantenimiento</strong></div>
      <div className="marketing-trust-items">
        <span>Multiempresa</span><i />
        <span>Multisedes</span><i />
        <span>Roles y permisos</span><i />
        <span>Telemetría operativa</span><i />
        <span>Self-hosted</span>
      </div>
    </section>

    <section id="solucion" className="marketing-section marketing-solution">
      <div className="marketing-section-heading marketing-section-heading-center">
        <span className="eyebrow">Capacidades centrales</span>
        <h2>Información conectada. Decisiones más claras.</h2>
        <p>Una arquitectura modular que centraliza la información que mantenimiento necesita sin perder trazabilidad entre empresas, sedes, personas y equipos.</p>
      </div>
      <div className="marketing-feature-grid">
        {features.map(feature => <article className="marketing-feature-card" key={feature.title}>
          <span className="marketing-feature-icon">{feature.icon}</span>
          <h3>{feature.title}</h3>
          <p>{feature.text}</p>
        </article>)}
      </div>
    </section>

    <section id="como-funciona" className="marketing-section marketing-workflow">
      <div className="marketing-workflow-intro">
        <span className="eyebrow">Flujo operativo</span>
        <h2>De la estructura inicial al control diario, sin fricción.</h2>
        <p>La plataforma acompaña el crecimiento de la empresa: primero organiza la base, luego conecta procesos y finalmente escala capacidad según el plan.</p>
        <Link className="marketing-inline-link" href="/checkout?plan=trial">Empezar ahora <b>→</b></Link>
      </div>
      <div className="marketing-workflow-steps">
        {workflow.map(item => <article key={item.step}>
          <span>{item.step}</span>
          <div><strong>{item.title}</strong><p>{item.text}</p></div>
        </article>)}
      </div>
    </section>

    <section id="planes" className="marketing-plans marketing-plans-pro">
      <div className="marketing-section-heading marketing-section-heading-center">
        <span className="eyebrow">Planes mensuales</span>
        <h2>Una capacidad adecuada para cada etapa.</h2>
        <p>Empieza con 15 días de prueba y evoluciona a un plan mensual cuando tu operación esté lista.</p>
      </div>

      <div className="marketing-plan-grid marketing-plan-grid-pro">
        {plans.rows.map(plan => {
          const isTrial = plan.code === "trial";
          const isPro = plan.code === "pro";
          const isMedium = plan.code === "medium";
          return <article className={`marketing-plan-card marketing-plan-card-pro ${isPro ? "featured" : ""} ${isMedium ? "recommended" : ""}`} key={plan.id}>
            {isMedium && <span className="marketing-plan-ribbon">Más equilibrado</span>}
            {isPro && <span className="marketing-plan-ribbon pro">Marca blanca</span>}
            <div className="marketing-plan-top">
              <span>{isTrial ? "Explora la plataforma" : "Suscripción mensual"}</span>
              <h3>{plan.name}</h3>
              <p>{plan.description}</p>
            </div>
            <div className="marketing-plan-price">
              {isTrial ? <><strong>Gratis</strong><small>por 15 días</small></> : <><strong>Mensual</strong><small>precio comercial por definir</small></>}
            </div>
            <div className="marketing-plan-divider" />
            <ul>
              <li><b>{formatCapacity(plan.max_sites)}</b> ubicaciones principales</li>
              <li><b>{formatCapacity(plan.max_sublocations)}</b> sububicaciones</li>
              <li><b>{formatCapacity(plan.max_assets)}</b> activos</li>
              <li><b>{formatCapacity(plan.max_inventory_items)}</b> artículos de inventario</li>
              <li><b>{formatCapacity(plan.max_technicians)}</b> técnicos</li>
              {plan.white_label && <li><b>Marca blanca</b> y personalización visual</li>}
            </ul>
            <Link className={`button ${isTrial ? "secondary" : ""}`} href={`/checkout?plan=${plan.code}`}>
              {session?.organizationId ? (isTrial ? "Ver condiciones" : `Activar ${plan.name}`) : isTrial ? "Iniciar prueba" : "Probar checkout"}
            </Link>
          </article>;
        })}
      </div>
      <p className="marketing-test-note">Entorno comercial en construcción: los planes pagos usan actualmente un checkout simulado y no procesan tarjetas.</p>
    </section>

    <section id="preguntas" className="marketing-section marketing-faq-section">
      <div className="marketing-faq-intro">
        <span className="eyebrow">Preguntas frecuentes</span>
        <h2>Resuelve lo esencial antes de empezar.</h2>
        <p>Concentramos las preguntas comerciales y operativas más comunes para que puedas evaluar si Desweb CMMS encaja en tu operación.</p>
        <a className="marketing-inline-link" href="#contacto">Hablar con un asesor <b>→</b></a>
      </div>
      <div className="marketing-faq-list">
        {faqs.map((item,index)=><details key={item.q} open={index===0}>
          <summary><span>{String(index+1).padStart(2,"0")}</span><strong>{item.q}</strong><b>+</b></summary>
          <p>{item.a}</p>
        </details>)}
      </div>
    </section>

    <section id="contacto" className="marketing-lead-section">
      <div className="marketing-lead-copy">
        <span className="eyebrow">Habla con un asesor</span>
        <h2>¿Quieres evaluar el CMMS con tu operación real?</h2>
        <p>Déjanos tus datos y cuéntanos qué necesitas. Este canal está pensado para empresas que requieren una demostración, asesoría de plan, marca blanca o instalación self-hosted.</p>
        <div className="marketing-lead-points">
          <span><i>✓</i><b>Demo orientada a tu operación</b><small>Revisamos sedes, activos, técnicos y necesidades reales.</small></span>
          <span><i>✓</i><b>Plan adecuado a tu capacidad</b><small>Podemos partir del catálogo o evaluar un acuerdo comercial especial.</small></span>
          <span><i>✓</i><b>SaaS o self-hosted</b><small>Definimos contigo el modelo de despliegue más conveniente.</small></span>
        </div>
      </div>
      <div className="marketing-lead-card">
        <div className="marketing-lead-card-head"><span>Solicitud comercial</span><strong>Cuéntanos sobre tu empresa</strong></div>
        <MarketingLeadForm />
      </div>
    </section>

    <section className="marketing-selfhost">
      <div className="marketing-selfhost-copy">
        <span className="eyebrow">También disponible self-hosted</span>
        <h2>¿Necesitas ejecutar el CMMS en tu propia infraestructura?</h2>
        <p>Desweb CMMS puede distribuirse como una instalación web contenerizada con PostgreSQL, migraciones automáticas y un proceso de actualización controlado.</p>
        <div className="marketing-selfhost-actions">
          <Link className="button" href="/downloads">Conocer versión self-hosted</Link>
          <span>Docker Compose · PostgreSQL · instalación licenciada</span>
        </div>
      </div>
      <div className="marketing-selfhost-terminal" aria-hidden="true">
        <div><i /><i /><i /><span>desweb-cmms</span></div>
        <code>$ ./scripts/install.sh</code>
        <code><b>✓</b> PostgreSQL healthy</code>
        <code><b>✓</b> Migrations applied</code>
        <code><b>✓</b> Desweb CMMS ready on :3000</code>
      </div>
    </section>

    <section className="marketing-final-cta">
      <div>
        <span className="eyebrow">Empieza hoy</span>
        <h2>Tu operación de mantenimiento puede estar mejor organizada en 15 días.</h2>
        <p>Prueba la plataforma con recursos limitados y valida cómo se adapta a tu forma de trabajar antes de elegir un plan.</p>
      </div>
      <div>
        <Link className="button" href="/checkout?plan=trial">Crear prueba gratuita</Link>
        {session ? <Link className="button secondary" href="/dashboard">Volver al panel</Link> : <Link className="button secondary" href="/login">Ya tengo cuenta</Link>}
      </div>
    </section>

    <footer className="marketing-footer marketing-footer-pro">
      <div className="marketing-footer-brand">
        <Link className="marketing-footer-logo-link" href="/">
          <span className={`marketing-footer-logo-wrap ${darkLogoNeedsPlate ? "marketing-logo-needs-plate" : ""}`}>
            <img src={darkLogo} alt="Desweb - Desarrollo de Soluciones" />
          </span>
          <strong>CMMS</strong>
        </Link>
        <p>Una plataforma Desweb para centralizar y escalar la gestión de mantenimiento.</p>
        <div className="marketing-footer-contact">
          <a href="mailto:contacto@deswebcol.com">contacto@deswebcol.com</a>
          <a href="tel:+573134373474">+57 313 437 3474</a>
          <span>Bogotá, Colombia</span>
        </div>
      </div>

      <div className="marketing-footer-column">
        <strong>Producto</strong>
        <a href="#solucion">Solución</a>
        <a href="#como-funciona">Cómo funciona</a>
        <a href="#planes">Planes</a>
        <Link href="/downloads">Self-hosted</Link>
      </div>

      <div className="marketing-footer-column">
        <strong>Comenzar</strong>
        <Link href="/checkout?plan=trial">Prueba 15 días</Link>
        <Link href="/login">Iniciar sesión</Link>
        <a href="#contacto">Hablar con un asesor</a>
        <a href="#preguntas">Preguntas frecuentes</a>
      </div>

      <div className="marketing-footer-column marketing-footer-cta">
        <strong>¿Evaluando un CMMS?</strong>
        <p>Cuéntanos el tamaño de tu operación y un asesor podrá revisar contigo el plan o despliegue más adecuado.</p>
        <a className="button" href="#contacto">Solicitar contacto</a>
      </div>

      <div className="marketing-footer-bottom">
        <span>© {new Date().getFullYear()} Desweb. Todos los derechos reservados.</span>
        <div><Link href="/">Inicio</Link><Link href="/downloads">Descargas</Link></div>
      </div>
    </footer>
  </main>;
}
