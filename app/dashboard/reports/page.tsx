import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, roleLabel } from "@/lib/permissions";
import { query } from "@/lib/db";
import DashboardControls from "@/components/DashboardControls";
import ModuleExportMenu from "@/components/ModuleExportMenu";
import UiIcon from "@/components/UiIcon";
import { Badge } from "@/components/ui-kit/Badge";
import { Card } from "@/components/ui-kit/Card";
import { Alert } from "@/components/ui-kit/Feedback";

type Option={value:string;label:string};

const WORK_ORDER_STATUS_OPTIONS:Option[]=[
  {value:"open",label:"Abiertas"},{value:"assigned",label:"Asignadas"},{value:"in_progress",label:"En progreso"},
  {value:"paused",label:"Pausadas"},{value:"completed",label:"Completadas"},{value:"cancelled",label:"Canceladas"},
];
const TASK_STATUS_OPTIONS:Option[]=[
  {value:"pending",label:"Pendientes"},{value:"in_progress",label:"En progreso"},
  {value:"completed",label:"Completadas"},{value:"cancelled",label:"Canceladas"},
];
const SUBSCRIPTION_STATUS_OPTIONS:Option[]=[
  {value:"active",label:"Activas"},{value:"trialing",label:"Prueba"},{value:"past_due",label:"Pago pendiente"},
  {value:"suspended",label:"Suspendidas"},{value:"canceled",label:"Canceladas"},{value:"trial_expired",label:"Prueba vencida"},
];
const PRIORITY_OPTIONS:Option[]=[
  {value:"low",label:"Baja"},{value:"medium",label:"Media"},{value:"high",label:"Alta"},{value:"urgent",label:"Urgente"},
];

export const dynamic="force-dynamic";

