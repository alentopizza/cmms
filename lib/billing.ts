import { query } from "@/lib/db";

export type PlanCode = "trial" | "basic" | "medium" | "pro";
export type SubscriptionStatus = "trialing" | "trial_expired" | "active" | "past_due" | "suspended" | "canceled";

export type BillingPlan = {
  id: string;
  code: PlanCode;
  name: string;
  description: string | null;
  monthly_price_cop: number | null;
  trial_days: number;
  white_label: boolean;
  max_sites: number;
  max_sublocations: number;
  max_assets: number;
  max_inventory_items: number;
  max_technicians: number;
  sort_order: number;
};

export async function getActivePlans() {
  return query<BillingPlan>(
    `SELECT id,code,name,description,monthly_price_cop,trial_days,white_label,
            max_sites,max_sublocations,max_assets,max_inventory_items,max_technicians,sort_order
     FROM billing_plans
     WHERE active=true
     ORDER BY sort_order`,
  );
}

export async function getPlanByCode(code: string) {
  return query<BillingPlan>(
    `SELECT id,code,name,description,monthly_price_cop,trial_days,white_label,
            max_sites,max_sublocations,max_assets,max_inventory_items,max_technicians,sort_order
     FROM billing_plans
     WHERE code=$1 AND active=true
     LIMIT 1`,
    [code],
  );
}

export function isSubscriptionUsable(status: SubscriptionStatus | null, trialEndsAt: string | null) {
  if (status === "active") return true;
  if (status !== "trialing") return false;
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt).getTime() > Date.now();
}

export function subscriptionLabel(status: SubscriptionStatus | null, trialEndsAt: string | null) {
  if (status === "trialing" && trialEndsAt) {
    const days = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000));
    return `Prueba · ${days} día${days === 1 ? "" : "s"} restante${days === 1 ? "" : "s"}`;
  }
  if (status === "active") return "Suscripción activa";
  if (status === "past_due") return "Pago pendiente";
  if (status === "suspended") return "Suscripción suspendida";
  if (status === "canceled") return "Suscripción cancelada";
  return "Prueba vencida";
}
