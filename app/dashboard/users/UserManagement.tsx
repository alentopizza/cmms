"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import ModuleHeader from "@/components/ModuleHeader";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  PLATFORM_OWNER_DESCRIPTION,
  SUPERADMIN_DESCRIPTION,
  type OrganizationRole,
} from "@/lib/permissions";

// ── User directory contracts and role/scope presentation ───────────────────

export type ManagedUser = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  active: boolean;
  platform_role: "platform_owner" | "superadmin" | "user";
  organization_id: string | null;
  organization_name: string | null;
  role: OrganizationRole | null;
  last_login_at: string | null;
  has_activity: boolean;
  access_all_sites: boolean | null;
  site_ids: string[] | null;
  site_names: string[] | null;
  external_supplier_id: string | null;
  external_supplier_name: string | null;
  has_avatar: boolean;
};

type Organization = { id: string; name: string };
type Site = { id: string; organization_id: string; name: string; organization_name: string };
type ServiceSupplier = { id: string; organization_id: string; name: string };

type Draft = {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  organization_id: string;
  role: string;
  access_all_sites: boolean;
  site_ids: string[];
  external_supplier_id: string;
};

type FieldErrors = Partial<Record<"full_name" | "email" | "password" | "avatar" | "organization_id" | "role" | "site_ids" | "external_supplier_id" | "general", string>>;

const EMPTY_DRAFT: Draft = {
  full_name: "",
  email: "",
  phone: "",
  password: "",
  organization_id: "",
  role: "viewer",
  access_all_sites: true,
  site_ids: [],
  external_supplier_id: "",
};

function roleKey(user: ManagedUser) {
  return user.platform_role !== "user" ? user.platform_role : user.role || "viewer";
}

function roleName(role: string) {
  if (role === "platform_owner") return "Propietario Desweb";
  if (role === "superadmin") return "Superadministrador";
  return ROLE_LABELS[role as OrganizationRole] || role;
}

