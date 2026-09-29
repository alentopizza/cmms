import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { getSession,canAccessSite } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { canAccessInventoryItem } from "@/lib/inventory-scope";
import { query } from "@/lib/db";
import UiIcon from "@/components/UiIcon";
import FileDropzone from "@/components/FileDropzone";
import InventorySubnav from "@/components/InventorySubnav";
import { Alert, EmptyState } from "@/components/ui-kit/Feedback";
import { Badge } from "@/components/ui-kit/Badge";
import { KpiCard, MetricGrid } from "@/components/ui-kit/Metrics";

type Item={
  id:string;organization_id:string;site_id:string;sku:string;name:string;description:string|null;presentation:string|null;unit:string;
  quantity:string;min_quantity:string;max_quantity:string;unit_cost:string;category:string|null;supplier_id:string|null;supplier:string|null;
  company:string;site:string;location:string|null;warehouse_id:string|null;warehouse:string|null;active:boolean;has_image:boolean;
};
type Stock={warehouse_id:string;warehouse:string;quantity:string;min_quantity:string;max_quantity:string};
type Warehouse={id:string;name:string};
type Tx={id:string;type:string;quantity:string;unit_cost:string|null;document_number:string|null;movement_at:string;warehouse:string|null;destination:string|null;lot_number:string|null;expires_at:string|null;cost_center:string|null;notes:string|null;requisition_id:string|null;requisition_number:string|null};

function money(value:number){return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(value);}
function movementLabel(type:string,qty:number){if(type==="receipt")return"Entrada";if(type==="issue")return"Salida";if(type==="return")return"Devolución";if(type==="transfer")return"Traslado";return qty<0?"Ajuste negativo":"Ajuste positivo";}

