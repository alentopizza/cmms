import { query } from "@/lib/db";

export type CatalogOrigin="SYSTEM"|"CUSTOM";

export type CatalogOption={
  id:string;
  catalogKey:string;
  organizationId:string|null;
  origin:CatalogOrigin;
  code:string;
  label:string;
  description:string|null;
  active:boolean;
  sortOrder:number;
};

export type CatalogDefinition={
  key:string;
  label:string;
  description:string|null;
  module:string;
  active:boolean;
  allowCustom:boolean;
  supportsRelations:boolean;
};

export function normalizeCatalogCode(value:string){
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,80);
}

export async function getCatalogDefinition(key:string){
  const result=await query<{
    key:string;label:string;description:string|null;module:string;active:boolean;allow_custom:boolean;supports_relations:boolean;
  }>(
    "SELECT key,label,description,module,active,allow_custom,supports_relations FROM configurable_catalogs WHERE key=$1 AND active=true",
    [key],
  );
  if(!result.rowCount)return null;
  const row=result.rows[0];
  return {key:row.key,label:row.label,description:row.description,module:row.module,active:row.active,allowCustom:row.allow_custom,supportsRelations:row.supports_relations} satisfies CatalogDefinition;
}

export async function listCatalogOptions(catalogKey:string,organizationId:string|null,{includeInactive=false}:{includeInactive?:boolean}={}){
  const result=await query<{
    id:string;catalog_key:string;organization_id:string|null;origin:CatalogOrigin;code:string;label:string;description:string|null;active:boolean;sort_order:number;
  }>(
    `SELECT id,catalog_key,organization_id,origin,code,label,description,active,sort_order
     FROM configurable_catalog_options
     WHERE catalog_key=$1
       AND (organization_id IS NULL OR organization_id=$2::uuid)
       AND ($3::boolean OR active=true)
     ORDER BY active DESC, origin='SYSTEM' DESC, sort_order, label`,
    [catalogKey,organizationId,includeInactive],
  );
  return result.rows.map(row=>({
    id:row.id,catalogKey:row.catalog_key,organizationId:row.organization_id,origin:row.origin,code:row.code,
    label:row.label,description:row.description,active:row.active,sortOrder:row.sort_order,
  } satisfies CatalogOption));
}

export async function listCatalogDefinitions(organizationId:string|null){
  const result=await query<{
    key:string;label:string;description:string|null;module:string;active:boolean;allow_custom:boolean;supports_relations:boolean;
    total_count:number;system_count:number;custom_count:number;
  }>(
    `SELECT c.key,c.label,c.description,c.module,c.active,c.allow_custom,c.supports_relations,
            count(o.id)::int total_count,
            count(o.id) FILTER (WHERE o.origin='SYSTEM')::int system_count,
            count(o.id) FILTER (WHERE o.origin='CUSTOM' AND o.organization_id=$1::uuid)::int custom_count
     FROM configurable_catalogs c
     LEFT JOIN configurable_catalog_options o
       ON o.catalog_key=c.key AND (o.organization_id IS NULL OR o.organization_id=$1::uuid)
     WHERE c.active=true
     GROUP BY c.key,c.label,c.description,c.module,c.active,c.allow_custom,c.supports_relations
     ORDER BY c.module,c.label`,
    [organizationId],
  );
  return result.rows;
}
