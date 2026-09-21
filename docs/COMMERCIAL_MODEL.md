# Commercial model

This document captures the commercial/product model so future developers and AI agents do not infer it from implementation details.

## Product model

Desweb CMMS is intended to be sold primarily as a monthly SaaS subscription with four tiers.

### Trial

Purpose: demonstrate the versatility of the platform with meaningful but intentionally small capacity.

- duration: 15 days;
- principal locations: 1;
- sublocations: 10;
- assets: 25;
- inventory items: 25;
- technicians: 2;
- Desweb branding;
- after expiration, tenant operational access is blocked;
- customer data is retained and can be reactivated by purchasing a paid plan.

### Basic

For small maintenance operations.

- principal locations: 3;
- sublocations: 50;
- assets: 150;
- inventory items: 250;
- technicians: 5;
- monthly subscription;
- Desweb branding.

### Medium

For growing maintenance teams.

- principal locations: 10;
- sublocations: 250;
- assets: 750;
- inventory items: 1,000;
- technicians: 20;
- monthly subscription;
- Desweb branding.

### Pro

For larger operations and customers who require their own visual identity.

- principal locations: 30;
- sublocations: 1,000;
- assets: 3,000;
- inventory items: 5,000;
- technicians: 75;
- monthly subscription;
- organization white label;
- custom application name;
- tenant colors;
- light/dark logos;
- optional Desweb signature.

Prices are intentionally not hard-coded yet. Pricing is a commercial decision and should be populated only after approval.

## Sales channels

Two acquisition paths are required.

### Self-service

Future public landing flow:

```text
Landing
  -> select plan
  -> hosted payment checkout
  -> verified payment webhook
  -> organization provisioning
  -> company administrator creation
  -> subscription activation
  -> immediate access
```

The current landing implements a **test checkout** for validating provisioning. It must not be mistaken for a payment processor.

### Advisor / direct sales

A Desweb advisor or Superadministrator creates the company from the platform and assigns Trial, Basic, Medium or Pro.

Plan defaults are copied into `organization_limits`. The Superadministrator may later apply negotiated overrides without changing the shared plan definition.

## Subscription lifecycle

Current modeled states:

- `trialing`
- `trial_expired`
- `active`
- `past_due`
- `suspended`
- `canceled`

Paid plans are monthly. The future payment provider must become the authority for successful payment, renewal, past-due and cancellation transitions through verified server-side webhooks.

Never activate a paid plan merely because the browser returns from a checkout-success URL.

## Entitlement architecture

`billing_plans` = shared commercial defaults.

`organization_subscriptions` = current plan/status for a tenant.

`organization_limits` = effective capacity enforced by the operational application.

This separation is intentional. It enables custom commercial agreements while preserving a stable public catalog.

## Capacity UX

Company administrators see consumption but cannot alter capacity.

Thresholds:

- below 80%: normal/teal;
- 80–94%: warning;
- 95% or more: critical;
- 100%: creation must be blocked server-side.

Only the Superadministrator may change contractual resource limits.


## Checkout UX requirements

The provisioning checkout must preserve user-entered data when validation or server errors occur.

Required behavior:

- validate required fields client-side before submission;
- validate again server-side;
- return field-specific errors for recoverable issues;
- duplicate email must be reported explicitly as an email conflict;
- failed provisioning must not clear company/name/email/password/city/site inputs in the active browser form;
- checkout screens must always offer a direct path back to Home and to plan comparison;
- after successful provisioning, redirect the tenant to company settings so the acquired plan, subscription dates and resource entitlements are immediately visible;
- plan upgrades from company settings return to the same settings view and refresh effective limits.


## Lead generation

The public landing supports advisor-assisted sales in addition to self-service checkout.

`sales_leads` stores:
- contact name;
- company;
- corporate email;
- phone;
- interest type;
- optional operation/request description;
- source;
- commercial status;
- timestamps.

Current interest categories:
- demonstration;
- Trial;
- Basic;
- Medium;
- Pro/white-label;
- self-hosted;
- other.

Lead statuses:
- new;
- contacted;
- qualified;
- closed;
- discarded.

Superadministrators have a **Leads** workspace for viewing landing inquiries and updating follow-up status. Company roles do not receive lead-management access.

Future commercialization work should add anti-spam/rate limiting, assignment to advisors, notes, source/campaign attribution, notifications and conversion analytics.


## Approved sales and distribution account model — pending implementation

Commercial growth will use dedicated platform roles rather than granting Superadministrator access to every seller.

### Comercial Desweb

An internal seller/advisor may manage assigned leads, opportunities, plan information, demonstrations, onboarding steps and future renewals/commissions. This role does not receive unrestricted customer maintenance-data administration or destructive tenant controls.

### Partner / Distribuidor

An external distribution account is limited to its authorized leads and attributed customer portfolio. It does not see the full Desweb customer base by default and does not receive Superadministrator privileges.

### Platform governance

Propietario Desweb / Platform Owner is the maximum platform authority. Superadministrators remain trusted platform operators, but only the Platform Owner may create/revoke Superadministrators.

The detailed role and account-creation rules are maintained in `docs/ROLE_MODEL.md`.

Future commercial data should support:
- lead/customer attribution to a Commercial or Partner;
- portfolio scoping;
- commissions;
- renewals;
- sales goals;
- channel/partner codes;
- approved discount workflows.

These commercial relationships must remain separate from tenant operational authorization.
