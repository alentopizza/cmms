import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import type { OrganizationRole } from "@/lib/permissions";

export const COOKIE_NAME = "cmms_session";

type SessionPayload =
  | { v: 1; kind: "bootstrap"; exp: number }
  | { v: 1; kind: "user"; userId: string; exp: number };

export type AuthSession = {
  kind: "bootstrap" | "user";
  userId: string | null;
  email: string;
  fullName: string;
  platformRole: "superadmin" | "user";
  organizationId: string | null;
  organizationName: string | null;
  role: OrganizationRole | null;
  siteId: string | null;
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

export async function getSession(): Promise<AuthSession | null> {
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
      fullName: "Desarrollador / Superadministrador",
      platformRole: "superadmin",
      organizationId: null,
      organizationName: null,
      role: null,
      siteId: null,
    };
  }

  const result = await query<{
    id: string;
    email: string;
    full_name: string;
    platform_role: "superadmin" | "user";
    organization_id: string | null;
    organization_name: string | null;
    role: OrganizationRole | null;
    site_id: string | null;
  }>(
    `SELECT u.id,u.email,u.full_name,u.platform_role,
            membership.organization_id,membership.organization_name,membership.role,membership.site_id
     FROM users u
     LEFT JOIN LATERAL (
       SELECT om.organization_id,o.name organization_name,om.role,om.site_id
       FROM organization_members om
       JOIN organizations o ON o.id=om.organization_id
       WHERE om.user_id=u.id AND o.active=true
       ORDER BY om.created_at ASC
       LIMIT 1
     ) membership ON true
     WHERE u.id=$1 AND u.active=true`,
    [payload.userId],
  );

  if (!result.rowCount) return null;
  const user = result.rows[0];

  if (user.platform_role !== "superadmin" && !user.organization_id) return null;

  return {
    kind: "user",
    userId: user.id,
    email: user.email,
    fullName: user.full_name,
    platformRole: user.platform_role,
    organizationId: user.organization_id,
    organizationName: user.organization_name,
    role: user.platform_role === "superadmin" ? null : user.role,
    siteId: user.site_id,
  };
}

export async function isAuthenticated() {
  return Boolean(await getSession());
}