function roleDescription(role: string) {
  if (role === "platform_owner") return PLATFORM_OWNER_DESCRIPTION;
  if (role === "superadmin") return SUPERADMIN_DESCRIPTION;
  return ROLE_DESCRIPTIONS[role as OrganizationRole] || "";
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

function siteAccessLabel(user: ManagedUser) {
  if (user.platform_role !== "user") return "Todas las empresas";
  if (user.access_all_sites !== false) return "Todas las sedes";
  const siteNames = user.site_names || [];
  if (!siteNames.length) return "Sin sedes asignadas";
  if (siteNames.length <= 2) return siteNames.join(", ");
  return `${siteNames.slice(0, 2).join(", ")} +${siteNames.length - 2}`;
}

// ── User CRUD state, validation and tenant-safe actions ─────────────────────

export default function UserManagement({
  users,
  organizations,
  sites,
  isPlatformOperator,
  isPlatformOwner,
  fixedOrganizationId,
  currentUserId,
  serviceSuppliers,
}: {
  users: ManagedUser[];
  organizations: Organization[];
  sites: Site[];
  isPlatformOperator: boolean;
  isPlatformOwner: boolean;
  fixedOrganizationId: string | null;
  currentUserId: string | null;
  serviceSuppliers: ServiceSupplier[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "delete" | "status"; user: ManagedUser } | null>(null);
  const [actionError, setActionError] = useState("");
  const [avatarFile,setAvatarFile]=useState<File|null>(null);

  useEffect(() => {
    if (!mode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) closeModal();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("modal-open");
    };
  }, [mode, saving]);

  const visibleSites = useMemo(() => {
    if (!draft.organization_id) return [];
    return sites.filter(site => site.organization_id === draft.organization_id);
  }, [draft.organization_id, sites]);

  const visibleServiceSuppliers = useMemo(() => {
    if (!draft.organization_id) return [];
    return serviceSuppliers.filter(supplier => supplier.organization_id === draft.organization_id);
  }, [draft.organization_id, serviceSuppliers]);

  function updateDraft<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field as keyof FieldErrors]: undefined, general: undefined }));
  }

  function changeOrganization(organizationId: string) {
    setDraft(previous => ({
      ...previous,
      organization_id: organizationId,
      access_all_sites: true,
      site_ids: [],
      external_supplier_id: "",
    }));
    setErrors(previous => ({ ...previous, organization_id: undefined, site_ids: undefined, general: undefined }));
  }

  function toggleSite(siteId: string) {
    setDraft(previous => ({
      ...previous,
      site_ids: previous.site_ids.includes(siteId)
        ? previous.site_ids.filter(id => id !== siteId)
        : [...previous.site_ids, siteId],
    }));
    setErrors(previous => ({ ...previous, site_ids: undefined, general: undefined }));
  }

  function openCreate() {
    setMode("create");
    setEditingUser(null);
    setDraft({
      ...EMPTY_DRAFT,
      organization_id: fixedOrganizationId || "",
      role: "viewer",
    });
    setErrors({});
    setActionError("");
    setAvatarFile(null);
  }

  function openEdit(user: ManagedUser) {
    if (user.platform_role === "platform_owner") return;
    if (!isPlatformOperator && user.platform_role !== "user") return;
    if (user.platform_role === "superadmin" && !isPlatformOwner) return;
    setMode("edit");
    setEditingUser(user);
    setDraft({
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || "",
      password: "",
      organization_id: user.organization_id || "",
      role: user.platform_role !== "user" ? user.platform_role : user.role || "viewer",
      access_all_sites: user.platform_role !== "user" ? true : user.access_all_sites !== false,
      site_ids: user.platform_role !== "user" ? [] : (user.site_ids || []),
      external_supplier_id: user.platform_role !== "user" ? "" : (user.external_supplier_id || ""),
    });
    setErrors({});
    setActionError("");
    setAvatarFile(null);
  }

  function closeModal() {
    if (saving) return;
    setMode(null);
    setEditingUser(null);
    setDraft(EMPTY_DRAFT);
    setErrors({});
    setAvatarFile(null);
  }

  // ── Client validation mirrors server requirements for fast feedback ───────

  function validate() {
    const next: FieldErrors = {};
    if (!draft.full_name.trim()) next.full_name = "Ingresa el nombre completo.";
    if (!draft.email.trim()) next.email = "Ingresa el correo electrónico.";
    else if (!/^\S+@\S+\.\S+$/.test(draft.email)) next.email = "Ingresa un correo válido.";
    if (mode === "create" && draft.password.length < 8) next.password = "Usa una contraseña de al menos 8 caracteres.";
    if (mode === "edit" && draft.password && draft.password.length < 8) next.password = "La nueva contraseña debe tener al menos 8 caracteres.";
    if (mode === "create" && !avatarFile) next.avatar = "Adjunta una foto de perfil para crear la cuenta.";

    if (draft.role !== "superadmin") {
      if (!draft.organization_id) next.organization_id = "Selecciona la empresa a la que pertenecerá.";
      if (!draft.role) next.role = "Selecciona un rol.";
      if (!draft.access_all_sites && draft.site_ids.length === 0) next.site_ids = "Selecciona al menos una sede o habilita el acceso a todas.";
      if (draft.site_ids.some(id => !visibleSites.some(site => site.id === id))) next.site_ids = "Una de las sedes seleccionadas no pertenece a la empresa indicada.";
      if (draft.role === "provider" && !draft.external_supplier_id) next.external_supplier_id = "Selecciona el proveedor de servicios al que representa.";
      if ((draft.role === "provider" || draft.role === "external") && draft.external_supplier_id && !visibleServiceSuppliers.some(supplier => supplier.id === draft.external_supplier_id)) {
        next.external_supplier_id = "El proveedor debe pertenecer a la empresa y prestar servicios.";
      }
    }
    if (draft.role === "superadmin" && !isPlatformOwner) next.role = "Solo el Propietario Desweb puede crear o asignar Superadministradores.";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ── Mutations: server remains authoritative for RBAC and tenant scope ─────

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setErrors({});
    try {
      const url = mode === "edit" && editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const body = new FormData();
      body.set("full_name", draft.full_name);
      body.set("email", draft.email);
      body.set("phone", draft.phone);
      body.set("password", draft.password);
      body.set("organization_id", draft.organization_id);
      body.set("role", draft.role);
      body.set("access_all_sites", draft.access_all_sites ? "true" : "false");
      body.set("external_supplier_id", draft.external_supplier_id);
      if(avatarFile) body.set("avatar",avatarFile);
      if (!draft.access_all_sites) draft.site_ids.forEach(siteId => body.append("site_ids", siteId));
      if (mode === "edit") body.set("intent", "update");

      const response = await fetch(url, {
        method: "POST",
        body,
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (payload?.fields) setErrors(payload.fields);
        else setErrors({ general: payload?.message || "No fue posible guardar el usuario." });
        return;
      }

      setMode(null);
      setEditingUser(null);
      setDraft(EMPTY_DRAFT);
      setErrors({});
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function runConfirmedAction() {
    if (!confirm) return;
    const { user, kind } = confirm;
    setConfirm(null);
    setActionError("");

    const body = new FormData();
    body.set("intent", kind === "delete" ? "delete" : user.active ? "deactivate" : "activate");

    const response = await fetch(`/api/users/${user.id}`, {
      method: "POST",
      body,
      headers: { Accept: "application/json" },
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setActionError(payload?.message || "No fue posible completar la acción.");
      return;
    }
    router.refresh();
  }

  const modalTitle = mode === "edit" ? "Editar usuario" : "Crear usuario";
  const selectedDescription = roleDescription(draft.role);

  return <>
    <ModuleHeader
      eyebrow="Control de acceso"
      title="Usuarios y roles"
      description="Administra cuentas, roles y alcance operativo sin perder la trazabilidad de las acciones realizadas."
      count={users.length}
      countLabel="cuentas"
      searchPlaceholder="Buscar nombre, correo, empresa o rol"
      action={<button className="button module-add-button" type="button" onClick={organizations.length ? openCreate : ()=>router.push("/dashboard/companies?create=1")}><span className="module-add-button-icon">◎</span><span>{organizations.length ? "Agregar" : "Crear empresa"}</span></button>}
    />

    {actionError && <div className="notice error section">{actionError}</div>}

    {users.length === 0 ? <section className="card user-empty-state section">
      <div className="user-empty-icon" aria-hidden="true">◎</div>
      <span className="eyebrow">Control de acceso</span>
      <h2>{organizations.length ? "Aún no tienes usuarios creados" : "Primero debes crear una empresa"}</h2>
      <p>{organizations.length ? "Crea la primera cuenta. El usuario pertenecerá a una empresa; las sedes solo definen posteriormente su alcance de acceso." : "No puedes crear usuarios de empresa todavía. Primero registra la empresa a la que pertenecerán."}</p>
      <button className="button" type="button" onClick={organizations.length ? openCreate : ()=>router.push("/dashboard/companies?create=1")}>{organizations.length ? "Crear usuario" : "Crear empresa"}</button>
    </section> : <section className="section">
      <div className="section-heading user-directory-heading">
        <div><span className="eyebrow">Directorio de acceso</span><h2>Usuarios registrados ({users.length})</h2></div>
        <small>Los accesos se limitan por empresa, rol y sedes autorizadas.</small>
      </div>

      <div className="user-role-grid">
        {users.map(user => <article
          className={`card user-role-card ${user.active ? "" : "user-role-card-inactive"}`}
          key={user.id}
          data-module-record
          data-status={user.active ? "active" : "inactive"}
          data-search={[user.full_name,user.email,user.organization_name,roleName(roleKey(user)),...(user.site_names||[])].filter(Boolean).join(" ")}
        >
          <div className="user-role-card-head">
            <div className="user-avatar" aria-hidden="true">{user.has_avatar ? <img src={`/api/users/${user.id}/avatar`} alt="" /> : initials(user.full_name)}</div>
            <div><strong>{user.full_name}</strong><span>{user.email}</span></div>
            <span className={`status-badge ${user.active ? "status-active" : "status-inactive"}`}><i />{user.active ? "Activo" : "Inactivo"}</span>
          </div>

          <div className="user-role-meta">
            <div><span>Rol</span><strong>{roleName(roleKey(user))}</strong></div>
            <div><span>Empresa</span><strong>{user.organization_name || "Acceso global"}</strong></div>
            <div><span>Alcance de sedes</span><strong title={(user.site_names || []).join(", ")}>{siteAccessLabel(user)}</strong></div>
            <div><span>{user.role === "external" || user.role === "provider" ? "Proveedor" : "Último acceso"}</span><strong>{user.role === "external" || user.role === "provider" ? (user.external_supplier_name || "Independiente") : user.last_login_at ? new Date(user.last_login_at).toLocaleString("es-CO") : "Aún no ingresa"}</strong></div>
          </div>

          {user.platform_role !== "platform_owner" && (isPlatformOperator ? (isPlatformOwner || user.platform_role !== "superadmin") : user.platform_role === "user") && <div className="user-card-actions">
            <button className="text-button" type="button" onClick={() => openEdit(user)}>Editar</button>
            {user.id !== currentUserId && <button className={`text-button ${user.active ? "text-danger" : ""}`} type="button" onClick={() => setConfirm({ kind: "status", user })}>{user.active ? "Desactivar" : "Reactivar"}</button>}
            {isPlatformOwner && user.id !== currentUserId && <button className="text-button text-danger" type="button" onClick={() => setConfirm({ kind: "delete", user })}>Eliminar</button>}
          </div>}
        </article>)}
      </div>
    </section>}

    {mode && <div className="modal-backdrop user-modal-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !saving) closeModal();
    }}>
      <section className="company-modal user-form-modal unified-create-modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
        <header className="modal-header">
          <div>
            <span className="eyebrow">{mode === "edit" ? "Administración de acceso" : "Nueva cuenta"}</span>
            <h2 id="user-modal-title">{modalTitle}</h2>
            <p>{mode === "edit" ? "Actualiza identidad, empresa, permisos de sedes y credenciales." : "El usuario quedará vinculado a una empresa. Las sedes no son requisito para crear la cuenta."}</p>
          </div>
          <button className="modal-close" type="button" aria-label="Cerrar" onClick={closeModal}>×</button>
        </header>

        <form className="company-modal-form user-modal-form" onSubmit={submit} noValidate>
          {errors.general && <div className="notice error">{errors.general}</div>}

          <div className="form-grid">
            <div className={`field form-span-2 user-photo-field ${errors.avatar ? "field-error" : ""}`}>
              <label>Foto de perfil {mode === "create" ? "*" : ""}</label>
              <div className="user-photo-upload">
                <div className="user-photo-preview">{avatarFile ? <img src={URL.createObjectURL(avatarFile)} alt="Vista previa" /> : editingUser?.has_avatar ? <img src={`/api/users/${editingUser.id}/avatar`} alt="" /> : <span>{initials(draft.full_name||"Usuario")}</span>}</div>
                <div><input type="file" accept="image/png,image/jpeg,image/webp" required={mode === "create"} onChange={event=>{setAvatarFile(event.target.files?.[0]||null);setErrors(previous=>({...previous,avatar:undefined,general:undefined}));}} /><small>JPG, PNG o WEBP · máximo 5 MB. La foto identifica visualmente al usuario; la biometría facial se enrola por cámara con prueba de vida.</small>{errors.avatar && <small className="field-error-message">{errors.avatar}</small>}</div>
              </div>
            </div>
            <div className={`field ${errors.full_name ? "field-error" : ""}`}>
              <label htmlFor="managed-user-name">Nombre completo *</label>
              <input id="managed-user-name" placeholder="Ej. Laura Gómez" value={draft.full_name} onChange={event => updateDraft("full_name", event.target.value)} autoFocus />
              {errors.full_name && <small className="field-error-message">{errors.full_name}</small>}
            </div>
            <div className={`field ${errors.email ? "field-error" : ""}`}>
              <label htmlFor="managed-user-email">Correo *</label>
              <input id="managed-user-email" type="email" placeholder="laura@empresa.com" value={draft.email} onChange={event => updateDraft("email", event.target.value)} />
              {errors.email && <small className="field-error-message">{errors.email}</small>}
            </div>
            <div className="field">
              <label htmlFor="managed-user-phone">Teléfono</label>
              <input id="managed-user-phone" placeholder="+57 300 123 4567" value={draft.phone} onChange={event => updateDraft("phone", event.target.value)} />
            </div>
            <div className={`field ${errors.password ? "field-error" : ""}`}>
              <label htmlFor="managed-user-password">{mode === "create" ? "Contraseña temporal *" : "Nueva contraseña (opcional)"}</label>
              <input id="managed-user-password" type="password" placeholder="Mínimo 8 caracteres" value={draft.password} onChange={event => updateDraft("password", event.target.value)} autoComplete="new-password" />
              <small>{mode === "edit" ? "Déjala vacía para conservar la contraseña actual." : "Mínimo 8 caracteres."}</small>
              {errors.password && <small className="field-error-message">{errors.password}</small>}
            </div>

            {isPlatformOperator ? <div className={`field ${errors.organization_id ? "field-error" : ""}`}>
              <label htmlFor="managed-user-org">Empresa {draft.role === "superadmin" ? "" : "*"}</label>
              <select id="managed-user-org" value={draft.organization_id} disabled={draft.role === "superadmin"} onChange={event => changeOrganization(event.target.value)}>
                <option value="">{draft.role === "superadmin" ? "Acceso global" : "Selecciona una empresa"}</option>
                {organizations.map(org => <option value={org.id} key={org.id}>{org.name}</option>)}
              </select>
              {errors.organization_id && <small className="field-error-message">{errors.organization_id}</small>}
            </div> : <input type="hidden" value={fixedOrganizationId || ""} />}

            <div className={`field ${errors.role ? "field-error" : ""}`}>
              <label htmlFor="managed-user-role">Rol *</label>
              <select id="managed-user-role" value={draft.role} onChange={event => {
                const nextRole = event.target.value;
                if (nextRole === "superadmin") {
                  setDraft(previous => ({ ...previous, role: nextRole, organization_id: "", access_all_sites: true, site_ids: [], external_supplier_id: "" }));
                } else {
                  setDraft(previous => ({ ...previous, role: nextRole, external_supplier_id: nextRole === "external" || nextRole === "provider" ? previous.external_supplier_id : "" }));
                  setErrors(previous => ({ ...previous, role: undefined, external_supplier_id: undefined, general: undefined }));
                }
              }}>
                {isPlatformOwner && <option value="superadmin">Superadministrador</option>}
                {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {errors.role && <small className="field-error-message">{errors.role}</small>}
            </div>

            {(draft.role === "provider" || draft.role === "external") && <div className={`field ${errors.external_supplier_id ? "field-error" : ""}`}>
              <label htmlFor="managed-user-supplier">Proveedor de servicios {draft.role === "provider" ? "*" : "(opcional)"}</label>
              <select id="managed-user-supplier" value={draft.external_supplier_id} onChange={event => updateDraft("external_supplier_id", event.target.value)}>
                <option value="">Selecciona proveedor</option>
                {visibleServiceSuppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
              {visibleServiceSuppliers.length === 0 && <small>Primero registra un proveedor de tipo Servicios o Materiales + servicios.</small>}
              {draft.role === "external" && visibleServiceSuppliers.length > 0 && <small>Déjalo vacío si la persona externa no pertenece a un proveedor contratado.</small>}
              {errors.external_supplier_id && <small className="field-error-message">{errors.external_supplier_id}</small>}
            </div>}

            {mode === "edit" && draft.role !== "superadmin" && <div className={`field form-span-2 site-access-field ${errors.site_ids ? "field-error" : ""}`}>
              <label>Alcance de acceso a sedes <span className="muted">(opcional)</span></label>
              {!draft.organization_id ? <div className="site-access-empty">Selecciona primero la empresa. El usuario pertenece a la empresa; este bloque solo restringe qué sedes podrá operar.</div> : visibleSites.length === 0 ? <div className="site-access-empty">La empresa todavía no tiene sedes. Puedes crear el usuario igualmente con alcance general de empresa.</div> : <>
                <div className="site-access-mode">
                  <button
                    type="button"
                    className={draft.access_all_sites ? "active" : ""}
                    onClick={() => {
                      updateDraft("access_all_sites", true);
                      setDraft(previous => ({ ...previous, access_all_sites: true, site_ids: [] }));
                    }}
                  >
                    <span className="site-access-mode-icon">✓</span>
                    <span><strong>Todas las sedes</strong><small>Acceso actual y a nuevas sedes que se creen.</small></span>
                  </button>
                  <button
                    type="button"
                    className={!draft.access_all_sites ? "active" : ""}
                    onClick={() => updateDraft("access_all_sites", false)}
                  >
                    <span className="site-access-mode-icon">◎</span>
                    <span><strong>Sedes específicas</strong><small>Selecciona individualmente dónde puede operar.</small></span>
                  </button>
                </div>

                {!draft.access_all_sites && <div className="site-checkbox-grid">
                  {visibleSites.map(site => {
                    const checked = draft.site_ids.includes(site.id);
                    return <label className={`site-checkbox-card ${checked ? "active" : ""}`} key={site.id}>
                      <input type="checkbox" checked={checked} onChange={() => toggleSite(site.id)} />
                      <span className="site-checkbox-mark">{checked ? "✓" : ""}</span>
                      <span><strong>{site.name}</strong><small>{site.organization_name}</small></span>
                    </label>;
                  })}
                </div>}
              </>}
              {errors.site_ids && <small className="field-error-message">{errors.site_ids}</small>}
            </div>}
          </div>

          <aside className="role-permission-note">
            <div className="role-permission-icon" aria-hidden="true">i</div>
            <div><strong>{roleName(draft.role)}</strong><p>{selectedDescription}</p></div>
          </aside>

          <footer className="modal-actions user-modal-actions">
            <button className="button secondary" type="button" disabled={saving} onClick={closeModal}>Cancelar</button>
            <button className="button" type="submit" disabled={saving}>{saving ? "Guardando…" : mode === "edit" ? "Guardar cambios" : "Crear usuario"}</button>
          </footer>
        </form>
      </section>
    </div>}

    <ConfirmDialog
      open={confirm?.kind === "status"}
      title={confirm?.user.active ? "Desactivar usuario" : "Reactivar usuario"}
      message={confirm?.user.active
        ? "El usuario dejará de poder iniciar sesión, pero su historial y movimientos permanecerán intactos."
        : "El usuario recuperará el acceso según el rol y alcance que tenga asignados."}
      confirmLabel={confirm?.user.active ? "Desactivar" : "Reactivar"}
      variant={confirm?.user.active ? "danger" : "default"}
      onCancel={() => setConfirm(null)}
      onConfirm={runConfirmedAction}
    />

    <ConfirmDialog
      open={confirm?.kind === "delete"}
      title="Eliminar usuario"
      message={confirm?.user.has_activity
        ? isPlatformOwner
          ? "Este usuario tiene movimientos registrados. Como Propietario Desweb puedes eliminar universalmente la cuenta y las dependencias que impidan su borrado. Esta acción es irreversible."
          : "Este usuario tiene movimientos registrados. Por trazabilidad no puede eliminarse; debes desactivarlo para conservar el historial."
        : "Esta acción eliminará definitivamente la cuenta y su membresía."}
      confirmLabel={confirm?.user.has_activity && !isPlatformOwner ? "Entendido" : "Eliminar definitivamente"}
      variant="danger"
      onCancel={() => setConfirm(null)}
      onConfirm={() => {
        if (confirm?.user.has_activity && !isPlatformOwner) {
          setConfirm(null);
          return;
        }
        void runConfirmedAction();
      }}
    />
  </>;
}
