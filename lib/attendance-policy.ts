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

export const DEFAULT_BIOMETRIC_NOTICE_TITLE="Autorización para tratamiento de datos biométricos";

export const DEFAULT_BIOMETRIC_NOTICE_BODY="La organización utiliza una plantilla matemática derivada de una captura facial en vivo para validar identidad y presencia dentro del módulo de Asistencia. La captura de enrolamiento se procesa para generar la plantilla biométrica y no se conserva como fotografía permanente. El sistema puede usar geolocalización, geocerca, prueba de vida y mecanismos anti-suplantación durante el enrolamiento y las marcaciones. La plantilla se almacena cifrada y se utiliza únicamente para los fines de control de presencia configurados por la organización. Puedes solicitar información, revocación o reenrolamiento a los responsables autorizados de tu organización. Al continuar confirmas que pudiste leer esta información y autorizas expresamente el tratamiento descrito.";

export function attendanceRoleEnabled(
  session: Pick<AuthSession,"platformRole"|"role">,
  enabledRoles:string[],
) {
  if (session.platformRole !== "user") return true;
  return Boolean(session.role && enabledRoles.includes(session.role));
}
