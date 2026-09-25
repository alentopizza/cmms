import type { AuthSession } from "@/lib/auth";
import { canAccessSite } from "@/lib/auth";
import { isPlatformOperator } from "@/lib/permissions";

// ── Attendance administrative scope ─────────────────────────────────────────
// Platform operators may explicitly target a customer organization. Tenant
// users may only operate on the organization already present in their session.

export function resolveAttendanceOrganization(
  session: AuthSession,
  requestedOrganizationId?: unknown,
) {
  const requested = typeof requestedOrganizationId === "string" ? requestedOrganizationId.trim() : "";
  if (isPlatformOperator(session)) return requested || null;
  if (!session.organizationId) return null;
  if (requested && requested !== session.organizationId) return null;
  return session.organizationId;
}

export function canAccessAttendanceSite(
  session: AuthSession,
  organizationId: string,
  siteId: string,
) {
  if (isPlatformOperator(session)) return true;
  return session.organizationId === organizationId && canAccessSite(session, siteId);
}
