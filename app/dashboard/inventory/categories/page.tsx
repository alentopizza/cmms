import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import ModuleHeader from "@/components/ModuleHeader";
import CreateRecordModal from "@/components/CreateRecordModal";
import InventorySubnav from "@/components/InventorySubnav";
import UiIcon from "@/components/UiIcon";

type Category={
  id:string;organization_id:string;organization_name:string;code:string;name:string;active:boolean;
  item_count:number;quantity:string;total_value:string;
};

function money(value:number){
  return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(value);
}

export default async function InventoryCategoriesPage({searchParams}:{searchParams:Promise<{created?:string;updated?:string;error?:string}>}){
  const session=await getSession();
  if(!session)redirect("/login");
  if(!can(session,"inventory.read"))redirect("/dashboard");
  const feedback=await searchParams;
  const platform=session.platformRole!=="user";
  const canWrite=can(session,"inventory.write");
  const sql=`SELECT c.id,c.organization_id,o.name organization_name,c.code,c.name,c.active,
      count(i.id)::int item_count,COALESCE(sum(i.quantity),0)::text quantity,
      COALESCE(sum(i.quantity*i.unit_cost),0)::text total_value
    FROM inventory_categories c
    JOIN organizations o ON o.id=c.organization_id
    LEFT JOIN inventory_items i ON i.category_id=c.id AND i.active=true`;
  const result=platform
    ?await query<Category>(sql+" GROUP BY c.id,o.name ORDER BY o.name,c.active DESC,c.name")
    :await query<Category>(sql+" WHERE c.organization_id=$1 GROUP BY c.id,o.name ORDER BY c.active DESC,c.name",[session.organizationId]);

  const error=feedback.error==="duplicate"?"Ya existe una categoría con ese código o nombre."
    :feedback.error?"Completa los datos requeridos.":"";

  return <>
    <ModuleHeader
      eyebrow="Inventario"
      title="Categorías"
      description="Clasificación estandarizada para productos, repuestos y suministros."
      count={result.rowCount||0}
      countLabel="categorías"
      searchPlaceholder="Buscar categoría, código o empresa"
      filters={[{value:"all",label:"Todas"},{value:"active",label:"Activas"},{value:"inactive",label:"Inactivas"}]}
      facets={[{key:"organization",label:"Empresa",allLabel:"Todas las empresas"}]}
      action={canWrite&&session.organizationId?<CreateRecordModal title="Nueva categoría" eyebrow="Catálogo de inventario" description="Crea una categoría reutilizable para mantener datos consistentes." triggerLabel="Nueva categoría" icon="▤">
        <form className="form-grid unified-popup-form" method="post" action="/api/inventory/categories">
          <div className="field"><label>Nombre *</label><input name="name" required placeholder="Ej. Refrigeración"/></div>
          <div className="field"><label>Código</label><input name="code" placeholder="Ej. REF"/></div>
          <div className="form-span-2 form-actions"><button className="button" type="submit">Crear categoría</button></div>
        </form>
      </CreateRecordModal>:undefined}
    />
    <InventorySubnav active="categories"/>
    {feedback.created&&<div className="notice success section">Categoría creada correctamente.</div>}
    {feedback.updated&&<div className="notice success section">Categoría actualizada correctamente.</div>}
    {error&&<div className="notice error section">{error}</div>}

    <section className="section inventory-category-grid">
      {result.rows.map(category=><article key={category.id} className={"card inventory-category-card "+(category.active?"":"inactive")}
        data-module-record data-status={category.active?"active":"inactive"}
        data-search={[category.code,category.name,category.organization_name].join(" ")}
        data-filter-organization={category.organization_id} data-filter-organization-label={category.organization_name}>
        <div className="inventory-category-card-head">
          <span><UiIcon name="file" size={19}/></span>
          <div><small>{category.code}</small><strong>{category.name}</strong><em>{category.organization_name}</em></div>
          <b className={category.active?"status active":"status"}>{category.active?"Activa":"Inactiva"}</b>
        </div>
        <div className="inventory-category-metrics">
          <div><span>Productos</span><strong>{category.item_count}</strong></div>
          <div><span>Unidades</span><strong>{Number(category.quantity||0).toLocaleString("es-CO")}</strong></div>
          <div><span>Valor</span><strong>{money(Number(category.total_value||0))}</strong></div>
        </div>
        {canWrite&&session.organizationId===category.organization_id&&<div className="inventory-category-actions">
          <details><summary className="button secondary"><UiIcon name="edit" size={14}/> Editar</summary>
            <form method="post" action={"/api/inventory/categories/"+category.id} className="inventory-popover-form">
              <div className="field"><label>Nombre</label><input name="name" defaultValue={category.name} required/></div>
              <div className="field"><label>Código</label><input name="code" defaultValue={category.code}/></div>
              <button className="button" type="submit">Guardar</button>
            </form>
          </details>
          <form method="post" action={"/api/inventory/categories/"+category.id}>
            <input type="hidden" name="intent" value="toggle"/>
            <input type="hidden" name="active" value={category.active?"false":"true"}/>
            <button className="button secondary" type="submit"><UiIcon name="power" size={14}/>{category.active?"Desactivar":"Activar"}</button>
          </form>
        </div>}
      </article>)}
      {!result.rowCount&&<div className="card empty-state"><strong>No hay categorías.</strong><span>Crea la primera categoría o impórtala junto con el inventario.</span></div>}
    </section>
  </>;
}
