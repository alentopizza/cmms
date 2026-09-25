import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, isPlatformOwner } from "@/lib/permissions";
import { query } from "@/lib/db";
import { getCreationGateForScope } from "@/lib/setup-sequence";
import Link from "next/link";
import { AssetCreateModal } from "@/components/ContextCreateModals";
import OwnerRecordActions from "@/components/OwnerRecordActions";
import ModuleHeader from "@/components/ModuleHeader";
import { AssetCard } from "@/components/business-ui";
import CreationPrerequisiteState from "@/components/CreationPrerequisiteState";
import BulkImportModal from "@/components/BulkImportModal";
import ModuleExportMenu from "@/components/ModuleExportMenu";
import AssetSubnav from "@/components/AssetSubnav";
import AssetCatalogOverview, { type AssetCategorySummary, type AssetMaintenanceSummary, type AssetHistorySummary, type AssetDocumentSummary } from "@/components/AssetCatalogOverview";
import { Alert, EmptyState } from "@/components/ui-kit/Feedback";
import { KpiCard, MetricGrid } from "@/components/ui-kit/Metrics";

type Asset={id:string;organization_id:string;site_id:string;category_id:string|null;supplier_id:string|null;code:string;name:string;company:string;site:string;location:string|null;category:string|null;supplier:string|null;status:string;criticality:string;manufacturer:string|null;model:string|null;serial_number:string|null;has_image:boolean};
type Site={id:string;organization_id:string;label:string};
type Location={id:string;organization_id:string;site_id:string;label:string};
type Supplier={id:string;organization_id:string;name:string};

function statusLabel(status:string){
  if(status==="operational")return "Operativo";
  if(status==="maintenance")return "En mantenimiento";
  if(status==="down")return "Fuera de servicio";
  return "Retirado";
}
function criticalityLabel(value:string){
  return ({low:"Baja",medium:"Media",high:"Alta",critical:"Crítica"} as Record<string,string>)[value]||value;
}

