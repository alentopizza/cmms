export type OrganizationRole = "owner" | "admin" | "manager" | "technician" | "requester" | "viewer";
export type Permission =
  | "companies.manage"
  | "company_resources.manage"
  | "personalization.manage"
  | "users.manage"
  | "locations.manage"
  | "assets.read"
  | "assets.write"
  | "work_orders.read"
  | "work_orders.write"
  | "maintenance.read"
  | "maintenance.write"
  | "inventory.read"
  | "inventory.write";

export const ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: "Propietario",
  admin: "Administrador de empresa",
  manager: "Manager / Supervisor",
  technician: "Técnico",
  requester: "Solicitante",
  viewer: "Consulta",
};

export const ROLE_DESCRIPTIONS: Record<OrganizationRole, string> = {
  owner: "Administra usuarios, ubicaciones y toda la operación de mantenimiento de su empresa.",
  admin: "Administra usuarios, ubicaciones, activos, órdenes de trabajo, preventivos e inventario de su empresa.",
  manager: "Opera ubicaciones, activos, órdenes de trabajo, preventivos e inventario, sin acceso a la configuración global de la plataforma.",
  technician: "Consulta activos y preventivos, trabaja sobre órdenes de trabajo y puede consultar inventario relacionado con la operación.",
  requester: "Crea solicitudes de mantenimiento y consulta únicamente las solicitudes generadas por su propia cuenta.",
  viewer: "Acceso de consulta a activos, órdenes de trabajo, preventivos e inventario, sin funciones de creación o edición.",
};

export const SUPERADMIN_DESCRIPTION = "Acceso total a la plataforma: empresas, usuarios, límites, personalización global y todos los módulos operativos.";

const ROLE_PERMISSIONS: Record<OrganizationRole, Permission[]> = {
  owner: ["users.manage","locations.manage","assets.read","assets.write","work_orders.read","work_orders.write","maintenance.read","maintenance.write","inventory.read","inventory.write"],
  admin: ["users.manage","locations.manage","assets.read","assets.write","work_orders.read","work_orders.write","maintenance.read","maintenance.write","inventory.read","inventory.write"],
  manager: ["locations.manage","assets.read","assets.write","work_orders.read","work_orders.write","maintenance.read","maintenance.write","inventory.read","inventory.write"],
  technician: ["assets.read","work_orders.read","work_orders.write","maintenance.read","inventory.read"],
  requester: ["work_orders.read","work_orders.write"],
  viewer: ["assets.read","work_orders.read","maintenance.read","inventory.read"],
};

export type PermissionSubject = {
  platformRole: "superadmin" | "user";
  role: OrganizationRole | null;
};

export function can(subject: PermissionSubject | null, permission: Permission) {
  if (!subject) return false;
  if (subject.platformRole === "superadmin") return true;
  if (!subject.role) return false;
  return ROLE_PERMISSIONS[subject.role].includes(permission);
}

export function roleLabel(subject: PermissionSubject | null) {
  if (!subject) return "";
  if (subject.platformRole === "superadmin") return "Superadministrador";
  return subject.role ? ROLE_LABELS[subject.role] : "Sin rol";
}
