export type OrganizationRole = "admin" | "manager" | "technician" | "requester" | "viewer" | "external";
export type Permission =
  | "companies.manage"
  | "leads.manage"
  | "company_resources.manage"
  | "settings.view"
  | "personalization.manage"
  | "users.manage"
  | "locations.manage"
  | "suppliers.manage"
  | "crews.manage"
  | "activities.manage"
  | "activities.execute"
  | "assets.read"
  | "assets.write"
  | "work_orders.read"
  | "work_orders.write"
  | "maintenance.read"
  | "maintenance.write"
  | "inventory.read"
  | "inventory.write";

export const ROLE_LABELS: Record<OrganizationRole, string> = {
  admin: "Administrador de empresa",
  manager: "Manager / Supervisor",
  technician: "Técnico",
  requester: "Solicitante",
  viewer: "Consulta",
  external: "Colaborador externo",
};

export const ROLE_DESCRIPTIONS: Record<OrganizationRole, string> = {
  admin: "Administra usuarios, ubicaciones, activos, órdenes de trabajo, preventivos, inventario y consulta la configuración de su empresa.",
  manager: "Opera ubicaciones, activos, órdenes de trabajo, preventivos e inventario, sin acceso a la configuración global de la plataforma.",
  technician: "Consulta activos y preventivos, trabaja sobre órdenes de trabajo y puede consultar inventario relacionado con la operación.",
  requester: "Crea solicitudes de mantenimiento y consulta únicamente las solicitudes generadas por su propia cuenta.",
  viewer: "Acceso de consulta a activos, órdenes de trabajo, preventivos e inventario, sin funciones de creación o edición.",
  external: "Personal de un proveedor de servicios. Ingresa al sistema para consultar activos y ejecutar únicamente trabajo asignado a su cuenta, cuadrilla o proveedor.",
};

export const SUPERADMIN_DESCRIPTION = "Acceso total a la plataforma: empresas, usuarios, límites, personalización global y todos los módulos operativos.";

const ROLE_PERMISSIONS: Record<OrganizationRole, Permission[]> = {
  admin: ["settings.view","users.manage","locations.manage","suppliers.manage","crews.manage","assets.read","assets.write","work_orders.read","work_orders.write","activities.manage","activities.execute","maintenance.read","maintenance.write","inventory.read","inventory.write"],
  manager: ["locations.manage","suppliers.manage","crews.manage","assets.read","assets.write","work_orders.read","work_orders.write","activities.manage","activities.execute","maintenance.read","maintenance.write","inventory.read","inventory.write"],
  technician: ["assets.read","work_orders.read","activities.execute","maintenance.read","inventory.read"],
  requester: ["work_orders.read","work_orders.write"],
  viewer: ["assets.read","work_orders.read","maintenance.read","inventory.read"],
  external: ["assets.read","work_orders.read","activities.execute","maintenance.read","inventory.read"],
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
