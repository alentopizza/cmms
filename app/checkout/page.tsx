import { redirect } from "next/navigation";
import { getPlanByCode } from "@/lib/billing";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ plan?: string; error?: string }> }) {
  const params = await searchParams;
  const planResult = await getPlanByCode(params.plan || "trial");
  if (!planResult.rowCount) redirect("/#planes");
  const plan = planResult.rows[0];

  return <main className="checkout-page">
    <section className="checkout-card">
      <div className="checkout-summary">
        <span className="eyebrow">Checkout de prueba</span>
        <h1>{plan.name}</h1>
        <p>{plan.description}</p>
        <div className="checkout-plan-stats"><span>{plan.max_assets} activos</span><span>{plan.max_technicians} técnicos</span><span>{plan.max_sites} sedes</span></div>
        <div className="notice">No se procesará ninguna tarjeta. Este flujo simula una compra para validar el aprovisionamiento automático.</div>
      </div>
      <form className="checkout-form" method="post" action="/api/public/test-checkout">
        <input type="hidden" name="plan_code" value={plan.code} />
        {params.error && <div className="notice error">No fue posible crear la cuenta. Revisa los datos o usa otro correo.</div>}
        <div className="field"><label>Empresa</label><input name="company_name" required placeholder="Mi empresa" /></div>
        <div className="field"><label>Nombre completo</label><input name="full_name" required placeholder="Nombre del administrador" /></div>
        <div className="field"><label>Correo</label><input name="email" type="email" required /></div>
        <div className="field"><label>Contraseña</label><input name="password" type="password" minLength={8} required /></div>
        <div className="field"><label>Ciudad</label><input name="city" required placeholder="Bogotá" /></div>
        <div className="field"><label>Nombre sede principal</label><input name="site_name" defaultValue="Sede principal" required /></div>
        <button className="button" type="submit">{plan.code === "trial" ? "Crear prueba de 15 días" : "Simular compra y crear cuenta"}</button>
        <Link href="/#planes">← Volver a planes</Link>
      </form>
    </section>
  </main>;
}
