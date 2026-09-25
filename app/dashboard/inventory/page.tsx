import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { getCreationGateForScope } from "@/lib/setup-sequence";
import ModuleHeader from "@/components/ModuleHeader";
import CreateRecordModal from "@/components/CreateRecordModal";
import CreationPrerequisiteState from "@/components/CreationPrerequisiteState";
import RequisitionBuilder from "@/components/RequisitionBuilder";
import BulkImportModal from "@/components/BulkImportModal";
import ModuleExportMenu from "@/components/ModuleExportMenu";
import Link from "next/link";
import UiIcon from "@/components/UiIcon";
import FileDropzone from "@/components/FileDropzone";
import InventorySubnav from "@/components/InventorySubnav";
import { InventoryCard } from "@/components/business-ui";

type Item={
  id:string;organization_id:string;site_id:string|null;location_id:string|null;supplier_id:string|null;category_id:string|null;warehouse_id:string|null;
  supplier_type:string|null;sku:string;name:string;description:string|null;presentation:string|null;company:string;site:string|null;location:string|null;
  category:string|null;warehouse:string|null;supplier:string|null;quantity:string;min_quantity:string;max_quantity:string;unit:string;unit_cost:string;storage_location:string|null;has_image:boolean;active:boolean;
};
type Site={id:string;label:string};
type Location={id:string;label:string};
type Supplier={id:string;name:string;supplier_type:string};
type Category={id:string;name:string};
type Warehouse={id:string;name:string;site_id:string|null;location_id:string|null};
type Movement={id:string;type:string;quantity:string;sku:string;name:string;warehouse:string|null;destination:string|null;movement_at:string;document_number:string|null};

function money(value:number){
  return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(value);
}
function stockState(item:Item){
  const q=Number(item.quantity||0),min=Number(item.min_quantity||0);
  if(q<=0)return {key:"out",label:"Sin stock"};
  if(q<=min)return {key:"low",label:"Stock bajo"};
  return {key:"ok",label:"En stock"};
}
function movementLabel(type:string,quantity:number){
  if(type==="receipt")return "Entrada";
  if(type==="issue")return "Salida";
  if(type==="return")return "Devolución";
  if(type==="transfer")return "Transferencia";
  return quantity<0?"Ajuste -":"Ajuste +";
}

