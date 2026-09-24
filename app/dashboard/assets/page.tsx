import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, isPlatformOwner } from "@/lib/permissions";
import { query } from "@/lib/db";
import { getCreationGateForScope } from "@/lib/setup-sequence";
import Link from "next/link";
import { AssetCreateModal } from "@/components/ContextCreateModals";
import OwnerRecordActions from "@/components/OwnerRecordActions";
import ModuleHeader from "@/components/ModuleHeader";
import CreationPrerequisiteState from "@/components/CreationPrerequisiteState";
import BulkImportModal from "@/components/BulkImportModal";
import ModuleExportMenu from "@/components/ModuleExportMenu";
import UiIcon from "@/components/UiIcon";

type Asset={id:string;organization_id:string;site_id:string;category_id:string|null;supplier_id:string|null;code:string;name:string;company:string;site:string;location:string|null;category:string|null;supplier:string|null;status:string;criticality:string;manufacturer:string|null;model:string|null;serial_number:string|null};
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
      a.status,a.criticality,a.manufacturer,a.model,a.serial_number
    FROM assets a JOIN organizations o ON o.id=a.organization_id JOIN sites s ON s.id=a.site_id
    LEFT JOIN locations l ON l.id=a.location_id LEFT JOIN asset_categories c ON c.id=a.category_id LEFT JOIN suppliers p ON p.id=a.supplier_id`;
  const [assets,sites,locations,suppliers]=await Promise.all([
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
  ]);
  const creationGate=await getCreationGateForScope("asset",session.organizationId,superadmin);
  const error=params.error==="sequence" ? creationGate.message
    : params.error==="limit" ? "La empresa alcanzó el límite de activos de su plan."
    : params.error ? "Revisa la información del activo." : "";

  const operational=assets.rows.filter(a=>a.status==="operational").length;
  const management=assets.rows.filter(a=>a.status==="maintenance").length;
  const down=assets.rows.filter(a=>a.status==="down").length;

  return <>
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
    {params.created && <div className="notice success section">Activo creado correctamente.</div>}
    {error && <div className="notice error section">{error}</div>}

    {canWrite && !creationGate.ready && <CreationPrerequisiteState icon="◇" eyebrow="Jerarquía de creación" title={creationGate.title} message={creationGate.message} href={creationGate.href || "/dashboard/locations"} action={creationGate.action || "Continuar"}/>}

    <section className="section inventory-kpi-grid asset-kpi-grid">
      <article className="inventory-kpi-card value"><span><UiIcon name="asset"/></span><div><small>Total activos</small><strong>{assets.rowCount||0}</strong><em>Todos los activos registrados</em></div></article>
      <article className="inventory-kpi-card success"><span><UiIcon name="check"/></span><div><small>Operativos</small><strong>{operational}</strong><em>{assets.rowCount?Math.round(operational/assets.rowCount*100):0}% del total</em></div></article>
      <article className="inventory-kpi-card warning"><span>!</span><div><small>En gestión</small><strong>{management}</strong><em>{assets.rowCount?Math.round(management/assets.rowCount*100):0}% del total</em></div></article>
      <article className="inventory-kpi-card danger"><span>×</span><div><small>Fuera de servicio</small><strong>{down}</strong><em>{assets.rowCount?Math.round(down/assets.rowCount*100):0}% del total</em></div></article>
    </section>

    <section className="section">
      <div className="section-heading"><div><span className="eyebrow">Vista de tarjetas</span><h2>Activos registrados</h2><p className="muted">Abre un activo para consultar su ficha, rutinas, historial y órdenes relacionadas.</p></div></div>
      {assets.rows.length?<div className="asset-modern-grid">{assets.rows.map(a=><article key={a.id} className="asset-modern-card"
        data-module-record data-status={a.status} data-search={[a.code,a.name,a.company,a.site,a.location,a.category,a.supplier,a.status,a.criticality,a.manufacturer,a.model].filter(Boolean).join(" ")}
        data-filter-organization={a.organization_id} data-filter-organization-label={a.company}
        data-filter-site={a.site_id} data-filter-site-label={a.site}
        data-filter-criticality={a.criticality} data-filter-criticality-label={criticalityLabel(a.criticality)}
        data-filter-category={a.category_id||""} data-filter-category-label={a.category||""}
        data-filter-supplier={a.supplier_id||""} data-filter-supplier-label={a.supplier||""}>
        <div className="asset-modern-visual"><UiIcon name="asset" size={48}/><span className={"asset-status-pill "+a.status}>{statusLabel(a.status)}</span></div>
        <div className="asset-modern-copy">
          <div className="asset-modern-code">Código: {a.code}</div>
          <h3>{a.name}</h3>
          <p>{a.category||"Sin categoría"}</p>
          <span><UiIcon name="location" size={13}/>{a.site}{a.location?" · "+a.location:""}</span>
          <div className="asset-modern-specs">
            <div><small>Proveedor</small><strong>{a.supplier||"Sin proveedor"}</strong></div>
            <div><small>Criticidad</small><strong>{criticalityLabel(a.criticality)}</strong></div>
            <div><small>Fabricante / modelo</small><strong>{[a.manufacturer,a.model].filter(Boolean).join(" · ")||"Sin registrar"}</strong></div>
          </div>
        </div>
        <div className="asset-modern-actions">
          <Link className="button secondary" href={"/dashboard/assets/"+a.id}>Ver detalles →</Link>
          {owner&&<OwnerRecordActions table="assets" id={a.id} label={a.name} fields={[
            {name:"code",label:"Código",value:a.code},{name:"name",label:"Nombre",value:a.name},
            {name:"status",label:"Estado",value:a.status,type:"select",options:[{value:"operational",label:"Operativo"},{value:"maintenance",label:"Mantenimiento"},{value:"down",label:"Fuera de servicio"},{value:"retired",label:"Retirado"}]},
            {name:"criticality",label:"Criticidad",value:a.criticality,type:"select",options:[{value:"low",label:"Baja"},{value:"medium",label:"Media"},{value:"high",label:"Alta"},{value:"critical",label:"Crítica"}]},
          ]}/>}
        </div>
      </article>)}</div>:<div className="card empty-state"><strong>Aún no hay activos.</strong><span>Usa Agregar activo o Importar para comenzar.</span></div>}
    </section>
  </>;
}
