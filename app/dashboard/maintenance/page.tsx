import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, isPlatformOwner } from "@/lib/permissions";
import { query } from "@/lib/db";
import { RoutineCreateModal } from "@/components/ContextCreateModals";
import OwnerRecordActions from "@/components/OwnerRecordActions";
import ModuleHeader from "@/components/ModuleHeader";
import { MaintenanceCard } from "@/components/business-ui";
import CreationPrerequisiteState from "@/components/CreationPrerequisiteState";
import { Alert, EmptyState } from "@/components/ui-kit/Feedback";
import { KpiCard, MetricGrid } from "@/components/ui-kit/Metrics";
import { StaticDataTable } from "@/components/ui-kit/StaticTable";
import { CollectionView } from "@/components/ui-kit/DataControls";
import { EntityIdentityCell, ListQuickActions } from "@/components/ui-kit/CollectionIdentity";
import { Badge } from "@/components/ui-kit/Badge";
import { getCreationGateForScope } from "@/lib/setup-sequence";

type AssetOption={id:string;organization_id:string;site_id:string;name:string;code:string;label:string};
type PlanRow={id:string;organization_id:string;site_id:string;site:string;name:string;asset_id:string;asset_has_image:boolean;asset:string;company:string;frequency_value:number;frequency_unit:string;next_due_at:string|null;active:boolean};

// ── Responsive maintenance directory: desktop table + mobile cards ─────────

