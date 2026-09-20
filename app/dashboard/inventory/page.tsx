import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";

export default async function InventoryPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session, "inventory.read")) redirect("/dashboard");

  const items = session.platformRole === "superadmin"
    ? await query<{id:string;sku:string;name:string;company:string;site:string|null;quantity:string;min_quantity:string;unit:string}>(
        `SELECT i.id,i.sku,i.name,o.name company,s.name site,i.quantity::text,i.min_quantity::text,i.unit
         FROM inventory_items i JOIN organizations o ON o.id=i.organization_id LEFT JOIN sites s ON s.id=i.site_id
         WHERE i.active=true ORDER BY i.name LIMIT 300`)
    : session.accessAllSites
      ? await query<{id:string;sku:string;name:string;company:string;site:string|null;quantity:string;min_quantity:string;unit:string}>(
          `SELECT i.id,i.sku,i.name,o.name company,s.name site,i.quantity::text,i.min_quantity::text,i.unit
           FROM inventory_items i JOIN organizations o ON o.id=i.organization_id LEFT JOIN sites s ON s.id=i.site_id
           WHERE i.active=true AND i.organization_id=$1 ORDER BY i.name LIMIT 300`, [session.organizationId])
      : await query<{id:string;sku:string;name:string;company:string;site:string|null;quantity:string;min_quantity:string;unit:string}>(
          `SELECT i.id,i.sku,i.name,o.name company,s.name site,i.quantity::text,i.min_quantity::text,i.unit
           FROM inventory_items i JOIN organizations o ON o.id=i.organization_id LEFT JOIN sites s ON s.id=i.site_id
           WHERE i.active=true AND i.organization_id=$1
             AND (i.site_id IS NULL OR i.site_id = ANY($2::uuid[]))
           ORDER BY i.name LIMIT 300`, [session.organizationId, session.siteIds]);

  return <>
    <h1 className="page-title">Inventario y repuestos</h1><p className="muted">Existencias, mínimos y consumos vinculados a órdenes de trabajo.</p>
    <section className="section"><table className="table"><thead><tr><th>SKU</th><th>Repuesto</th><th>Empresa / sede</th><th>Existencia</th><th>Mínimo</th></tr></thead>
      <tbody>{items.rows.map(i=><tr key={i.id}><td>{i.sku}</td><td><strong>{i.name}</strong></td><td>{i.company}{i.site ? " · " + i.site : ""}</td><td>{i.quantity} {i.unit}</td><td>{i.min_quantity} {i.unit}</td></tr>)}</tbody>
    </table></section>
  </>;
}
