import { query } from "@/lib/db";

export default async function MaintenancePage() {
  const plans = await query<{id:string;name:string;asset:string;company:string;frequency_value:number;frequency_unit:string;next_due_at:string|null;active:boolean}>(
    `SELECT p.id,p.name,a.name asset,o.name company,p.frequency_value,p.frequency_unit,p.next_due_at::text,p.active
     FROM maintenance_plans p
     JOIN assets a ON a.id=p.asset_id
     JOIN organizations o ON o.id=p.organization_id
     ORDER BY p.next_due_at NULLS LAST,p.name LIMIT 200`
  );
  return <>
    <h1 className="page-title">Mantenimiento preventivo</h1>
    <p className="muted">Planes por calendario o lectura de medidor.</p>
    <section className="card section">
      <p>La estructura de preventivos ya está activa. En la siguiente iteración añadiremos el constructor de tareas, frecuencias, responsables y generación automática de OT.</p>
    </section>
    <section className="section"><table className="table"><thead><tr><th>Plan</th><th>Empresa</th><th>Equipo</th><th>Frecuencia</th><th>Próximo vencimiento</th></tr></thead>
      <tbody>{plans.rows.map(p=><tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.company}</td><td>{p.asset}</td><td>Cada {p.frequency_value} {p.frequency_unit}</td><td>{p.next_due_at ? new Date(p.next_due_at).toLocaleDateString("es-CO") : "Sin programar"}</td></tr>)}</tbody>
    </table></section>
  </>;
}
