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
