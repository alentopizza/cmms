import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, isPlatformOwner } from "@/lib/permissions";
import { organizationScopeFor } from "@/lib/organization-scope";
import { query } from "@/lib/db";
import { getCreationGateForScope } from "@/lib/setup-sequence";
import ModuleHeader from "@/components/ModuleHeader";
import CreateRecordModal from "@/components/CreateRecordModal";
import CreationPrerequisiteState from "@/components/CreationPrerequisiteState";
import CrewCreateForm, { type CrewFormWorker } from "@/components/CrewCreateForm";
import CrewDirectory from "@/components/CrewDirectory";
import { Alert } from "@/components/ui-kit/Feedback";
import UiIcon from "@/components/UiIcon";

type Crew = {
  id:string;
  organization_id:string;
  organization_name:string;
  site_id:string|null;
  site_name:string|null;
  name:string;
  description:string|null;
  leader_user_id:string|null;
  leader_name:string|null;
  leader_phone:string|null;
  leader_email:string|null;
  leader_role:string|null;
  leader_has_avatar:boolean;
  member_count:number;
  active_activity_count:number;
  completed_activity_count:number;
  active:boolean;
};

type CrewMember={
  crew_id:string;
  user_id:string;
  full_name:string;
  phone:string|null;
  email:string;
  role:string;
  supplier_name:string|null;
  has_avatar:boolean;
};

type Organization={id:string;name:string};
type Site={id:string;organization_id:string;name:string;organization_name:string};

function roleLabel(role:string|null){
  if(role==="manager")return "Supervisor";
  if(role==="technician")return "Técnico";
  if(role==="external")return "Colaborador externo";
  return role||"Integrante";
}

