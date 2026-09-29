import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { organizationScopeFor } from "@/lib/organization-scope";
import { query } from "@/lib/db";
import ModuleHeader from "@/components/ModuleHeader";
import CreateRecordModal from "@/components/CreateRecordModal";
import InventorySubnav from "@/components/InventorySubnav";
import UiIcon from "@/components/UiIcon";
import { Alert, EmptyState } from "@/components/ui-kit/Feedback";
import { Badge } from "@/components/ui-kit/Badge";
import { StatTiles } from "@/components/ui-kit/Metrics";

type Warehouse={
  id:string;organization_id:string;organization_name:string;site_id:string|null;site_name:string|null;location_id:string|null;location_name:string|null;
  code:string;name:string;type:string;responsible:string|null;capacity:string|null;location_detail:string|null;notes:string|null;active:boolean;
  item_count:number;quantity:string;total_value:string;
};
type Site={id:string;organization_id:string;organization_name:string;name:string};
type Location={id:string;organization_id:string;organization_name:string;site_id:string;site_name:string;name:string};

function money(value:number){return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(value);}

export default async function InventoryWarehousesPage({searchParams}:{searchParams:Promise<{created?:string;updated?:string;error?:string}>}){
  const session=await getSession();
  if(!session)redirect("/login");
  if(!can(session,"inventory.read"))redirect("/dashboard");
  const feedback=await searchParams;
  const platform=session.platformRole!=="user";
  const canWrite=can(session,"inventory.write");
  const orgId=session.organizationId;
  const organizationScope=organizationScopeFor(session);
  const platformScopeParams:unknown[]=[organizationScope.unrestricted,organizationScope.organizationIds];
  const warehouseSql=`SELECT w.id,w.organization_id,o.name organization_name,w.site_id,s.name site_name,w.location_id,l.name location_name,
      w.code,w.name,w.type,w.responsible,w.capacity::text,w.location_detail,w.notes,w.active,
      count(DISTINCT sl.item_id)::int item_count,COALESCE(sum(sl.quantity),0)::text quantity,
      COALESCE(sum(sl.quantity*i.unit_cost),0)::text total_value
    FROM inventory_warehouses w JOIN organizations o ON o.id=w.organization_id
    LEFT JOIN sites s ON s.id=w.site_id LEFT JOIN locations l ON l.id=w.location_id
    LEFT JOIN inventory_stock_levels sl ON sl.warehouse_id=w.id
    LEFT JOIN inventory_items i ON i.id=sl.item_id`;
  const [warehouses,sites,locations]=await Promise.all([
    platform
      ?query<Warehouse>(warehouseSql+" WHERE ($1::boolean OR w.organization_id=ANY($2::uuid[])) GROUP BY w.id,o.name,s.name,l.name ORDER BY o.name,w.active DESC,w.name",platformScopeParams)
      :session.accessAllSites
        ?query<Warehouse>(warehouseSql+" WHERE w.organization_id=$1 GROUP BY w.id,o.name,s.name,l.name ORDER BY w.active DESC,w.name",[orgId])
        :query<Warehouse>(warehouseSql+" WHERE w.organization_id=$1 AND w.site_id=ANY($2::uuid[]) GROUP BY w.id,o.name,s.name,l.name ORDER BY w.active DESC,w.name",[orgId,session.siteIds]),
    canWrite
      ?platform
        ?query<Site>(
            "SELECT s.id,s.organization_id,o.name organization_name,s.name FROM sites s JOIN organizations o ON o.id=s.organization_id WHERE s.active=true AND ($1::boolean OR s.organization_id=ANY($2::uuid[])) ORDER BY o.name,s.name",
            platformScopeParams,
          )
        :session.accessAllSites
          ?query<Site>("SELECT s.id,s.organization_id,o.name organization_name,s.name FROM sites s JOIN organizations o ON o.id=s.organization_id WHERE s.organization_id=$1 AND s.active=true ORDER BY s.name",[orgId])
          :query<Site>("SELECT s.id,s.organization_id,o.name organization_name,s.name FROM sites s JOIN organizations o ON o.id=s.organization_id WHERE s.organization_id=$1 AND s.active=true AND s.id=ANY($2::uuid[]) ORDER BY s.name",[orgId,session.siteIds])
      :Promise.resolve({rows:[]} as {rows:Site[]}),
    canWrite
      ?platform
        ?query<Location>(
            "SELECT l.id,l.organization_id,o.name organization_name,l.site_id,s.name site_name,l.name FROM locations l JOIN organizations o ON o.id=l.organization_id JOIN sites s ON s.id=l.site_id WHERE l.active=true AND ($1::boolean OR l.organization_id=ANY($2::uuid[])) ORDER BY o.name,s.name,l.name",
            platformScopeParams,
          )
        :session.accessAllSites
          ?query<Location>("SELECT l.id,l.organization_id,o.name organization_name,l.site_id,s.name site_name,l.name FROM locations l JOIN organizations o ON o.id=l.organization_id JOIN sites s ON s.id=l.site_id WHERE l.organization_id=$1 AND l.active=true ORDER BY l.name",[orgId])
          :query<Location>("SELECT l.id,l.organization_id,o.name organization_name,l.site_id,s.name site_name,l.name FROM locations l JOIN organizations o ON o.id=l.organization_id JOIN sites s ON s.id=l.site_id WHERE l.organization_id=$1 AND l.active=true AND l.site_id=ANY($2::uuid[]) ORDER BY l.name",[orgId,session.siteIds])
      :Promise.resolve({rows:[]} as {rows:Location[]}),
  ]);
  const error=feedback.error==="duplicate"?"Ya existe un almacén con ese código."
    :feedback.error==="relation"?"La sede o sububicación no corresponde a la empresa."
    :feedback.error?"Completa los datos obligatorios del almacén.":"";

  return <div className="phase7-inventory">
    <ModuleHeader
      eyebrow="Inventario"
      title="Almacenes / Bodegas"
      description="Existencias separadas por punto físico, responsable y capacidad."
      count={warehouses.rowCount||0}
      countLabel="almacenes"
      searchPlaceholder="Buscar almacén, código, sede, responsable o empresa"
      filters={[{value:"all",label:"Todos"},{value:"active",label:"Activos"},{value:"inactive",label:"Inactivos"}]}
      facets={[
        {key:"organization",label:"Empresa",allLabel:"Todas las empresas"},
        {key:"site",label:"Sede",allLabel:"Todas las sedes"},
      ]}
      action={canWrite&&sites.rows.length?<CreateRecordModal title="Nuevo almacén" eyebrow="Inventario físico" description="Define dónde se almacenan existencias y quién responde por ellas." triggerLabel="Nuevo almacén" iconName="inventory">
        <form className="form-grid unified-popup-form" method="post" action="/api/inventory/warehouses">
          <div className="field"><label>Sede *</label><select name="site_id" required><option value="">Selecciona sede</option>{sites.rows.map(site=><option value={site.id} key={site.id}>{platform?site.organization_name+" · "+site.name:site.name}</option>)}</select></div>
          <div className="field"><label>Sububicación</label><select name="location_id"><option value="">Sin sububicación específica</option>{locations.rows.map(location=><option value={location.id} key={location.id}>{platform?location.organization_name+" · "+location.site_name+" · "+location.name:location.name}</option>)}</select></div>
          <div className="field"><label>Nombre *</label><input name="name" required placeholder="Ej. Bodega técnica"/></div>
          <div className="field"><label>Código</label><input name="code" placeholder="Ej. BOD-TEC"/></div>
          <div className="field"><label>Tipo</label><input name="type" defaultValue="storage" placeholder="Almacenamiento, técnica, oficina..."/></div>
          <div className="field"><label>Responsable</label><input name="responsible" placeholder="Nombre o cargo"/></div>
          <div className="field"><label>Capacidad</label><input name="capacity" type="number" min="0" step="0.001"/></div>
          <div className="field"><label>Ubicación detalle</label><input name="location_detail" placeholder="Piso, zona, estante general..."/></div>
          <div className="field form-span-2"><label>Observaciones</label><textarea name="notes" rows={3}/></div>
          <div className="form-span-2 form-actions"><button className="button" type="submit">Crear almacén</button></div>
        </form>
      </CreateRecordModal>:undefined}
    />
    <InventorySubnav active="warehouses"/>
    {(feedback.created||feedback.updated)&&<div className="section phase7-feedback-stack">
      {feedback.created&&<Alert variant="success" title="Almacén creado">Almacén creado correctamente.</Alert>}
      {feedback.updated&&<Alert variant="success" title="Almacén actualizado">Almacén actualizado correctamente.</Alert>}
    </div>}
    {error&&<div className="section"><Alert variant="danger" title="Revisa el almacén">{error}</Alert></div>}

    <section className="section inventory-warehouse-grid">
      {warehouses.rows.map(warehouse=><article key={warehouse.id} className={"card inventory-warehouse-card "+(warehouse.active?"":"inactive")}
        data-module-record data-status={warehouse.active?"active":"inactive"}
        data-search={[warehouse.code,warehouse.name,warehouse.organization_name,warehouse.site_name,warehouse.location_name,warehouse.responsible,warehouse.location_detail].filter(Boolean).join(" ")}
        data-filter-organization={warehouse.organization_id} data-filter-organization-label={warehouse.organization_name}
        data-filter-site={warehouse.site_id||""} data-filter-site-label={warehouse.site_name||""}>
        <div className="inventory-warehouse-head"><span><UiIcon name="location" size={22}/></span><div><small>{warehouse.code}</small><strong>{warehouse.name}</strong><em>{warehouse.organization_name} · {warehouse.site_name||"Sin sede"}{warehouse.location_name?" · "+warehouse.location_name:""}</em></div><Badge variant={warehouse.active?"success":"neutral"}>{warehouse.active?"Activo":"Inactivo"}</Badge></div>
        <StatTiles className="inventory-warehouse-metrics" items={[
          {label:"Productos",value:String(warehouse.item_count)},
          {label:"Existencias",value:Number(warehouse.quantity||0).toLocaleString("es-CO")},
          {label:"Valor",value:money(Number(warehouse.total_value||0))},
          {label:"Capacidad",value:warehouse.capacity||"—"},
        ]}/>
        <div className="inventory-warehouse-copy"><span>Responsable</span><strong>{warehouse.responsible||"Sin registrar"}</strong><small>{warehouse.location_detail||warehouse.notes||"Sin observaciones"}</small></div>
        {canWrite&&<div className="inventory-category-actions">
          <details><summary className="button secondary"><UiIcon name="edit" size={14}/> Editar</summary>
            <form className="inventory-popover-form form-grid" method="post" action={"/api/inventory/warehouses/"+warehouse.id}>
              <div className="field"><label>Sede *</label><select name="site_id" defaultValue={warehouse.site_id||""} required><option value="">Selecciona</option>{sites.rows.filter(site=>site.organization_id===warehouse.organization_id).map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select></div>
              <div className="field"><label>Sububicación</label><select name="location_id" defaultValue={warehouse.location_id||""}><option value="">Sin sububicación</option>{locations.rows.filter(location=>location.organization_id===warehouse.organization_id).map(location=><option key={location.id} value={location.id}>{location.name}</option>)}</select></div>
              <div className="field"><label>Nombre</label><input name="name" defaultValue={warehouse.name} required/></div>
              <div className="field"><label>Código</label><input name="code" defaultValue={warehouse.code}/></div>
              <div className="field"><label>Tipo</label><input name="type" defaultValue={warehouse.type}/></div>
              <div className="field"><label>Responsable</label><input name="responsible" defaultValue={warehouse.responsible||""}/></div>
              <div className="field"><label>Capacidad</label><input name="capacity" type="number" min="0" step="0.001" defaultValue={warehouse.capacity||""}/></div>
              <div className="field"><label>Ubicación detalle</label><input name="location_detail" defaultValue={warehouse.location_detail||""}/></div>
              <div className="field form-span-2"><label>Observaciones</label><textarea name="notes" defaultValue={warehouse.notes||""}/></div>
              <div className="form-span-2 form-actions"><button className="button" type="submit">Guardar</button></div>
            </form>
          </details>
          <form method="post" action={"/api/inventory/warehouses/"+warehouse.id}><input type="hidden" name="intent" value="toggle"/><input type="hidden" name="active" value={warehouse.active?"false":"true"}/><button className="button secondary" type="submit"><UiIcon name="power" size={14}/>{warehouse.active?"Desactivar":"Activar"}</button></form>
        </div>}
      </article>)}
      {!warehouses.rowCount&&<EmptyState icon="file" title="No hay almacenes registrados" description="Crea uno o impórtalo desde la plantilla de Inventario/Kardex."/>}
    </section>
  </div>;
}
