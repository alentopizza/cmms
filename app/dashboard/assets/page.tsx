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

type Asset={id:string;organization_id:string;site_id:string;category_id:string|null;supplier_id:string|null;code:string;name:string;company:string;site:string;location:string|null;category:string|null;supplier:string|null;status:string;criticality:string};
type Site={id:string;organization_id:string;label:string};
type Location={id:string;organization_id:string;site_id:string;label:string};
type Supplier={id:string;organization_id:string;name:string};

// ── Responsive asset directory: desktop table + mobile cards ────────────────

export default async function AssetsPage({searchParams}:{searchParams:Promise<{created?:string;error?:string}>}) {
  const session=await getSession();
  if(!session) redirect("/login");
  if(!can(session,"assets.read")) redirect("/dashboard");

  const params=await searchParams;
  const superadmin=session.platformRole!=="user";
  const orgId=session.organizationId;
  const canWrite=can(session,"assets.write");
  const owner=isPlatformOwner(session);

  const [assets,sites,locations,suppliers]=await Promise.all([
    superadmin
      ? query<Asset>(`SELECT a.id,a.organization_id,a.site_id,a.category_id,a.supplier_id,a.code,a.name,o.name company,s.name site,l.name location,c.name category,p.name supplier,a.status,a.criticality
                       FROM assets a JOIN organizations o ON o.id=a.organization_id JOIN sites s ON s.id=a.site_id
                       LEFT JOIN locations l ON l.id=a.location_id LEFT JOIN asset_categories c ON c.id=a.category_id LEFT JOIN suppliers p ON p.id=a.supplier_id
                       ORDER BY a.created_at DESC LIMIT 200`)
      : session.accessAllSites
        ? query<Asset>(`SELECT a.id,a.organization_id,a.site_id,a.category_id,a.supplier_id,a.code,a.name,o.name company,s.name site,l.name location,c.name category,p.name supplier,a.status,a.criticality
                         FROM assets a JOIN organizations o ON o.id=a.organization_id JOIN sites s ON s.id=a.site_id
                         LEFT JOIN locations l ON l.id=a.location_id LEFT JOIN asset_categories c ON c.id=a.category_id LEFT JOIN suppliers p ON p.id=a.supplier_id
                         WHERE a.organization_id=$1 ORDER BY a.created_at DESC LIMIT 200`,[orgId])
        : query<Asset>(`SELECT a.id,a.organization_id,a.site_id,a.category_id,a.supplier_id,a.code,a.name,o.name company,s.name site,l.name location,c.name category,p.name supplier,a.status,a.criticality
                         FROM assets a JOIN organizations o ON o.id=a.organization_id JOIN sites s ON s.id=a.site_id
                         LEFT JOIN locations l ON l.id=a.location_id LEFT JOIN asset_categories c ON c.id=a.category_id LEFT JOIN suppliers p ON p.id=a.supplier_id
                         WHERE a.organization_id=$1 AND a.site_id=ANY($2::uuid[])
                         ORDER BY a.created_at DESC LIMIT 200`,[orgId,session.siteIds]),
    canWrite
      ? superadmin
        ? query<Site>(`SELECT s.id,s.organization_id,o.name||' · '||s.name label FROM sites s JOIN organizations o ON o.id=s.organization_id WHERE s.active=true ORDER BY o.name,s.name`)
        : session.accessAllSites
          ? query<Site>(`SELECT s.id,s.organization_id,s.name label FROM sites s WHERE s.organization_id=$1 AND s.active=true ORDER BY s.name`,[orgId])
          : query<Site>(`SELECT s.id,s.organization_id,s.name label FROM sites s WHERE s.organization_id=$1 AND s.active=true AND s.id=ANY($2::uuid[]) ORDER BY s.name`,[orgId,session.siteIds])
      : Promise.resolve({rows:[]} as {rows:Site[]}),
    canWrite
      ? superadmin
        ? query<Location>(`SELECT l.id,l.organization_id,l.site_id,o.name||' · '||s.name||' · '||l.name label FROM locations l JOIN sites s ON s.id=l.site_id JOIN organizations o ON o.id=l.organization_id WHERE l.active=true ORDER BY o.name,s.name,l.name`)
        : session.accessAllSites
          ? query<Location>(`SELECT l.id,l.organization_id,l.site_id,s.name||' · '||l.name label FROM locations l JOIN sites s ON s.id=l.site_id WHERE l.organization_id=$1 AND l.active=true ORDER BY s.name,l.name`,[orgId])
          : query<Location>(`SELECT l.id,l.organization_id,l.site_id,s.name||' · '||l.name label FROM locations l JOIN sites s ON s.id=l.site_id WHERE l.organization_id=$1 AND l.active=true AND l.site_id=ANY($2::uuid[]) ORDER BY s.name,l.name`,[orgId,session.siteIds])
      : Promise.resolve({rows:[]} as {rows:Location[]}),
    canWrite
      ? superadmin
        ? query<Supplier>(`SELECT id,organization_id,name FROM suppliers WHERE active=true ORDER BY name`)
        : query<Supplier>(`SELECT id,organization_id,name FROM suppliers WHERE active=true AND organization_id=$1 ORDER BY name`,[orgId])
      : Promise.resolve({rows:[]} as {rows:Supplier[]}),
  ]);
  const creationGate=await getCreationGateForScope("asset",session.organizationId,superadmin);
  const error=params.error==="sequence" ? creationGate.message
    : params.error==="limit" ? "La empresa alcanzó el límite de activos de su plan."
    : params.error ? "Revisa la información del activo." : "";

  return <>
    <ModuleHeader
      eyebrow="Registro técnico"
      title="Activos y equipos"
      description="Cada activo debe quedar vinculado a empresa, sede, sububicación y proveedor."
      count={assets.rowCount || 0}
      countLabel="activos"
      searchPlaceholder="Buscar código, activo, empresa, ubicación o proveedor"
      filters={[
        {value:"all",label:"Todos"},
        {value:"operational",label:"Operativos"},
        {value:"maintenance",label:"En mantenimiento"},
        {value:"down",label:"Detenidos"},
        {value:"retired",label:"Retirados"},
      ]}
      facets={[
        {key:"organization",label:"Empresa",allLabel:"Todas las empresas"},
        {key:"site",label:"Sede",allLabel:"Todas las sedes"},
        {key:"criticality",label:"Criticidad",allLabel:"Todas las criticidades"},
        {key:"category",label:"Categoría",allLabel:"Todas las categorías"},
        {key:"supplier",label:"Proveedor",allLabel:"Todos los proveedores"},
      ]}
      action={canWrite && creationGate.ready ? <AssetCreateModal triggerLabel="Agregar" sites={sites.rows.map(s=>({id:s.id,organization_id:s.organization_id,name:s.label}))} locations={locations.rows.map(l=>({id:l.id,organization_id:l.organization_id,site_id:l.site_id,name:l.label,label:l.label}))} suppliers={suppliers.rows} returnTo="/dashboard/assets" /> : undefined}
    />
    {params.created && <div className="notice success section">Activo creado correctamente.</div>}
    {error && <div className="notice error section">{error}</div>}

    {canWrite && !creationGate.ready && <CreationPrerequisiteState
      icon="◇"
      eyebrow="Jerarquía de creación"
      title={creationGate.title}
      message={creationGate.message}
      href={creationGate.href || "/dashboard/locations"}
      action={creationGate.action || "Continuar"}
    />}

    <section className="section asset-directory-section">
      <div className="asset-mobile-list">
        {assets.rows.map(a=><article key={a.id} className="asset-mobile-card" data-module-record data-status={a.status} data-search={[a.code,a.name,a.company,a.site,a.location,a.category,a.supplier,a.status,a.criticality].filter(Boolean).join(" ")}
          data-filter-organization={a.organization_id} data-filter-organization-label={a.company}
          data-filter-site={a.site_id} data-filter-site-label={a.site}
          data-filter-criticality={a.criticality} data-filter-criticality-label={a.criticality}
          data-filter-category={a.category_id||""} data-filter-category-label={a.category||""}
          data-filter-supplier={a.supplier_id||""} data-filter-supplier-label={a.supplier||""}>
          <Link className="asset-mobile-card-main" href={"/dashboard/assets/"+a.id}>
            <div className="asset-mobile-card-icon" aria-hidden="true">◇</div>
            <div className="asset-mobile-card-copy">
              <span>{a.code}</span>
              <strong>{a.name}</strong>
              <small>{a.company}</small>
            </div>
            <span className="asset-mobile-card-chevron" aria-hidden="true">›</span>
          </Link>
          <div className="asset-mobile-card-meta">
            <div><span>Ubicación</span><strong>{a.site}{a.location?" · "+a.location:""}</strong></div>
            <div><span>Proveedor</span><strong>{a.supplier||"Sin proveedor"}</strong></div>
          </div>
          <div className="asset-mobile-card-footer">
            <span className="status">{a.status}</span>
            <span className="asset-criticality">{a.criticality}</span>
            {owner&&<OwnerRecordActions table="assets" id={a.id} label={a.name} fields={[
              {name:"code",label:"Código",value:a.code},
              {name:"name",label:"Nombre",value:a.name},
              {name:"status",label:"Estado",value:a.status,type:"select",options:[
                {value:"operational",label:"Operativo"},{value:"maintenance",label:"Mantenimiento"},{value:"down",label:"Detenido"},{value:"retired",label:"Retirado"}
              ]},
              {name:"criticality",label:"Criticidad",value:a.criticality,type:"select",options:[
                {value:"low",label:"Baja"},{value:"medium",label:"Media"},{value:"high",label:"Alta"},{value:"critical",label:"Crítica"}
              ]},
            ]}/>}
          </div>
        </article>)}
      </div>
      <table className="table asset-directory-table"><thead><tr><th>Código</th><th>Activo</th><th>Ubicación</th><th>Proveedor</th><th>Estado</th><th>Criticidad</th>{owner&&<th>Acciones</th>}</tr></thead><tbody>
      {assets.rows.map(a=><tr key={a.id} data-module-record data-status={a.status} data-search={[a.code,a.name,a.company,a.site,a.location,a.category,a.supplier,a.status,a.criticality].filter(Boolean).join(" ")}
          data-filter-organization={a.organization_id} data-filter-organization-label={a.company}
          data-filter-site={a.site_id} data-filter-site-label={a.site}
          data-filter-criticality={a.criticality} data-filter-criticality-label={a.criticality}
          data-filter-category={a.category_id||""} data-filter-category-label={a.category||""}
          data-filter-supplier={a.supplier_id||""} data-filter-supplier-label={a.supplier||""}><td>{a.code}</td><td><Link className="table-entity-link" href={"/dashboard/assets/"+a.id}><strong>{a.name}</strong><small className="table-subline">{a.company}</small></Link></td><td>{a.site}{a.location?" · "+a.location:""}</td><td>{a.supplier||"Sin proveedor"}</td><td><span className="status">{a.status}</span></td><td>{a.criticality}</td>{owner&&<td><OwnerRecordActions table="assets" id={a.id} label={a.name} fields={[
        {name:"code",label:"Código",value:a.code},
        {name:"name",label:"Nombre",value:a.name},
        {name:"status",label:"Estado",value:a.status,type:"select",options:[
          {value:"operational",label:"Operativo"},{value:"maintenance",label:"Mantenimiento"},{value:"down",label:"Detenido"},{value:"retired",label:"Retirado"}
        ]},
        {name:"criticality",label:"Criticidad",value:a.criticality,type:"select",options:[
          {value:"low",label:"Baja"},{value:"medium",label:"Media"},{value:"high",label:"Alta"},{value:"critical",label:"Crítica"}
        ]},
      ]}/></td>}</tr>)}
    </tbody></table>{!assets.rowCount && creationGate.ready && <div className="card empty-state"><strong>Aún no hay activos.</strong><span>La jerarquía está lista. Usa Agregar para registrar el primer activo.</span></div>}</section>
  </>;
}