export default async function MaintenancePage({searchParams}:{searchParams:Promise<{created?:string;error?:string}>}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session, "maintenance.read")) redirect("/dashboard");
  const feedback=await searchParams;
  const canWrite=can(session,"maintenance.write");
  const canReadAssets=can(session,"assets.read");
  const owner=isPlatformOwner(session);
  const creationGate=await getCreationGateForScope("routine",session.organizationId,session.platformRole!=="user");

  const plans = session.platformRole !== "user"
    ? await query<PlanRow>(
        `SELECT p.id,p.organization_id,a.site_id,s.name site,p.name,a.id asset_id,(a.image_data IS NOT NULL) asset_has_image,a.name asset,o.name company,p.frequency_value,p.frequency_unit,p.next_due_at::text,p.active
         FROM maintenance_plans p JOIN assets a ON a.id=p.asset_id JOIN organizations o ON o.id=p.organization_id JOIN sites s ON s.id=a.site_id
         ORDER BY p.next_due_at NULLS LAST,p.name LIMIT 200`)
    : session.accessAllSites
      ? await query<PlanRow>(
          `SELECT p.id,p.organization_id,a.site_id,s.name site,p.name,a.id asset_id,(a.image_data IS NOT NULL) asset_has_image,a.name asset,o.name company,p.frequency_value,p.frequency_unit,p.next_due_at::text,p.active
           FROM maintenance_plans p JOIN assets a ON a.id=p.asset_id JOIN organizations o ON o.id=p.organization_id JOIN sites s ON s.id=a.site_id
           WHERE p.organization_id=$1 ORDER BY p.next_due_at NULLS LAST,p.name LIMIT 200`, [session.organizationId])
      : await query<PlanRow>(
          `SELECT p.id,p.organization_id,a.site_id,s.name site,p.name,a.id asset_id,(a.image_data IS NOT NULL) asset_has_image,a.name asset,o.name company,p.frequency_value,p.frequency_unit,p.next_due_at::text,p.active
           FROM maintenance_plans p JOIN assets a ON a.id=p.asset_id JOIN organizations o ON o.id=p.organization_id JOIN sites s ON s.id=a.site_id
           WHERE p.organization_id=$1 AND a.site_id = ANY($2::uuid[])
           ORDER BY p.next_due_at NULLS LAST,p.name LIMIT 200`, [session.organizationId, session.siteIds]);

  const assets=canWrite
    ? session.platformRole!=="user"
      ? await query<AssetOption>(
          `SELECT a.id,a.organization_id,a.site_id,a.name,a.code,o.name||' · '||s.name||' · '||a.code||' '||a.name label
           FROM assets a JOIN organizations o ON o.id=a.organization_id JOIN sites s ON s.id=a.site_id
           WHERE a.status<>'retired' ORDER BY o.name,s.name,a.name`)
      : session.accessAllSites
        ? await query<AssetOption>(
            `SELECT a.id,a.organization_id,a.site_id,a.name,a.code,s.name||' · '||a.code||' '||a.name label
             FROM assets a JOIN sites s ON s.id=a.site_id
             WHERE a.organization_id=$1 AND a.status<>'retired' ORDER BY s.name,a.name`,
            [session.organizationId])
        : await query<AssetOption>(
            `SELECT a.id,a.organization_id,a.site_id,a.name,a.code,s.name||' · '||a.code||' '||a.name label
             FROM assets a JOIN sites s ON s.id=a.site_id
             WHERE a.organization_id=$1 AND a.status<>'retired' AND a.site_id=ANY($2::uuid[])
             ORDER BY s.name,a.name`,
            [session.organizationId,session.siteIds])
    : {rows:[]} as {rows:AssetOption[]};

  const today=new Date(); today.setHours(0,0,0,0);
  const activeCount=plans.rows.filter(plan=>plan.active).length;
  const overdueCount=plans.rows.filter(plan=>plan.active&&plan.next_due_at&&new Date(plan.next_due_at)<today).length;
  const dueSoonCount=plans.rows.filter(plan=>{
    if(!plan.active||!plan.next_due_at)return false;
    const due=new Date(plan.next_due_at); const diff=(due.getTime()-today.getTime())/86400000;
    return diff>=0&&diff<=7;
  }).length;

  return <div className="phase9-maintenance">
    <ModuleHeader
      eyebrow="Mantenimiento preventivo"
      title="Rutinas"
      description="Planes por calendario asociados a los activos visibles para tu cuenta."
      count={plans.rowCount || 0}
      countLabel="rutinas"
      searchPlaceholder="Buscar rutina, empresa, sede o activo"
      facets={[
        {key:"organization",label:"Empresa",allLabel:"Todas las empresas"},
        {key:"site",label:"Sede",allLabel:"Todas las sedes"},
        {key:"frequency",label:"Frecuencia",allLabel:"Todas las frecuencias"},
      ]}
      action={canWrite && creationGate.ready ? <RoutineCreateModal triggerLabel="Agregar" assets={assets.rows} returnTo="/dashboard/maintenance" /> : undefined}
    />
    {feedback.created==="routine" && <div className="section"><Alert variant="success" title="Rutina creada">Rutina creada correctamente.</Alert></div>}
    {feedback.error && <div className="section"><Alert variant="danger" title="No fue posible crear la rutina">{feedback.error==="sequence" ? creationGate.message : "Revisa los datos e inténtalo nuevamente."}</Alert></div>}
    {canWrite && !creationGate.ready && <CreationPrerequisiteState
      icon="maintenance"
      eyebrow="Jerarquía de creación"
      title={creationGate.title}
      message={creationGate.message}
      href={creationGate.href || "/dashboard/assets"}
      action={creationGate.action || "Continuar"}
    />}
    {creationGate.ready && <section className="section phase9-maintenance-note"><Alert variant="info" title="Creación contextual">Desde el módulo puedes escoger el activo. Si creas la rutina entrando al activo, esa relación queda preseleccionada automáticamente.</Alert></section>}
    <MetricGrid className="section phase9-kpi-grid">
      <KpiCard label="Rutinas visibles" value={String(plans.rowCount||0)} hint="según tu alcance" icon="maintenance"/>
      <KpiCard label="Activas" value={String(activeCount)} hint="planes habilitados" icon="check" tone="success"/>
      <KpiCard label="Vencidas" value={String(overdueCount)} hint="fecha anterior a hoy" icon="warning" tone={overdueCount?"danger":"success"}/>
      <KpiCard label="Próximos 7 días" value={String(dueSoonCount)} hint="vencimientos próximos" icon="clock" tone={dueSoonCount?"warning":"default"}/>
    </MetricGrid>
    <section className="section maintenance-directory-section">
      <CollectionView storageKey="maintenance" label="Vista de rutinas" grid={<div className="maintenance-mobile-list" data-collection-grid>
        {plans.rows.map(p=><MaintenanceCard
          key={p.id}
          name={p.name}
          asset={p.asset}
          company={p.company}
          frequency={"Cada "+p.frequency_value+" "+p.frequency_unit}
          nextDue={p.next_due_at ? new Date(p.next_due_at).toLocaleDateString("es-CO") : "Sin programar"}
          active={p.active}
          recordProps={{
            "data-module-record":true,"data-status":p.active?"active":"inactive",
            "data-search":[p.name,p.asset,p.company,p.site,p.frequency_unit].filter(Boolean).join(" "),
            "data-filter-organization":p.organization_id,"data-filter-organization-label":p.company,
            "data-filter-site":p.site_id,"data-filter-site-label":p.site,
            "data-filter-frequency":p.frequency_unit,"data-filter-frequency-label":p.frequency_unit,
          }}
          actions={owner?<OwnerRecordActions table="maintenance_plans" id={p.id} label={p.name} fields={[
            {name:"name",label:"Nombre",value:p.name},
            {name:"frequency_value",label:"Frecuencia",value:p.frequency_value,type:"number"},
            {name:"frequency_unit",label:"Unidad",value:p.frequency_unit,type:"select",options:[
              {value:"day",label:"Día"},{value:"week",label:"Semana"},{value:"month",label:"Mes"},{value:"year",label:"Año"},{value:"meter",label:"Medidor"}
            ]},
            {name:"next_due_at",label:"Próxima ejecución",value:p.next_due_at?p.next_due_at.slice(0,10):"",type:"date"},
            {name:"active",label:"Estado",value:p.active,type:"checkbox"},
          ]}/>:undefined}
        />)}
      </div>} list={<StaticDataTable
        className="maintenance-directory-table"
        caption="Rutinas de mantenimiento preventivo"
        columns={[
          {key:"plan",label:"Rutina",width:"34%"},
          {key:"company",label:"Empresa"},
          {key:"asset",label:"Equipo"},
          {key:"due",label:"Próximo vencimiento"},
          {key:"state",label:"Estado"},
          ...(owner?[{key:"actions",label:"Acciones",align:"end" as const}]:[]),
        ]}
        rows={plans.rows.map(p=>({id:p.id,recordProps:{
          "data-module-record":true,"data-status":p.active?"active":"inactive",
          "data-search":[p.name,p.asset,p.company,p.site,p.frequency_unit].filter(Boolean).join(" "),
          "data-filter-organization":p.organization_id,"data-filter-organization-label":p.company,
          "data-filter-site":p.site_id,"data-filter-site-label":p.site,
          "data-filter-frequency":p.frequency_unit,"data-filter-frequency-label":p.frequency_unit,
        },cells:{
          plan:<EntityIdentityCell
            imageSrc={canReadAssets&&p.asset_has_image?"/api/assets/"+p.asset_id+"/image":null}
            imageAlt={canReadAssets&&p.asset_has_image?"Imagen de "+p.asset:""}
            icon="maintenance"
            variant="thumbnail"
            title={p.name}
            subtitle={"Cada "+p.frequency_value+" "+p.frequency_unit}
            meta={p.site}
          />,
          company:p.company,
          asset:p.asset,
          due:p.next_due_at?new Date(p.next_due_at).toLocaleDateString("es-CO"):"Sin programar",
          state:<Badge variant={p.active?"success":"neutral"}>{p.active?"Activa":"Inactiva"}</Badge>,
          ...(owner?{actions:<ListQuickActions><OwnerRecordActions table="maintenance_plans" id={p.id} label={p.name} fields={[
            {name:"name",label:"Nombre",value:p.name},
            {name:"frequency_value",label:"Frecuencia",value:p.frequency_value,type:"number"},
            {name:"frequency_unit",label:"Unidad",value:p.frequency_unit,type:"select",options:[
              {value:"day",label:"Día"},{value:"week",label:"Semana"},{value:"month",label:"Mes"},{value:"year",label:"Año"},{value:"meter",label:"Medidor"}
            ]},
            {name:"next_due_at",label:"Próxima ejecución",value:p.next_due_at?p.next_due_at.slice(0,10):"",type:"date"},
            {name:"active",label:"Estado",value:p.active,type:"checkbox"},
          ]}/></ListQuickActions>}:{})
        }}))}
        empty={<EmptyState icon="file" title="No hay rutinas disponibles" description="Cuando existan rutinas visibles para tu alcance aparecerán aquí."/>}
      />}/>
    </section>
  </div>;
}
