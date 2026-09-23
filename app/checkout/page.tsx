import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlanByCode } from "@/lib/billing";
import { getSession } from "@/lib/auth";
import CheckoutForm from "./CheckoutForm";
import { getCustomizationSummary } from "@/lib/customization";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const params = await searchParams;
  const session = await getSession();
  const [planResult,customization] = await Promise.all([
    getPlanByCode(params.plan || "trial"),
    getCustomizationSummary(),
  ]);
  if (!planResult.rowCount) redirect("/#planes");
  const plan = planResult.rows[0];

  return <main className="checkout-page">
    <div className="checkout-home-link"><Link href="/">← Home</Link></div>
    <section className="checkout-card">
      <div className="checkout-summary">
        <span className="eyebrow">Checkout de prueba</span>
        <h1>{plan.name}</h1>
        <p>{plan.description}</p>
        <div className="checkout-plan-stats">
          <span>{plan.max_assets} activos</span>
          <span>{plan.max_technicians} técnicos</span>
          <span>{plan.max_sites} sedes</span>
        </div>
        <div className="notice">No se procesará ninguna tarjeta. Este flujo simula una compra para validar el aprovisionamiento automático.</div>
      </div>

      <CheckoutForm
        plan={{
          code: plan.code,
          name: plan.name,
          description: plan.description,
          max_assets: plan.max_assets,
          max_technicians: plan.max_technicians,
          max_sites: plan.max_sites,
        }}
        existingCompany={session?.organizationId ? {
          name: session.organizationName || "Empresa",
          email: session.email,
        } : null}
        defaultCountry={customization.defaultCountry}
        defaultLocale={customization.defaultLocale}
      />
    </section>
  </main>;
}
