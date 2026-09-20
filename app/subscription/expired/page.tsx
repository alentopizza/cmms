import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { subscriptionLabel } from "@/lib/billing";

export default async function SubscriptionExpiredPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.platformRole === "superadmin") redirect("/dashboard");

  return <main className="subscription-gate-page">
    <section className="subscription-gate-card">
      <div className="subscription-gate-icon">!</div>
      <span className="eyebrow">Suscripción</span>
      <h1>{session.subscriptionStatus === "past_due" ? "Tu suscripción requiere atención" : "Tu periodo de acceso finalizó"}</h1>
      <p>{subscriptionLabel(session.subscriptionStatus, session.trialEndsAt)}. Tus datos permanecen guardados y podrás continuar cuando actives un plan.</p>
      <div className="subscription-gate-actions">
        <Link className="button" href="/#planes">Elegir un plan</Link>
        <Link className="button secondary" href="/login">Volver al acceso</Link>
      </div>
      <small>No eliminamos automáticamente la información de tu empresa al finalizar la prueba.</small>
    </section>
  </main>;
}
