import Link from "next/link";
import { getSession } from "@/lib/auth";
import { isSubscriptionUsable } from "@/lib/billing";
import { getActivePlans } from "@/lib/billing";

export default async function Home() {
  const session = await getSession();
  if (session && (session.platformRole === "superadmin" || isSubscriptionUsable(session.subscriptionStatus, session.trialEndsAt))) {
    return <main className="marketing-page"><div className="marketing-shell"><p>Ya tienes una sesión activa.</p><Link className="button" href="/dashboard">Ir al dashboard</Link></div></main>;
  }

  const plans = await getActivePlans();

  return <main className="marketing-page">
    <section className="marketing-hero">
      <div className="marketing-nav">
        <div className="marketing-brand"><span>D</span><strong>DESWEB CMMS</strong></div>
        <div><Link href="/login">Iniciar sesión</Link><a href="#planes" className="button">Ver planes</a></div>
      </div>
      <div className="marketing-hero-copy">
        <span className="eyebrow">Mantenimiento inteligente</span>
        <h1>Organiza activos, órdenes de trabajo, preventivos e inventario desde una sola plataforma.</h1>
        <p>Empieza con una prueba de 15 días o elige un plan mensual según el tamaño de tu operación.</p>
        <div className="marketing-hero-actions"><Link className="button" href="/checkout?plan=trial">Probar 15 días</Link><a className="button secondary" href="#planes">Comparar planes</a></div>
      </div>
    </section>

    <section id="planes" className="marketing-plans">
      <div className="marketing-section-heading"><span className="eyebrow">Planes mensuales</span><h2>Escala el CMMS con tu operación</h2><p>Esta landing usa checkout simulado para validar el alta. Los cobros reales se conectarán después por webhook.</p></div>
      <div className="marketing-plan-grid">
        {plans.rows.map(plan => <article className={`marketing-plan-card ${plan.code === "pro" ? "featured" : ""}`} key={plan.id}>
          <div><span>{plan.code === "trial" ? "15 días" : plan.code === "pro" ? "Marca blanca" : "Mensual"}</span><h3>{plan.name}</h3><p>{plan.description}</p></div>
          <div className="marketing-plan-price">{plan.code === "trial" ? "Gratis" : "Precio por definir"}</div>
          <ul>
            <li>{plan.max_sites} ubicaciones principales</li>
            <li>{plan.max_sublocations} sububicaciones</li>
            <li>{plan.max_assets} activos</li>
            <li>{plan.max_inventory_items} artículos de inventario</li>
            <li>{plan.max_technicians} técnicos</li>
            {plan.white_label && <li>Marca blanca y personalización</li>}
          </ul>
          <Link className="button" href={`/checkout?plan=${plan.code}`}>{session ? "Activar este plan" : plan.code === "trial" ? "Iniciar prueba" : "Probar compra"}</Link>
        </article>)}
      </div>
    </section>
  </main>;
}
