import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { canAccessOrganization, organizationScopeFor } from "@/lib/organization-scope";
import { listCatalogDefinitions, listCatalogOptions } from "@/lib/configurable-catalogs";
import { query } from "@/lib/db";
import { Badge } from "@/components/ui-kit/Badge";
import CatalogAdminPanel from "@/components/CatalogAdminPanel";

export default async function CatalogsPage({searchParams}:{searchParams:Promise<{catalog?:string;organization?:string}>}){
  const session=await getSession();
  if(!session)redirect("/login");
  if(!can(session,"catalogs.read"))redirect("/dashboard");

  const params=await searchParams;
  const requestedOrganization=params.organization||session.organizationId||null;
  const organizationId=requestedOrganization&&canAccessOrganization(session,requestedOrganization)?requestedOrganization:null;
  const definitions=await listCatalogDefinitions(organizationId);
  const selected=definitions.find(item=>item.key===params.catalog)||definitions[0]||null;
  const options=selected?await listCatalogOptions(selected.key,organizationId,{includeInactive:true}):[];
  const scope=organizationScopeFor(session);
  const organizations=session.platformRole==="user"?[]
    :(await query<{id:string;name:string}>(
      scope.unrestricted
        ?"SELECT id,name FROM organizations WHERE active=true ORDER BY name"
        :"SELECT id,name FROM organizations WHERE active=true AND id=ANY($1::uuid[]) ORDER BY name",
      scope.unrestricted?[]:[scope.organizationIds],
    )).rows;

  return <div className="catalog-admin-page">
    <header className="page-header">
      <div><span className="eyebrow">Configuración</span><h1 className="page-title">Catálogos</h1><p className="muted">Administra clasificaciones reutilizables de DesWeb CMMS sin crear listas independientes por módulo.</p></div>
      <Badge variant="brand">Sistema central</Badge>
    </header>

    {session.platformRole!=="user"&&<form className="card section catalog-organization-picker" method="get">
      {selected&&<input type="hidden" name="catalog" value={selected.key}/>}
      <div className="field"><label>Empresa</label><select name="organization" defaultValue={organizationId||""}><option value="">Solo opciones globales SYSTEM</option>{organizations.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}</select></div>
      <button className="button secondary" type="submit">Cambiar contexto</button>
    </form>}

    <div className="catalog-admin-layout section">
      <aside className="card catalog-directory">
        <div className="catalog-directory-head"><strong>Catálogos</strong><small>{definitions.length} registrados</small></div>
        {definitions.map(item=><Link key={item.key} className={"catalog-directory-item"+(selected?.key===item.key?" active":"")} href={"/dashboard/settings/catalogs?catalog="+encodeURIComponent(item.key)+(organizationId?"&organization="+organizationId:"")}>
          <div><strong>{item.label}</strong><span>{item.description}</span></div>
          <div><b>{item.total_count} opciones</b><small>{item.system_count} sistema · {item.custom_count} empresa</small></div>
        </Link>)}
      </aside>
      <main>
        {selected?<CatalogAdminPanel
          catalogKey={selected.key}
          catalogLabel={selected.label}
          allowCustom={selected.allow_custom}
          organizationId={organizationId}
          initialOptions={options}
          canManage={can(session,"catalogs.manage")}
          canManageSystem={session.platformRole==="platform_owner"}
        />:<div className="empty-state"><h2>No hay catálogos configurados</h2></div>}
      </main>
    </div>
  </div>;
}
