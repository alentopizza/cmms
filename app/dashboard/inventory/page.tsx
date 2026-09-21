import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { gateFor, getSetupState } from "@/lib/setup-sequence";

type Item={id:string;sku:string;name:string;company:string;site:string|null;location:string|null;supplier:string|null;quantity:string;min_quantity:string;unit:string};
type Site={id:string;label:string};
type Location={id:string;label:string};
type Supplier={id:string;name:string};

export default async function InventoryPage({searchParams}:{searchParams:Promise<{created?:string;error?:string}>}) {
  const session=await getSession();
  if(!session) redirect("/login");
  if(!can(session,"inventory.read")) redirect("/dashboard");
  const params=await searchParams;
  const superadmin=session.platformRole==="superadmin";
  const orgId=session.organizationId;
  const canWrite=can(session,"inventory.write");

  const [items,sites,locations,suppliers]=await Promise.all([
    superadmin
      ? query<Item>(`SELECT i.id,i.sku,i.name,o.name company,s.name site,l.name location,p.name supplier,i.quantity::text,i.min_quantity::text,i.unit
                     FROM inventory_items i JOIN organizations o ON o.id=i.organization_id
                     LEFT JOIN sites s ON s.id=i.site_id LEFT JOIN locations l ON l.id=i.location_id LEFT JOIN suppliers p ON p.id=i.supplier_id
                     WHERE i.active=true ORDER BY i.name LIMIT 300`)
      : session.accessAllSites
        ? query<Item>(`SELECT i.id,i.sku,i.name,o.name company,s.name site,l.name location,p.name supplier,i.quantity::text,i.min_quantity::text,i.unit
                       FROM inventory_items i JOIN organizations o ON o.id=i.organization_id
                       LEFT JOIN sites s ON s.id=i.site_id LEFT JOIN locations l ON l.id=i.location_id LEFT JOIN suppliers p ON p.id=i.supplier_id
                       WHERE i.active=true AND i.organization_id=$1 ORDER BY i.name LIMIT 300`,[orgId])
        : query<Item>(`SELECT i.id,i.sku,i.name,o.name company,s.name site,l.name location,p.name supplier,i.quantity::text,i.min_quantity::text,i.unit
                       FROM inventory_items i JOIN organizations o ON o.id=i.organization_id
                       LEFT JOIN sites s ON s.id=i.site_id LEFT JOIN locations l ON l.id=i.location_id LEFT JOIN suppliers p ON p.id=i.supplier_id
                       WHERE i.active=true AND i.organization_id=$1 AND (i.site_id IS NULL OR i.site_id=ANY($2::uuid[]))
                       ORDER BY i.name LIMIT 300`,[orgId,session.siteIds]),
    canWrite && orgId
      ? session.accessAllSites
        ? query<Site>("SELECT id,name label FROM sites WHERE organization_id=$1 AND active=true ORDER BY name",[orgId])
        : query<Site>("SELECT id,name label FROM sites WHERE organization_id=$1 AND active=true AND id=ANY($2::uuid[]) ORDER BY name",[orgId,session.siteIds])
      : Promise.resolve({rows:[]} as {rows:Site[]}),
    canWrite && orgId
      ? session.accessAllSites
        ? query<Location>(`SELECT l.id,s.name||' · '||l.name label FROM locations l JOIN sites s ON s.id=l.site_id WHERE l.organization_id=$1 AND l.active=true ORDER BY s.name,l.name`,[orgId])
        : query<Location>(`SELECT l.id,s.name||' · '||l.name label FROM locations l JOIN sites s ON s.id=l.site_id WHERE l.organization_id=$1 AND l.active=true AND l.site_id=ANY($2::uuid[]) ORDER BY s.name,l.name`,[orgId,session.siteIds])
      : Promise.resolve({rows:[]} as {rows:Location[]}),
    canWrite && orgId
      ? query<Supplier>("SELECT id,name FROM suppliers WHERE organization_id=$1 AND active=true ORDER BY name",[orgId])
      : Promise.resolve({rows:[]} as {rows:Supplier[]}),
  ]);

  const gate=orgId ? gateFor(await getSetupState(orgId),"inventory") : null;
  const error=params.error==="sequence" ? "Primero completa ubicaciones y registra al menos un proveedor."
    : params.error==="limit" ? "La empresa alcanzó el límite de artículos de inventario."
    : params.error ? "Revisa la información del artículo." : "";

  return <>
    <header className="page-header"><div><span className="eyebrow">Abastecimiento</span><h1 className="page-title">Inventario y repuestos</h1><p className="muted">Cada artículo nuevo debe relacionarse con un proveedor y su ubicación física.</p></div><div className="brand-pill"><span /> {items.rowCount} artículos</div></header>
    {params.created && <div className="notice success section">Artículo de inventario creado correctamente.</div>}
    {error && <div className="notice error section">{error}</div>}

    {canWrite && <section className="card section setup-flow-card">
      <div className="setup-flow-head"><div><span className="eyebrow">Secuencia obligatoria</span><h2>Inventario después de proveedores</h2></div><span className={"setup-flow-state "+(gate?.ready?"ready":"blocked")}>{gate?.ready?"Habilitado":"Paso pendiente"}</span></div>
      <div className="setup-flow-steps"><span className="done"><b>1</b> Empresa</span><span className="done"><b>2</b> Ubicación</span><span className="done"><b>3</b> Sububicación</span><span className={gate?.ready?"done":""}><b>4</b> Proveedor</span><span className={gate?.ready?"active":""}><b>5</b> Artículo</span></div>
      {!gate?.ready && gate?.href && <a className="button secondary" href={gate.href}>{gate.action}</a>}
    </section>}

    {canWrite && gate?.ready && orgId && <section className="card section">
      <div className="section-heading"><div><span className="eyebrow">Nuevo artículo</span><h2>Registrar repuesto o material</h2></div></div>
      <form className="form-grid" method="post" action="/api/inventory">
        <div className="field"><label>Sede *</label><select name="site_id" required><option value="">Selecciona sede</option>{sites.rows.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
        <div className="field"><label>Sububicación *</label><select name="location_id" required><option value="">Selecciona sububicación</option>{locations.rows.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></div>
        <div className="field"><label>Proveedor *</label><select name="supplier_id" required><option value="">Selecciona proveedor</option>{suppliers.rows.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="field"><label>SKU *</label><input name="sku" required placeholder="REP-001"/></div>
        <div className="field"><label>Nombre *</label><input name="name" required placeholder="Ej. Correa industrial"/></div>
        <div className="field"><label>Unidad</label><input name="unit" defaultValue="unit" placeholder="unidad"/></div>
        <div className="field"><label>Existencia inicial</label><input name="quantity" type="number" step="0.001" min="0" defaultValue="0"/></div>
        <div className="field"><label>Existencia mínima</label><input name="min_quantity" type="number" step="0.001" min="0" defaultValue="0"/></div>
        <div className="field"><label>Costo unitario</label><input name="unit_cost" type="number" step="0.01" min="0" defaultValue="0"/></div>
        <div className="field"><label>Ubicación de almacenamiento</label><input name="storage_location" placeholder="Estante A-03"/></div>
        <div className="form-span-2 form-actions"><button className="button" type="submit">Crear artículo</button></div>
      </form>
    </section>}

    <section className="section"><table className="table"><thead><tr><th>SKU</th><th>Artículo</th><th>Ubicación</th><th>Proveedor</th><th>Existencia</th><th>Mínimo</th></tr></thead><tbody>
      {items.rows.map(i=><tr key={i.id}><td>{i.sku}</td><td><strong>{i.name}</strong><small className="table-subline">{i.company}</small></td><td>{i.site||"Sin sede"}{i.location?" · "+i.location:""}</td><td>{i.supplier||"Sin proveedor"}</td><td>{i.quantity} {i.unit}</td><td>{i.min_quantity} {i.unit}</td></tr>)}
    </tbody></table>{!items.rowCount && <div className="card empty-state"><strong>Aún no hay artículos.</strong><span>Registra proveedores antes de crear inventario.</span></div>}</section>
  </>;
}
