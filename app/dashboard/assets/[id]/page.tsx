import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { RoutineCreateModal } from "@/components/ContextCreateModals";
import FileDropzone from "@/components/FileDropzone";
import UiIcon from "@/components/UiIcon";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AssetDetail={
  id:string;organization_id:string;site_id:string;location_id:string|null;supplier_id:string|null;category_id:string|null;
  code:string;name:string;description:string|null;manufacturer:string|null;model:string|null;serial_number:string|null;
  status:string;criticality:string;purchase_date:string|null;installation_date:string|null;warranty_expires:string|null;
  purchase_cost:string|null;location_detail:string|null;notes:string|null;organization_name:string;site_name:string;
  location_name:string|null;supplier_name:string|null;category_name:string|null;has_image:boolean;
};
type Plan={id:string;name:string;frequency_value:number;frequency_unit:string;next_due_at:string|null;estimated_minutes:number|null;active:boolean};
type Site={id:string;name:string};
type Location={id:string;site_id:string;name:string};
type Supplier={id:string;name:string};
type Category={id:string;name:string};

function statusLabel(value:string){
  return ({operational:"Operativo",maintenance:"En mantenimiento",down:"Fuera de servicio",retired:"Retirado"} as Record<string,string>)[value]||value;
}
function criticalityLabel(value:string){
  return ({low:"Baja",medium:"Media",high:"Alta",critical:"Crítica"} as Record<string,string>)[value]||value;
}
function money(value:number){
  return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(value);
}

