import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { RoutineCreateModal } from "@/components/ContextCreateModals";

type AssetOption={id:string;organization_id:string;site_id:string;name:string;code:string;label:string};

export default async function MaintenancePage({searchParams}:{searchParams:Promise<{created?:string;error?:string}>}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session, "maintenance.read")) redirect("/dashboard");
  const feedback=await searchParams;
  const canWrite=can(session,"maintenance.write");

  const plans = session.platformRole !== "user"
    ? await query<{id:string;name:string;asset:string;company:string;frequency_value:number;frequency_unit:string;next_due_at:string|null;active:boolean}>(
        `SELECT p.id,p.name,a.name asset,o.name company,p.frequency_value,p.frequency_unit,p.next_due_at::text,p.active
         FROM maintenance_plans p JOIN assets a ON a.id=p.asset_id JOIN organizations o ON o.id=p.organization_id
         ORDER BY p.next_due_at NULLS LAST,p.name LIMIT 200`)
    : session.accessAllSites
      ? await query<{id:string;name:string;asset:string;company:string;frequency_value:number;frequency_unit:string;next_due_at:string|null;active:boolean}>(
          `SELECT p.id,p.name,a.name asset,o.name company,p.frequency_value,p.frequency_unit,p.next_due_at::text,p.active
           FROM maintenance_plans p JOIN assets a ON a.id=p.asset_id JOIN organizations o ON o.id=p.organization_id
           WHERE p.organization_id=$1 ORDER BY p.next_due_at NULLS LAST,p.name LIMIT 200`, [session.organizationId])
      : await query<{id:string;name:string;asset:string;company:string;frequency_value:number;frequency_unit:string;next_due_at:string|null;active:boolean}>(
          `SELECT p.id,p.name,a.name asset,o.name company,p.frequency_value,p.frequency_unit,p.next_due_at::text,p.active
           FROM maintenance_plans p JOIN assets a ON a.id=p.asset_id JOIN organizations o ON o.id=p.organization_id
           WHERE p.organization_id=$1 AND a.site_id = ANY($2::uuid[])
           ORDER BY p.next_due_at NULLS LAST,p.name LIMIT 200`, [session.organizationId, session.siteIds]);

  const assets=canWrite
    ? session.platformRole!=="user"
      ? await query<AssetOption>(
          `SELECT a.id,a.organization_id,a.site_id,a.name,a.code,o.name||' · '||s.name||' · '||a.code||' '||a.name label
           FROM assets a JOIN organizations o ON o.id=a.organization_id JOIN sites s ON s.id=a.site_id
           WHERE a.status<>'retired' ORDER BY o.name,s.name,a.name`)
      : session.accessAllSites
        ? await query<AssetOption>(
            `SELECT a.id,a.organization_id,a.site_id,a.name,a.code,s.name||' · '||a.code||' '||a.name label
             FROM assets a JOIN sites s ON s.id=a.site_id
             WHERE a.organization_id=$1 AND a.status<>'retired' ORDER BY s.name,a.name`,
            [session.organizationId])
        : await query<AssetOption>(
            `SELECT a.id,a.organization_id,a.site_id,a.name,a.code,s.name||' · '||a.code||' '||a.name label
             FROM assets a JOIN sites s ON s.id=a.site_id
             WHERE a.organization_id=$1 AND a.status<>'retired' AND a.site_id=ANY($2::uuid[])
             ORDER BY s.name,a.name`,
            [session.organizationId,session.siteIds])
    : {rows:[]} as {rows:AssetOption[]};

  return <>
    <header className="page-header">
      <div><span className="eyebrow">Mantenimiento preventivo</span><h1 className="page-title">Rutinas</h1><p className="muted">Planes por calendario asociados a los activos visibles para tu cuenta.</p></div>
      <div className="page-header-actions">
        <div className="brand-pill"><span /> {plans.rowCount} rutinas</div>
        {canWrite && <RoutineCreateModal assets={assets.rows} returnTo="/dashboard/maintenance" />}
      </div>
    </header>
    {feedback.created==="routine" && <div className="notice success section">Rutina creada correctamente.</div>}
    {feedback.error && <div className="notice error section">No fue posible crear la rutina. Revisa los datos e inténtalo nuevamente.</div>}
    <section className="card section"><p>Desde el módulo puedes escoger el activo. Si creas la rutina entrando al activo, esa relación queda preseleccionada automáticamente.</p></section>
    <section className="section"><table className="table"><thead><tr><th>Plan</th><th>Empresa</th><th>Equipo</th><th>Frecuencia</th><th>Próximo vencimiento</th></tr></thead>
      <tbody>{plans.rows.map(p=><tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.company}</td><td>{p.asset}</td><td>Cada {p.frequency_value} {p.frequency_unit}</td><td>{p.next_due_at ? new Date(p.next_due_at).toLocaleDateString("es-CO") : "Sin programar"}</td></tr>)}</tbody>
    </table></section>
  </>;
}
