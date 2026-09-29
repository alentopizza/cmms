import { createHmac, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import type { OrganizationRole, PlatformRole } from "@/lib/permissions";

export const COOKIE_NAME = "cmms_session";

type SessionPayload =
  | { v: 1; kind: "bootstrap"; exp: number }
  | { v: 1; kind: "user"; userId: string; exp: number };

export type AuthSession = {
  kind: "bootstrap" | "user";
  userId: string | null;
  email: string;
  fullName: string;
  platformRole: PlatformRole;
  organizationId: string | null;
  organizationName: string | null;
  role: OrganizationRole | null;
  siteId: string | null;
  accessAllSites: boolean;
  siteIds: string[];
  planCode: "trial" | "basic" | "medium" | "pro" | null;
  subscriptionStatus: "trialing" | "trial_expired" | "active" | "past_due" | "suspended" | "canceled" | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  whiteLabel: boolean;
  externalSupplierId: string | null;
  platformOrganizationIds: string[];
};

function secret() {
  return process.env.AUTH_SECRET || "";
}

function sign(encodedPayload: string) {
  return createHmac("sha256", secret()).update(encodedPayload).digest("base64url");
}

export function createSessionToken(payload: SessionPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function parseSessionToken(token: string): SessionPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  if (signature.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (payload.v !== 1 || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function bootstrapSessionToken(maxAgeSeconds = 60 * 60 * 12) {
  return createSessionToken({
    v: 1,
    kind: "bootstrap",
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  });
}

export function userSessionToken(userId: string, maxAgeSeconds = 60 * 60 * 12) {
  return createSessionToken({
    v: 1,
    kind: "user",
    userId,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  });
}

async function resolveSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = parseSessionToken(token);
  if (!payload) return null;

  if (payload.kind === "bootstrap") {
    const email = (process.env.APP_ADMIN_EMAIL || "").trim().toLowerCase();
    if (!email) return null;
    return {
      kind: "bootstrap",
      userId: null,
      email,
      fullName: "Propietario Desweb",
      platformRole: "platform_owner",
      organizationId: null,
      organizationName: null,
      role: null,
      siteId: null,
      accessAllSites: true,
      siteIds: [],
      planCode: null,
      subscriptionStatus: "active",
      trialEndsAt: null,
      currentPeriodEnd: null,
      whiteLabel: true,
      externalSupplierId: null,
      platformOrganizationIds: [],
    };
  }

  const result = await query<{
    id: string;
    email: string;
    full_name: string;
    platform_role: PlatformRole;
    organization_id: string | null;
    organization_name: string | null;
    role: OrganizationRole | null;
    site_id: string | null;
    access_all_sites: boolean | null;
    site_ids: string[] | null;
    plan_code: "trial" | "basic" | "medium" | "pro" | null;
    subscription_status: "trialing" | "trial_expired" | "active" | "past_due" | "suspended" | "canceled" | null;
    trial_ends_at: string | null;
    current_period_end: string | null;
    white_label: boolean | null;
    external_supplier_id: string | null;
    platform_organization_ids: string[] | null;
  }>(
    `SELECT u.id,u.email,u.full_name,u.platform_role,
            membership.organization_id,membership.organization_name,membership.role,membership.site_id,
            membership.access_all_sites,membership.site_ids,membership.external_supplier_id,
            subscription.plan_code,subscription.subscription_status,subscription.trial_ends_at,
            subscription.current_period_end,subscription.white_label,
            COALESCE((
              SELECT array_agg(poa.organization_id::text ORDER BY poa.organization_id::text)
              FROM platform_organization_access poa
              WHERE poa.user_id=u.id
            ),ARRAY[]::text[]) platform_organization_ids
     FROM users u
     LEFT JOIN LATERAL (
       SELECT om.organization_id,o.name organization_name,om.role,om.site_id,om.access_all_sites,om.external_supplier_id,
              COALESCE((
                SELECT array_agg(oms.site_id::text ORDER BY oms.site_id::text)
                FROM organization_member_sites oms
                WHERE oms.organization_id=om.organization_id AND oms.user_id=om.user_id
              ), ARRAY[]::text[]) site_ids
       FROM organization_members om
       JOIN organizations o ON o.id=om.organization_id
       WHERE om.user_id=u.id AND o.active=true
       ORDER BY om.created_at ASC
       LIMIT 1
     ) membership ON true
     LEFT JOIN LATERAL (
       SELECT bp.code plan_code,os.status subscription_status,
              os.trial_ends_at::text trial_ends_at,os.current_period_end::text current_period_end,
              bp.white_label
       FROM organization_subscriptions os
       JOIN billing_plans bp ON bp.id=os.plan_id
       WHERE os.organization_id=membership.organization_id
       LIMIT 1
     ) subscription ON true
     WHERE u.id=$1 AND u.active=true`,
    [payload.userId],
  );

  if (!result.rowCount) return null;
  const user = result.rows[0];

  if (user.platform_role === "user" && !user.organization_id) return null;

  return {
    kind: "user",
    userId: user.id,
    email: user.email,
    fullName: user.full_name,
    platformRole: user.platform_role,
    organizationId: user.organization_id,
    organizationName: user.organization_name,
    role: user.platform_role !== "user" ? null : user.role,
    siteId: user.site_id,
    accessAllSites: user.platform_role !== "user" ? true : Boolean(user.access_all_sites),
    siteIds: user.platform_role !== "user" ? [] : (user.site_ids || []),
    planCode: user.platform_role !== "user" ? null : user.plan_code,
    subscriptionStatus: user.platform_role !== "user" ? "active" : user.subscription_status,
    trialEndsAt: user.platform_role !== "user" ? null : user.trial_ends_at,
    currentPeriodEnd: user.platform_role !== "user" ? null : user.current_period_end,
    whiteLabel: user.platform_role !== "user" ? true : Boolean(user.white_label),
    externalSupplierId: user.platform_role !== "user" ? null : user.external_supplier_id,
    platformOrganizationIds: user.platform_role === "superadmin" ? (user.platform_organization_ids || []) : [],
  };
}

export const getSession = cache(resolveSession);

export async function isAuthenticated() {
  return Boolean(await getSession());
}


export function canAccessSite(session: AuthSession, siteId: string) {
  return session.platformRole !== "user" || session.accessAllSites || session.siteIds.includes(siteId);
}
