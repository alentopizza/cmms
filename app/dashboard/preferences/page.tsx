import { redirect } from "next/navigation";
import ThemePreferences from "@/components/ThemePreferences";
import FileDropzone from "@/components/FileDropzone";
import UiIcon from "@/components/UiIcon";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { roleLabel } from "@/lib/permissions";
import { getOrganizationBranding } from "@/lib/organization-branding";
import { Alert, EmptyState } from "@/components/ui-kit/Feedback";
import { Button } from "@/components/ui-kit/Button";

export const dynamic = "force-dynamic";

type ProfileRow={
  full_name:string;
  email:string;
  phone:string|null;
  has_avatar:boolean;
  last_login_at:string|null;
};

export default async function PreferencesPage({
  searchParams,
}:{
  searchParams:Promise<{
    profile_saved?:string;profile_error?:string;
  }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const params=await searchParams;

  const [profileResult,organizationResult,organizationBranding]=await Promise.all([
    session.userId
      ? query<ProfileRow>(
          `SELECT full_name,email,phone,(avatar_data IS NOT NULL) has_avatar,last_login_at::text
           FROM users WHERE id=$1 LIMIT 1`,
          [session.userId],
        )
      : Promise.resolve({rows:[] as ProfileRow[],rowCount:0}),
    session.organizationId
      ? query<{timezone:string}>("SELECT timezone FROM organizations WHERE id=$1 LIMIT 1",[session.organizationId])
      : Promise.resolve({rows:[] as {timezone:string}[],rowCount:0}),
    session.organizationId&&session.whiteLabel
      ? getOrganizationBranding(session.organizationId)
      : Promise.resolve(null),
  ]);

  const profile=profileResult.rows[0]||{
    full_name:session.fullName,email:session.email,phone:null,has_avatar:false,last_login_at:null,
  };
  const timezone=organizationResult.rows[0]?.timezone||"Sin zona horaria de empresa asociada";
  const editable=Boolean(session.userId);

  const profileError=params.profile_error==="managed"
    ?"La cuenta Propietario Desweb se administra mediante la configuración segura del entorno y no tiene un registro de usuario editable."
    :params.profile_error==="name"
      ?"Ingresa tu nombre completo."
      :params.profile_error==="email"
        ?"Ingresa un correo electrónico válido."
        :params.profile_error==="duplicate"
          ?"Ese correo ya pertenece a otra cuenta."
          :params.profile_error
            ? decodeURIComponent(params.profile_error)
            : "";
  const nav=[
    {href:"#profile",label:"Perfil",description:"Tu información personal",icon:"user" as const},
    {href:"#preferences",label:"Preferencias",description:"Navegación y opciones",icon:"preferences" as const},
    {href:"#appearance",label:"Apariencia",description:"Tema y vista del sistema",icon:"system" as const},
    {href:"#security",label:"Seguridad",description:"Contraseña y sesiones",icon:"settings" as const},
    {href:"#integrations",label:"Integraciones",description:"Conexiones externas",icon:"share" as const},
  ];

  return <div className="account-preferences-page">
    <header className="account-page-header">
      <div className="account-page-heading">
        <span className="account-page-icon"><UiIcon name="user" size={19}/></span>
        <div><span className="eyebrow">MI CONFIGURACIÓN</span><h1>Mi configuración</h1><p>Administra tu perfil, preferencias de visualización y opciones personales.</p></div>
      </div>
    </header>

    {params.profile_saved==="1"&&<Alert variant="success" title="Cambios guardados">Tu información personal quedó actualizada.</Alert>}
    {profileError&&<Alert variant="danger" title="No fue posible guardar el perfil">{profileError}</Alert>}

    <div className="account-settings-layout">
      <aside className="account-settings-nav" aria-label="Secciones de Mi configuración">
        {nav.map(item=><a key={item.href} href={item.href}><span><UiIcon name={item.icon} size={16}/></span><span><strong>{item.label}</strong><small>{item.description}</small></span></a>)}
      </aside>

      <main className="account-settings-content">
        <section id="profile" className="account-settings-card">
          <div className="account-card-heading"><div><span className="eyebrow">Perfil</span><h2>Información personal</h2><p>Los datos provienen de tu cuenta autenticada y de la empresa a la que perteneces.</p></div></div>
          <form method="post" action="/api/preferences/profile" encType="multipart/form-data" className="account-profile-form">
            <input type="hidden" name="intent" value="profile"/>
            <div className="account-profile-photo">
              <span className="account-profile-avatar">{profile.has_avatar&&session.userId?<img src={"/api/users/"+session.userId+"/avatar"} alt={"Foto de "+profile.full_name}/>:<UiIcon name="user" size={28}/>}</span>
              {editable?<FileDropzone name="avatar" label="Cambiar foto" description="PNG, JPG o WebP. Se reutiliza tu foto de usuario existente." accept="image/png,image/jpeg,image/webp" maxSizeMb={5} kind="image" compact existingFileName={profile.has_avatar?"Foto de perfil actual":null} existingPreviewUrl={profile.has_avatar&&session.userId?"/api/users/"+session.userId+"/avatar":null}/>:<small>Esta identidad de plataforma no tiene un perfil de base de datos editable.</small>}
            </div>
            <div className="account-form-grid">
              <label><span>Nombre completo</span><input name="full_name" defaultValue={profile.full_name} readOnly={!editable} required/></label>
              <label><span>Rol</span><input value={roleLabel(session)} readOnly/></label>
              <label><span>Correo electrónico</span><input name="email" type="email" defaultValue={profile.email} readOnly={!editable} required/></label>
              <label><span>Empresa</span><input value={session.organizationName||"Plataforma Desweb"} readOnly/></label>
              <label><span>Teléfono</span><input name="phone" defaultValue={profile.phone||""} readOnly={!editable} placeholder={editable?"Número de contacto":"Sin registrar"}/></label>
              <label><span>Zona horaria</span><input value={timezone} readOnly/></label>
            </div>
            {editable&&<div className="account-form-actions"><Button type="submit" iconLeft="check">Guardar cambios</Button></div>}
          </form>
        </section>

        <section id="preferences" className="account-settings-card">
          <div className="account-card-heading"><div><span className="eyebrow">Preferencias</span><h2>Navegación personal</h2><p>Estas opciones aprovechan el comportamiento que ya tiene tu panel.</p></div></div>
          <div className="account-preference-facts">
            <article><span><UiIcon name="reorder" size={18}/></span><div><strong>Orden del menú</strong><p>Usa Organizar menú en el sidebar para mover los módulos. El orden se guarda con tu preferencia actual.</p></div></article>
            <article><span><UiIcon name="chevron-left" size={18}/></span><div><strong>Sidebar contraído</strong><p>El estado expandido o contraído se conserva mediante la preferencia de navegación ya existente.</p></div></article>
          </div>
        </section>

        <section id="appearance" className="account-settings-card">
          <div className="account-card-heading"><div><span className="eyebrow">Apariencia</span><h2>Tema de la interfaz</h2><p>Elige una preferencia personal. Esta opción utiliza el sistema claro, oscuro y automático existente.</p></div></div>
          <ThemePreferences organizationDefault={organizationBranding?.interfaceStyle}/>
        </section>

        <section id="security" className="account-settings-card">
          <div className="account-card-heading"><div><span className="eyebrow">Seguridad</span><h2>Seguridad y sesión</h2><p>Consulta información de acceso sin crear un segundo flujo de autenticación o credenciales.</p></div></div>
          <Alert variant="info" title="Seguridad administrada por el sistema existente">Los cambios de credenciales y controles de acceso continúan en las superficies autorizadas del CMMS; Mi configuración no modifica roles, permisos, empresa ni alcance de sedes.</Alert>
          {profile.last_login_at&&<small className="account-last-login">Último acceso registrado: {new Date(profile.last_login_at).toLocaleString("es-CO")}</small>}
        </section>

        <section id="integrations" className="account-settings-card">
          <div className="account-card-heading"><div><span className="eyebrow">Integraciones</span><h2>Conexiones personales</h2><p>Esta sección no crea conexiones nuevas: refleja el alcance disponible actualmente para tu cuenta.</p></div></div>
          <EmptyState icon="info" title="Sin integraciones personales configurables" description="Las integraciones operativas y de plataforma continúan administrándose desde sus superficies autorizadas; no existe una segunda configuración personal."/>
        </section>
      </main>
    </div>
  </div>;
}
