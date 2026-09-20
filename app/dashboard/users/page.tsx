import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, ROLE_LABELS, type OrganizationRole } from "@/lib/permissions";
import { query } from "@/lib/db";

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  active: boolean;
  platform_role: "superadmin" | "user";
  organization_name: string | null;
  role: OrganizationRole | null;
  site_name: string | null;
  last_login_at: string | null;
};

type Organization = { id: string; name: string };
type Site = { id: string; organization_id: string; name: string; organization_name: string };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session, "users.manage")) redirect("/dashboard");

  const params = await searchParams;
  const isSuperadmin = session.platformRole === "superadmin";

  const [users, organizations, sites] = await Promise.all([
    isSuperadmin
      ? query<UserRow>(
          `SELECT u.id,u.email,u.full_name,u.phone,u.active,u.platform_role,u.last_login_at::text,
                  membership.organization_name,membership.role,membership.site_name
           FROM users u
           LEFT JOIN LATERAL (
             SELECT o.name organization_name,om.role,s.name site_name
             FROM organization_members om
             JOIN organizations o ON o.id=om.organization_id
             LEFT JOIN sites s ON s.id=om.site_id
             WHERE om.user_id=u.id
             ORDER BY om.created_at ASC
             LIMIT 1
           ) membership ON true
           ORDER BY u.active DESC,u.full_name`,
        )
      : query<UserRow>(
          `SELECT u.id,u.email,u.full_name,u.phone,u.active,u.platform_role,u.last_login_at::text,
                  o.name organization_name,om.role,s.name site_name
           FROM organization_members om
           JOIN users u ON u.id=om.user_id
           JOIN organizations o ON o.id=om.organization_id
           LEFT JOIN sites s ON s.id=om.site_id
           WHERE om.organization_id=$1
           ORDER BY u.active DESC,u.full_name`,
          [session.organizationId],
        ),
    isSuperadmin
      ? query<Organization>("SELECT id,name FROM organizations WHERE active=true ORDER BY name")
      : query<Organization>("SELECT id,name FROM organizations WHERE id=$1", [session.organizationId]),
    isSuperadmin
      ? query<Site>(
          `SELECT s.id,s.organization_id,s.name,o.name organization_name
           FROM sites s JOIN organizations o ON o.id=s.organization_id
           WHERE s.active=true AND o.active=true ORDER BY o.name,s.name`,
        )
      : query<Site>(
          `SELECT s.id,s.organization_id,s.name,o.name organization_name
           FROM sites s JOIN organizations o ON o.id=s.organization_id
           WHERE s.active=true AND s.organization_id=$1 ORDER BY s.name`,
          [session.organizationId],
        ),
  ]);

  const feedback = params.error === "email"
    ? "Ya existe una cuenta con ese correo electrónico."
    : params.error === "required"
      ? "Completa los datos obligatorios y usa una contraseña de al menos 8 caracteres."
      : params.error === "technician-limit"
        ? "La empresa alcanzó el límite de técnicos asignado."
        : params.error
          ? "No fue posible crear el usuario."
          : "";

  return <>
    <header className="page-header">
      <div>
        <span className="eyebrow">Control de acceso</span>
        <h1 className="page-title">Usuarios y roles</h1>
        <p className="muted">Crea cuentas de prueba y define qué funciones podrá usar cada persona al iniciar sesión.</p>
      </div>
      <div className="brand-pill"><span /> {users.rowCount} cuentas</div>
    </header>

    {params.created && <div className="notice success section">Usuario creado. Ya puede iniciar sesión con el correo y la contraseña asignados.</div>}
    {feedback && <div className="notice error section">{feedback}</div>}

    <section className="card section">
      <div className="section-heading">
        <div><span className="eyebrow">Nueva cuenta</span><h2>Crear usuario</h2></div>
        <small>La contraseña se almacena cifrada mediante derivación criptográfica.</small>
      </div>

      <form className="form-grid user-create-form" method="post" action="/api/users">
        <div className="field"><label htmlFor="user-name">Nombre completo</label><input id="user-name" name="full_name" required /></div>
        <div className="field"><label htmlFor="user-email">Correo</label><input id="user-email" name="email" type="email" autoComplete="off" required /></div>
        <div className="field"><label htmlFor="user-phone">Teléfono</label><input id="user-phone" name="phone" /></div>
        <div className="field"><label htmlFor="user-password">Contraseña temporal</label><input id="user-password" name="password" type="password" minLength={8} autoComplete="new-password" required /></div>

        {isSuperadmin && <div className="field">
          <label htmlFor="user-organization">Empresa</label>
          <select id="user-organization" name="organization_id" defaultValue="">
            <option value="">Sin empresa (solo para superadministrador)</option>
            {organizations.rows.map(org => <option value={org.id} key={org.id}>{org.name}</option>)}
          </select>
        </div>}
        {!isSuperadmin && <input type="hidden" name="organization_id" value={session.organizationId || ""} />}

        <div className="field">
          <label htmlFor="user-role">Rol</label>
          <select id="user-role" name="role" required defaultValue="viewer">
            {isSuperadmin && <option value="superadmin">Superadministrador</option>}
            {Object.entries(ROLE_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <div className="field form-span-2">
          <label htmlFor="user-site">Sede asignada (opcional)</label>
          <select id="user-site" name="site_id" defaultValue="">
            <option value="">Todas las sedes permitidas por el rol</option>
            {sites.rows.map(site => <option value={site.id} key={site.id}>{isSuperadmin ? `${site.organization_name} · ` : ""}{site.name}</option>)}
          </select>
          <small>La sede será útil para restringir técnicos y otros perfiles operativos en iteraciones posteriores.</small>
        </div>

        <div className="form-span-2 form-actions"><button className="button" type="submit">Crear usuario</button></div>
      </form>
    </section>

    <section className="section">
      <div className="section-heading"><div><span className="eyebrow">Directorio de acceso</span><h2>Cuentas registradas</h2></div></div>
      <div className="user-role-grid">
        {users.rows.map(user => <article className="card user-role-card" key={user.id}>
          <div className="user-role-card-head">
            <div className="user-avatar" aria-hidden="true">{user.full_name.split(/\s+/).slice(0,2).map(part => part[0]).join("").toUpperCase()}</div>
            <div><strong>{user.full_name}</strong><span>{user.email}</span></div>
            <span className={`status-badge ${user.active ? "status-active" : "status-inactive"}`}><i />{user.active ? "Activo" : "Inactivo"}</span>
          </div>
          <div className="user-role-meta">
            <div><span>Rol</span><strong>{user.platform_role === "superadmin" ? "Superadministrador" : user.role ? ROLE_LABELS[user.role] : "Sin rol"}</strong></div>
            <div><span>Empresa</span><strong>{user.organization_name || "Acceso global"}</strong></div>
            <div><span>Sede</span><strong>{user.site_name || "Sin restricción específica"}</strong></div>
            <div><span>Último acceso</span><strong>{user.last_login_at ? new Date(user.last_login_at).toLocaleString("es-CO") : "Aún no ingresa"}</strong></div>
          </div>
        </article>)}
      </div>
    </section>
  </>;
}
