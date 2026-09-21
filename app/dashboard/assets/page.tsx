import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, isPlatformOwner } from "@/lib/permissions";
import { query } from "@/lib/db";
import { gateFor, getSetupState } from "@/lib/setup-sequence";
import Link from "next/link";
import { AssetCreateModal } from "@/components/ContextCreateModals";
import OwnerRecordActions from "@/components/OwnerRecordActions";

type Asset={id:string;code:string;name:string;company:string;site:string;location:string|null;supplier:string|null;status:string;criticality:string};
type Site={id:string;organization_id:string;label:string};
type Location={id:string;organization_id:string;site_id:string;label:string};
type Supplier={id:string;organization_id:string;name:string};

export default async function AssetsPage({searchParams}:{searchParams:Promise<{created?:string;error?:string}>}) {
  const session=await getSession();
  if(!session) redirect("/login");
  if(!can(session,"assets.read")) redirect("/dashboard");

  const params=await searchParams;
  const superadmin=session.platformRole!=="user";
  const orgId=session.organizationId;
  const canWrite=can(session,"assets.write");
  const owner=isPlatformOwner(session);

  const [assets,sites,locations,suppliers]=await Promise.all([
    superadmin
      ? query<Asset>(`SELECT a.id,a.code,a.name,o.name company,s.name site,l.name location,p.name supplier,a.status,a.criticality
                       FROM assets a JOIN organizations o ON o.id=a.organization_id JOIN sites s ON s.id=a.site_id
                       LEFT JOIN locations l ON l.id=a.location_id LEFT JOIN suppliers p ON p.id=a.supplier_id
                       ORDER BY a.created_at DESC LIMIT 200`)
      : session.accessAllSites
        ? query<Asset>(`SELECT a.id,a.code,a.name,o.name company,s.name site,l.name location,p.name supplier,a.status,a.criticality
                         FROM assets a JOIN organizations o ON o.id=a.organization_id JOIN sites s ON s.id=a.site_id
                         LEFT JOIN locations l ON l.id=a.location_id LEFT JOIN suppliers p ON p.id=a.supplier_id
                         WHERE a.organization_id=$1 ORDER BY a.created_at DESC LIMIT 200`,[orgId])
        : query<Asset>(`SELECT a.id,a.code,a.name,o.name company,s.name site,l.name location,p.name supplier,a.status,a.criticality
                         FROM assets a JOIN organizations o ON o.id=a.organization_id JOIN sites s ON s.id=a.site_id
                         LEFT JOIN locations l ON l.id=a.location_id LEFT JOIN suppliers p ON p.id=a.supplier_id
                         WHERE a.organization_id=$1 AND a.site_id=ANY($2::uuid[])
                         ORDER BY a.created_at DESC LIMIT 200`,[orgId,session.siteIds]),
    canWrite
      ? superadmin
        ? query<Site>(`SELECT s.id,s.organization_id,o.name||' · '||s.name label FROM sites s JOIN organizations o ON o.id=s.organization_id WHERE s.active=true ORDER BY o.name,s.name`)
        : session.accessAllSites
          ? query<Site>(`SELECT s.id,s.organization_id,s.name label FROM sites s WHERE s.organization_id=$1 AND s.active=true ORDER BY s.name`,[orgId])
          : query<Site>(`SELECT s.id,s.organization_id,s.name label FROM sites s WHERE s.organization_id=$1 AND s.active=true AND s.id=ANY($2::uuid[]) ORDER BY s.name`,[orgId,session.siteIds])
      : Promise.resolve({rows:[]} as {rows:Site[]}),
    canWrite
      ? superadmin
        ? query<Location>(`SELECT l.id,l.organization_id,l.site_id,o.name||' · '||s.name||' · '||l.name label FROM locations l JOIN sites s ON s.id=l.site_id JOIN organizations o ON o.id=l.organization_id WHERE l.active=true ORDER BY o.name,s.name,l.name`)
        : session.accessAllSites
          ? query<Location>(`SELECT l.id,l.organization_id,l.site_id,s.name||' · '||l.name label FROM locations l JOIN sites s ON s.id=l.site_id WHERE l.organization_id=$1 AND l.active=true ORDER BY s.name,l.name`,[orgId])
          : query<Location>(`SELECT l.id,l.organization_id,l.site_id,s.name||' · '||l.name label FROM locations l JOIN sites s ON s.id=l.site_id WHERE l.organization_id=$1 AND l.active=true AND l.site_id=ANY($2::uuid[]) ORDER BY s.name,l.name`,[orgId,session.siteIds])
      : Promise.resolve({rows:[]} as {rows:Location[]}),
    canWrite
      ? superadmin
        ? query<Supplier>(`SELECT id,organization_id,name FROM suppliers WHERE active=true ORDER BY name`)
        : query<Supplier>(`SELECT id,organization_id,name FROM suppliers WHERE active=true AND organization_id=$1 ORDER BY name`,[orgId])
      : Promise.resolve({rows:[]} as {rows:Supplier[]}),
  ]);

  const gate=orgId ? gateFor(await getSetupState(orgId),"asset") : null;
  const error=params.error==="sequence" ? "Primero completa la estructura física y registra al menos un proveedor."
    : params.error==="limit" ? "La empresa alcanzó el límite de activos de su plan."
    : params.error ? "Revisa la información del activo." : "";

  return <>
    <header className="page-header"><div><span className="eyebrow">Registro técnico</span><h1 className="page-title">Activos y equipos</h1><p className="muted">Cada activo debe quedar vinculado a empresa, sede, sububicación y proveedor.</p></div><div className="page-header-actions"><div className="brand-pill"><span /> {assets.rowCount} activos</div>{canWrite && gate?.ready && <AssetCreateModal sites={sites.rows.map(s=>({id:s.id,organization_id:s.organization_id,name:s.label}))} locations={locations.rows.map(l=>({id:l.id,organization_id:l.organization_id,site_id:l.site_id,name:l.label,label:l.label}))} suppliers={suppliers.rows} returnTo="/dashboard/assets" />}</div></header>
    {params.created && <div className="notice success section">Activo creado correctamente.</div>}
    {error && <div className="notice error section">{error}</div>}

    {canWrite && <section className="card section setup-flow-card">
      <div className="setup-flow-head"><div><span className="eyebrow">Secuencia obligatoria</span><h2>Activos después de proveedores</h2></div><span className={"setup-flow-state "+(gate?.ready?"ready":"blocked")}>{gate?.ready?"Habilitado":"Paso pendiente"}</span></div>
      <div className="setup-flow-steps"><span className="done"><b>1</b> Empresa</span><span className="done"><b>2</b> Ubicación</span><span className="done"><b>3</b> Sububicación</span><span className={gate?.ready?"done":""}><b>4</b> Proveedor</span><span className={gate?.ready?"active":""}><b>5</b> Activo</span></div>
      {!gate?.ready && gate?.href && <a className="button secondary" href={gate.href}>{gate.action}</a>}
    </section>}

    <section className="section"><table className="table"><thead><tr><th>Código</th><th>Activo</th><th>Ubicación</th><th>Proveedor</th><th>Estado</th><th>Criticidad</th>{owner&&<th>Acciones</th>}</tr></thead><tbody>
      {assets.rows.map(a=><tr key={a.id}><td>{a.code}</td><td><Link className="table-entity-link" href={"/dashboard/assets/"+a.id}><strong>{a.name}</strong><small className="table-subline">{a.company}</small></Link></td><td>{a.site}{a.location?" · "+a.location:""}</td><td>{a.supplier||"Sin proveedor"}</td><td><span className="status">{a.status}</span></td><td>{a.criticality}</td>{owner&&<td><OwnerRecordActions table="assets" id={a.id} label={a.name} fields={[
        {name:"code",label:"Código",value:a.code},
        {name:"name",label:"Nombre",value:a.name},
        {name:"status",label:"Estado",value:a.status,type:"select",options:[
          {value:"operational",label:"Operativo"},{value:"maintenance",label:"Mantenimiento"},{value:"down",label:"Detenido"},{value:"retired",label:"Retirado"}
        ]},
        {name:"criticality",label:"Criticidad",value:a.criticality,type:"select",options:[
          {value:"low",label:"Baja"},{value:"medium",label:"Media"},{value:"high",label:"Alta"},{value:"critical",label:"Crítica"}
        ]},
      ]}/></td>}</tr>)}
    </tbody></table>{!assets.rowCount && <div className="card empty-state"><strong>Aún no hay activos.</strong><span>Completa primero ubicaciones, sububicaciones y proveedores.</span></div>}</section>
  </>;
}
