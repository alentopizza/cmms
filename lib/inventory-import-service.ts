import { normalizedHeader } from "@/lib/import-workbook";

export type InventoryImportMode="global"|"contextual";
export type InventoryImportScope="all"|"context_only";
export type DuplicatePolicy="compare"|"update"|"skip";

export type ImportSupplier={
  id:string;
  code:string|null;
  tax_id:string|null;
  name:string;
  supplier_type:string;
};

export type SupplierReference={
  supplierId?:string;
  taxId?:string;
  code?:string;
  name?:string;
};

export type SupplierResolution={
  supplier:ImportSupplier|null;
  matchedBy:"id"|"tax_id"|"code"|"name"|null;
  error:string|null;
};

function key(value:string|undefined|null){
  return normalizedHeader(value||"");
}
function taxKey(value:string|undefined|null){
  return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
}

function exact(rows:ImportSupplier[],field:"id"|"tax_id"|"code"|"name",value:string){
  if(!value)return null;
  if(field==="id"){
    const idValue=value.trim().toLowerCase();
    return rows.find(row=>row.id.toLowerCase()===idValue||key(row.code)===key(value))||null;
  }
  if(field==="tax_id")return rows.find(row=>taxKey(row.tax_id)===taxKey(value))||null;
  return rows.find(row=>key(row[field])===key(value))||null;
}

/**
 * Supplier identity is intentionally deterministic. We use the first populated
 * identifier by business priority and then verify any lower-priority identifiers
 * that were supplied do not point at a different supplier.
 */
export function resolveImportSupplier(rows:ImportSupplier[],reference:SupplierReference):SupplierResolution{
  const candidates:[SupplierResolution["matchedBy"],string][]=[
    ["id",(reference.supplierId||"").trim()],
    ["tax_id",(reference.taxId||"").trim()],
    ["code",(reference.code||"").trim()],
    ["name",(reference.name||"").trim()],
  ];
  const primary=candidates.find(([,value])=>Boolean(value));
  if(!primary)return {supplier:null,matchedBy:null,error:"No se indicó un identificador de proveedor."};

  const [matchedBy,value]=primary;
  const supplier=exact(rows,matchedBy!,value);
  if(!supplier){
    return {supplier:null,matchedBy,error:"No existe un proveedor que coincida con "+matchedBy+" = "+value+"."};
  }

  const checks:[SupplierResolution["matchedBy"],string][]=[
    ["id",(reference.supplierId||"").trim()],
    ["tax_id",(reference.taxId||"").trim()],
    ["code",(reference.code||"").trim()],
    ["name",(reference.name||"").trim()],
  ];
  for(const [field,raw] of checks){
    if(!field||!raw)continue;
    const resolved=exact(rows,field,raw);
    if(resolved&&resolved.id!==supplier.id){
      return {supplier:null,matchedBy,error:"Los identificadores del proveedor son inconsistentes entre sí."};
    }
  }
  return {supplier,matchedBy,error:null};
}

export function isServiceInventoryRow(typeValue:string,categoryValue:string,unitValue:string){
  const type=key(typeValue);
  const category=key(categoryValue);
  const unit=key(unitValue);
  return ["servicio","servicios","service","services"].includes(type)
    ||["servicio","servicios"].includes(category)
    ||["servicio","hora","dia","viaje","visita","punto"].includes(unit);
}

export function supplierBelongsToContext(supplier:ImportSupplier|null,contextSupplier:ImportSupplier|null){
  return !contextSupplier||supplier?.id===contextSupplier.id;
}

export function importBatchLabel(number:number|string,createdAt?:string){
  const year=createdAt?new Date(createdAt).getFullYear():new Date().getFullYear();
  return "IMP-"+year+"-"+String(number).padStart(6,"0");
}
