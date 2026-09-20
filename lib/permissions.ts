export type OrganizationRole = "owner" | "admin" | "manager" | "technician" | "requester" | "viewer";
export type Permission =
  | "companies.manage"
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