export default async function AssetsPage({searchParams}:{searchParams:Promise<{created?:string;error?:string}>}) {
  const session=await getSession();
  if(!session) redirect("/login");
  if(!can(session,"assets.read")) redirect("/dashboard");
  const params=await searchParams;
  const superadmin=session.platformRole!=="user";
  const orgId=session.organizationId;
  const canWrite=can(session,"assets.write");
  const owner=isPlatformOwner(session);

  const assetSql=`SELECT a.id,a.organization_id,a.site_id,a.category_id,a.supplier_id,a.code,a.name,o.name company,s.name site,l.name location,c.name category,p.name supplier,
      a.status,a.criticality,a.manufacturer,a.model,a.serial_number,(a.image_data IS NOT NULL) has_image
    FROM assets a JOIN organizations o ON o.id=a.organization_id JOIN sites s ON s.id=a.site_id
    LEFT JOIN locations l ON l.id=a.location_id LEFT JOIN asset_categories c ON c.id=a.category_id LEFT JOIN suppliers p ON p.id=a.supplier_id`;
  const [assets,sites,locations,suppliers,catalogCategories,maintenanceSummary,historySummary,documentSummary]=await Promise.all([
    superadmin
      ? query<Asset>(assetSql+" ORDER BY a.created_at DESC LIMIT 600")
      : session.accessAllSites
        ? query<Asset>(assetSql+" WHERE a.organization_id=$1 ORDER BY a.created_at DESC LIMIT 600",[orgId])
        : query<Asset>(assetSql+" WHERE a.organization_id=$1 AND a.site_id=ANY($2::uuid[]) ORDER BY a.created_at DESC LIMIT 600",[orgId,session.siteIds]),
    canWrite
      ? superadmin
        ? query<Site>("SELECT s.id,s.organization_id,o.name||' · '||s.name label FROM sites s JOIN organizations o ON o.id=s.organization_id WHERE s.active=true ORDER BY o.name,s.name")
        : session.accessAllSites
          ? query<Site>("SELECT s.id,s.organization_id,s.name label FROM sites s WHERE s.organization_id=$1 AND s.active=true ORDER BY s.name",[orgId])
          : query<Site>("SELECT s.id,s.organization_id,s.name label FROM sites s WHERE s.organization_id=$1 AND s.active=true AND s.id=ANY($2::uuid[]) ORDER BY s.name",[orgId,session.siteIds])
      : Promise.resolve({rows:[]} as {rows:Site[]}),
    canWrite
      ? superadmin
        ? query<Location>("SELECT l.id,l.organization_id,l.site_id,o.name||' · '||s.name||' · '||l.name label FROM locations l JOIN sites s ON s.id=l.site_id JOIN organizations o ON o.id=l.organization_id WHERE l.active=true ORDER BY o.name,s.name,l.name")
        : session.accessAllSites
          ? query<Location>("SELECT l.id,l.organization_id,l.site_id,s.name||' · '||l.name label FROM locations l JOIN sites s ON s.id=l.site_id WHERE l.organization_id=$1 AND l.active=true ORDER BY s.name,l.name",[orgId])
          : query<Location>("SELECT l.id,l.organization_id,l.site_id,s.name||' · '||l.name label FROM locations l JOIN sites s ON s.id=l.site_id WHERE l.organization_id=$1 AND l.active=true AND l.site_id=ANY($2::uuid[]) ORDER BY s.name,l.name",[orgId,session.siteIds])
      : Promise.resolve({rows:[]} as {rows:Location[]}),
    canWrite
      ? superadmin
        ? query<Supplier>("SELECT id,organization_id,name FROM suppliers WHERE active=true ORDER BY name")
        : query<Supplier>("SELECT id,organization_id,name FROM suppliers WHERE active=true AND organization_id=$1 ORDER BY name",[orgId])
      : Promise.resolve({rows:[]} as {rows:Supplier[]}),
    superadmin
      ? query<AssetCategorySummary>(`SELECT c.id,c.name,p.name parent_name,count(a.id)::int asset_count
          FROM asset_categories c LEFT JOIN asset_categories p ON p.id=c.parent_id
          LEFT JOIN assets a ON a.category_id=c.id
          GROUP BY c.id,c.name,p.name ORDER BY p.name NULLS FIRST,c.name`)
      : query<AssetCategorySummary>(`SELECT c.id,c.name,p.name parent_name,count(a.id)::int asset_count
          FROM asset_categories c LEFT JOIN asset_categories p ON p.id=c.parent_id
          LEFT JOIN assets a ON a.category_id=c.id
          WHERE c.organization_id=$1
          GROUP BY c.id,c.name,p.name ORDER BY p.name NULLS FIRST,c.name`,[orgId]),
    superadmin
      ? query<AssetMaintenanceSummary>(`SELECT mp.id,mp.name,a.name asset_name,mp.frequency_value,mp.frequency_unit,mp.next_due_at::text,mp.active
          FROM maintenance_plans mp JOIN assets a ON a.id=mp.asset_id
          ORDER BY mp.active DESC,mp.next_due_at NULLS LAST LIMIT 250`)
      : session.accessAllSites
        ? query<AssetMaintenanceSummary>(`SELECT mp.id,mp.name,a.name asset_name,mp.frequency_value,mp.frequency_unit,mp.next_due_at::text,mp.active
            FROM maintenance_plans mp JOIN assets a ON a.id=mp.asset_id
            WHERE mp.organization_id=$1 ORDER BY mp.active DESC,mp.next_due_at NULLS LAST LIMIT 250`,[orgId])
        : query<AssetMaintenanceSummary>(`SELECT mp.id,mp.name,a.name asset_name,mp.frequency_value,mp.frequency_unit,mp.next_due_at::text,mp.active
            FROM maintenance_plans mp JOIN assets a ON a.id=mp.asset_id
            WHERE mp.organization_id=$1 AND a.site_id=ANY($2::uuid[])
            ORDER BY mp.active DESC,mp.next_due_at NULLS LAST LIMIT 250`,[orgId,session.siteIds]),
    superadmin
      ? query<AssetHistorySummary>(`SELECT w.id,w.number::text,w.title,a.name asset_name,w.status,w.priority,w.requested_at::text
          FROM work_orders w JOIN assets a ON a.id=w.asset_id
          ORDER BY w.requested_at DESC LIMIT 250`)
      : session.accessAllSites
        ? query<AssetHistorySummary>(`SELECT w.id,w.number::text,w.title,a.name asset_name,w.status,w.priority,w.requested_at::text
            FROM work_orders w JOIN assets a ON a.id=w.asset_id
            WHERE w.organization_id=$1 ORDER BY w.requested_at DESC LIMIT 250`,[orgId])
        : query<AssetHistorySummary>(`SELECT w.id,w.number::text,w.title,a.name asset_name,w.status,w.priority,w.requested_at::text
            FROM work_orders w JOIN assets a ON a.id=w.asset_id
            WHERE w.organization_id=$1 AND w.site_id=ANY($2::uuid[])
            ORDER BY w.requested_at DESC LIMIT 250`,[orgId,session.siteIds]),
    superadmin
      ? query<AssetDocumentSummary>(`SELECT at.id,a.name asset_name,at.file_name,at.mime_type,at.size_bytes::text,at.created_at::text
          FROM attachments at JOIN assets a ON a.id=at.asset_id
          WHERE at.asset_id IS NOT NULL ORDER BY at.created_at DESC LIMIT 250`)
      : session.accessAllSites
        ? query<AssetDocumentSummary>(`SELECT at.id,a.name asset_name,at.file_name,at.mime_type,at.size_bytes::text,at.created_at::text
            FROM attachments at JOIN assets a ON a.id=at.asset_id
            WHERE at.asset_id IS NOT NULL AND at.organization_id=$1 ORDER BY at.created_at DESC LIMIT 250`,[orgId])
        : query<AssetDocumentSummary>(`SELECT at.id,a.name asset_name,at.file_name,at.mime_type,at.size_bytes::text,at.created_at::text
            FROM attachments at JOIN assets a ON a.id=at.asset_id
            WHERE at.asset_id IS NOT NULL AND at.organization_id=$1 AND a.site_id=ANY($2::uuid[])
            ORDER BY at.created_at DESC LIMIT 250`,[orgId,session.siteIds]),
  ]);
  const creationGate=await getCreationGateForScope("asset",session.organizationId,superadmin);
  const error=params.error==="sequence" ? creationGate.message
    : params.error==="limit" ? "La empresa alcanzó el límite de activos de su plan."
    : params.error ? "Revisa la información del activo." : "";

  const operational=assets.rows.filter(a=>a.status==="operational").length;
  const management=assets.rows.filter(a=>a.status==="maintenance").length;
  const down=assets.rows.filter(a=>a.status==="down").length;

  return <div className="phase7-assets">
    <ModuleHeader
      eyebrow="Registro técnico"
      title="Activos"
      description="Gestión visual de equipos con ubicación, proveedor, categoría, estado y criticidad."
      count={assets.rowCount || 0}
      countLabel="activos"
      searchPlaceholder="Buscar activo por código, nombre, categoría, sede o proveedor"
      filters={[
        {value:"all",label:"Todos"},
        {value:"operational",label:"Operativos"},
        {value:"maintenance",label:"En mantenimiento"},
        {value:"down",label:"Fuera de servicio"},
        {value:"retired",label:"Retirados"},
      ]}
      facets={[
        {key:"organization",label:"Empresa",allLabel:"Todas las empresas"},
        {key:"site",label:"Sede",allLabel:"Todas las sedes"},
        {key:"criticality",label:"Criticidad",allLabel:"Todas las criticidades"},
        {key:"category",label:"Categoría",allLabel:"Todas las categorías"},
        {key:"supplier",label:"Proveedor",allLabel:"Todos los proveedores"},
      ]}
      action={<div className="module-header-action-group">
        {canWrite&&orgId&&<BulkImportModal entity="assets"/>}
        <ModuleExportMenu entity="assets"/>
        {canWrite && creationGate.ready ? <AssetCreateModal triggerLabel="Agregar activo" sites={sites.rows.map(s=>({id:s.id,organization_id:s.organization_id,name:s.label}))} locations={locations.rows.map(l=>({id:l.id,organization_id:l.organization_id,site_id:l.site_id,name:l.label,label:l.label}))} suppliers={suppliers.rows} returnTo="/dashboard/assets" /> : undefined}
      </div>}
    />
    <AssetSubnav/>
    {params.created && <div className="section"><Alert variant="success" title="Activo creado">El activo se registró correctamente.</Alert></div>}
    {error && <div className="section"><Alert variant="danger" title="Revisa la información">{error}</Alert></div>}

    {canWrite && !creationGate.ready && <CreationPrerequisiteState icon="◇" eyebrow="Jerarquía de creación" title={creationGate.title} message={creationGate.message} href={creationGate.href || "/dashboard/locations"} action={creationGate.action || "Continuar"}/>}

    <MetricGrid className="section phase7-kpi-grid">
      <KpiCard label="Total activos" value={String(assets.rowCount||0)} hint="Todos los activos registrados" icon="asset"/>
      <KpiCard label="Operativos" value={String(operational)} hint={(assets.rowCount?Math.round(operational/assets.rowCount*100):0)+"% del total"} icon="check" tone="success"/>
      <KpiCard label="En mantenimiento" value={String(management)} hint={(assets.rowCount?Math.round(management/assets.rowCount*100):0)+"% del total"} icon="maintenance" tone="warning"/>
      <KpiCard label="Fuera de servicio" value={String(down)} hint={(assets.rowCount?Math.round(down/assets.rowCount*100):0)+"% del total"} icon="warning" tone="danger"/>
    </MetricGrid>

    <section className="section phase7-anchor" id="asset-list">
      <div className="section-heading"><div><span className="eyebrow">Vista de tarjetas</span><h2>Activos registrados</h2><p className="muted">Abre un activo para consultar su ficha, rutinas, historial y órdenes relacionadas.</p></div></div>
      {assets.rows.length?<div className="asset-modern-grid">{assets.rows.map(a=><AssetCard
        key={a.id}
        name={a.name}
        code={a.code}
        category={a.category||"Sin categoría"}
        site={a.site}
        location={a.location}
        supplier={a.supplier||"Sin proveedor"}
        criticality={criticalityLabel(a.criticality)}
        manufacturerModel={[a.manufacturer,a.model].filter(Boolean).join(" · ")||"Sin registrar"}
        status={statusLabel(a.status)}
        statusTone={a.status==="operational"?"success":a.status==="maintenance"?"warning":a.status==="down"?"danger":"neutral"}
        imageSrc={a.has_image?"/api/assets/"+a.id+"/image":null}
        recordProps={{
          "data-module-record":true,"data-status":a.status,
          "data-search":[a.code,a.name,a.company,a.site,a.location,a.category,a.supplier,a.status,a.criticality,a.manufacturer,a.model].filter(Boolean).join(" "),
          "data-filter-organization":a.organization_id,"data-filter-organization-label":a.company,
          "data-filter-site":a.site_id,"data-filter-site-label":a.site,
          "data-filter-criticality":a.criticality,"data-filter-criticality-label":criticalityLabel(a.criticality),
          "data-filter-category":a.category_id||"","data-filter-category-label":a.category||"",
          "data-filter-supplier":a.supplier_id||"","data-filter-supplier-label":a.supplier||"",
        }}
        actions={<>
          <Link className="button secondary" href={"/dashboard/assets/"+a.id}>Ver detalles →</Link>
          {owner&&<OwnerRecordActions table="assets" id={a.id} label={a.name} fields={[
            {name:"code",label:"Código",value:a.code},{name:"name",label:"Nombre",value:a.name},
            {name:"status",label:"Estado",value:a.status,type:"select",options:[{value:"operational",label:"Operativo"},{value:"maintenance",label:"Mantenimiento"},{value:"down",label:"Fuera de servicio"},{value:"retired",label:"Retirado"}]},
            {name:"criticality",label:"Criticidad",value:a.criticality,type:"select",options:[{value:"low",label:"Baja"},{value:"medium",label:"Media"},{value:"high",label:"Alta"},{value:"critical",label:"Crítica"}]},
          ]}/>}
        </>}
      />)}</div>:<EmptyState icon="asset" title="Aún no hay activos" description="Usa Agregar activo o Importar para comenzar."/>}
    </section>
    <AssetCatalogOverview
      assets={assets.rows}
      categories={catalogCategories.rows}
      maintenance={maintenanceSummary.rows}
      history={historySummary.rows}
      documents={documentSummary.rows}
    />
  </div>;
}
