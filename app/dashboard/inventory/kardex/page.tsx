import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import ModuleHeader from "@/components/ModuleHeader";
import CreateRecordModal from "@/components/CreateRecordModal";
import InventorySubnav from "@/components/InventorySubnav";
import UiIcon from "@/components/UiIcon";
import ModuleExportMenu from "@/components/ModuleExportMenu";
import { Alert, EmptyState } from "@/components/ui-kit/Feedback";
import { Badge, type BadgeVariant } from "@/components/ui-kit/Badge";

type Tx={
  id:string;organization_id:string;organization_name:string;item_id:string;sku:string;item_name:string;unit:string;supplier_id:string|null;supplier_name:string|null;
  site_id:string|null;site_name:string|null;type:string;quantity:string;unit_cost:string|null;warehouse_id:string|null;warehouse_name:string|null;
  destination_warehouse_id:string|null;destination_name:string|null;document_number:string|null;movement_at:string;lot_number:string|null;expires_at:string|null;
  cost_center:string|null;notes:string|null;created_by_name:string|null;requisition_id:string|null;requisition_number:string|null;supplier_return_number:string|null;
  source_movement_id:string|null;import_number:string|null;import_created_at:string|null;
};
type Item={id:string;sku:string;name:string;unit:string;organization_id:string;site_id:string|null;warehouse_id:string|null};
type Warehouse={id:string;name:string;organization_id:string;site_id:string|null};

function typeTone(type:string,quantity:number):BadgeVariant{
  if(type==="receipt"||type==="return")return "success";
  if(type==="issue"||type==="supplier_return")return "warning";
  if(type==="transfer")return "info";
  return quantity<0?"danger":"brand";
}
function typeLabel(type:string,quantity:number){
  if(type==="receipt")return "Entrada";
  if(type==="issue")return "Salida";
  if(type==="return")return "Devolución a inventario";
  if(type==="supplier_return")return "Devolución a proveedor";
  if(type==="transfer")return "Transferencia";
  return quantity<0?"Ajuste negativo":"Ajuste positivo";
}
function sectionTitle(type:string|undefined){
  if(type==="receipt")return "Entradas";
  if(type==="issue")return "Salidas";
  if(type==="adjustment")return "Ajustes";
  if(type==="transfer")return "Transferencias";
  if(type==="return")return "Devoluciones a inventario";
  if(type==="supplier_return")return "Devoluciones a proveedor";
  return "Kardex";
}
function activeSection(type:string|undefined){
  if(type==="receipt")return "entries" as const;
  if(type==="issue")return "issues" as const;
  if(type==="adjustment")return "adjustments" as const;
  if(type==="transfer")return "transfers" as const;
  return "kardex" as const;
}

