-- SaaS plans, subscriptions and billing lifecycle foundation.

CREATE TABLE billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  monthly_price_cop integer,
  trial_days integer NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  white_label boolean NOT NULL DEFAULT false,
  max_sites integer NOT NULL CHECK (max_sites >= 0),
  max_sublocations integer NOT NULL CHECK (max_sublocations >= 0),
  max_assets integer NOT NULL CHECK (max_assets >= 0),
  max_inventory_items integer NOT NULL CHECK (max_inventory_items >= 0),
  max_technicians integer NOT NULL CHECK (max_technicians >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_plans_code_check CHECK (code IN ('trial','basic','medium','pro'))
);

INSERT INTO billing_plans(
  code,name,description,monthly_price_cop,trial_days,white_label,
  max_sites,max_sublocations,max_assets,max_inventory_items,max_technicians,sort_order
) VALUES
  ('trial','Prueba gratuita','Explora las funciones principales de Desweb CMMS durante 15 días.',NULL,15,false,1,10,25,25,2,10),
  ('basic','Básico','Para operaciones pequeñas que necesitan organizar mantenimiento, activos y órdenes de trabajo.',NULL,0,false,3,50,150,250,5,20),
  ('medium','Medio','Para equipos de mantenimiento en crecimiento con mayor capacidad operativa.',NULL,0,false,10,250,750,1000,20,30),
  ('pro','Pro','Mayor capacidad operativa y habilitación de marca blanca por organización.',NULL,0,true,30,1000,3000,5000,75,40)
ON CONFLICT(code) DO UPDATE SET
  name=EXCLUDED.name,
  description=EXCLUDED.description,
  trial_days=EXCLUDED.trial_days,
  white_label=EXCLUDED.white_label,
  max_sites=EXCLUDED.max_sites,
  max_sublocations=EXCLUDED.max_sublocations,
  max_assets=EXCLUDED.max_assets,
  max_inventory_items=EXCLUDED.max_inventory_items,
  max_technicians=EXCLUDED.max_technicians,
  sort_order=EXCLUDED.sort_order,
  updated_at=now();

CREATE TABLE organization_subscriptions (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES billing_plans(id),
  status text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  auto_renew boolean NOT NULL DEFAULT true,
  has_custom_limits boolean NOT NULL DEFAULT false,
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_subscriptions_status_check CHECK (status IN ('trialing','trial_expired','active','past_due','suspended','canceled')),
  CONSTRAINT organization_subscriptions_source_check CHECK (source IN ('manual','test_checkout','payment_provider'))
);

CREATE INDEX organization_subscriptions_plan_idx ON organization_subscriptions(plan_id);
CREATE INDEX organization_subscriptions_status_idx ON organization_subscriptions(status);

CREATE TABLE subscription_events (
  id bigserial PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  source text NOT NULL DEFAULT 'system',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX subscription_events_org_idx ON subscription_events(organization_id,created_at DESC);

-- Existing companies stay active and preserve their current custom limits.
INSERT INTO organization_subscriptions(
  organization_id,plan_id,status,source,current_period_start,current_period_end,auto_renew,has_custom_limits
)
SELECT o.id,p.id,'active','manual',now(),now() + interval '1 month',true,true
FROM organizations o
JOIN billing_plans p ON p.code='medium'
ON CONFLICT(organization_id) DO NOTHING;
