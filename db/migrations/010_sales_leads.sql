-- Public commercial leads captured from the marketing landing.
CREATE TABLE sales_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  company_name text NOT NULL,
  email text NOT NULL,
  phone text,
  interest text NOT NULL,
  message text,
  source text NOT NULL DEFAULT 'landing',
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_leads_status_check CHECK (status IN ('new','contacted','qualified','closed','discarded')),
  CONSTRAINT sales_leads_interest_check CHECK (interest IN ('demo','trial','basic','medium','pro','self_hosted','other'))
);

CREATE INDEX sales_leads_created_idx ON sales_leads(created_at DESC);
CREATE INDEX sales_leads_status_idx ON sales_leads(status,created_at DESC);
CREATE INDEX sales_leads_email_idx ON sales_leads(lower(email));