export default async function InventoryDetail({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{updated?:string;movement?:string;error?:string}>}){
  const session=await getSession();
  if(!session)redirect("/login");
  if(!can(session,"inventory.read"))redirect("/dashboard");
  const {id}=await params;
  const feedback=await searchParams;
  const result=await query<Item>(
    `SELECT i.id,i.organization_id,i.site_id,i.sku,i.name,i.description,i.presentation,i.unit,i.quantity::text,i.min_quantity::text,i.max_quantity::text,
      i.unit_cost::text,c.name category,i.supplier_id,p.name supplier,o.name company,s.name site,l.name location,i.warehouse_id,w.name warehouse,i.active,(i.image_data IS NOT NULL) has_image
     FROM inventory_items i JOIN organizations o ON o.id=i.organization_id JOIN sites s ON s.id=i.site_id
     LEFT JOIN locations l ON l.id=i.location_id LEFT JOIN suppliers p ON p.id=i.supplier_id
     LEFT JOIN inventory_categories c ON c.id=i.category_id LEFT JOIN inventory_warehouses w ON w.id=i.warehouse_id
     WHERE i.id=$1`,[id],
  );
  if(!result.rowCount)notFound();
  const item=result.rows[0];
  if(!canAccessInventoryItem(session,item.organization_id,item.site_id))notFound();
  const limitedSiteScope=session.platformRole==="user"&&!session.accessAllSites;
  const [stocks,warehouses,transactions]=await Promise.all([
    limitedSiteScope
      ?query<Stock>(`SELECT sl.warehouse_id,w.name warehouse,sl.quantity::text,sl.min_quantity::text,sl.max_quantity::text
                      FROM inventory_stock_levels sl JOIN inventory_warehouses w ON w.id=sl.warehouse_id
                      WHERE sl.item_id=$1 AND w.site_id=ANY($2::uuid[]) ORDER BY w.name`,[id,session.siteIds])
      :query<Stock>(`SELECT sl.warehouse_id,w.name warehouse,sl.quantity::text,sl.min_quantity::text,sl.max_quantity::text
                      FROM inventory_stock_levels sl JOIN inventory_warehouses w ON w.id=sl.warehouse_id WHERE sl.item_id=$1 ORDER BY w.name`,[id]),
    limitedSiteScope
      ?query<Warehouse>("SELECT id,name FROM inventory_warehouses WHERE organization_id=$1 AND active=true AND site_id=ANY($2::uuid[]) ORDER BY name",[item.organization_id,session.siteIds])
      :query<Warehouse>("SELECT id,name FROM inventory_warehouses WHERE organization_id=$1 AND active=true ORDER BY name",[item.organization_id]),
    limitedSiteScope
      ?query<Tx>(`SELECT t.id,t.type,t.quantity::text,t.unit_cost::text,t.document_number,t.movement_at::text,w.name warehouse,d.name destination,
                          t.lot_number,t.expires_at::text,t.cost_center,t.notes,t.requisition_id,r.number::text requisition_number
                   FROM inventory_transactions t
                   JOIN inventory_warehouses w ON w.id=t.warehouse_id
                   LEFT JOIN inventory_warehouses d ON d.id=t.destination_warehouse_id
                   LEFT JOIN supplier_requisitions r ON r.id=t.requisition_id
                   WHERE t.item_id=$1 AND w.site_id=ANY($2::uuid[])
                     AND (d.id IS NULL OR d.site_id=ANY($2::uuid[]))
                   ORDER BY t.movement_at DESC,t.created_at DESC LIMIT 200`,[id,session.siteIds])
      :query<Tx>(`SELECT t.id,t.type,t.quantity::text,t.unit_cost::text,t.document_number,t.movement_at::text,w.name warehouse,d.name destination,
                          t.lot_number,t.expires_at::text,t.cost_center,t.notes,t.requisition_id,r.number::text requisition_number
                   FROM inventory_transactions t
                   LEFT JOIN inventory_warehouses w ON w.id=t.warehouse_id
                   LEFT JOIN inventory_warehouses d ON d.id=t.destination_warehouse_id
                   LEFT JOIN supplier_requisitions r ON r.id=t.requisition_id
                   WHERE t.item_id=$1 ORDER BY t.movement_at DESC,t.created_at DESC LIMIT 200`,[id]),
  ]);
  const canWrite=can(session,"inventory.write");
  const visibleQuantity=limitedSiteScope?stocks.rows.reduce((sum,stock)=>sum+Number(stock.quantity||0),0):Number(item.quantity||0);
  const visiblePrimaryWarehouse=warehouses.rows.find(warehouse=>warehouse.id===item.warehouse_id)||null;

  return <div className="phase7-inventory phase7-inventory-detail">
    <nav className="entity-breadcrumbs">
      <Link href="/dashboard"><UiIcon name="home" size={13}/> Inicio</Link><span className="entity-breadcrumb-separator"><UiIcon name="chevron-right" size={13}/></span>
      <Link href="/dashboard/inventory">Inventario</Link><span className="entity-breadcrumb-separator"><UiIcon name="chevron-right" size={13}/></span>
      <span className="current">{item.sku}</span>
    </nav>
    <header className="entity-profile-page-head">
      <div className="entity-profile-page-identity"><span className="entity-profile-page-icon"><UiIcon name="asset" size={27}/></span><div><span className="eyebrow">Inventario</span><h1>{item.name}</h1><p>{item.sku} · {item.company}</p></div></div>
      <div className="entity-profile-toolbar-actions">
        {item.supplier_id&&<Link className="button secondary" href={"/dashboard/suppliers?supplier="+item.supplier_id+"&tab=inventory"}>Proveedor</Link>}
        {canWrite&&<form method="post" action={"/api/inventory/"+item.id}>
          <input type="hidden" name="intent" value={item.active?"deactivate":"reactivate"}/>
          <input type="hidden" name="return_to" value={"/dashboard/inventory/"+item.id}/>
          <button className="button secondary" type="submit">{item.active?"Desactivar":"Reactivar"}</button>
        </form>}
        <Link className="button secondary" href="/dashboard/inventory">Volver</Link>
      </div>
    </header>
    <InventorySubnav active="products"/>
    {(feedback.updated||feedback.movement)&&<div className="section phase7-feedback-stack">
      {feedback.updated&&<Alert variant="success" title="Producto actualizado">Artículo actualizado correctamente.</Alert>}
      {feedback.movement&&<Alert variant="success" title="Kardex actualizado">Movimiento registrado en Kardex.</Alert>}
    </div>}
    {feedback.error&&<div className="section"><Alert variant="danger" title="No fue posible completar la operación">Revisa existencias, bodega y datos.</Alert></div>}

    <MetricGrid className="section phase7-kpi-grid">
      <KpiCard label="Existencia total" value={visibleQuantity+" "+item.unit} hint={money(visibleQuantity*Number(item.unit_cost))} icon="inventory"/>
      <KpiCard label="Costo unitario" value={money(Number(item.unit_cost))} hint={item.presentation||item.unit} icon="activity" tone="success"/>
      <KpiCard label="Stock mínimo" value={item.min_quantity} hint={item.unit} icon="warning" tone={visibleQuantity<=Number(item.min_quantity)?"warning":"default"}/>
      <KpiCard label="Bodega principal" value={visiblePrimaryWarehouse?.name||"Sin registrar"} hint={item.site+(item.location?" · "+item.location:"")} icon="location"/>
    </MetricGrid>

    <section className="section inventory-detail-grid">
      <div className="card inventory-detail-panel">
        <div className="inventory-detail-identity">
          <span className={"inventory-detail-image"+(item.has_image?" has-image":"")}>{item.has_image?<img src={"/api/inventory/"+item.id+"/image"} alt="" />:<UiIcon name="asset" size={44}/>}</span>
          <div><span className="eyebrow">Ficha</span><h2>{item.name}</h2><p>{item.sku} · {item.category||"Sin categoría"}</p></div>
        </div>
        <div className="entity-info-grid">
          <div className="entity-info-field"><span>SKU</span><strong>{item.sku}</strong></div><div className="entity-info-field"><span>Categoría</span><strong>{item.category||"Sin categoría"}</strong></div>
          <div className="entity-info-field"><span>Proveedor</span><strong>{item.supplier||"Sin proveedor"}</strong></div><div className="entity-info-field"><span>Unidad</span><strong>{item.unit}</strong></div>
          <div className="entity-info-field"><span>Descripción</span><strong>{item.description||"Sin descripción"}</strong></div><div className="entity-info-field"><span>Presentación</span><strong>{item.presentation||"Sin registrar"}</strong></div>
        </div>
        {canWrite&&<form className="form-grid inventory-inline-form" method="post" encType="multipart/form-data" action={"/api/inventory/"+item.id}>
          <input type="hidden" name="return_to" value={"/dashboard/inventory/"+item.id}/>
          <div className="field"><label>Nombre</label><input name="name" defaultValue={item.name} required/></div>
          <div className="field"><label>Categoría</label><input name="category" defaultValue={item.category||""}/></div>
          <div className="field form-span-2"><label>Descripción</label><input name="description" defaultValue={item.description||""}/></div>
          <div className="form-span-2"><FileDropzone name="image" label="Imagen del producto" description="Puedes reemplazar la imagen actual sin afectar el Kardex." accept="image/png,image/jpeg,image/webp" maxSizeMb={5} kind="image" existingFileName={item.has_image?"Imagen actual":null} existingPreviewUrl={item.has_image?"/api/inventory/"+item.id+"/image":null}/></div>
          <div className="field"><label>Presentación</label><input name="presentation" defaultValue={item.presentation||""}/></div>
          <div className="field"><label>Unidad</label><input name="unit" defaultValue={item.unit}/></div>
          <div className="field"><label>Mínimo</label><input type="number" step="0.001" min="0" name="min_quantity" defaultValue={item.min_quantity}/></div>
          <div className="field"><label>Máximo</label><input type="number" step="0.001" min="0" name="max_quantity" defaultValue={item.max_quantity}/></div>
          <div className="field"><label>Costo unitario</label><input type="number" step="0.01" min="0" name="unit_cost" defaultValue={item.unit_cost}/></div>
          <div className="form-span-2 form-actions"><button className="button" type="submit">Guardar cambios</button></div>
        </form>}
      </div>

      <div className="card inventory-detail-panel">
        <div className="section-heading"><div><span className="eyebrow">Bodegas</span><h2>Existencias por almacén</h2></div></div>
        <div className="inventory-stock-location-list">{stocks.rows.map(stock=><article key={stock.warehouse_id}><div><strong>{stock.warehouse}</strong><span>Mín {stock.min_quantity} · Máx {stock.max_quantity}</span></div><b>{stock.quantity} {item.unit}</b></article>)}</div>
        {canWrite&&<form className="form-grid inventory-inline-form" method="post" action={"/api/inventory/"+item.id+"/movement"}>
          <input type="hidden" name="return_to" value={"/dashboard/inventory/"+item.id}/>
          <div className="field"><label>Movimiento *</label><select name="movement_type" required><option value="receipt">Entrada</option><option value="issue">Salida</option><option value="adjustment_positive">Ajuste positivo</option><option value="adjustment_negative">Ajuste negativo</option><option value="return">Devolución</option><option value="transfer">Traslado</option></select></div>
          <div className="field"><label>Bodega origen *</label><select name="warehouse_id" defaultValue={visiblePrimaryWarehouse?.id||""} required>{warehouses.rows.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
          <div className="field"><label>Bodega destino (traslado)</label><select name="destination_warehouse_id"><option value="">No aplica</option>{warehouses.rows.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
          <div className="field"><label>Cantidad *</label><input name="quantity" type="number" min="0.001" step="0.001" required/></div>
          <div className="field"><label>Costo unitario</label><input name="unit_cost" type="number" min="0" step="0.01"/></div>
          <div className="field"><label>Fecha / hora</label><input name="movement_at" type="datetime-local"/></div>
          <div className="field"><label>Documento</label><input name="document_number" placeholder="OC, REQ, ajuste..."/></div>
          <div className="field"><label>Lote</label><input name="lot_number" placeholder="Lote o serie de recepción"/></div>
          <div className="field"><label>Vencimiento</label><input name="expires_at" type="date"/></div>
          <div className="field"><label>Centro de costo</label><input name="cost_center" placeholder="Área, contrato o proyecto"/></div>
          <div className="field form-span-2"><label>Observaciones</label><input name="notes"/></div>
          <div className="form-span-2 form-actions"><button className="button" type="submit">Registrar movimiento</button></div>
        </form>}
      </div>
    </section>

    <section className="card section">
      <div className="section-heading"><div><span className="eyebrow">Kardex</span><h2>Historial de movimientos</h2></div></div>
      <div className="ds-data-table-shell inventory-kardex-table-wrap"><div className="ds-data-table-scroll"><table className="ds-data-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Documento</th><th>Bodega</th><th>Cantidad</th><th>Costo</th><th>Lote / vencimiento</th><th>Centro de costo</th><th>Observaciones</th></tr></thead><tbody>
        {transactions.rows.map(tx=>{const qty=Number(tx.quantity);return <tr key={tx.id}>
          <td>{new Date(tx.movement_at).toLocaleString("es-CO")}</td><td>{movementLabel(tx.type,qty)}</td><td>{tx.document_number||"—"}{tx.requisition_id&&tx.requisition_number?<Link className="table-subline kardex-requisition-link" href={"/dashboard/requisitions/"+tx.requisition_id}>REQ-{tx.requisition_number.padStart(6,"0")}</Link>:null}</td>
          <td>{tx.warehouse||"—"}{tx.destination?" → "+tx.destination:""}</td><td>{qty>0?"+":""}{qty} {item.unit}</td><td>{tx.unit_cost?money(Number(tx.unit_cost)):"—"}</td>
          <td>{tx.lot_number||"—"}{tx.expires_at?<small className="table-subline">Vence {new Date(tx.expires_at+"T12:00:00").toLocaleDateString("es-CO")}</small>:null}</td>
          <td>{tx.cost_center||"—"}</td><td>{tx.notes||"—"}</td>
        </tr>})}
      </tbody></table></div></div>
      {!transactions.rowCount&&<EmptyState icon="file" title="Sin movimientos" description="Los movimientos de Kardex de este producto aparecerán aquí."/>}
    </section>
  </div>;
}
