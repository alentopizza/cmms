import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessSite, getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { RoutineCreateModal } from "@/components/ContextCreateModals";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AssetDetail={
  id:string;
  organization_id:string;
  site_id:string;
  code:string;
  name:string;
  description:string|null;
  manufacturer:string|null;
  model:string|null;
  serial_number:string|null;
  status:string;
  criticality:string;
  organization_name:string;
  site_name:string;
  location_name:string|null;
  supplier_name:string|null;
};

type Plan={
  id:string;
  name:string;
  frequency_value:number;
  frequency_unit:string;
  next_due_at:string|null;
  estimated_minutes:number|null;
  active:boolean;
};

export default async function AssetDetailPage({
  params,
  searchParams,
}:{
  params:Promise<{id:string}>;
  searchParams:Promise<{created?:string;error?:string}>;
}) {
  const session=await getSession();
  if(!session) redirect("/login");
  if(!can(session,"assets.read")) redirect("/dashboard");

  const [{id},feedback]=await Promise.all([params,searchParams]);
  if(!UUID.test(id)) notFound();

  const assetResult=await query<AssetDetail>(
    `SELECT a.id,a.organization_id,a.site_id,a.code,a.name,a.description,a.manufacturer,a.model,a.serial_number,
            a.status,a.criticality,o.name organization_name,s.name site_name,l.name location_name,p.name supplier_name
     FROM assets a
     JOIN organizations o ON o.id=a.organization_id
     JOIN sites s ON s.id=a.site_id
     LEFT JOIN locations l ON l.id=a.location_id
     LEFT JOIN suppliers p ON p.id=a.supplier_id
     WHERE a.id=$1`,
    [id],
  );
  if(!assetResult.rowCount) notFound();
  const asset=assetResult.rows[0];

  if(session.platformRole!=="superadmin"){
    if(session.organizationId!==asset.organization_id || !canAccessSite(session,asset.site_id)) redirect("/dashboard/assets");
  }

  const plans=await query<Plan>(
    `SELECT id,name,frequency_value,frequency_unit,next_due_at::text,estimated_minutes,active
     FROM maintenance_plans WHERE asset_id=$1 ORDER BY active DESC,next_due_at NULLS LAST,name`,
    [asset.id],
  );

  const canCreateRoutine=can(session,"maintenance.write") && asset.status!=="retired";

  return <>
    <header className="page-header">
      <div>
        <Link className="back-link" href="/dashboard/assets">← Activos</Link>
        <span className="eyebrow">Activo {asset.code}</span>
        <h1 className="page-title">{asset.name}</h1>
        <p className="muted">{asset.organization_name} · {asset.site_name}{asset.location_name?" · "+asset.location_name:""}</p>
      </div>
      <div className="page-header-actions">
        <span className={"status-badge "+(asset.status==="operational"?"status-active":"")}><i />{asset.status}</span>
        {canCreateRoutine && <RoutineCreateModal
          assets={[{id:asset.id,organization_id:asset.organization_id,site_id:asset.site_id,name:asset.name,code:asset.code,label:asset.code+" · "+asset.name}]}
          fixedAssetId={asset.id}
          fixedAssetName={asset.code+" · "+asset.name}
          returnTo={"/dashboard/assets/"+asset.id}
        />}
      </div>
    </header>

    {feedback.created==="routine" && <div className="notice success section">Rutina creada y asociada a este activo.</div>}
    {feedback.error && <div className="notice error section">No fue posible crear la rutina. Revisa los datos e inténtalo nuevamente.</div>}

    <section className="asset-detail-grid section">
      <article className="card asset-detail-card">
        <div className="section-heading"><div><span className="eyebrow">Relaciones</span><h2>Contexto del activo</h2></div></div>
        <div className="asset-detail-meta">
          <div><span>Empresa</span><strong>{asset.organization_name}</strong></div>
          <div><span>Sede</span><strong>{asset.site_name}</strong></div>
          <div><span>Sububicación</span><strong>{asset.location_name||"Sin sububicación"}</strong></div>
          <div><span>Proveedor</span><strong>{asset.supplier_name||"Sin proveedor"}</strong></div>
          <div><span>Criticidad</span><strong>{asset.criticality}</strong></div>
          <div><span>Fabricante / modelo</span><strong>{[asset.manufacturer,asset.model].filter(Boolean).join(" · ")||"Sin registrar"}</strong></div>
        </div>
      </article>

      <article className="card asset-routine-summary">
        <span className="eyebrow">Mantenimiento</span>
        <strong>{plans.rowCount}</strong>
        <span>rutinas asociadas</span>
        {canCreateRoutine && <RoutineCreateModal
          assets={[{id:asset.id,organization_id:asset.organization_id,site_id:asset.site_id,name:asset.name,code:asset.code}]}
          fixedAssetId={asset.id}
          fixedAssetName={asset.name}
          returnTo={"/dashboard/assets/"+asset.id}
          triggerLabel="Agregar rutina"
          secondary
        />}
      </article>
    </section>

    <section className="section">
      <div className="section-heading"><div><span className="eyebrow">Rutinas del activo</span><h2>Mantenimiento preventivo</h2></div><small>El activo ya queda seleccionado al crear desde aquí.</small></div>
      {plans.rowCount ? <table className="table"><thead><tr><th>Rutina</th><th>Frecuencia</th><th>Próxima ejecución</th><th>Duración</th><th>Estado</th></tr></thead><tbody>
        {plans.rows.map(plan=><tr key={plan.id}><td><strong>{plan.name}</strong></td><td>Cada {plan.frequency_value} {plan.frequency_unit}</td><td>{plan.next_due_at?new Date(plan.next_due_at).toLocaleDateString("es-CO"):"Sin programar"}</td><td>{plan.estimated_minutes?plan.estimated_minutes+" min":"Sin estimar"}</td><td><span className={"status-badge "+(plan.active?"status-active":"status-inactive")}><i />{plan.active?"Activa":"Inactiva"}</span></td></tr>)}
      </tbody></table> : <div className="card empty-state"><strong>Este activo aún no tiene rutinas.</strong><span>Usa “Nueva rutina” y el activo quedará asociado automáticamente.</span></div>}
    </section>
  </>;
}
