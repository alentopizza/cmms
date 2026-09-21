import type { PoolClient } from "pg";
import { query } from "@/lib/db";

export type ResourceLimits = {
  max_sites: number;
  max_sublocations: number;
  max_assets: number;
  max_inventory_items: number;
  max_technicians: number;
};

export const DEFAULT_LIMITS: ResourceLimits = {
  max_sites: 5,
  max_sublocations: 100,
  max_assets: 500,
  max_inventory_items: 1000,
  max_technicians: 50,
};

export function positiveLimit(value: FormDataEntryValue | null, fallback: number, minimum = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

export async function canCreateSite(organizationId: string) {
  const result = await query<{ used: number; allowed: number }>(
    `SELECT (SELECT count(*)::int FROM sites WHERE organization_id=$1) used,
            COALESCE((SELECT max_sites FROM organization_limits WHERE organization_id=$1), $2)::int allowed`,
    [organizationId, DEFAULT_LIMITS.max_sites],
  );
  return result.rows[0].used < result.rows[0].allowed;
}

export async function canCreateLocation(client: PoolClient, organizationId: string) {
  const result = await client.query<{ used: number; allowed: number }>(
    `SELECT (SELECT count(*)::int FROM locations WHERE organization_id=$1) used,
            COALESCE((SELECT max_sublocations FROM organization_limits WHERE organization_id=$1), $2)::int allowed`,
    [organizationId, DEFAULT_LIMITS.max_sublocations],
  );
  return result.rows[0].used < result.rows[0].allowed;
}


export async function canCreateAsset(organizationId: string) {
  const result = await query<{ used: number; allowed: number }>(
    `SELECT (SELECT count(*)::int FROM assets WHERE organization_id=$1) used,
            COALESCE((SELECT max_assets FROM organization_limits WHERE organization_id=$1), $2)::int allowed`,
    [organizationId, DEFAULT_LIMITS.max_assets],
  );
  return result.rows[0].used < result.rows[0].allowed;
}

export async function canCreateInventoryItem(organizationId: string) {
  const result = await query<{ used: number; allowed: number }>(
    `SELECT (SELECT count(*)::int FROM inventory_items WHERE organization_id=$1) used,
            COALESCE((SELECT max_inventory_items FROM organization_limits WHERE organization_id=$1), $2)::int allowed`,
    [organizationId, DEFAULT_LIMITS.max_inventory_items],
  );
  return result.rows[0].used < result.rows[0].allowed;
}
