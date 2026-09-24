import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, isPlatformOwner } from "@/lib/permissions";
import { query } from "@/lib/db";
import { getCreationGateForScope } from "@/lib/setup-sequence";
import OwnerRecordActions from "@/components/OwnerRecordActions";
import ModuleHeader from "@/components/ModuleHeader";
import CreateRecordModal from "@/components/CreateRecordModal";
import CreationPrerequisiteState from "@/components/CreationPrerequisiteState";
import RequisitionBuilder from "@/components/RequisitionBuilder";
import Link from "next/link";
import UiIcon from "@/components/UiIcon";

type Item={id:string;organization_id:string;site_id:string|null;location_id:string|null;supplier_id:string|null;supplier_type:string|null;sku:string;name:string;company:string;site:string|null;location:string|null;supplier:string|null;quantity:string;min_quantity:string;unit:string;unit_cost:string;storage_location:string|null};
type Site={id:string;label:string};
type Location={id:string;label:string};
type Supplier={id:string;name:string;supplier_type:string};

// ── Responsive inventory directory: desktop table + mobile cards ──────────

export default async function InventoryPage({searchParams}:{searchParams:Promise<{created?:string;error?:string;requisition_created?:string}>}) {
  const session=await getSession();
  if(!session) redirect("/login");
  if(!can(session,"inventory.read")) redirect("/dashboard");
  const params=await searchParams;
  const superadmin=session.platformRole!=="user";
  const orgId=session.organizationId;
  const canWrite=can(session,"inventory.write");
  const owner=isPlatformOwner(session);

  const [items,sites,locations,suppliers]=await Promise.all([
    superadmin
      ? query<Item>(`SELECT i.id,i.organization_id,i.site_id,i.location_id,i.supplier_id,p.supplier_type,i.sku,i.name,o.name company,s.name site,l.name location,p.name supplier,i.quantity::text,i.min_quantity::text,i.unit,i.unit_cost::text,i.storage_location
                     FROM inventory_items i JOIN organizations o ON o.id=i.organization_id
                     LEFT JOIN sites s ON s.id=i.site_id LEFT JOIN locations l ON l.id=i.location_id LEFT JOIN suppliers p ON p.id=i.supplier_id
                     WHERE i.active=true ORDER BY i.name LIMIT 300`)
      : session.accessAllSites
        ? query<Item>(`SELECT i.id,i.organization_id,i.site_id,i.location_id,i.supplier_id,p.supplier_type,i.sku,i.name,o.name company,s.name site,l.name location,p.name supplier,i.quantity::text,i.min_quantity::text,i.unit,i.unit_cost::text,i.storage_location
                       FROM inventory_items i JOIN organizations o ON o.id=i.organization_id
                       LEFT JOIN sites s ON s.id=i.site_id LEFT JOIN locations l ON l.id=i.location_id LEFT JOIN suppliers p ON p.id=i.supplier_id
                       WHERE i.active=true AND i.organization_id=$1 ORDER BY i.name LIMIT 300`,[orgId])
        : query<Item>(`SELECT i.id,i.organization_id,i.site_id,i.location_id,i.supplier_id,p.supplier_type,i.sku,i.name,o.name company,s.name site,l.name location,p.name supplier,i.quantity::text,i.min_quantity::text,i.unit,i.unit_cost::text,i.storage_location
                       FROM inventory_items i JOIN organizations o ON o.id=i.organization_id
                       LEFT JOIN sites s ON s.id=i.site_id LEFT JOIN locations l ON l.id=i.location_id LEFT JOIN suppliers p ON p.id=i.supplier_id
                       WHERE i.active=true AND i.organization_id=$1 AND (i.site_id IS NULL OR i.site_id=ANY($2::uuid[]))
                       ORDER BY i.name LIMIT 300`,[orgId,session.siteIds]),
    canWrite && orgId
      ? session.accessAllSites
        ? query<Site>("SELECT id,name label FROM sites WHERE organization_id=$1 AND active=true ORDER BY name",[orgId])
        : query<Site>("SELECT id,name label FROM sites WHERE organization_id=$1 AND active=true AND id=ANY($2::uuid[]) ORDER BY name",[orgId,session.siteIds])
      : Promise.resolve({rows:[]} as {rows:Site[]}),
    canWrite && orgId
      ? session.accessAllSites
        ? query<Location>(`SELECT l.id,s.name||' · '||l.name label FROM locations l JOIN sites s ON s.id=l.site_id WHERE l.organization_id=$1 AND l.active=true ORDER BY s.name,l.name`,[orgId])
        : query<Location>(`SELECT l.id,s.name||' · '||l.name label FROM locations l JOIN sites s ON s.id=l.site_id WHERE l.organization_id=$1 AND l.active=true AND l.site_id=ANY($2::uuid[]) ORDER BY s.name,l.name`,[orgId,session.siteIds])
      : Promise.resolve({rows:[]} as {rows:Location[]}),
    canWrite && orgId
      ? query<Supplier>("SELECT id,name,supplier_type FROM suppliers WHERE organization_id=$1 AND active=true AND supplier_type IN ('materials','both') ORDER BY name",[orgId])
      : Promise.resolve({rows:[]} as {rows:Supplier[]}),
  ]);
  const creationGate=await getCreationGateForScope("inventory",session.organizationId,superadmin);
  const error=params.error==="sequence" ? creationGate.message
    : params.error==="limit" ? "La empresa alcanzó el límite de artículos de inventario."
    : params.error ? "Revisa la información del artículo." : "";

  return <>
    <ModuleHeader
      eyebrow="Abastecimiento"
      title="Inventario y repuestos"
      description="Cada artículo nuevo debe relacionarse con un proveedor y su ubicación física."
      count={items.rowCount || 0}
      countLabel="artículos"
      searchPlaceholder="Buscar SKU, artículo, ubicación o proveedor"
      filters={[{value:"all",label:"Todos"},{value:"low",label:"Bajo mínimo"},{value:"ok",label:"Existencia suficiente"}]}
      facets={[
        {key:"organization",label:"Empresa",allLabel:"Todas las empresas"},
        {key:"site",label:"Sede",allLabel:"Todas las sedes"},
        {key:"supplier",label:"Proveedor",allLabel:"Todos los proveedores"},
      ]}
      action={<div className="module-header-action-group">
        {can(session,"requisitions.read")&&<Link className="button secondary" href="/dashboard/requisitions"><UiIcon name="file" size={15}/> Requisiciones</Link>}
        {canWrite && creationGate.ready && orgId ? <CreateRecordModal title="Crear artículo" eyebrow="Nuevo inventario" description="Registra el repuesto o material, su proveedor y su ubicación física." triggerLabel="Agregar" icon="▤">
        <form className="form-grid unified-popup-form" method="post" action="/api/inventory">
          <div className="field"><label>Sede *</label><select name="site_id" required><option value="">Selecciona sede</option>{sites.rows.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
          <div className="field"><label>Sububicación *</label><select name="location_id" required><option value="">Selecciona sububicación</option>{locations.rows.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></div>
          <div className="field"><label>Proveedor *</label><select name="supplier_id" required><option value="">Selecciona proveedor</option>{suppliers.rows.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div className="field"><label>SKU *</label><input name="sku" required placeholder="Ej. REP-FLT-001"/></div>
          <div className="field"><label>Nombre *</label><input name="name" required placeholder="Ej. Filtro plisado 20 x 20"/></div>
          <div className="field"><label>Unidad</label><input name="unit" defaultValue="unit" placeholder="Ej. unidad, caja, metro"/></div>
          <div className="field"><label>Existencia inicial</label><input name="quantity" type="number" step="0.001" min="0" defaultValue="0"/></div>
          <div className="field"><label>Existencia mínima</label><input name="min_quantity" type="number" step="0.001" min="0" defaultValue="0"/></div>
          <div className="field"><label>Costo unitario</label><input name="unit_cost" type="number" step="0.01" min="0" defaultValue="0"/></div>
          <div className="field form-span-2"><label>Ubicación de almacenamiento</label><input name="storage_location" placeholder="Ej. Almacén técnico · Estante A-03"/></div>
          <div className="form-span-2 form-actions"><button className="button" type="submit">Crear artículo</button></div>
        </form>
      </CreateRecordModal> : null}
      </div>}
    />
    {params.created && <div className="notice success section">Artículo de inventario creado correctamente.</div>}
    {params.requisition_created && <div className="notice success section">{params.requisition_created} requisición{params.requisition_created==="1"?"":"es"} creada{params.requisition_created==="1"?"":"s"} correctamente y separada{params.requisition_created==="1"?"":"s"} por proveedor.</div>}
    {error && <div className="notice error section">{error}</div>}

    {canWrite && !creationGate.ready && <CreationPrerequisiteState
      icon="▤"
      eyebrow="Jerarquía de creación"
      title={creationGate.title}
      message={creationGate.message}
      href={creationGate.href || "/dashboard/locations"}
      action={creationGate.action || "Continuar"}
    />}

    {can(session,"requisitions.write")&&<section className="card section" id="crear-requisicion">
      <RequisitionBuilder
        items={items.rows.filter(item=>Boolean(item.supplier_id)&&["materials","both"].includes(item.supplier_type||"")).map(item=>({
          id:item.id,
          supplier_id:item.supplier_id||"",
          supplier_name:item.supplier||"Proveedor",
          sku:item.sku,
          name:item.name,
          unit:item.unit,
          unit_cost:item.unit_cost,
          quantity:item.quantity,
          min_quantity:item.min_quantity,
          site_name:item.site,
          location_name:item.location,
        }))}
        returnTo="/dashboard/inventory"
        title="Generar requisiciones desde inventario"
        description="Selecciona insumos y cantidades. Si pertenecen a proveedores distintos, Desweb CMMS crea una requisición independiente para cada proveedor."
      />
    </section>}

    <section className="section inventory-directory-section">
      <div className="inventory-mobile-list">
        {items.rows.map(i=>{
          const quantity=Number(i.quantity||0);
          const minimum=Number(i.min_quantity||0);
          const low=quantity<=minimum;
          return <article key={i.id} className="inventory-mobile-card" data-module-record data-status={low?"low":"ok"} data-search={[i.sku,i.name,i.company,i.site,i.location,i.supplier,i.storage_location].filter(Boolean).join(" ")}
            data-filter-organization={i.organization_id} data-filter-organization-label={i.company}
            data-filter-site={i.site_id||""} data-filter-site-label={i.site||""}
            data-filter-supplier={i.supplier_id||""} data-filter-supplier-label={i.supplier||""}>
            <div className="inventory-mobile-main">
              <div className="inventory-mobile-icon" aria-hidden="true">▤</div>
              <div className="inventory-mobile-copy">
                <span>{i.sku}</span>
                <strong>{i.name}</strong>
                <small>{i.company}</small>
              </div>
              <span className={"inventory-stock-badge "+(low?"low":"ok")}>{quantity} {i.unit}</span>
            </div>
            <div className="inventory-mobile-meta">
              <div><span>Ubicación</span><strong>{i.site||"Sin sede"}{i.location?" · "+i.location:""}</strong></div>
              <div><span>Proveedor</span><strong>{i.supplier||"Sin proveedor"}</strong></div>
              <div><span>Mínimo</span><strong>{i.min_quantity} {i.unit}</strong></div>
              <div><span>Almacenamiento</span><strong>{i.storage_location||"Sin registrar"}</strong></div>
            </div>
            {owner&&<div className="inventory-mobile-footer"><OwnerRecordActions table="inventory_items" id={i.id} label={i.name} fields={[
              {name:"sku",label:"SKU",value:i.sku},
              {name:"name",label:"Nombre",value:i.name},
              {name:"unit",label:"Unidad",value:i.unit},
              {name:"quantity",label:"Existencia",value:i.quantity,type:"number"},
              {name:"min_quantity",label:"Mínimo",value:i.min_quantity,type:"number"},
              {name:"unit_cost",label:"Costo unitario",value:i.unit_cost,type:"number"},
              {name:"storage_location",label:"Almacenamiento",value:i.storage_location||""},
            ]}/></div>}
          </article>;
        })}
      </div>

      <table className="table inventory-directory-table"><thead><tr><th>SKU</th><th>Artículo</th><th>Ubicación</th><th>Proveedor</th><th>Existencia</th><th>Mínimo</th>{owner&&<th>Acciones</th>}</tr></thead><tbody>
        {items.rows.map(i=><tr key={i.id} data-module-record data-status={Number(i.quantity||0)<=Number(i.min_quantity||0)?"low":"ok"} data-search={[i.sku,i.name,i.company,i.site,i.location,i.supplier,i.storage_location].filter(Boolean).join(" ")}
          data-filter-organization={i.organization_id} data-filter-organization-label={i.company}
          data-filter-site={i.site_id||""} data-filter-site-label={i.site||""}
          data-filter-supplier={i.supplier_id||""} data-filter-supplier-label={i.supplier||""}><td>{i.sku}</td><td><strong>{i.name}</strong><small className="table-subline">{i.company}</small></td><td>{i.site||"Sin sede"}{i.location?" · "+i.location:""}</td><td>{i.supplier||"Sin proveedor"}</td><td>{i.quantity} {i.unit}</td><td>{i.min_quantity} {i.unit}</td>{owner&&<td><OwnerRecordActions table="inventory_items" id={i.id} label={i.name} fields={[
          {name:"sku",label:"SKU",value:i.sku},
          {name:"name",label:"Nombre",value:i.name},
          {name:"unit",label:"Unidad",value:i.unit},
          {name:"quantity",label:"Existencia",value:i.quantity,type:"number"},
          {name:"min_quantity",label:"Mínimo",value:i.min_quantity,type:"number"},
          {name:"unit_cost",label:"Costo unitario",value:i.unit_cost,type:"number"},
          {name:"storage_location",label:"Almacenamiento",value:i.storage_location||""},
        ]}/></td>}</tr>)}
      </tbody></table>
      {!items.rowCount && creationGate.ready && <div className="card empty-state"><strong>Aún no hay artículos.</strong><span>La jerarquía está lista. Usa Agregar para registrar el primer artículo.</span></div>}
    </section>
  </>;
}