export default async function InventoryKardexPage({searchParams}:{searchParams:Promise<{type?:string;created?:string;error?:string}>}){
  const session=await getSession();
  if(!session)redirect("/login");
  if(!can(session,"inventory.read"))redirect("/dashboard");
  const params=await searchParams;
  const requestedType=["receipt","issue","adjustment","transfer","return","supplier_return"].includes(params.type||"")?params.type:"";
  const platform=session.platformRole!=="user";
  const canWrite=can(session,"inventory.write");
  const orgId=session.organizationId;

  const base=`SELECT t.id,t.organization_id,o.name organization_name,t.item_id,i.sku,i.name item_name,i.unit,i.supplier_id,p.name supplier_name,
      i.site_id,s.name site_name,t.type,t.quantity::text,t.unit_cost::text,t.warehouse_id,w.name warehouse_name,
      t.destination_warehouse_id,d.name destination_name,t.document_number,t.movement_at::text,t.lot_number,t.expires_at::text,t.cost_center,t.notes,
      u.full_name created_by_name,t.requisition_id,r.number::text requisition_number,sr.number::text supplier_return_number,
      t.source_movement_id,b.import_number::text import_number,b.created_at::text import_created_at
    FROM inventory_transactions t
    JOIN inventory_items i ON i.id=t.item_id
    JOIN organizations o ON o.id=t.organization_id
    LEFT JOIN suppliers p ON p.id=i.supplier_id LEFT JOIN sites s ON s.id=i.site_id
    LEFT JOIN inventory_warehouses w ON w.id=t.warehouse_id LEFT JOIN inventory_warehouses d ON d.id=t.destination_warehouse_id
    LEFT JOIN users u ON u.id=t.created_by
    LEFT JOIN supplier_requisitions r ON r.id=t.requisition_id
    LEFT JOIN supplier_returns sr ON sr.id=t.supplier_return_id
    LEFT JOIN bulk_import_batches b ON b.id=t.import_batch_id`;

  let transactions;
  if(platform){
    const clauses:string[]=[];const values:unknown[]=[];
    if(requestedType){values.push(requestedType);clauses.push("t.type=$1");}
    transactions=await query<Tx>(base+(clauses.length?" WHERE "+clauses.join(" AND "):"")+" ORDER BY t.movement_at DESC,t.created_at DESC LIMIT 1000",values);
  }else{
    const values:unknown[]=[orgId];
    let where=" WHERE t.organization_id=$1";
    if(!session.accessAllSites){values.push(session.siteIds);where+=" AND (i.site_id IS NULL OR i.site_id=ANY($2::uuid[]))";}
    if(requestedType){values.push(requestedType);where+=" AND t.type=$"+values.length;}
    transactions=await query<Tx>(base+where+" ORDER BY t.movement_at DESC,t.created_at DESC LIMIT 1000",values);
  }

  const [items,warehouses]=orgId?await Promise.all([
    query<Item>(`SELECT id,sku,name,unit,organization_id,site_id,warehouse_id FROM inventory_items
                 WHERE organization_id=$1 AND active=true ORDER BY name`,[orgId]),
    query<Warehouse>("SELECT id,name,organization_id,site_id FROM inventory_warehouses WHERE organization_id=$1 AND active=true ORDER BY name",[orgId]),
  ]):[{rows:[]} as {rows:Item[]},{rows:[]} as {rows:Warehouse[]}];

  const error=params.error==="stock"?"El movimiento fue rechazado porque dejaría existencias negativas o incumple las reglas del Kardex."
    :params.error==="relation"?"La bodega seleccionada no pertenece a la empresa."
    :params.error?"Revisa artículo, movimiento, cantidad y bodegas.":"";
  const initialMovement=requestedType==="receipt"?"receipt":requestedType==="issue"?"issue":requestedType==="transfer"?"transfer":requestedType==="adjustment"?"adjustment_positive":"receipt";

  return <div className="phase7-inventory phase7-kardex">
    <ModuleHeader
      eyebrow="Inventario"
      title={sectionTitle(requestedType)}
      description="Historial auditable de entradas, salidas, ajustes, devoluciones y transferencias por bodega."
      count={transactions.rowCount||0}
      countLabel="movimientos"
      searchPlaceholder="Buscar SKU, producto, documento, MOVIMIENTO_ID, IMP, proveedor, bodega o lote"
      filters={[
        {value:"all",label:"Todos"},{value:"receipt",label:"Entradas"},{value:"issue",label:"Salidas"},
        {value:"adjustment",label:"Ajustes"},{value:"return",label:"Dev. a inventario"},{value:"supplier_return",label:"Dev. a proveedor"},{value:"transfer",label:"Transferencias"},
      ]}
      facets={[
        {key:"organization",label:"Empresa",allLabel:"Todas las empresas"},
        {key:"site",label:"Sede",allLabel:"Todas las sedes"},
        {key:"supplier",label:"Proveedor",allLabel:"Todos los proveedores"},
        {key:"warehouse",label:"Bodega",allLabel:"Todas las bodegas"},
      ]}
      action={<div className="module-header-action-group">
        <ModuleExportMenu entity="kardex" type={requestedType||undefined}/>
        {canWrite&&orgId?<CreateRecordModal title="Registrar movimiento" eyebrow="Kardex" description="El saldo se actualizará únicamente después de validar la existencia y las bodegas." triggerLabel="Nuevo movimiento" iconName="inventory">
        <form className="form-grid unified-popup-form" method="post" action="/api/inventory/movements">
          <div className="field form-span-2"><label>Artículo *</label><select name="item_id" required><option value="">Selecciona SKU / producto</option>{items.rows.map(item=><option key={item.id} value={item.id}>{item.sku} · {item.name}</option>)}</select></div>
          <div className="field"><label>Movimiento *</label><select name="movement_type" defaultValue={initialMovement} required><option value="receipt">Entrada</option><option value="issue">Salida</option><option value="adjustment_positive">Ajuste positivo</option><option value="adjustment_negative">Ajuste negativo</option><option value="return">Devolución a inventario</option><option value="transfer">Transferencia</option></select><small>Las devoluciones a proveedor se registran únicamente desde la requisición/recepción de origen.</small></div>
          <div className="field"><label>Cantidad *</label><input name="quantity" type="number" min="0.001" step="0.001" required/></div>
          <div className="field"><label>Bodega origen *</label><select name="warehouse_id" required><option value="">Selecciona</option>{warehouses.rows.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
          <div className="field"><label>Bodega destino</label><select name="destination_warehouse_id"><option value="">Solo para transferencia</option>{warehouses.rows.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
          <div className="field"><label>Fecha / hora</label><input name="movement_at" type="datetime-local"/></div>
          <div className="field"><label>Documento</label><input name="document_number" placeholder="OC, REQ, ajuste..."/></div>
          <div className="field"><label>Costo unitario</label><input name="unit_cost" type="number" min="0" step="0.01"/></div>
          <div className="field"><label>Lote</label><input name="lot_number"/></div>
          <div className="field"><label>Vencimiento</label><input name="expires_at" type="date"/></div>
          <div className="field"><label>Centro de costo</label><input name="cost_center"/></div>
          <div className="field form-span-2"><label>Observaciones</label><textarea name="notes" rows={3}/></div>
          <div className="form-span-2 form-actions"><button className="button" type="submit">Registrar movimiento</button></div>
        </form>
      </CreateRecordModal>:null}
      </div>}
    />
    <InventorySubnav active={activeSection(requestedType)}/>
    {params.created&&<div className="section"><Alert variant="success" title="Movimiento registrado">Existencias actualizadas correctamente en Kardex.</Alert></div>}
    {error&&<div className="section"><Alert variant="danger" title="Movimiento rechazado">{error}</Alert></div>}

    <section className="card section inventory-kardex-directory phase7-anchor">
      <div className="ds-data-table-shell inventory-kardex-table-wrap"><div className="ds-data-table-scroll"><table className="ds-data-table inventory-kardex-table"><thead><tr>
        <th>Fecha</th><th>Movimiento</th><th>SKU / producto</th><th>Documento</th><th>Bodega</th><th>Cantidad</th><th>Costo</th><th>Lote / centro</th><th>Usuario</th>
      </tr></thead><tbody>
        {transactions.rows.map(tx=>{
          const qty=Number(tx.quantity||0);
          const displayQty=tx.type==="issue"||tx.type==="supplier_return"?-Math.abs(qty):qty;
          return <tr key={tx.id} data-module-record data-status={tx.type}
            data-search={[tx.sku,tx.item_name,tx.document_number,tx.source_movement_id,tx.import_number?"IMP-"+new Date(tx.import_created_at||tx.movement_at).getFullYear()+"-"+tx.import_number.padStart(6,"0"):null,tx.supplier_name,tx.warehouse_name,tx.destination_name,tx.lot_number,tx.cost_center,tx.created_by_name,tx.requisition_number?"REQ-"+tx.requisition_number.padStart(6,"0"):null,tx.supplier_return_number?"DEV-"+tx.supplier_return_number.padStart(6,"0"):null].filter(Boolean).join(" ")}
            data-filter-organization={tx.organization_id} data-filter-organization-label={tx.organization_name}
            data-filter-site={tx.site_id||""} data-filter-site-label={tx.site_name||""}
            data-filter-supplier={tx.supplier_id||""} data-filter-supplier-label={tx.supplier_name||""}
            data-filter-warehouse={tx.warehouse_id||""} data-filter-warehouse-label={tx.warehouse_name||""}>
            <td><strong>{new Date(tx.movement_at).toLocaleDateString("es-CO")}</strong><small className="table-subline">{new Date(tx.movement_at).toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"})}</small></td>
            <td><Badge variant={typeTone(tx.type,qty)}>{typeLabel(tx.type,qty)}</Badge></td>
            <td><strong>{tx.sku}</strong><small className="table-subline">{tx.item_name} · {tx.supplier_name||"Sin proveedor"}</small></td>
            <td>{tx.document_number||"—"}{tx.source_movement_id?<small className="table-subline">MOV · {tx.source_movement_id}</small>:null}{tx.import_number?<small className="table-subline">IMP-{new Date(tx.import_created_at||tx.movement_at).getFullYear()}-{tx.import_number.padStart(6,"0")}</small>:null}{tx.supplier_return_number?<small className="table-subline">DEV-{tx.supplier_return_number.padStart(6,"0")}</small>:null}{tx.requisition_id&&tx.requisition_number?<Link className="table-subline kardex-requisition-link" href={"/dashboard/requisitions/"+tx.requisition_id}>REQ-{tx.requisition_number.padStart(6,"0")}</Link>:null}</td>
            <td>{tx.warehouse_name||"—"}{tx.destination_name?<small className="table-subline">→ {tx.destination_name}</small>:null}</td>
            <td><strong className={displayQty<0?"kardex-negative":"kardex-positive"}>{displayQty>0?"+":""}{displayQty} {tx.unit}</strong></td>
            <td>{tx.unit_cost?Number(tx.unit_cost).toLocaleString("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}):"—"}</td>
            <td>{tx.lot_number||"—"}<small className="table-subline">{tx.cost_center||""}{tx.expires_at?" · vence "+new Date(tx.expires_at+"T12:00:00").toLocaleDateString("es-CO"):""}</small></td>
            <td>{tx.created_by_name||"Sistema"}</td>
          </tr>;
        })}
      </tbody></table></div></div>
      {!transactions.rowCount&&<EmptyState icon="file" title="No hay movimientos para este filtro" description="Registra un movimiento o cambia la sección del Kardex."/>}
    </section>
  </div>;
}