export default async function ReportsPage(){
  const session=await getSession();
  if(!session)redirect("/login");

  const mode=session.platformRole!=="user"
    ?"platform"
    :session.role==="technician"||session.role==="external"||session.role==="provider"
      ?"field"
      :session.role==="requester"
        ?"requester"
        :"operation";

  const sites=session.organizationId
    ?session.accessAllSites
      ?await query<{id:string;name:string}>("SELECT id,name FROM sites WHERE organization_id=$1 AND active=true ORDER BY name",[session.organizationId])
      :await query<{id:string;name:string}>("SELECT id,name FROM sites WHERE organization_id=$1 AND id=ANY($2::uuid[]) AND active=true ORDER BY name",[session.organizationId,session.siteIds])
    :{rows:[]} as {rows:{id:string;name:string}[]};

  const siteOptions=sites.rows.map(site=>({value:site.id,label:site.name}));
  const activityStatusOptions=mode==="platform"
    ?SUBSCRIPTION_STATUS_OPTIONS
    :mode==="field"
      ?TASK_STATUS_OPTIONS
      :WORK_ORDER_STATUS_OPTIONS;

  const canAssets=can(session,"assets.read");
  const canInventory=can(session,"inventory.read");
  const canAttendanceReports=can(session,"attendance.reports");
  const reportScope=session.platformRole!=="user"?"Plataforma":session.organizationName||roleLabel(session);

  return <div className="phase10-reports">
    <header className="phase10-page-hero">
      <div>
        <span className="eyebrow">Centro de reportes</span>
        <h1>Reportes y exportaciones</h1>
        <p>Genera informes con los mismos datos y alcance autorizado del Dashboard y de cada módulo. Los filtros no amplían permisos ni cambian la fuente de verdad.</p>
      </div>
      <Badge variant="brand" icon="report">{reportScope}</Badge>
    </header>

    <section className="section">
      <Card
        className="phase10-report-primary"
        header={<div><span className="eyebrow">Reporte ejecutivo</span><h2>Dashboard por periodo</h2><p>Aplica periodo, estado, sede y prioridad; luego exporta en Excel, CSV o PDF con la identidad visual correspondiente.</p></div>}
      >
        <DashboardControls
          mode={mode}
          companyStatusOptions={mode==="platform"?[{value:"active",label:"Activas"},{value:"inactive",label:"Inactivas"}]:[]}
          activityStatusOptions={activityStatusOptions}
          siteOptions={siteOptions}
          priorityOptions={mode==="platform"?[]:PRIORITY_OPTIONS}
        />
        <Alert variant="info" title="Paridad de filtros">El archivo exportado usa exactamente los filtros visibles en esta página y conserva el alcance por rol, empresa y sede.</Alert>
      </Card>
    </section>

    <section className="section">
      <div className="section-heading">
        <div><span className="eyebrow">Datos maestros</span><h2>Exportaciones operativas</h2><p className="muted">Descarga bases estructuradas sin crear una segunda lógica de reportes.</p></div>
      </div>
      <div className="phase10-report-grid">
        {canAssets&&<Card className="phase10-report-card" header={<div className="phase10-report-card-head"><UiIcon name="asset" size={20}/><div><strong>Activos</strong><small>Catálogo autorizado de equipos</small></div></div>}>
          <p>Exporta el catálogo de Activos en Excel, CSV o PDF desde el endpoint oficial del módulo.</p>
          <ModuleExportMenu entity="assets"/>
        </Card>}
        {canInventory&&<Card className="phase10-report-card" header={<div className="phase10-report-card-head"><UiIcon name="inventory" size={20}/><div><strong>Inventario</strong><small>Productos y existencias</small></div></div>}>
          <p>Obtén la base de inventario respetando organización, sede y autoridad de existencias.</p>
          <ModuleExportMenu entity="inventory"/>
        </Card>}
        {canInventory&&<Card className="phase10-report-card" header={<div className="phase10-report-card-head"><UiIcon name="report" size={20}/><div><strong>Kardex</strong><small>Trazabilidad de movimientos</small></div></div>}>
          <p>Exporta los movimientos que ya alimentan la trazabilidad del Kardex sin recalcular stock en el cliente.</p>
          <ModuleExportMenu entity="kardex"/>
        </Card>}
        {canAttendanceReports&&<Card className="phase10-report-card" header={<div className="phase10-report-card-head"><UiIcon name="attendance" size={20}/><div><strong>Asistencia</strong><small>Programado vs. real · multi-sede</small></div></div>}>
          <p>Compara jornada programada con presencia real, separa tiempo en sede y desplazamiento, y conserva actividades, contingencias y evidencia Reacción.</p>
          <Link className="ds-button ds-button-secondary ds-button-md phase10-link-button" href="/dashboard/attendance#attendance-report"><UiIcon name="report" size={16}/>Abrir reporte de asistencia</Link>
        </Card>}
      </div>
    </section>

    <section className="section phase10-report-guidance">
      <Card header={<div><span className="eyebrow">Hojas de vida</span><h2>Reportes por registro</h2></div>}>
        <p>Las fichas de empresa, sede, sububicación, usuario y proveedor conservan su exportación individual en PDF, Excel y Word desde el perfil correspondiente.</p>
        <div className="phase10-report-links">
          {can(session,"companies.manage")&&<Link href="/dashboard/companies">Empresas <UiIcon name="chevron-right" size={14}/></Link>}
          {can(session,"locations.manage")&&<Link href="/dashboard/locations">Ubicaciones <UiIcon name="chevron-right" size={14}/></Link>}
          {can(session,"users.manage")&&<Link href="/dashboard/users">Usuarios <UiIcon name="chevron-right" size={14}/></Link>}
          {can(session,"suppliers.manage")&&<Link href="/dashboard/suppliers">Proveedores <UiIcon name="chevron-right" size={14}/></Link>}
        </div>
      </Card>
      <Card header={<div><span className="eyebrow">Documentos transaccionales</span><h2>Requisiciones</h2></div>}>
        <p>Cada requisición mantiene exportación individual PDF, Excel y Word desde su detalle, preservando cantidades, recepción, aprobación y reconciliación documental.</p>
        {can(session,"requisitions.read")&&<Link className="ds-button ds-button-secondary ds-button-md phase10-link-button" href="/dashboard/requisitions"><UiIcon name="requisition" size={16}/>Abrir requisiciones</Link>}
      </Card>
    </section>
  </div>;
}
