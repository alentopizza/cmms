import type { AuthSession } from "@/lib/auth";

export type OrganizationScope = {
  unrestricted: boolean;
  organizationIds: string[];
};

export function organizationScopeFor(session: AuthSession): OrganizationScope {
  if (session.platformRole === "platform_owner") {
    return { unrestricted: true, organizationIds: [] };
  }
  if (session.platformRole === "superadmin") {
    return { unrestricted: false, organizationIds: session.platformOrganizationIds };
  }
  return {
    unrestricted: false,
    organizationIds: session.organizationId ? [session.organizationId] : [],
  };
}

export function canAccessOrganization(session: AuthSession, organizationId: string) {
  if (session.platformRole === "platform_owner") return true;
  if (session.platformRole === "superadmin") {
    return session.platformOrganizationIds.includes(organizationId);
  }
  return session.organizationId === organizationId;
}

export function isTenantCompanyAdmin(session: AuthSession) {
  return session.platformRole === "user" && session.role === "admin" && Boolean(session.organizationId);
}

export function canCreateOrganizations(session: AuthSession) {
  return session.platformRole === "platform_owner" || session.platformRole === "superadmin";
}

export function canManageOrganizationCommercialControls(session: AuthSession) {
  return session.platformRole === "platform_owner" || session.platformRole === "superadmin";
}
