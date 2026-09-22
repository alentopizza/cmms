import type { AuthSession } from "@/lib/auth";
import type { OrganizationRole } from "@/lib/permissions";

export type AttendancePolicy = {
  enabled:boolean;
  enabled_roles:string[];
  require_face:boolean;
  require_geolocation:boolean;
  max_location_accuracy_m:number;
  face_similarity_threshold:number;
  liveness_threshold:number;
};

export const DEFAULT_ATTENDANCE_ROLES: OrganizationRole[] = [
  "admin",
  "manager",
  "technician",
  "provider",
  "external",
];

export const DEFAULT_ATTENDANCE_POLICY: AttendancePolicy = {
  enabled:true,
  enabled_roles:[...DEFAULT_ATTENDANCE_ROLES],
  require_face:true,
  require_geolocation:true,
  max_location_accuracy_m:120,
  face_similarity_threshold:0.55,
  liveness_threshold:0.60,
};

export function attendanceRoleEnabled(
  session: Pick<AuthSession,"platformRole"|"role">,
  enabledRoles:string[],
) {
  if (session.platformRole !== "user") return true;
  return Boolean(session.role && enabledRoles.includes(session.role));
}