export default async function CrewsPage({searchParams}:{searchParams:Promise<{created?:string;updated?:string;error?:string}>}) {
  const session=await getSession();
  if(!session) redirect("/login");
  if(!can(session,"crews.manage")) redirect("/dashboard");
  const params=await searchParams;
  const platform=session.platformRole!=="user";
  const owner=isPlatformOwner(session);
  const organizationScope=organizationScopeFor(session);
  const platformScopeParams:unknown[]=[organizationScope.unrestricted,organizationScope.organizationIds];

  const crewSelect=`SELECT c.id,c.organization_id,o.name organization_name,c.site_id,s.name site_name,c.name,c.description,c.leader_user_id,
      leader.full_name leader_name,leader.phone leader_phone,leader.email leader_email,leader_membership.role leader_role,
      (leader.avatar_data IS NOT NULL) leader_has_avatar,
      (SELECT count(*)::int FROM crew_members cm WHERE cm.crew_id=c.id) member_count,
      (SELECT count(*)::int FROM work_order_tasks wt WHERE wt.crew_id=c.id AND wt.status IN ('pending','in_progress')) active_activity_count,
      (SELECT count(*)::int FROM work_order_tasks wt WHERE wt.crew_id=c.id AND wt.status='completed') completed_activity_count,
      c.active
    FROM crews c
    JOIN organizations o ON o.id=c.organization_id
    LEFT JOIN sites s ON s.id=c.site_id
    LEFT JOIN users leader ON leader.id=c.leader_user_id
    LEFT JOIN organization_members leader_membership ON leader_membership.organization_id=c.organization_id AND leader_membership.user_id=c.leader_user_id`;

  const memberSelect=`SELECT cm.crew_id,cm.user_id,u.full_name,u.phone,u.email,om.role,supplier.name supplier_name,
      (u.avatar_data IS NOT NULL) has_avatar
    FROM crew_members cm
    JOIN crews c ON c.id=cm.crew_id
    JOIN users u ON u.id=cm.user_id
    JOIN organization_members om ON om.organization_id=cm.organization_id AND om.user_id=cm.user_id
    LEFT JOIN suppliers supplier ON supplier.id=om.external_supplier_id`;

  const [crews,organizations,sites,workers,members]=await Promise.all([
    platform
      ? query<Crew>(crewSelect+" WHERE ($1::boolean OR c.organization_id=ANY($2::uuid[])) ORDER BY o.name,c.active DESC,c.name",platformScopeParams)
      : session.accessAllSites
        ? query<Crew>(crewSelect+" WHERE c.organization_id=$1 ORDER BY c.active DESC,c.name",[session.organizationId])
        : query<Crew>(crewSelect+" WHERE c.organization_id=$1 AND (c.site_id IS NULL OR c.site_id=ANY($2::uuid[])) ORDER BY c.active DESC,c.name",[session.organizationId,session.siteIds]),
    platform
      ? query<Organization>("SELECT id,name FROM organizations WHERE active=true AND ($1::boolean OR id=ANY($2::uuid[])) ORDER BY name",platformScopeParams)
      : query<Organization>("SELECT id,name FROM organizations WHERE id=$1",[session.organizationId]),
    platform
      ? query<Site>(`SELECT s.id,s.organization_id,s.name,o.name organization_name FROM sites s JOIN organizations o ON o.id=s.organization_id WHERE s.active=true AND ($1::boolean OR s.organization_id=ANY($2::uuid[])) ORDER BY o.name,s.name`,platformScopeParams)
      : session.accessAllSites
        ? query<Site>(`SELECT s.id,s.organization_id,s.name,o.name organization_name FROM sites s JOIN organizations o ON o.id=s.organization_id WHERE s.active=true AND s.organization_id=$1 ORDER BY s.name`,[session.organizationId])
        : query<Site>(`SELECT s.id,s.organization_id,s.name,o.name organization_name FROM sites s JOIN organizations o ON o.id=s.organization_id WHERE s.active=true AND s.organization_id=$1 AND s.id=ANY($2::uuid[]) ORDER BY s.name`,[session.organizationId,session.siteIds]),
    platform
      ? query<CrewFormWorker>(
          `SELECT u.id,om.organization_id,u.full_name,om.role,supplier.name supplier_name,u.phone,u.email,
                  (u.avatar_data IS NOT NULL) has_avatar,COALESCE(om.access_all_sites,true) access_all_sites,
                  COALESCE((SELECT array_agg(oms.site_id::text) FROM organization_member_sites oms WHERE oms.organization_id=om.organization_id AND oms.user_id=om.user_id),ARRAY[]::text[]) site_ids
           FROM organization_members om JOIN users u ON u.id=om.user_id
           LEFT JOIN suppliers supplier ON supplier.id=om.external_supplier_id
           WHERE u.active=true AND om.role IN ('manager','technician','external')
             AND ($1::boolean OR om.organization_id=ANY($2::uuid[]))
           ORDER BY om.organization_id,u.full_name`,platformScopeParams)
      : query<CrewFormWorker>(
          `SELECT u.id,om.organization_id,u.full_name,om.role,supplier.name supplier_name,u.phone,u.email,
                  (u.avatar_data IS NOT NULL) has_avatar,COALESCE(om.access_all_sites,true) access_all_sites,
                  COALESCE((SELECT array_agg(oms.site_id::text) FROM organization_member_sites oms WHERE oms.organization_id=om.organization_id AND oms.user_id=om.user_id),ARRAY[]::text[]) site_ids
           FROM organization_members om JOIN users u ON u.id=om.user_id
           LEFT JOIN suppliers supplier ON supplier.id=om.external_supplier_id
           WHERE u.active=true AND om.organization_id=$1 AND om.role IN ('manager','technician','external')
           ORDER BY u.full_name`,[session.organizationId]),
    platform
      ? query<CrewMember>(memberSelect+" WHERE ($1::boolean OR c.organization_id=ANY($2::uuid[])) ORDER BY cm.crew_id,u.full_name",platformScopeParams)
      : session.accessAllSites
        ? query<CrewMember>(memberSelect+" WHERE c.organization_id=$1 ORDER BY cm.crew_id,u.full_name",[session.organizationId])
        : query<CrewMember>(memberSelect+" WHERE c.organization_id=$1 AND (c.site_id IS NULL OR c.site_id=ANY($2::uuid[])) ORDER BY cm.crew_id,u.full_name",[session.organizationId,session.siteIds]),
  ]);

  const creationGate=await getCreationGateForScope("crew",session.organizationId,platform,session.platformRole==="superadmin"?session.platformOrganizationIds:undefined);
  const error=params.error==="sequence" ? creationGate.message
    : params.error==="members" ? "Selecciona al menos un integrante válido para la cuadrilla."
    : params.error==="leader" ? "El líder debe ser un integrante activo y autorizado de la misma cuadrilla."
    : params.error==="site-access" ? "Todos los integrantes deben tener acceso a la sede seleccionada."
    : params.error==="duplicate" ? "Ya existe una cuadrilla con ese nombre dentro de la empresa."
    : params.error==="edit-fields" ? "Completa nombre, sede, líder e integrantes válidos para guardar la cuadrilla."
    : params.error ? "No fue posible guardar la cuadrilla." : "";

  const activeCrews=crews.rows.filter(crew=>crew.active).length;
  const inactiveCrews=crews.rows.length-activeCrews;
  const directoryCrews=crews.rows.map(crew=>({
    id:crew.id,
    organizationId:crew.organization_id,
    organizationName:crew.organization_name,
    siteId:crew.site_id,
    siteName:crew.site_name,
    name:crew.name,
    description:crew.description,
    leaderUserId:crew.leader_user_id,
    leaderName:crew.leader_name,
    leaderPhone:crew.leader_phone,
    leaderEmail:crew.leader_email,
    leaderRole:roleLabel(crew.leader_role),
    leaderHasAvatar:crew.leader_has_avatar,
    memberCount:crew.member_count,
    activeActivityCount:crew.active_activity_count,
    completedActivityCount:crew.completed_activity_count,
    active:crew.active,
    members:members.rows.filter(member=>member.crew_id===crew.id).map(member=>({
      id:member.user_id,
      name:member.full_name,
      role:roleLabel(member.role),
      phone:member.phone,
      email:member.email,
      hasAvatar:member.has_avatar,
    })),
  }));

  return <div className="phase8-crews">
    <ModuleHeader
      eyebrow="Ejecución operativa"
      title="Cuadrillas"
      description="Equipos de trabajo en campo, asigna actividades, gestiona integrantes y monitorea su operación."
      count={crews.rowCount||0}
      countLabel="cuadrillas"
      searchPlaceholder="Buscar cuadrilla, líder, sede o integrante"
      facets={[
        {key:"organization",label:"Empresa",allLabel:"Todas las empresas"},
        {key:"site",label:"Sede",allLabel:"Todas las sedes"},
      ]}
      action={creationGate.ready?<CreateRecordModal
        title="Crear cuadrilla"
        eyebrow="Nuevo equipo"
        description="Selecciona la sede, define los integrantes y elige visualmente quién será el líder. El liderazgo no depende de que sea Técnico o Supervisor."
        triggerLabel="Nueva cuadrilla"
        iconName="plus"
        iconOnly
      >
        <CrewCreateForm
          organizations={organizations.rows}
          sites={sites.rows}
          workers={workers.rows}
          fixedOrganizationId={platform?undefined:session.organizationId||undefined}
        />
      </CreateRecordModal>:undefined}
    />

    {params.created&&<Alert variant="success" title="Cuadrilla creada">Cuadrilla creada correctamente.</Alert>}
    {params.updated&&<Alert variant="success" title="Cuadrilla actualizada">Los cambios de la cuadrilla se guardaron correctamente.</Alert>}
    {error&&<Alert variant="danger" title="No fue posible crear la cuadrilla">{error}</Alert>}

    {!creationGate.ready&&<CreationPrerequisiteState
      icon="crew"
      eyebrow="Jerarquía de creación"
      title={creationGate.title}
      message={creationGate.message}
      href={creationGate.href||"/dashboard/users"}
      action={creationGate.action||"Continuar"}
    />}

    <section className="crew-compact-stats" aria-label="Resumen de cuadrillas">
      <article>
        <span className="crew-compact-stat-icon"><UiIcon name="crew" size={18}/></span>
        <div><strong>{crews.rowCount||0}</strong><span>Cuadrillas registradas</span><small>dentro de tu alcance</small></div>
      </article>
      <article className="success">
        <span className="crew-compact-stat-icon"><UiIcon name="check" size={18}/></span>
        <div><strong>{activeCrews}</strong><span>Activas</span><small>disponibles para la operación</small></div>
      </article>
      <article className={inactiveCrews?"warning":""}>
        <span className="crew-compact-stat-icon"><UiIcon name="warning" size={18}/></span>
        <div><strong>{inactiveCrews}</strong><span>Inactivas</span><small>fuera de operación</small></div>
      </article>
    </section>

    <CrewDirectory crews={directoryCrews} owner={owner} sites={sites.rows} workers={workers.rows}/>
  </div>;
}
