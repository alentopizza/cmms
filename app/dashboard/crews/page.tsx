import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, isPlatformOwner } from "@/lib/permissions";
import { query } from "@/lib/db";
import { getCreationGateForScope } from "@/lib/setup-sequence";
import OwnerRecordActions from "@/components/OwnerRecordActions";
import ModuleHeader from "@/components/ModuleHeader";
import CreateRecordModal from "@/components/CreateRecordModal";
import CreationPrerequisiteState from "@/components/CreationPrerequisiteState";
import CrewCreateForm, { type CrewFormWorker } from "@/components/CrewCreateForm";
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

function initials(value:string){
  return value.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase()||"C";
}
function roleLabel(role:string|null){
  if(role==="manager")return "Supervisor";
  if(role==="technician")return "Técnico";
  if(role==="external")return "Colaborador externo";
  return role||"Integrante";
}

export default async function CrewsPage({searchParams}:{searchParams:Promise<{created?:string;error?:string}>}) {
  const session=await getSession();
  if(!session) redirect("/login");
  if(!can(session,"crews.manage")) redirect("/dashboard");
  const params=await searchParams;
  const superadmin=session.platformRole!=="user";
  const owner=isPlatformOwner(session);

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
    superadmin
      ? query<Crew>(crewSelect+" ORDER BY o.name,c.active DESC,c.name")
      : session.accessAllSites
        ? query<Crew>(crewSelect+" WHERE c.organization_id=$1 ORDER BY c.active DESC,c.name",[session.organizationId])
        : query<Crew>(crewSelect+" WHERE c.organization_id=$1 AND (c.site_id IS NULL OR c.site_id=ANY($2::uuid[])) ORDER BY c.active DESC,c.name",[session.organizationId,session.siteIds]),
    superadmin
      ? query<Organization>("SELECT id,name FROM organizations WHERE active=true ORDER BY name")
      : query<Organization>("SELECT id,name FROM organizations WHERE id=$1",[session.organizationId]),
    superadmin
      ? query<Site>(`SELECT s.id,s.organization_id,s.name,o.name organization_name FROM sites s JOIN organizations o ON o.id=s.organization_id WHERE s.active=true ORDER BY o.name,s.name`)
      : session.accessAllSites
        ? query<Site>(`SELECT s.id,s.organization_id,s.name,o.name organization_name FROM sites s JOIN organizations o ON o.id=s.organization_id WHERE s.active=true AND s.organization_id=$1 ORDER BY s.name`,[session.organizationId])
        : query<Site>(`SELECT s.id,s.organization_id,s.name,o.name organization_name FROM sites s JOIN organizations o ON o.id=s.organization_id WHERE s.active=true AND s.organization_id=$1 AND s.id=ANY($2::uuid[]) ORDER BY s.name`,[session.organizationId,session.siteIds]),
    superadmin
      ? query<CrewFormWorker>(
          `SELECT u.id,om.organization_id,u.full_name,om.role,supplier.name supplier_name,u.phone,u.email,
                  (u.avatar_data IS NOT NULL) has_avatar,COALESCE(om.access_all_sites,true) access_all_sites,
                  COALESCE((SELECT array_agg(oms.site_id::text) FROM organization_member_sites oms WHERE oms.organization_id=om.organization_id AND oms.user_id=om.user_id),ARRAY[]::text[]) site_ids
           FROM organization_members om JOIN users u ON u.id=om.user_id
           LEFT JOIN suppliers supplier ON supplier.id=om.external_supplier_id
           WHERE u.active=true AND om.role IN ('manager','technician','external')
           ORDER BY om.organization_id,u.full_name`)
      : query<CrewFormWorker>(
          `SELECT u.id,om.organization_id,u.full_name,om.role,supplier.name supplier_name,u.phone,u.email,
                  (u.avatar_data IS NOT NULL) has_avatar,COALESCE(om.access_all_sites,true) access_all_sites,
                  COALESCE((SELECT array_agg(oms.site_id::text) FROM organization_member_sites oms WHERE oms.organization_id=om.organization_id AND oms.user_id=om.user_id),ARRAY[]::text[]) site_ids
           FROM organization_members om JOIN users u ON u.id=om.user_id
           LEFT JOIN suppliers supplier ON supplier.id=om.external_supplier_id
           WHERE u.active=true AND om.organization_id=$1 AND om.role IN ('manager','technician','external')
           ORDER BY u.full_name`,[session.organizationId]),
    superadmin
      ? query<CrewMember>(memberSelect+" ORDER BY cm.crew_id,u.full_name")
      : session.accessAllSites
        ? query<CrewMember>(memberSelect+" WHERE c.organization_id=$1 ORDER BY cm.crew_id,u.full_name",[session.organizationId])
        : query<CrewMember>(memberSelect+" WHERE c.organization_id=$1 AND (c.site_id IS NULL OR c.site_id=ANY($2::uuid[])) ORDER BY cm.crew_id,u.full_name",[session.organizationId,session.siteIds]),
  ]);

  const creationGate=await getCreationGateForScope("crew",session.organizationId,superadmin);
  const error=params.error==="sequence" ? creationGate.message
    : params.error==="members" ? "Selecciona al menos un integrante válido para la cuadrilla."
    : params.error==="leader" ? "El líder debe ser un integrante activo y autorizado de la misma cuadrilla."
    : params.error==="site-access" ? "Todos los integrantes deben tener acceso a la sede seleccionada."
    : params.error==="duplicate" ? "Ya existe una cuadrilla con ese nombre dentro de la empresa."
    : params.error ? "No fue posible crear la cuadrilla." : "";

  return <>
    <ModuleHeader
      eyebrow="Ejecución operativa"
      title="Cuadrillas"
      description="Equipos de campo conformados por Técnicos, Supervisores y colaboradores autorizados, con un líder elegido por la operación."
      count={crews.rowCount || 0}
      countLabel="cuadrillas"
      searchPlaceholder="Buscar cuadrilla, empresa, sede, líder o integrante"
      facets={[
        {key:"organization",label:"Empresa",allLabel:"Todas las empresas"},
        {key:"site",label:"Sede",allLabel:"Todas las sedes"},
      ]}
      action={creationGate.ready ? <CreateRecordModal
        title="Crear cuadrilla"
        eyebrow="Nuevo equipo"
        description="Selecciona la sede, define los integrantes y elige visualmente quién será el líder. El liderazgo no depende de que sea Técnico o Supervisor."
        triggerLabel="Agregar"
        icon="◉"
      >
        <CrewCreateForm
          organizations={organizations.rows}
          sites={sites.rows}
          workers={workers.rows}
          fixedOrganizationId={superadmin?undefined:session.organizationId||undefined}
        />
      </CreateRecordModal> : undefined}
    />

    {params.created && <div className="notice success section">Cuadrilla creada correctamente.</div>}
    {error && <div className="notice error section">{error}</div>}

    {!creationGate.ready && <CreationPrerequisiteState
      icon="◉"
      eyebrow="Jerarquía de creación"
      title={creationGate.title}
      message={creationGate.message}
      href={creationGate.href || "/dashboard/users"}
      action={creationGate.action || "Continuar"}
    />}

    <section className="section crew-showcase-section">
      <div className="section-heading">
        <div><span className="eyebrow">Equipos operativos</span><h2>Cuadrillas registradas</h2></div>
        <small>El líder se destaca visualmente; el resto de integrantes conserva su rol real dentro de la empresa.</small>
      </div>

      {crews.rowCount ? <div className="crew-showcase-grid">{crews.rows.map(crew=>{
        const crewMembers=members.rows.filter(member=>member.crew_id===crew.id);
        const roster=crewMembers.filter(member=>member.user_id!==crew.leader_user_id);
        const searchMembers=crewMembers.map(member=>member.full_name).join(" ");
        return <article
          className={"crew-showcase-card "+(crew.active?"":"inactive")}
          key={crew.id}
          data-module-record
          data-status={crew.active?"active":"inactive"}
          data-search={[crew.name,crew.organization_name,crew.site_name,crew.leader_name,crew.description,searchMembers].filter(Boolean).join(" ")}
          data-filter-organization={crew.organization_id}
          data-filter-organization-label={crew.organization_name}
          data-filter-site={crew.site_id||""}
          data-filter-site-label={crew.site_name||""}
        >
          <div className="crew-leader-hero">
            <div className="crew-leader-photo">
              {crew.leader_user_id&&crew.leader_has_avatar
                ?<img src={"/api/users/"+crew.leader_user_id+"/avatar"} alt={"Foto de "+(crew.leader_name||"líder")}/>
                :<span>{initials(crew.leader_name||crew.name)}</span>}
              <div className="crew-leader-shade"/>
              <span className="crew-leader-badge">♕ Líder</span>
              <div className="crew-leader-identity">
                <strong>{crew.leader_name||"Líder sin asignar"}</strong>
                <small>{roleLabel(crew.leader_role)}</small>
              </div>
            </div>
            <div className="crew-leader-actions">
              {crew.leader_phone&&<a href={"https://wa.me/"+crew.leader_phone.replace(/\D/g,"")} target="_blank" rel="noreferrer" title="WhatsApp del líder"><UiIcon name="whatsapp" size={17}/><span>WhatsApp</span></a>}
              {crew.leader_phone&&<a href={"tel:"+crew.leader_phone.replace(/[^+\d]/g,"")} title="Llamar al líder"><UiIcon name="phone" size={17}/><span>Llamar</span></a>}
              {crew.leader_email&&<a href={"mailto:"+crew.leader_email} title="Correo del líder"><UiIcon name="mail" size={17}/><span>Correo</span></a>}
            </div>
          </div>

          <div className="crew-showcase-main">
            <header className="crew-showcase-head">
              <div>
                <span className="eyebrow">Cuadrilla</span>
                <h3>{crew.name}</h3>
                <p>{crew.organization_name}{crew.site_name?" · "+crew.site_name:""}</p>
              </div>
              <span className={"status-badge "+(crew.active?"status-active":"status-inactive")}><i/>{crew.active?"Activa":"Inactiva"}</span>
            </header>

            <div className="crew-showcase-metrics">
              <div><UiIcon name="user" size={18}/><span><strong>{crew.member_count}</strong><small>Integrantes</small></span></div>
              <div><UiIcon name="activity" size={18}/><span><strong>{crew.active_activity_count}</strong><small>Actividades activas</small></span></div>
              <div><UiIcon name="check" size={18}/><span><strong>{crew.completed_activity_count}</strong><small>Completadas</small></span></div>
            </div>

            {crew.description&&<p className="crew-showcase-description">{crew.description}</p>}

            <div className="crew-roster-head"><strong>Integrantes</strong><span>{crewMembers.length} en el equipo</span></div>
            <div className="crew-roster-grid">
              {roster.slice(0,4).map(member=><div className="crew-roster-person" key={member.user_id}>
                <span className="crew-person-avatar">{member.has_avatar?<img src={"/api/users/"+member.user_id+"/avatar"} alt=""/>:<b>{initials(member.full_name)}</b>}</span>
                <div><strong>{member.full_name}</strong><small>{roleLabel(member.role)}</small></div>
                <nav>
                  {member.phone&&<a href={"https://wa.me/"+member.phone.replace(/\D/g,"")} target="_blank" rel="noreferrer" title={"WhatsApp de "+member.full_name}><UiIcon name="whatsapp" size={14}/></a>}
                  {member.phone&&<a href={"tel:"+member.phone.replace(/[^+\d]/g,"")} title={"Llamar a "+member.full_name}><UiIcon name="phone" size={14}/></a>}
                </nav>
              </div>)}
              {roster.length===0&&<div className="crew-roster-empty">El líder es actualmente el único integrante.</div>}
              {roster.length>4&&<div className="crew-roster-more">+{roster.length-4}<small>integrantes</small></div>}
            </div>

            {owner&&<div className="crew-showcase-owner-actions"><OwnerRecordActions table="crews" id={crew.id} label={crew.name} fields={[
              {name:"name",label:"Nombre",value:crew.name},
              {name:"description",label:"Descripción",value:crew.description||"",type:"textarea"},
              {name:"active",label:"Estado",value:crew.active,type:"checkbox"},
            ]}/></div>}
          </div>
        </article>;
      })}</div> : <div className="card empty-state"><strong>Aún no hay cuadrillas.</strong><span>Crea Técnicos o Supervisores y luego conforma el primer equipo operativo.</span></div>}
    </section>
  </>;
}
