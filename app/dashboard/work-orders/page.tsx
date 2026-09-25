import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, isPlatformOwner } from "@/lib/permissions";
import { query } from "@/lib/db";
import OwnerRecordActions from "@/components/OwnerRecordActions";
import ModuleHeader from "@/components/ModuleHeader";
import CreationPrerequisiteState from "@/components/CreationPrerequisiteState";
import { getCreationGateForScope } from "@/lib/setup-sequence";
import CreateRecordModal from "@/components/CreateRecordModal";
import { WorkOrderCard } from "@/components/business-ui";
import { Alert, EmptyState } from "@/components/ui-kit/Feedback";
import { KpiCard, MetricGrid } from "@/components/ui-kit/Metrics";
import { StaticDataTable } from "@/components/ui-kit/StaticTable";
import { CollectionView } from "@/components/ui-kit/DataControls";
import { EntityIdentityCell, ListQuickActions } from "@/components/ui-kit/CollectionIdentity";
import UiIcon from "@/components/UiIcon";
import { PriorityBadge, WorkOrderStatusBadge } from "@/components/maintenance-ui/OperationStatus";

type OrderRow={id:string;organization_id:string;site_id:string;site:string;number:string;title:string;asset_id:string|null;asset_has_image:boolean;asset:string;company:string;type:string;priority:string;status:string;requested_at:string};

// ── Responsive work-order directory: desktop table + mobile cards ──────────

