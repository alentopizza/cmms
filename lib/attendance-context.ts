import type { AuthSession } from "@/lib/auth";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ── Attendance administration tenant context ─────────────────────────────────
// Tenant users always operate inside their session organization. Platform
// operators may explicitly select an active organization in administrative
// attendance surfaces; the selected identifier is still revalidated by the
// server query/mutation that consumes it.
export function attendanceOrganizationId(
  session:AuthSession,
  requestedOrganizationId:unknown,
){
  if(session.platformRole==="user")return session.organizationId;
  const candidate=typeof requestedOrganizationId==="string"?requestedOrganizationId.trim():"";
  if(!UUID.test(candidate))return null;
  if(session.platformRole==="superadmin"&&!session.platformOrganizationIds.includes(candidate))return null;
  return candidate;
}
