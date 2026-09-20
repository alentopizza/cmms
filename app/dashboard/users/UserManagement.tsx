"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  SUPERADMIN_DESCRIPTION,
  type OrganizationRole,
} from "@/lib/permissions";

export type ManagedUser = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  active: boolean;
  platform_role: "superadmin" | "user";
  organization_id: string | null;
  organization_name: string | null;
  role: OrganizationRole | null;
  site_id: string | null;
  site_name: string | null;
  last_login_at: string | null;
  has_activity: boolean;
};

type Organization = { id: string; name: string };
type Site = { id: string; organization_id: string; name: string; organization_name: string };

type Draft = {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  organization_id: string;
  role: string;
  site_id: string;
};

type FieldErrors = Partial<Record<keyof Draft | "general", string>>;

const EMPTY_DRAFT: Draft = {
  full_name: "",
  email: "",
  phone: "",
  password: "",
  organization_id: "",
  role: "viewer",
  site_id: "",
};

function roleKey(user: ManagedUser) {
  return user.platform_role === "superadmin" ? "superadmin" : user.role || "viewer";
}

function roleName(role: string) {
  return role === "superadmin"
    ? "Superadministrador"
    : ROLE_LABELS[role as OrganizationRole] || role;
}

function roleDescription(role: string) {
  return role === "superadmin"
    ? SUPERADMIN_DESCRIPTION
    : ROLE_DESCRIPTIONS[role as OrganizationRole] || "";
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

export default function UserManagement({
  users,
  organizations,
  sites,
  isSuperadmin,
  fixedOrganizationId,
  currentUserId,
}: {
  users: ManagedUser[];
  organizations: Organization[];
  sites: Site[];
  isSuperadmin: boolean;
  fixedOrganizationId: string | null;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "delete" | "status"; user: ManagedUser } | null>(null);
  const [actionError, setActionError] = useState("");

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

  const roleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    users.forEach(user => {
      const key = roleKey(user);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.entries()];
  }, [users]);

  const visibleSites = useMemo(() => {
    if (!draft.organization_id) return [];
    return sites.filter(site => site.organization_id === draft.organization_id);
  }, [draft.organization_id, sites]);

  function setField<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined, general: undefined }));
    if (field === "organization_id") {
      setDraft(previous => ({ ...previous, organization_id: value, site_id: "" }));
    }
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
  }

  function openEdit(user: ManagedUser) {
    if (!isSuperadmin) return;
    setMode("edit");
    setEditingUser(user);
    setDraft({
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || "",
      password: "",
      organization_id: user.organization_id || "",
      role: user.platform_role === "superadmin" ? "superadmin" : user.role || "viewer",
      site_id: user.site_id || "",
    });
    setErrors({});
    setActionError("");
  }

  function closeModal() {
    if (saving) return;
    setMode(null);
    setEditingUser(null);
    setDraft(EMPTY_DRAFT);
    setErrors({});
  }

  function validate() {
    const next: FieldErrors = {};
    if (!draft.full_name.trim()) next.full_name = "Ingresa el nombre completo.";
    if (!draft.email.trim()) next.email = "Ingresa el correo electrónico.";
    else if (!/^\S+@\S+\.\S+$/.test(draft.email)) next.email = "Ingresa un correo válido.";
    if (mode === "create" && draft.password.length < 8) next.password = "Usa una contraseña de al menos 8 caracteres.";
    if (mode === "edit" && draft.password && draft.password.length < 8) next.password = "La nueva contraseña debe tener al menos 8 caracteres.";

    if (draft.role !== "superadmin") {
      if (!draft.organization_id) next.organization_id = "Selecciona la empresa a la que pertenecerá.";
      if (!draft.role) next.role = "Selecciona un rol.";
    }
    if (draft.role === "superadmin" && !isSuperadmin) next.role = "No tienes permiso para asignar este rol.";

    if (draft.site_id && !visibleSites.some(site => site.id === draft.site_id)) {
      next.site_id = "La sede seleccionada no pertenece a la empresa indicada.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setErrors({});
    try {
      const url = mode === "edit" && editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const body = new FormData();
      Object.entries(draft).forEach(([key, value]) => body.set(key, value));
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

      closeModal();
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
    <section className="user-access-toolbar section">
      <div>
        <span className="eyebrow">Roles en uso</span>
        <div className="role-summary-row">
          {roleCounts.length
            ? roleCounts.map(([role, count]) => <span className="role-summary-pill" key={role}><strong>{roleName(role)}</strong><b>{count}</b></span>)
            : <span className="muted">Aún no hay roles asignados.</span>}
        </div>
      </div>
      {users.length > 0 && <button className="button" type="button" onClick={openCreate}>Crear usuario</button>}
    </section>

    {actionError && <div className="notice error section">{actionError}</div>}

    {users.length === 0 ? <section className="card user-empty-state section">
      <div className="user-empty-icon" aria-hidden="true">◎</div>
      <span className="eyebrow">Control de acceso</span>
      <h2>Aún no tienes usuarios creados</h2>
      <p>Crea la primera cuenta y asigna un rol para definir qué módulos y funciones podrá utilizar al iniciar sesión.</p>
      <button className="button" type="button" onClick={openCreate}>Crear usuario</button>
    </section> : <section className="section">
      <div className="section-heading user-directory-heading">
        <div><span className="eyebrow">Directorio de acceso</span><h2>Usuarios registrados ({users.length})</h2></div>
        <small>Los accesos se limitan por empresa, rol y, cuando aplica, sede.</small>
      </div>

      <div className="user-role-grid">
        {users.map(user => <article className={`card user-role-card ${user.active ? "" : "user-role-card-inactive"}`} key={user.id}>
          <div className="user-role-card-head">
            <div className="user-avatar" aria-hidden="true">{initials(user.full_name)}</div>
            <div><strong>{user.full_name}</strong><span>{user.email}</span></div>
            <span className={`status-badge ${user.active ? "status-active" : "status-inactive"}`}><i />{user.active ? "Activo" : "Inactivo"}</span>
          </div>

          <div className="user-role-meta">
            <div><span>Rol</span><strong>{roleName(roleKey(user))}</strong></div>
            <div><span>Empresa</span><strong>{user.organization_name || "Acceso global"}</strong></div>
            <div><span>Sede</span><strong>{user.site_name || "Sin restricción específica"}</strong></div>
            <div><span>Último acceso</span><strong>{user.last_login_at ? new Date(user.last_login_at).toLocaleString("es-CO") : "Aún no ingresa"}</strong></div>
          </div>

          {isSuperadmin && <div className="user-card-actions">
            <button className="text-button" type="button" onClick={() => openEdit(user)}>Editar</button>
            {user.id !== currentUserId && <button className={`text-button ${user.active ? "text-danger" : ""}`} type="button" onClick={() => setConfirm({ kind: "status", user })}>{user.active ? "Desactivar" : "Reactivar"}</button>}
            {user.id !== currentUserId && <button className="text-button text-danger" type="button" onClick={() => setConfirm({ kind: "delete", user })}>Eliminar</button>}
          </div>}
        </article>)}
      </div>
    </section>}

    {mode && <div className="modal-backdrop user-modal-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !saving) closeModal();
    }}>
      <section className="company-modal user-form-modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
        <header className="modal-header">
          <div>
            <span className="eyebrow">{mode === "edit" ? "Administración de acceso" : "Nueva cuenta"}</span>
            <h2 id="user-modal-title">{modalTitle}</h2>
            <p>{mode === "edit" ? "Actualiza la identidad, alcance y credenciales del usuario." : "Completa los datos y revisa los permisos antes de habilitar la cuenta."}</p>
          </div>
          <button className="modal-close" type="button" aria-label="Cerrar" onClick={closeModal}>×</button>
        </header>

        <form className="company-modal-form user-modal-form" onSubmit={submit} noValidate>
          {errors.general && <div className="notice error">{errors.general}</div>}

          <div className="form-grid">
            <div className={`field ${errors.full_name ? "field-error" : ""}`}>
              <label htmlFor="managed-user-name">Nombre completo *</label>
              <input id="managed-user-name" value={draft.full_name} onChange={event => setField("full_name", event.target.value)} autoFocus />
              {errors.full_name && <small className="field-error-message">{errors.full_name}</small>}
            </div>
            <div className={`field ${errors.email ? "field-error" : ""}`}>
              <label htmlFor="managed-user-email">Correo *</label>
              <input id="managed-user-email" type="email" value={draft.email} onChange={event => setField("email", event.target.value)} />
              {errors.email && <small className="field-error-message">{errors.email}</small>}
            </div>
            <div className="field">
              <label htmlFor="managed-user-phone">Teléfono</label>
              <input id="managed-user-phone" value={draft.phone} onChange={event => setField("phone", event.target.value)} />
            </div>
            <div className={`field ${errors.password ? "field-error" : ""}`}>
              <label htmlFor="managed-user-password">{mode === "create" ? "Contraseña temporal *" : "Nueva contraseña (opcional)"}</label>
              <input id="managed-user-password" type="password" value={draft.password} onChange={event => setField("password", event.target.value)} autoComplete="new-password" />
              <small>{mode === "edit" ? "Déjala vacía para conservar la contraseña actual." : "Mínimo 8 caracteres."}</small>
              {errors.password && <small className="field-error-message">{errors.password}</small>}
            </div>

            {isSuperadmin ? <div className={`field ${errors.organization_id ? "field-error" : ""}`}>
              <label htmlFor="managed-user-org">Empresa {draft.role === "superadmin" ? "" : "*"}</label>
              <select id="managed-user-org" value={draft.organization_id} disabled={draft.role === "superadmin"} onChange={event => setField("organization_id", event.target.value)}>
                <option value="">{draft.role === "superadmin" ? "Acceso global" : "Selecciona una empresa"}</option>
                {organizations.map(org => <option value={org.id} key={org.id}>{org.name}</option>)}
              </select>
              {errors.organization_id && <small className="field-error-message">{errors.organization_id}</small>}
            </div> : <input type="hidden" value={fixedOrganizationId || ""} />}

            <div className={`field ${errors.role ? "field-error" : ""}`}>
              <label htmlFor="managed-user-role">Rol *</label>
              <select id="managed-user-role" value={draft.role} onChange={event => {
                const nextRole = event.target.value;
                setField("role", nextRole);
                if (nextRole === "superadmin") {
                  setDraft(previous => ({ ...previous, role: nextRole, organization_id: "", site_id: "" }));
                }
              }}>
                {isSuperadmin && <option value="superadmin">Superadministrador</option>}
                {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {errors.role && <small className="field-error-message">{errors.role}</small>}
            </div>

            <div className={`field form-span-2 ${errors.site_id ? "field-error" : ""}`}>
              <label htmlFor="managed-user-site">Sede asignada (opcional)</label>
              <select id="managed-user-site" value={draft.site_id} disabled={draft.role === "superadmin" || !draft.organization_id} onChange={event => setField("site_id", event.target.value)}>
                <option value="">Todas las sedes permitidas por el rol</option>
                {visibleSites.map(site => <option value={site.id} key={site.id}>{site.name}</option>)}
              </select>
              {errors.site_id && <small className="field-error-message">{errors.site_id}</small>}
            </div>
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
        ? "Este usuario tiene movimientos registrados. Por trazabilidad no puede eliminarse; debes desactivarlo para conservar el historial."
        : "Esta acción eliminará definitivamente la cuenta y su membresía. Solo es posible si no tiene movimientos registrados."}
      confirmLabel={confirm?.user.has_activity ? "Entendido" : "Eliminar definitivamente"}
      variant="danger"
      onCancel={() => setConfirm(null)}
      onConfirm={() => {
        if (confirm?.user.has_activity) {
          setConfirm(null);
          return;
        }
        void runConfirmedAction();
      }}
    />
  </>;
}