export default async function AssetDetailPage({
  params,
  searchParams,
}:{
  params:Promise<{id:string}>;
  searchParams:Promise<{created?:string;updated?:string;error?:string}>;
}) {
  const session=await getSession();
  if(!session) redirect("/login");
  if(!can(session,"assets.read")) redirect("/dashboard");

  const [{id},feedback]=await Promise.all([params,searchParams]);
  if(!UUID.test(id)) notFound();

  const assetResult=await query<AssetDetail>(
    `SELECT a.id,a.organization_id,a.site_id,a.location_id,a.supplier_id,a.category_id,a.code,a.name,a.description,a.manufacturer,a.model,a.serial_number,
            a.status,a.criticality,a.purchase_date::text,a.installation_date::text,a.warranty_expires::text,a.purchase_cost::text,a.location_detail,a.notes,
            o.name organization_name,s.name site_name,l.name location_name,p.name supplier_name,c.name category_name,
            (a.image_data IS NOT NULL) has_image
     FROM assets a
     JOIN organizations o ON o.id=a.organization_id
     JOIN sites s ON s.id=a.site_id
     LEFT JOIN locations l ON l.id=a.location_id
     LEFT JOIN suppliers p ON p.id=a.supplier_id
     LEFT JOIN asset_categories c ON c.id=a.category_id
     WHERE a.id=$1`,
    [id],
  );
  if(!assetResult.rowCount) notFound();
  const asset=assetResult.rows[0];

  if(session.platformRole==="user"){
    if(session.organizationId!==asset.organization_id || !canAccessSite(session,asset.site_id)) redirect("/dashboard/assets");
  }

  const canWrite=can(session,"assets.write");
  const [plans,sites,locations,suppliers,categories]=await Promise.all([
    query<Plan>(
      `SELECT id,name,frequency_value,frequency_unit,next_due_at::text,estimated_minutes,active
       FROM maintenance_plans WHERE asset_id=$1 ORDER BY active DESC,next_due_at NULLS LAST,name`,
      [asset.id],
    ),
    canWrite?query<Site>("SELECT id,name FROM sites WHERE organization_id=$1 AND active=true ORDER BY name",[asset.organization_id]):Promise.resolve({rows:[]} as {rows:Site[]}),
    canWrite?query<Location>("SELECT id,site_id,name FROM locations WHERE organization_id=$1 AND active=true ORDER BY name",[asset.organization_id]):Promise.resolve({rows:[]} as {rows:Location[]}),
    canWrite?query<Supplier>("SELECT id,name FROM suppliers WHERE organization_id=$1 AND active=true ORDER BY name",[asset.organization_id]):Promise.resolve({rows:[]} as {rows:Supplier[]}),
    canWrite?query<Category>("SELECT id,name FROM asset_categories WHERE organization_id=$1 ORDER BY name",[asset.organization_id]):Promise.resolve({rows:[]} as {rows:Category[]}),
  ]);

  const canCreateRoutine=can(session,"maintenance.write") && asset.status!=="retired";
  const error=feedback.error==="code"?"El código interno ya existe en esta empresa."
    :feedback.error==="relation"?"La sede, sububicación o proveedor seleccionado no corresponde a la empresa."
    :feedback.error?"Revisa los datos del activo e inténtalo nuevamente.":"";

  return <>
    <nav className="entity-breadcrumbs" aria-label="Migas de pan">
      <Link href="/dashboard"><UiIcon name="home" size={13}/> Inicio</Link><span className="entity-breadcrumb-separator"><UiIcon name="chevron-right" size={13}/></span>
      <Link href="/dashboard/assets">Activos</Link><span className="entity-breadcrumb-separator"><UiIcon name="chevron-right" size={13}/></span>
      <span className="current">{asset.code}</span>
    </nav>

    <header className="entity-profile-page-head">
      <div className="entity-profile-page-identity">
        <span className="entity-profile-page-icon"><UiIcon name="asset" size={27}/></span>
        <div><span className="eyebrow">Ficha técnica</span><h1>{asset.name}</h1><p>{asset.code} · {asset.organization_name} · {asset.site_name}</p></div>
      </div>
      <div className="entity-profile-toolbar-actions">
        <span className={"status-badge "+(asset.status==="operational"?"status-active":"")}><i/>{statusLabel(asset.status)}</span>
        {canCreateRoutine&&<RoutineCreateModal
          assets={[{id:asset.id,organization_id:asset.organization_id,site_id:asset.site_id,name:asset.name,code:asset.code,label:asset.code+" · "+asset.name}]}
          fixedAssetId={asset.id}
          fixedAssetName={asset.code+" · "+asset.name}
          returnTo={"/dashboard/assets/"+asset.id}
        />}
        <Link className="button secondary" href="/dashboard/assets">Volver</Link>
      </div>
    </header>

    {feedback.created==="routine"&&<div className="notice success section">Rutina creada y asociada a este activo.</div>}
    {feedback.updated&&<div className="notice success section">Activo actualizado correctamente.</div>}
    {error&&<div className="notice error section">{error}</div>}

    <section className="asset-detail-grid section">
      <article className="card asset-detail-card">
        <div className="asset-detail-visual-head">
          <span className={"asset-detail-photo"+(asset.has_image?" has-image":"")}>{asset.has_image?<img src={"/api/assets/"+asset.id+"/image"} alt="" />:<UiIcon name="asset" size={40}/>}</span>
          <div><span className="eyebrow">Identificación</span><h2>{asset.name}</h2><p>{asset.code} · {asset.category_name||"Sin categoría"}</p></div>
        </div>
        <div className="asset-detail-meta">
          <div><span>Empresa</span><strong>{asset.organization_name}</strong></div>
          <div><span>Sede</span><strong>{asset.site_name}</strong></div>
          <div><span>Sububicación</span><strong>{asset.location_name||"Sin sububicación"}</strong></div>
          <div><span>Proveedor</span><strong>{asset.supplier_name||"Sin proveedor"}</strong></div>
          <div><span>Criticidad</span><strong>{criticalityLabel(asset.criticality)}</strong></div>
          <div><span>Fabricante / modelo</span><strong>{[asset.manufacturer,asset.model].filter(Boolean).join(" · ")||"Sin registrar"}</strong></div>
          <div><span>Serial</span><strong>{asset.serial_number||"Sin registrar"}</strong></div>
          <div><span>Costo compra</span><strong>{asset.purchase_cost?money(Number(asset.purchase_cost)):"Sin registrar"}</strong></div>
        </div>
        {asset.description&&<p className="asset-detail-description">{asset.description}</p>}
      </article>

      <article className="card asset-routine-summary">
        <span className="eyebrow">Mantenimiento</span>
        <strong>{plans.rowCount}</strong>
        <span>rutinas asociadas</span>
        <small>{asset.installation_date?"Instalado "+new Date(asset.installation_date+"T12:00:00").toLocaleDateString("es-CO"):"Fecha de instalación sin registrar"}</small>
        {canCreateRoutine&&<RoutineCreateModal
          assets={[{id:asset.id,organization_id:asset.organization_id,site_id:asset.site_id,name:asset.name,code:asset.code}]}
          fixedAssetId={asset.id}
          fixedAssetName={asset.name}
          returnTo={"/dashboard/assets/"+asset.id}
          triggerLabel="Agregar rutina"
          secondary
        />}
      </article>
    </section>

    {canWrite&&<section className="card section asset-edit-panel">
      <div className="section-heading"><div><span className="eyebrow">Edición</span><h2>Datos técnicos del activo</h2><p className="muted">Actualiza ubicación, proveedor, estado, identificación, fechas e imagen sin perder el historial de mantenimiento.</p></div></div>
      <form className="form-grid" method="post" encType="multipart/form-data" action={"/api/assets/"+asset.id}>
        <div className="field"><label>Sede *</label><select name="site_id" defaultValue={asset.site_id} required>{sites.rows.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select></div>
        <div className="field"><label>Sububicación *</label><select name="location_id" defaultValue={asset.location_id||""} required><option value="">Selecciona</option>{locations.rows.map(location=><option key={location.id} value={location.id}>{location.name}</option>)}</select></div>
        <div className="field"><label>Proveedor *</label><select name="supplier_id" defaultValue={asset.supplier_id||""} required><option value="">Selecciona</option>{suppliers.rows.map(supplier=><option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>
        <div className="field"><label>Categoría</label><input name="category" list={"asset-categories-"+asset.id} defaultValue={asset.category_name||""}/><datalist id={"asset-categories-"+asset.id}>{categories.rows.map(category=><option key={category.id} value={category.name}/>)}</datalist></div>

        <div className="field"><label>Código *</label><input name="code" defaultValue={asset.code} required/></div>
        <div className="field"><label>Nombre *</label><input name="name" defaultValue={asset.name} required/></div>
        <div className="field form-span-2"><label>Descripción</label><textarea name="description" rows={3} defaultValue={asset.description||""}/></div>

        <div className="field"><label>Fabricante</label><input name="manufacturer" defaultValue={asset.manufacturer||""}/></div>
        <div className="field"><label>Modelo</label><input name="model" defaultValue={asset.model||""}/></div>
        <div className="field"><label>Serial</label><input name="serial_number" defaultValue={asset.serial_number||""}/></div>
        <div className="field"><label>Estado</label><select name="status" defaultValue={asset.status}><option value="operational">Operativo</option><option value="maintenance">En mantenimiento</option><option value="down">Fuera de servicio</option><option value="retired">Retirado</option></select></div>
        <div className="field"><label>Criticidad</label><select name="criticality" defaultValue={asset.criticality}><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option></select></div>
        <div className="field"><label>Costo compra</label><input name="purchase_cost" type="number" min="0" step="0.01" defaultValue={asset.purchase_cost||""}/></div>

        <div className="field"><label>Fecha compra</label><input name="purchase_date" type="date" defaultValue={asset.purchase_date||""}/></div>
        <div className="field"><label>Fecha instalación</label><input name="installation_date" type="date" defaultValue={asset.installation_date||""}/></div>
        <div className="field"><label>Garantía vence</label><input name="warranty_expires" type="date" defaultValue={asset.warranty_expires||""}/></div>
        <div className="field"><label>Ubicación detalle</label><input name="location_detail" defaultValue={asset.location_detail||""} placeholder="Equipo, cuarto, rack, posición..."/></div>
        <div className="field form-span-2"><label>Notas</label><textarea name="notes" rows={3} defaultValue={asset.notes||""}/></div>

        <div className="form-span-2"><FileDropzone
          name="image"
          label="Imagen del activo"
          description="Reemplaza la imagen de referencia sin afectar rutinas, órdenes ni historial."
          accept="image/png,image/jpeg,image/webp"
          maxSizeMb={5}
          kind="image"
          existingFileName={asset.has_image?"Imagen actual":null}
          existingPreviewUrl={asset.has_image?"/api/assets/"+asset.id+"/image":null}
        /></div>
        <div className="form-span-2 form-actions"><button className="button" type="submit">Guardar activo</button></div>
      </form>
    </section>}

    <section className="section">
      <div className="section-heading"><div><span className="eyebrow">Rutinas del activo</span><h2>Mantenimiento preventivo</h2></div><small>El activo ya queda seleccionado al crear desde aquí.</small></div>
      {plans.rowCount?<div className="card inventory-kardex-table-wrap"><table className="table"><thead><tr><th>Rutina</th><th>Frecuencia</th><th>Próxima ejecución</th><th>Duración</th><th>Estado</th></tr></thead><tbody>
        {plans.rows.map(plan=><tr key={plan.id}><td><strong>{plan.name}</strong></td><td>Cada {plan.frequency_value} {plan.frequency_unit}</td><td>{plan.next_due_at?new Date(plan.next_due_at).toLocaleDateString("es-CO"):"Sin programar"}</td><td>{plan.estimated_minutes?plan.estimated_minutes+" min":"Sin estimar"}</td><td><span className={"status-badge "+(plan.active?"status-active":"status-inactive")}><i/>{plan.active?"Activa":"Inactiva"}</span></td></tr>)}
      </tbody></table></div>:<div className="card empty-state"><strong>Este activo aún no tiene rutinas.</strong><span>Usa “Agregar rutina” y el activo quedará asociado automáticamente.</span></div>}
    </section>
  </>;
}
