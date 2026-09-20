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
  last_login_at: string | null;
  has_activity: boolean;
  access_all_sites: boolean | null;
  site_ids: string[] | null;
  site_names: string[] | null;
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
  access_all_sites: boolean;
  site_ids: string[];
};

type FieldErrors = Partial<Record<"full_name" | "email" | "password" | "organization_id" | "role" | "site_ids" | "general", string>>;

const EMPTY_DRAFT: Draft = {
  full_name: "",
  email: "",
  phone: "",
  password: "",
  organization_id: "",
  role: "viewer",
  access_all_sites: true,
  site_ids: [],
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

function siteAccessLabel(user: ManagedUser) {
  if (user.platform_role === "superadmin") return "Todas las empresas";
  if (user.access_all_sites !== false) return "Todas las sedes";
  const siteNames = user.site_names || [];
  if (!siteNames.length) return "Sin sedes asignadas";
  if (siteNames.length <= 2) return siteNames.join(", ");
  return `${siteNames.slice(0, 2).join(", ")} +${siteNames.length - 2}`;
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
      access_all_sites: user.platform_role === "superadmin" ? true : user.access_all_sites !== false,
      site_ids: user.platform_role === "superadmin" ? [] : (user.site_ids || []),
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
      if (!draft.access_all_sites && draft.site_ids.length === 0) next.site_ids = "Selecciona al menos una sede o habilita el acceso a todas.";
      if (draft.site_ids.some(id => !visibleSites.some(site => site.id === id))) next.site_ids = "Una de las sedes seleccionadas no pertenece a la empresa indicada.";
    }
    if (draft.role === "superadmin" && !isSuperadmin) next.role = "No tienes permiso para asignar este rol.";

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
      body.set("full_name", draft.full_name);
      body.set("email", draft.email);
      body.set("phone", draft.phone);
      body.set("password", draft.password);
      body.set("organization_id", draft.organization_id);
      body.set("role", draft.role);
      body.set("access_all_sites", draft.access_all_sites ? "true" : "false");
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
      <p>Crea la primera cuenta y asigna un rol para definir qué módulos y sedes podrá utilizar al iniciar sesión.</p>
      <button className="button" type="button" onClick={openCreate}>Crear usuario</button>
    </section> : <section className="section">
      <div className="section-heading user-directory-heading">
        <div><span className="eyebrow">Directorio de acceso</span><h2>Usuarios registrados ({users.length})</h2></div>
        <small>Los accesos se limitan por empresa, rol y sedes autorizadas.</small>
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
            <div><span>Sedes</span><strong title={(user.site_names || []).join(", ")}>{siteAccessLabel(user)}</strong></div>
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
            <p>{mode === "edit" ? "Actualiza la identidad, empresa, sedes y credenciales del usuario." : "Completa los datos y define el alcance del usuario dentro de la empresa."}</p>
          </div>
          <button className="modal-close" type="button" aria-label="Cerrar" onClick={closeModal}>×</button>
        </header>

        <form className="company-modal-form user-modal-form" onSubmit={submit} noValidate>
          {errors.general && <div className="notice error">{errors.general}</div>}

          <div className="form-grid">
            <div className={`field ${errors.full_name ? "field-error" : ""}`}>
              <label htmlFor="managed-user-name">Nombre completo *</label>
              <input id="managed-user-name" value={draft.full_name} onChange={event => updateDraft("full_name", event.target.value)} autoFocus />
              {errors.full_name && <small className="field-error-message">{errors.full_name}</small>}
            </div>
            <div className={`field ${errors.email ? "field-error" : ""}`}>
              <label htmlFor="managed-user-email">Correo *</label>
              <input id="managed-user-email" type="email" value={draft.email} onChange={event => updateDraft("email", event.target.value)} />
              {errors.email && <small className="field-error-message">{errors.email}</small>}
            </div>
            <div className="field">
              <label htmlFor="managed-user-phone">Teléfono</label>
              <input id="managed-user-phone" value={draft.phone} onChange={event => updateDraft("phone", event.target.value)} />
            </div>
            <div className={`field ${errors.password ? "field-error" : ""}`}>
              <label htmlFor="managed-user-password">{mode === "create" ? "Contraseña temporal *" : "Nueva contraseña (opcional)"}</label>
              <input id="managed-user-password" type="password" value={draft.password} onChange={event => updateDraft("password", event.target.value)} autoComplete="new-password" />
              <small>{mode === "edit" ? "Déjala vacía para conservar la contraseña actual." : "Mínimo 8 caracteres."}</small>
              {errors.password && <small className="field-error-message">{errors.password}</small>}
            </div>

            {isSuperadmin ? <div className={`field ${errors.organization_id ? "field-error" : ""}`}>
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
                  setDraft(previous => ({ ...previous, role: nextRole, organization_id: "", access_all_sites: true, site_ids: [] }));
                } else {
                  updateDraft("role", nextRole);
                }
              }}>
                {isSuperadmin && <option value="superadmin">Superadministrador</option>}
                {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {errors.role && <small className="field-error-message">{errors.role}</small>}
            </div>

            {draft.role !== "superadmin" && <div className={`field form-span-2 site-access-field ${errors.site_ids ? "field-error" : ""}`}>
              <label>Acceso a sedes *</label>
              {!draft.organization_id ? <div className="site-access-empty">Selecciona primero una empresa para cargar sus sedes.</div> : visibleSites.length === 0 ? <div className="site-access-empty">La empresa seleccionada todavía no tiene sedes activas.</div> : <>
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
