export type OrganizationRole = "admin" | "manager" | "technician" | "requester" | "viewer" | "provider" | "external";
export type PlatformRole = "platform_owner" | "superadmin" | "user";

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
  | "attendance.self"
  | "attendance.manage"
  | "attendance.reports"
  | "reaction.view"
  | "reaction.track"
  | "assets.read"
  | "assets.write"
  | "work_orders.read"
  | "work_orders.write"
  | "maintenance.read"
  | "maintenance.write"
  | "inventory.read"
  | "inventory.write"
  | "requisitions.read"
  | "requisitions.write";

export const ROLE_LABELS: Record<OrganizationRole, string> = {
  admin: "Administrador de empresa",
  manager: "Manager / Supervisor",
  technician: "Técnico",
  requester: "Solicitante",
  viewer: "Consulta",
  provider: "Proveedor de servicios",
  external: "Colaborador externo",
};

export const ROLE_DESCRIPTIONS: Record<OrganizationRole, string> = {
  admin: "Máximo nivel dentro de una empresa cliente. Administra usuarios, ubicaciones y módulos operativos de su organización, sin acceso a otras empresas ni a roles de plataforma.",
  manager: "Coordina la operación de mantenimiento dentro de las sedes autorizadas. Gestiona trabajo operativo y equipos, sin permisos de administración global de la empresa ni de la plataforma.",
  technician: "Ejecuta mantenimiento sobre los trabajos y sedes autorizados. Consulta activos, preventivos e inventario necesarios para su labor, sin administrar usuarios ni configuración empresarial.",
  requester: "Reporta necesidades de mantenimiento y consulta el avance de sus solicitudes permitidas. No administra la operación ni la configuración del CMMS.",
  viewer: "Acceso de solo lectura a la información autorizada. Puede consultar datos operativos, pero no crear, editar ni eliminar registros.",
  provider: "Representa a una empresa proveedora de servicios y solo puede consultar o ejecutar trabajos asignados a ese proveedor.",
  external: "Persona externa autorizada para trabajos específicos. Solo accede a actividades asignadas directamente o mediante sus cuadrillas autorizadas.",
};

export const PLATFORM_OWNER_DESCRIPTION =
  "Máxima autoridad de Desweb CMMS. Tiene acceso total de plataforma y es el único nivel autorizado para crear o retirar Superadministradores. Durante la fase de desarrollo puede visualizar, crear, editar y administrar todos los módulos sin restricciones funcionales de RBAC.";

export const SUPERADMIN_DESCRIPTION =
  "Administra clientes y la operación global de Desweb. Puede crear empresas, asignar planes y administrar usuarios de cliente, pero no puede crear otros Superadministradores ni modificar al Propietario Desweb.";

const ROLE_PERMISSIONS: Record<OrganizationRole, Permission[]> = {
  admin: ["settings.view","users.manage","locations.manage","suppliers.manage","crews.manage","attendance.self","attendance.manage","attendance.reports","reaction.view","assets.read","assets.write","work_orders.read","work_orders.write","activities.manage","activities.execute","maintenance.read","maintenance.write","inventory.read","inventory.write","requisitions.read","requisitions.write"],
  manager: ["locations.manage","suppliers.manage","crews.manage","attendance.self","attendance.manage","attendance.reports","reaction.view","assets.read","assets.write","work_orders.read","work_orders.write","activities.manage","activities.execute","maintenance.read","maintenance.write","inventory.read","inventory.write","requisitions.read","requisitions.write"],
  technician: ["attendance.self","reaction.track","assets.read","work_orders.read","activities.execute","maintenance.read","inventory.read"],
  requester: ["work_orders.read","work_orders.write","requisitions.read","requisitions.write"],
  viewer: ["assets.read","work_orders.read","maintenance.read","inventory.read","requisitions.read"],
  provider: ["attendance.self","assets.read","work_orders.read","activities.execute","maintenance.read","inventory.read"],
  external: ["attendance.self","assets.read","work_orders.read","activities.execute","maintenance.read","inventory.read"],
};

export type PermissionSubject = {
  platformRole: PlatformRole;
  role: OrganizationRole | null;
};

export function isPlatformOperator(subject: PermissionSubject | null) {
  return Boolean(subject && subject.platformRole !== "user");
}

export function isPlatformOwner(subject: PermissionSubject | null) {
  return subject?.platformRole === "platform_owner";
}

export function can(subject: PermissionSubject | null, permission: Permission) {
  if (!subject) return false;
  if (subject.platformRole === "platform_owner") return true;
  if (subject.platformRole === "superadmin") return true;
  if (!subject.role) return false;
  return ROLE_PERMISSIONS[subject.role].includes(permission);
}

export function roleLabel(subject: PermissionSubject | null) {
  if (!subject) return "";
  if (subject.platformRole === "platform_owner") return "Propietario Desweb";
  if (subject.platformRole === "superadmin") return "Superadministrador";
  return subject.role ? ROLE_LABELS[subject.role] : "Sin rol";
}