export default async function WorkOrdersPage({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const session=await getSession();
  const feedback=await searchParams;
  if(!session) redirect("/login");
  if(!can(session,"work_orders.read")) redirect("/dashboard");

  const superadmin=session.platformRole!=="user";
  const orgId=session.organizationId;
  const canWrite=can(session,"work_orders.write");
  const owner=isPlatformOwner(session);
  const creationGate=await getCreationGateForScope("work_order",session.organizationId,superadmin);
  const requesterOnly=session.role==="requester" && session.userId;
  const providerOnly=session.role==="provider" && session.userId;
  const externalOnly=session.role==="external" && session.userId;

  let orders;
  if(superadmin){
    orders=await query<OrderRow>(
      `SELECT w.id,w.organization_id,w.site_id,s.name site,w.number::text,w.title,a.id asset_id,(a.image_data IS NOT NULL) asset_has_image,coalesce(a.name,'Sin equipo') asset,o.name company,w.type,w.priority,w.status,w.requested_at::text
       FROM work_orders w JOIN organizations o ON o.id=w.organization_id JOIN sites s ON s.id=w.site_id LEFT JOIN assets a ON a.id=w.asset_id
       ORDER BY w.requested_at DESC LIMIT 200`);
  }else if(requesterOnly){
    orders=session.accessAllSites
      ? await query<OrderRow>(
          `SELECT w.id,w.organization_id,w.site_id,s.name site,w.number::text,w.title,a.id asset_id,(a.image_data IS NOT NULL) asset_has_image,coalesce(a.name,'Sin equipo') asset,o.name company,w.type,w.priority,w.status,w.requested_at::text
           FROM work_orders w JOIN organizations o ON o.id=w.organization_id JOIN sites s ON s.id=w.site_id LEFT JOIN assets a ON a.id=w.asset_id
           WHERE w.organization_id=$1 AND w.requested_by=$2 ORDER BY w.requested_at DESC LIMIT 200`,
          [orgId,session.userId])
      : await query<OrderRow>(
          `SELECT w.id,w.organization_id,w.site_id,s.name site,w.number::text,w.title,a.id asset_id,(a.image_data IS NOT NULL) asset_has_image,coalesce(a.name,'Sin equipo') asset,o.name company,w.type,w.priority,w.status,w.requested_at::text
           FROM work_orders w JOIN organizations o ON o.id=w.organization_id JOIN sites s ON s.id=w.site_id LEFT JOIN assets a ON a.id=w.asset_id
           WHERE w.organization_id=$1 AND w.requested_by=$2 AND w.site_id=ANY($3::uuid[])
           ORDER BY w.requested_at DESC LIMIT 200`,
          [orgId,session.userId,session.siteIds]);
  }else if(providerOnly){
    const supplierId=session.externalSupplierId;
    orders=session.accessAllSites
      ? await query<OrderRow>(
          `SELECT DISTINCT w.id,w.organization_id,w.site_id,s.name site,w.number::text,w.title,a.id asset_id,(a.image_data IS NOT NULL) asset_has_image,coalesce(a.name,'Sin equipo') asset,o.name company,w.type,w.priority,w.status,w.requested_at::text
           FROM work_orders w JOIN organizations o ON o.id=w.organization_id JOIN sites s ON s.id=w.site_id LEFT JOIN assets a ON a.id=w.asset_id
           WHERE w.organization_id=$1 AND $2::uuid IS NOT NULL AND (
             w.service_supplier_id=$2 OR EXISTS(SELECT 1 FROM work_order_tasks t WHERE t.work_order_id=w.id AND t.service_supplier_id=$2)
           )
           ORDER BY w.requested_at DESC LIMIT 200`,
          [orgId,supplierId])
      : await query<OrderRow>(
          `SELECT DISTINCT w.id,w.organization_id,w.site_id,s.name site,w.number::text,w.title,a.id asset_id,(a.image_data IS NOT NULL) asset_has_image,coalesce(a.name,'Sin equipo') asset,o.name company,w.type,w.priority,w.status,w.requested_at::text
           FROM work_orders w JOIN organizations o ON o.id=w.organization_id JOIN sites s ON s.id=w.site_id LEFT JOIN assets a ON a.id=w.asset_id
           WHERE w.organization_id=$1 AND w.site_id=ANY($3::uuid[]) AND $2::uuid IS NOT NULL AND (
             w.service_supplier_id=$2 OR EXISTS(SELECT 1 FROM work_order_tasks t WHERE t.work_order_id=w.id AND t.service_supplier_id=$2)
           )
           ORDER BY w.requested_at DESC LIMIT 200`,
          [orgId,supplierId,session.siteIds]);
  }else if(externalOnly){
    orders=session.accessAllSites
      ? await query<OrderRow>(
          `SELECT DISTINCT w.id,w.organization_id,w.site_id,s.name site,w.number::text,w.title,a.id asset_id,(a.image_data IS NOT NULL) asset_has_image,coalesce(a.name,'Sin equipo') asset,o.name company,w.type,w.priority,w.status,w.requested_at::text
           FROM work_orders w JOIN organizations o ON o.id=w.organization_id JOIN sites s ON s.id=w.site_id LEFT JOIN assets a ON a.id=w.asset_id
           WHERE w.organization_id=$1 AND (
             w.assigned_to=$2 OR EXISTS(SELECT 1 FROM work_order_tasks t WHERE t.work_order_id=w.id AND (
               t.assigned_to=$2 OR EXISTS(SELECT 1 FROM crew_members cm WHERE cm.crew_id=t.crew_id AND cm.user_id=$2)
             ))
           )
           ORDER BY w.requested_at DESC LIMIT 200`,
          [orgId,session.userId])
      : await query<OrderRow>(
          `SELECT DISTINCT w.id,w.organization_id,w.site_id,s.name site,w.number::text,w.title,a.id asset_id,(a.image_data IS NOT NULL) asset_has_image,coalesce(a.name,'Sin equipo') asset,o.name company,w.type,w.priority,w.status,w.requested_at::text
           FROM work_orders w JOIN organizations o ON o.id=w.organization_id JOIN sites s ON s.id=w.site_id LEFT JOIN assets a ON a.id=w.asset_id
           WHERE w.organization_id=$1 AND w.site_id=ANY($3::uuid[]) AND (
             w.assigned_to=$2 OR EXISTS(SELECT 1 FROM work_order_tasks t WHERE t.work_order_id=w.id AND (
               t.assigned_to=$2 OR EXISTS(SELECT 1 FROM crew_members cm WHERE cm.crew_id=t.crew_id AND cm.user_id=$2)
             ))
           )
           ORDER BY w.requested_at DESC LIMIT 200`,
          [orgId,session.userId,session.siteIds]);
  }else{
    orders=session.accessAllSites
      ? await query<OrderRow>(
          `SELECT w.id,w.organization_id,w.site_id,s.name site,w.number::text,w.title,a.id asset_id,(a.image_data IS NOT NULL) asset_has_image,coalesce(a.name,'Sin equipo') asset,o.name company,w.type,w.priority,w.status,w.requested_at::text
           FROM work_orders w JOIN organizations o ON o.id=w.organization_id JOIN sites s ON s.id=w.site_id LEFT JOIN assets a ON a.id=w.asset_id
           WHERE w.organization_id=$1 ORDER BY w.requested_at DESC LIMIT 200`,[orgId])
      : await query<OrderRow>(
          `SELECT w.id,w.organization_id,w.site_id,s.name site,w.number::text,w.title,a.id asset_id,(a.image_data IS NOT NULL) asset_has_image,coalesce(a.name,'Sin equipo') asset,o.name company,w.type,w.priority,w.status,w.requested_at::text
           FROM work_orders w JOIN organizations o ON o.id=w.organization_id JOIN sites s ON s.id=w.site_id LEFT JOIN assets a ON a.id=w.asset_id
           WHERE w.organization_id=$1 AND w.site_id=ANY($2::uuid[])
           ORDER BY w.requested_at DESC LIMIT 200`,[orgId,session.siteIds]);
  }

  const assets=canWrite
    ? superadmin
      ? await query<{id:string;label:string}>(`SELECT a.id,o.name||' · '||s.name||' · '||a.code||' '||a.name label FROM assets a JOIN organizations o ON o.id=a.organization_id JOIN sites s ON s.id=a.site_id WHERE a.status<>'retired' ORDER BY o.name,a.name`)
      : session.accessAllSites
        ? await query<{id:string;label:string}>(`SELECT a.id,s.name||' · '||a.code||' '||a.name label FROM assets a JOIN sites s ON s.id=a.site_id WHERE a.organization_id=$1 AND a.status<>'retired' ORDER BY a.name`,[orgId])
        : await query<{id:string;label:string}>(`SELECT a.id,s.name||' · '||a.code||' '||a.name label FROM assets a JOIN sites s ON s.id=a.site_id WHERE a.organization_id=$1 AND a.site_id=ANY($2::uuid[]) AND a.status<>'retired' ORDER BY a.name`,[orgId,session.siteIds])
    : {rows:[]} as {rows:{id:string;label:string}[]};

  const activeOrders=orders.rows.filter(order=>!["completed","cancelled"].includes(order.status)).length;
  const urgentOrders=orders.rows.filter(order=>order.priority==="urgent"&&!["completed","cancelled"].includes(order.status)).length;
  const inProgressOrders=orders.rows.filter(order=>order.status==="in_progress").length;
  const completedOrders=orders.rows.filter(order=>order.status==="completed").length;

  return <div className="phase9-work-orders">
    <ModuleHeader
      eyebrow="Mantenimiento"
      title="Órdenes de trabajo"
      description={providerOnly?"Solo ves trabajo asignado a tu empresa proveedora.":externalOnly?"Solo ves órdenes y actividades asignadas directamente a tu cuenta o cuadrilla.":requesterOnly?"Consulta y registra tus solicitudes de mantenimiento.":"Correctivos, preventivos, inspecciones y emergencias."}
      count={orders.rowCount || 0}
      countLabel="órdenes"
      searchPlaceholder="Buscar OT, trabajo, empresa o equipo"
      filters={[
        {value:"all",label:"Todas"},
        {value:"open",label:"Abiertas"},
        {value:"assigned",label:"Asignadas"},
        {value:"in_progress",label:"En progreso"},
        {value:"paused",label:"Pausadas"},
        {value:"completed",label:"Completadas"},
        {value:"cancelled",label:"Canceladas"},
      ]}
      facets={[
        {key:"organization",label:"Empresa",allLabel:"Todas las empresas"},
        {key:"site",label:"Sede",allLabel:"Todas las sedes"},
        {key:"priority",label:"Prioridad",allLabel:"Todas las prioridades"},
        {key:"type",label:"Tipo",allLabel:"Todos los tipos"},
      ]}
      action={canWrite && creationGate.ready && assets.rows.length>0 ? <CreateRecordModal title={requesterOnly?"Crear solicitud":"Crear orden de trabajo"} eyebrow={requesterOnly?"Nueva solicitud":"Nueva orden"} description="Relaciona el trabajo con un activo y define los datos iniciales de atención." triggerLabel="Agregar" iconName="work-order">
        <form className="form-grid unified-popup-form" method="post" action="/api/work-orders">
          <div className="field form-span-2"><label>Equipo *</label><select name="asset_id" required><option value="">Selecciona un activo</option>{assets.rows.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select></div>
          <div className="field form-span-2"><label>Título *</label><input name="title" required placeholder="Ej. Revisar temperatura irregular en cámara 02"/></div>
          {!requesterOnly && <><div className="field"><label>Tipo</label><select name="type"><option value="corrective">Correctivo</option><option value="preventive">Preventivo</option><option value="inspection">Inspección</option><option value="emergency">Emergencia</option><option value="improvement">Mejora</option></select></div><div className="field"><label>Prioridad</label><select name="priority"><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></div></>}
          <div className="form-span-2 form-actions"><button className="button" type="submit">{requesterOnly?"Enviar solicitud":"Crear orden"}</button></div>
        </form>
      </CreateRecordModal> : undefined}
    />

    {feedback.error==="sequence" && <div className="section"><Alert variant="danger" title="Jerarquía incompleta">{creationGate.message}</Alert></div>}

    {canWrite && !creationGate.ready && <CreationPrerequisiteState
      icon="work-order"
      eyebrow="Jerarquía de creación"
      title={creationGate.title}
      message={creationGate.message}
      href={creationGate.href || "/dashboard/assets"}
      action={creationGate.action || "Continuar"}
    />}

    <MetricGrid className="section phase9-kpi-grid">
      <KpiCard label="Órdenes activas" value={String(activeOrders)} hint="abiertas, asignadas, en progreso o pausadas" icon="work-order"/>
      <KpiCard label="En progreso" value={String(inProgressOrders)} hint="ejecución activa" icon="activity" tone="info"/>
      <KpiCard label="Urgentes" value={String(urgentOrders)} hint="pendientes de cierre" icon="warning" tone={urgentOrders?"danger":"success"}/>
      <KpiCard label="Completadas" value={String(completedOrders)} hint="en el conjunto visible" icon="check" tone="success"/>
    </MetricGrid>
    <section className="section work-order-directory-section">
      <CollectionView storageKey="work-orders" label="Vista de órdenes" grid={<div className="work-order-mobile-list" data-collection-grid>
        {orders.rows.map(w=><WorkOrderCard
          key={w.id}
          id={w.id}
          number={w.number}
          title={w.title}
          asset={w.asset}
          company={w.company}
          priority={w.priority}
          status={w.status}
          recordProps={{
            "data-module-record":true,"data-status":w.status,
            "data-search":[w.number,w.title,w.company,w.site,w.asset,w.type,w.priority,w.status].join(" "),
            "data-filter-organization":w.organization_id,"data-filter-organization-label":w.company,
            "data-filter-site":w.site_id,"data-filter-site-label":w.site,
            "data-filter-priority":w.priority,"data-filter-priority-label":w.priority,
            "data-filter-type":w.type,"data-filter-type-label":w.type,
          }}
          actions={owner?<OwnerRecordActions table="work_orders" id={w.id} label={"OT #"+w.number} fields={[
            {name:"title",label:"Título",value:w.title},
            {name:"priority",label:"Prioridad",value:w.priority,type:"select",options:[
              {value:"low",label:"Baja"},{value:"medium",label:"Media"},{value:"high",label:"Alta"},{value:"urgent",label:"Urgente"}
            ]},
            {name:"status",label:"Estado",value:w.status,type:"select",options:[
              {value:"open",label:"Abierta"},{value:"assigned",label:"Asignada"},{value:"in_progress",label:"En progreso"},{value:"paused",label:"Pausada"},{value:"completed",label:"Completada"},{value:"cancelled",label:"Cancelada"}
            ]},
          ]}/>:undefined}
        />)}
      </div>} list={<StaticDataTable
        className="work-order-directory-table"
        caption="Órdenes de trabajo visibles"
        columns={[
          {key:"order",label:"Orden",width:"34%"},
          {key:"company",label:"Empresa"},
          {key:"asset",label:"Equipo"},
          {key:"priority",label:"Prioridad"},
          {key:"status",label:"Estado"},
          {key:"actions",label:"Acciones",align:"end"},
        ]}
        rows={orders.rows.map(w=>({id:w.id,recordProps:{
          "data-module-record":true,"data-status":w.status,
          "data-search":[w.number,w.title,w.company,w.site,w.asset,w.type,w.priority,w.status].join(" "),
          "data-filter-organization":w.organization_id,"data-filter-organization-label":w.company,
          "data-filter-site":w.site_id,"data-filter-site-label":w.site,
          "data-filter-priority":w.priority,"data-filter-priority-label":w.priority,
          "data-filter-type":w.type,"data-filter-type-label":w.type,
        },cells:{
          order:<EntityIdentityCell
            imageSrc={w.asset_id&&w.asset_has_image?"/api/assets/"+w.asset_id+"/image":null}
            imageAlt={w.asset_id&&w.asset_has_image?"Imagen de "+w.asset:""}
            icon="work-order"
            variant="thumbnail"
            title={"OT #"+w.number}
            subtitle={w.title}
            meta={[w.type,w.site].filter(Boolean).join(" · ")}
          />,
          company:w.company,
          asset:w.asset,
          priority:<PriorityBadge priority={w.priority}/>,
          status:<WorkOrderStatusBadge status={w.status}/>,
          actions:<ListQuickActions>
            <Link className="ds-list-action primary" href={"/dashboard/work-orders/"+w.id} title="Ver actividades" data-tooltip="Ver actividades" aria-label={"Ver actividades de OT #"+w.number}><UiIcon name="eye" size={16}/></Link>
            {owner&&<OwnerRecordActions table="work_orders" id={w.id} label={"OT #"+w.number} fields={[
              {name:"title",label:"Título",value:w.title},
              {name:"priority",label:"Prioridad",value:w.priority,type:"select",options:[
                {value:"low",label:"Baja"},{value:"medium",label:"Media"},{value:"high",label:"Alta"},{value:"urgent",label:"Urgente"}
              ]},
              {name:"status",label:"Estado",value:w.status,type:"select",options:[
                {value:"open",label:"Abierta"},{value:"assigned",label:"Asignada"},{value:"in_progress",label:"En progreso"},{value:"paused",label:"Pausada"},{value:"completed",label:"Completada"},{value:"cancelled",label:"Cancelada"}
              ]},
            ]}/>}
          </ListQuickActions>,
        }}))}
        empty={(providerOnly||externalOnly||creationGate.ready)?<EmptyState icon="file" title="No hay órdenes disponibles" description={providerOnly||externalOnly?"Cuando te asignen trabajo aparecerá aquí.":"La jerarquía está lista. Usa Agregar para crear la primera orden."}/>:undefined}
      />}/>
    </section>
  </div>;
}