export default async function InventoryPage({searchParams}:{searchParams:Promise<{created?:string;updated?:string;movement?:string;error?:string;requisition_created?:string}>}) {
  const session=await getSession();
  if(!session) redirect("/login");
  if(!can(session,"inventory.read")) redirect("/dashboard");
  const params=await searchParams;
  const superadmin=session.platformRole!=="user";
  const orgId=session.organizationId;
  const canWrite=can(session,"inventory.write");

  const itemSql=`SELECT i.id,i.organization_id,i.site_id,i.location_id,i.supplier_id,i.category_id,i.warehouse_id,p.supplier_type,
      i.sku,i.name,i.description,i.presentation,o.name company,s.name site,l.name location,c.name category,w.name warehouse,p.name supplier,
      i.quantity::text,i.min_quantity::text,i.max_quantity::text,i.unit,i.unit_cost::text,i.storage_location,(i.image_data IS NOT NULL) has_image,i.active
    FROM inventory_items i JOIN organizations o ON o.id=i.organization_id
    LEFT JOIN sites s ON s.id=i.site_id LEFT JOIN locations l ON l.id=i.location_id LEFT JOIN suppliers p ON p.id=i.supplier_id
    LEFT JOIN inventory_categories c ON c.id=i.category_id LEFT JOIN inventory_warehouses w ON w.id=i.warehouse_id
    WHERE 1=1`;
  const [items,sites,locations,suppliers,categories,warehouses,movements]=await Promise.all([
    superadmin
      ? query<Item>(itemSql+" ORDER BY i.name LIMIT 600")
      : session.accessAllSites
        ? query<Item>(itemSql+" AND i.organization_id=$1 ORDER BY i.name LIMIT 600",[orgId])
        : query<Item>(itemSql+" AND i.organization_id=$1 AND (i.site_id IS NULL OR i.site_id=ANY($2::uuid[])) ORDER BY i.name LIMIT 600",[orgId,session.siteIds]),
    canWrite && orgId
      ? session.accessAllSites
        ? query<Site>("SELECT id,name label FROM sites WHERE organization_id=$1 AND active=true ORDER BY name",[orgId])
        : query<Site>("SELECT id,name label FROM sites WHERE organization_id=$1 AND active=true AND id=ANY($2::uuid[]) ORDER BY name",[orgId,session.siteIds])
      : Promise.resolve({rows:[]} as {rows:Site[]}),
    canWrite && orgId
      ? session.accessAllSites
        ? query<Location>("SELECT l.id,s.name||' · '||l.name label FROM locations l JOIN sites s ON s.id=l.site_id WHERE l.organization_id=$1 AND l.active=true ORDER BY s.name,l.name",[orgId])
        : query<Location>("SELECT l.id,s.name||' · '||l.name label FROM locations l JOIN sites s ON s.id=l.site_id WHERE l.organization_id=$1 AND l.active=true AND l.site_id=ANY($2::uuid[]) ORDER BY s.name,l.name",[orgId,session.siteIds])
      : Promise.resolve({rows:[]} as {rows:Location[]}),
    canWrite && orgId
      ? query<Supplier>("SELECT id,name,supplier_type FROM suppliers WHERE organization_id=$1 AND active=true AND supplier_type IN ('materials','both') ORDER BY name",[orgId])
      : Promise.resolve({rows:[]} as {rows:Supplier[]}),
    orgId?query<Category>("SELECT id,name FROM inventory_categories WHERE organization_id=$1 AND active=true ORDER BY name",[orgId]):Promise.resolve({rows:[]} as {rows:Category[]}),
    orgId?query<Warehouse>("SELECT id,name,site_id,location_id FROM inventory_warehouses WHERE organization_id=$1 AND active=true ORDER BY name",[orgId]):Promise.resolve({rows:[]} as {rows:Warehouse[]}),
    orgId
      ? query<Movement>(`SELECT t.id,t.type,t.quantity::text,i.sku,i.name,w.name warehouse,d.name destination,t.movement_at::text,t.document_number
                         FROM inventory_transactions t JOIN inventory_items i ON i.id=t.item_id
                         LEFT JOIN inventory_warehouses w ON w.id=t.warehouse_id LEFT JOIN inventory_warehouses d ON d.id=t.destination_warehouse_id
                         WHERE t.organization_id=$1 ORDER BY t.movement_at DESC,t.created_at DESC LIMIT 10`,[orgId])
      : Promise.resolve({rows:[]} as {rows:Movement[]}),
  ]);

  const creationGate=await getCreationGateForScope("inventory",session.organizationId,superadmin);
  const error=params.error==="sequence" ? creationGate.message
    : params.error==="limit" ? "La empresa alcanzó el límite de artículos de inventario."
    : params.error==="sku" ? "El SKU ya existe dentro de la empresa."
    : params.error==="stock" ? "El movimiento no pudo aplicarse porque dejaría existencias negativas o contiene datos inválidos."
    : params.error==="movement" ? "Revisa el tipo de movimiento, cantidad y bodega."
    : params.error ? "Revisa la información del inventario." : "";

  const activeItems=items.rows.filter(item=>item.active);
  const totalValue=activeItems.reduce((sum,item)=>sum+Number(item.quantity||0)*Number(item.unit_cost||0),0);
  const inStock=activeItems.filter(item=>Number(item.quantity)>Number(item.min_quantity)&&Number(item.quantity)>0).length;
  const lowStock=activeItems.filter(item=>Number(item.quantity)>0&&Number(item.quantity)<=Number(item.min_quantity)).length;
  const outStock=activeItems.filter(item=>Number(item.quantity)<=0).length;

  return <>
    <ModuleHeader
      eyebrow="Abastecimiento"
      title="Inventario"
      description="Productos, repuestos y suministros con trazabilidad por proveedor, ubicación, bodega y Kardex."
      count={items.rowCount || 0}
      countLabel="artículos"
      searchPlaceholder="Buscar SKU, artículo, categoría, ubicación o proveedor"
      filters={[{value:"all",label:"Todos"},{value:"ok",label:"En stock"},{value:"low",label:"Stock bajo"},{value:"out",label:"Sin stock"}]}
      facets={[
        {key:"organization",label:"Empresa",allLabel:"Todas las empresas"},
        {key:"site",label:"Sede",allLabel:"Todas las sedes"},
        {key:"category",label:"Categoría",allLabel:"Todas las categorías"},
        {key:"supplier",label:"Proveedor",allLabel:"Todos los proveedores"},
        {key:"warehouse",label:"Bodega",allLabel:"Todas las bodegas"},
        {key:"record",label:"Registro",allLabel:"Todos los registros"},
      ]}
      action={<div className="module-header-action-group">
        {canWrite&&orgId&&<BulkImportModal entity="inventory"/>}
        <ModuleExportMenu entity="inventory"/>
        {can(session,"requisitions.read")&&<Link className="button secondary" href="/dashboard/requisitions"><UiIcon name="file" size={15}/> Requisiciones</Link>}
        {canWrite && creationGate.ready && orgId ? <CreateRecordModal title="Crear artículo" eyebrow="Nuevo inventario" description="Registra el artículo y su posición inicial. La existencia inicial quedará registrada en Kardex." triggerLabel="Nuevo producto" icon="▤">
          <form className="form-grid unified-popup-form" method="post" action="/api/inventory" encType="multipart/form-data">
            <div className="field"><label>Sede *</label><select name="site_id" required><option value="">Selecciona sede</option>{sites.rows.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
            <div className="field"><label>Sububicación *</label><select name="location_id" required><option value="">Selecciona sububicación</option>{locations.rows.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></div>
            <div className="field"><label>Proveedor *</label><select name="supplier_id" required><option value="">Selecciona proveedor</option>{suppliers.rows.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div className="field"><label>SKU *</label><input name="sku" required placeholder="Ej. REP-FLT-001"/></div>
            <div className="field"><label>Nombre *</label><input name="name" required placeholder="Ej. Filtro plisado 20 x 20"/></div>
            <div className="field"><label>Categoría</label><input name="category" list="inventory-category-list" placeholder="Ej. Refrigeración"/><datalist id="inventory-category-list">{categories.rows.map(c=><option value={c.name} key={c.id}/>)}</datalist></div>
            <div className="field form-span-2"><label>Descripción</label><input name="description" placeholder="Descripción del producto o repuesto"/></div>
            <div className="form-span-2"><FileDropzone name="image" label="Imagen del producto" description="PNG, JPG o WebP. Se mostrará en las tarjetas y ficha del inventario." accept="image/png,image/jpeg,image/webp" maxSizeMb={5} kind="image"/></div>
            <div className="field"><label>Presentación</label><input name="presentation" placeholder="Ej. caja x 12, rollo 100 m"/></div>
            <div className="field"><label>Unidad</label><input name="unit" defaultValue="unidad" placeholder="unidad, caja, metro..."/></div>
            <div className="field"><label>Bodega / almacén</label><input name="warehouse_name" list="inventory-warehouse-list" defaultValue="Almacén principal"/><datalist id="inventory-warehouse-list">{warehouses.rows.map(w=><option value={w.name} key={w.id}/>)}</datalist></div>
            <div className="field"><label>Existencia inicial</label><input name="quantity" type="number" step="0.001" min="0" defaultValue="0"/></div>
            <div className="field"><label>Stock mínimo</label><input name="min_quantity" type="number" step="0.001" min="0" defaultValue="0"/></div>
            <div className="field"><label>Stock máximo</label><input name="max_quantity" type="number" step="0.001" min="0" defaultValue="0"/></div>
            <div className="field"><label>Costo unitario</label><input name="unit_cost" type="number" step="0.01" min="0" defaultValue="0"/></div>
            <div className="form-span-2 form-actions"><button className="button" type="submit">Crear artículo</button></div>
          </form>
        </CreateRecordModal> : null}
      </div>}
    />
    <InventorySubnav active="summary"/>

    {params.created && <div className="notice success section">Artículo creado y existencia inicial registrada en Kardex.</div>}
    {params.updated && <div className="notice success section">Artículo actualizado correctamente.</div>}
    {params.movement && <div className="notice success section">Movimiento de Kardex registrado correctamente.</div>}
    {params.requisition_created && <div className="notice success section">{params.requisition_created} requisición{params.requisition_created==="1"?"":"es"} creada{params.requisition_created==="1"?"":"s"} correctamente y separada{params.requisition_created==="1"?"":"s"} por proveedor.</div>}
    {error && <div className="notice error section">{error}</div>}

    {canWrite && !creationGate.ready && <CreationPrerequisiteState
      icon="▤" eyebrow="Jerarquía de creación" title={creationGate.title} message={creationGate.message}
      href={creationGate.href || "/dashboard/locations"} action={creationGate.action || "Continuar"}
    />}

    <section className="section inventory-kpi-grid">
      <article className="inventory-kpi-card value"><span><UiIcon name="asset"/></span><div><small>Valor total inventario</small><strong>{money(totalValue)}</strong><em>{activeItems.length} productos activos</em></div></article>
      <article className="inventory-kpi-card success"><span><UiIcon name="check"/></span><div><small>Productos en stock</small><strong>{inStock}</strong><em>{activeItems.length?Math.round(inStock/activeItems.length*100):0}% del total activo</em></div></article>
      <article className="inventory-kpi-card warning"><span>!</span><div><small>Stock bajo</small><strong>{lowStock}</strong><em>{activeItems.length?Math.round(lowStock/activeItems.length*100):0}% del total activo</em></div></article>
      <article className="inventory-kpi-card danger"><span>×</span><div><small>Sin stock</small><strong>{outStock}</strong><em>{activeItems.length?Math.round(outStock/activeItems.length*100):0}% del total activo</em></div></article>
    </section>

    <section className="section inventory-dashboard-layout" id="productos">
      <div className="inventory-products-panel">
        <div className="section-heading"><div><span className="eyebrow">Productos</span><h2>Catálogo y existencias</h2><p className="muted">La existencia se calcula desde movimientos de Kardex y bodegas.</p></div></div>
        {items.rows.length?<div className="inventory-product-grid">{items.rows.map(item=>{
          const state=stockState(item);
          const quantity=Number(item.quantity||0),max=Math.max(Number(item.max_quantity||0),Number(item.min_quantity||0),quantity,1);
          const pct=Math.max(0,Math.min(100,quantity/max*100));
          return <InventoryCard
            key={item.id}
            name={item.name}
            sku={item.sku}
            category={item.category||"Sin categoría"}
            presentation={item.presentation||item.unit}
            quantity={quantity}
            unit={item.unit}
            min={Number(item.min_quantity||0)}
            max={Number(item.max_quantity||0)}
            supplier={item.supplier||"Sin proveedor"}
            warehouse={item.warehouse||item.storage_location||"Sin registrar"}
            unitValue={money(Number(item.unit_cost||0))}
            status={state.label}
            statusTone={state.key==="out"?"danger":state.key==="low"?"warning":"success"}
            active={item.active}
            imageSrc={item.has_image?"/api/inventory/"+item.id+"/image":null}
            recordProps={{
              "data-module-record":true,"data-status":state.key,
              "data-search":[item.sku,item.name,item.description,item.category,item.company,item.site,item.location,item.warehouse,item.supplier].filter(Boolean).join(" "),
              "data-filter-organization":item.organization_id,"data-filter-organization-label":item.company,
              "data-filter-site":item.site_id||"","data-filter-site-label":item.site||"",
              "data-filter-category":item.category_id||"","data-filter-category-label":item.category||"",
              "data-filter-supplier":item.supplier_id||"","data-filter-supplier-label":item.supplier||"",
              "data-filter-warehouse":item.warehouse_id||"","data-filter-warehouse-label":item.warehouse||"",
              "data-filter-record":item.active?"active":"inactive","data-filter-record-label":item.active?"Activo":"Inactivo",
            }}
            actions={<>
              <Link href={"/dashboard/suppliers?supplier="+(item.supplier_id||"")+"&tab=inventory"} className="text-button">Ver proveedor</Link>
              {canWrite&&<Link href={"/dashboard/inventory/"+item.id} className="button secondary">Ver detalles →</Link>}
            </>}
          />;
        })}</div>:<div className="card empty-state"><strong>Aún no hay artículos.</strong><span>Usa Nuevo producto o Importar para comenzar.</span></div>}
      </div>

      <aside className="inventory-movements-panel card">
        <div className="section-heading"><div><span className="eyebrow">Kardex</span><h2>Últimos movimientos</h2></div></div>
        <div className="inventory-movement-list">
          {movements.rows.length?movements.rows.map(move=>{
            const qty=Number(move.quantity||0);
            return <article key={move.id} className={"inventory-movement-item "+move.type}>
              <span>{move.type==="issue"||qty<0?"↓":move.type==="transfer"?"↔":"↑"}</span>
              <div><strong>{movementLabel(move.type,qty)}</strong><small>{move.sku} · {move.name}</small><em>{move.warehouse||"Sin bodega"}{move.destination?" → "+move.destination:""} · {new Date(move.movement_at).toLocaleDateString("es-CO")}</em></div>
              <b>{qty>0?"+":""}{qty}</b>
            </article>;
          }):<div className="location-detail-empty">Todavía no hay movimientos registrados.</div>}
        </div>
      </aside>
    </section>

    {can(session,"requisitions.write")&&<section className="card section" id="crear-requisicion">
      <RequisitionBuilder
        items={items.rows.filter(item=>item.active&&Boolean(item.supplier_id)&&["materials","both"].includes(item.supplier_type||"")).map(item=>({
          id:item.id,supplier_id:item.supplier_id||"",supplier_name:item.supplier||"Proveedor",sku:item.sku,name:item.name,unit:item.unit,
          unit_cost:item.unit_cost,quantity:item.quantity,min_quantity:item.min_quantity,site_name:item.site,location_name:item.location,
        }))}
        returnTo="/dashboard/inventory"
        title="Generar requisiciones desde inventario"
        description="Selecciona insumos y cantidades. Si pertenecen a proveedores distintos, Desweb CMMS crea una requisición independiente para cada proveedor."
      />
    </section>}
  </>;
}
