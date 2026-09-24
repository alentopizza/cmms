import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getSession, canAccessSite } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool, query } from "@/lib/db";
import {
  boolValue,
  findWorksheet,
  isoDateValue,
  loadWorkbook,
  normalizedHeader,
  numberValue,
  parseSheet,
  stableCode,
  textValue,
  type ParsedSheetRow,
} from "@/lib/import-workbook";
import {
  importBatchLabel,
  isServiceInventoryRow,
  resolveImportSupplier,
  supplierBelongsToContext,
  type DuplicatePolicy,
  type ImportSupplier,
  type InventoryImportMode,
  type InventoryImportScope,
} from "@/lib/inventory-import-service";

type Issue={
  sheet:string;row:number;severity:"error"|"warning";message:string;
  field?:string;value?:string;problem?:string;suggestion?:string;
};
type Supplier=ImportSupplier;
type Site={id:string;name:string};
type Location={id:string;site_id:string;name:string};
type Warehouse={id:string;site_id:string|null;location_id:string|null;name:string};
type Item={id:string;sku:string;site_id:string|null;location_id:string|null;warehouse_id:string|null;quantity:string;supplier_id:string|null;supplier_name:string|null;active:boolean;};
type ParsedWarehouse={
  row:number;code:string;name:string;type:string;responsible:string;locationDetail:string;capacity:number|null;active:boolean;notes:string;
  site:Site|null;location:Location|null;
};
type ParsedInventory={
  row:number;sku:string;name:string;description:string;itemType:string;category:string;subcategory:string;brand:string;model:string;
  presentation:string;unit:string;barcode:string;supplier:Supplier|null;belongsContext:boolean;site:Site|null;location:Location|null;
  warehouseName:string;warehouse:Warehouse|null;min:number;max:number;cost:number;referencePrice:number;taxRate:number;initial:number;
  lot:string;expiresAt:string;active:boolean;existing:Item|null;
};
type ParsedKardex={
  row:number;movementId:string;sku:string;movement:{type:string;sign:number};date:string;document:string;warehouseName:string;destination:string;
  quantity:number;cost:number;notes:string;lot:string;expiresAt:string;costCenter:string;sourceUser:string;
  supplier:Supplier|null;belongsContext:boolean;
};

const INVENTORY_ALIASES={
  supplierId:["PROVEEDOR_ID","Proveedor ID","ID proveedor","Proveedor_ID"],
  supplierTaxId:["NIT_PROVEEDOR","NIT proveedor","NIT"],
  supplierCode:["CODIGO_PROVEEDOR","Código proveedor","Codigo proveedor","Código interno proveedor"],
  supplier:["PROVEEDOR","Proveedor *","Proveedor"],
  sku:["SKU *","SKU","Código","Codigo","Item"],
  name:["Nombre *","Nombre","Nombre producto/servicio","Producto"],
  description:["Descripción","Descripcion"],
  itemType:["TIPO","Tipo producto","Tipo ítem","Tipo item"],
  category:["Categoría","Categoria"],
  subcategory:["SUBCATEGORIA","Subcategoría","Subcategoria"],
  brand:["MARCA","Marca","Fabricante"],
  model:["MODELO","Modelo"],
  presentation:["Presentación","Presentacion"],
  unit:["Unidad *","Unidad"],
  barcode:["CODIGO_BARRAS","Código de barras","Codigo de barras"],
  supplierType:["Tipo proveedor"],
  site:["Sede *","Sede"],
  location:["Sububicación *","Sububicacion","Ubicación física","Ubicacion fisica","UBICACION","Ubicación"],
  warehouse:["Bodega *","Bodega","Almacén","Almacen","Ubicación de bodega","Ubicacion de bodega"],
  min:["Stock mínimo","Stock minimo"],
  max:["Stock máximo","Stock maximo"],
  cost:["Costo unitario","Valor unitario"],
  referencePrice:["PRECIO_REFERENCIA","Precio referencia","Precio de referencia"],
  taxRate:["IVA","IVA %","Impuesto"],
  initial:["Stock inicial","Existencia inicial","Cantidad base"],
  lot:["LOTE","Lote"],
  expires:["FECHA_VENCIMIENTO","Fecha vencimiento","Vencimiento"],
  active:["Activo","Estado"],
};
const WAREHOUSE_ALIASES={
  code:["Código","Codigo","ID","ID bodega","CODIGO_BODEGA","Código bodega","Codigo bodega"],
  name:["Bodega *","Bodega","Almacén","Almacen","Nombre"],
  type:["Tipo"],
  responsible:["Responsable"],
  site:["Sede"],
  location:["Sububicación","Sububicacion","UBICACION"],
  locationDetail:["Ubicación detalle","Ubicacion detalle","UBICACION_DETALLE"],
  capacity:["Capacidad"],
  active:["Estado","Activo"],
  notes:["Observaciones","Notas"],
};
const KARDEX_ALIASES={
  movementId:["MOVIMIENTO_ID","Movimiento ID","ID movimiento"],
  date:["Fecha *","Fecha"],
  movement:["Tipo movimiento *","Tipo movimiento"],
  document:["Documento"],
  sku:["SKU *","SKU","Código","Codigo"],
  warehouse:["Bodega origen *","Bodega origen","Bodega"],
  destination:["Bodega destino"],
  quantity:["Cantidad *","Cantidad"],
  entry:["Entrada"],
  exit:["Salida"],
  cost:["Costo unitario"],
  supplierId:["PROVEEDOR_ID","Proveedor ID","ID proveedor"],
  supplierTaxId:["NIT_PROVEEDOR","NIT proveedor","NIT"],
  supplierCode:["CODIGO_PROVEEDOR","Código proveedor","Codigo proveedor"],
  supplier:["PROVEEDOR","Proveedor"],
  lot:["Lote"],
  expires:["Vencimiento","Fecha vencimiento"],
  costCenter:["Centro de costo","Centro costo"],
  sourceUser:["Usuario"],
  notes:["Observaciones"],
};
const PROVIDER_ALIASES={
  supplierId:["PROVEEDOR_ID","Proveedor ID","ID proveedor"],
  taxId:["NIT_PROVEEDOR","NIT proveedor","NIT"],
  code:["CODIGO_PROVEEDOR","Código proveedor","Codigo proveedor"],
  name:["PROVEEDOR","Proveedor","Nombre proveedor"],
};
const ASSET_ALIASES={
  code:["Código *","Codigo *","Código","Codigo","SKU"],
  name:["Nombre *","Nombre","Activo","Nombre activo"],
  description:["Descripción","Descripcion"],
  category:["Categoría","Categoria"],
  site:["Sede *","Sede"],
  location:["Sububicación *","Sububicacion","Ubicación","Ubicacion"],
  supplier:["Proveedor *","Proveedor"],
  manufacturer:["Fabricante","Marca"],
  model:["Modelo"],
  serial:["Serial","Número de serie","Numero de serie"],
  status:["Estado *","Estado"],
  criticality:["Criticidad *","Criticidad"],
  purchaseDate:["Fecha compra","Fecha de compra"],
  installationDate:["Fecha instalación","Fecha instalacion"],
  warrantyDate:["Garantía vence","Garantia vence","Vencimiento garantía","Vencimiento garantia"],
  purchaseCost:["Costo compra","Costo de compra"],
  locationDetail:["Ubicación detalle","Ubicacion detalle"],
  notes:["Notas","Observaciones"],
};

function key(value:string){return normalizedHeader(value);}
function issue(
  issues:Issue[],sheet:string,row:number,severity:Issue["severity"],message:string,
  field?:string,value?:string,suggestion?:string,
){
  issues.push({sheet,row,severity,message,field,value,problem:message,suggestion});
}
function movementType(value:string){
  const v=key(value);
  if(["entrada","receipt"].includes(v))return {type:"receipt",sign:1};
  if(["salida","issue"].includes(v))return {type:"issue",sign:1};
  if(["devolucion","return"].includes(v))return {type:"return",sign:1};
  if(["ajuste positivo","adjustment positive","ajuste"].includes(v))return {type:"adjustment",sign:1};
  if(["ajuste negativo","adjustment negative"].includes(v))return {type:"adjustment",sign:-1};
  if(["traslado","transfer"].includes(v))return {type:"transfer",sign:1};
  return null;
}
function assetStatus(value:string){
  const v=key(value);
  if(["operativo","operational"].includes(v))return "operational";
  if(["en mantenimiento","mantenimiento","maintenance"].includes(v))return "maintenance";
  if(["detenido","fuera de servicio","down"].includes(v))return "down";
  if(["retirado","retired"].includes(v))return "retired";
  return "";
}
function criticality(value:string){
  const v=key(value);
  if(["baja","low"].includes(v))return "low";
  if(["media","medium"].includes(v))return "medium";
  if(["alta","high"].includes(v))return "high";
  if(["critica","critical"].includes(v))return "critical";
  return "";
}
function safeRows<T>(rows:T[],max=5000){return rows.slice(0,max);}
function findByName<T extends {name:string}>(rows:T[],value:string){return rows.find(row=>key(row.name)===key(value))||null;}
async function catalogs(organizationId:string){
  const [suppliers,sites,locations,warehouses,items,categories,limits,counts,movementIds,stockLevels]=await Promise.all([
    query<Supplier>("SELECT id,code,name,tax_id,supplier_type FROM suppliers WHERE organization_id=$1 AND active=true ORDER BY name",[organizationId]),
    query<Site>("SELECT id,name FROM sites WHERE organization_id=$1 AND active=true ORDER BY name",[organizationId]),
    query<Location>("SELECT id,site_id,name FROM locations WHERE organization_id=$1 AND active=true ORDER BY name",[organizationId]),
    query<Warehouse>("SELECT id,site_id,location_id,name FROM inventory_warehouses WHERE organization_id=$1 AND active=true ORDER BY name",[organizationId]),
    query<Item>("SELECT i.id,i.sku,i.site_id,i.location_id,i.warehouse_id,i.quantity::text,i.supplier_id,s.name supplier_name,i.active FROM inventory_items i LEFT JOIN suppliers s ON s.id=i.supplier_id WHERE i.organization_id=$1",[organizationId]),
    query<{id:string;name:string}>("SELECT id,name FROM inventory_categories WHERE organization_id=$1 AND active=true ORDER BY name",[organizationId]),
    query<{max_assets:number;max_inventory_items:number}>("SELECT max_assets,max_inventory_items FROM organization_limits WHERE organization_id=$1",[organizationId]),
    query<{assets:number;inventory:number}>("SELECT (SELECT count(*)::int FROM assets WHERE organization_id=$1) assets,(SELECT count(*)::int FROM inventory_items WHERE organization_id=$1 AND active=true) inventory",[organizationId]),
    query<{source_movement_id:string}>("SELECT source_movement_id FROM inventory_transactions WHERE organization_id=$1 AND source_movement_id IS NOT NULL",[organizationId]),
    query<{sku:string;warehouse_name:string;quantity:string}>(
      `SELECT i.sku,w.name warehouse_name,s.quantity::text
       FROM inventory_stock_levels s
       JOIN inventory_items i ON i.id=s.item_id
       JOIN inventory_warehouses w ON w.id=s.warehouse_id
       WHERE s.organization_id=$1`,
      [organizationId],
    ),
  ]);
  return {
    suppliers:suppliers.rows,sites:sites.rows,locations:locations.rows,warehouses:warehouses.rows,items:items.rows,
    categories:categories.rows,limits:limits.rows[0],counts:counts.rows[0],
    movementIds:new Set(movementIds.rows.map(row=>key(row.source_movement_id))),
    stockLevels:stockLevels.rows,
  };
}

function resolveSite(rows:Site[],value:string){
  if(value)return findByName(rows,value);
  return rows.length===1?rows[0]:null;
}
function resolveLocation(rows:Location[],siteId:string,value:string){
  const candidates=rows.filter(row=>row.site_id===siteId);
  if(value)return findByName(candidates,value);
  return candidates.length===1?candidates[0]:null;
}
function resolveWarehouse(rows:Warehouse[],siteId:string,locationId:string,value:string){
  const candidates=rows.filter(row=>(!row.site_id||row.site_id===siteId)&&(!row.location_id||row.location_id===locationId));
  return findByName(candidates,value)||findByName(rows,value);
}

function inventoryValidation(
  rows:ParsedSheetRow[],
  sheetName:string,
  catalog:Awaited<ReturnType<typeof catalogs>>,
  contextSupplier:Supplier|null,
  fileWarehouseNames:Set<string>,
  importScope:InventoryImportScope,
){
  const issues:Issue[]=[];
  const parsed:ParsedInventory[]=[];
  const firstBySku=new Map<string,{row:number;name:string;supplierId:string|null}>();
  const allowedUnits=new Set([
    "unidad","caja","paquete","metro","rollo","litro","galon","kg","g","par","juego","bulto","pieza","set",
    ...catalog.items.map(item=>key((item as Item&{unit?:string}).unit||"")).filter(Boolean),
  ]);
  let newCount=0;
  let existingCount=0;
  let skippedServices=0;
  let contextMismatchRows=0;

  for(const row of safeRows(rows)){
    const sku=textValue(row.values.sku).toUpperCase();
    const name=textValue(row.values.name);
    if(!sku&&!name)continue;

    const itemType=textValue(row.values.itemType)||"PRODUCTO";
    const category=textValue(row.values.category);
    const unit=textValue(row.values.unit)||"unidad";
    if(isServiceInventoryRow(itemType,category,unit)){
      skippedServices++;
      issue(
        issues,sheetName,row.rowNumber,"warning",
        "Servicio detectado: no genera stock ni Kardex físico y será omitido del inventario.",
        "TIPO",itemType,"Gestiona el servicio desde el flujo operativo correspondiente; no requiere existencias físicas.",
      );
      continue;
    }

    if(!sku)issue(issues,sheetName,row.rowNumber,"error","Falta SKU.","SKU","", "Completa un SKU único para el producto.");
    if(!name)issue(issues,sheetName,row.rowNumber,"error","Falta nombre del producto.","NOMBRE_PRODUCTO","", "Completa el nombre del producto.");

    const supplierReference={
      supplierId:textValue(row.values.supplierId),
      taxId:textValue(row.values.supplierTaxId),
      code:textValue(row.values.supplierCode),
      name:textValue(row.values.supplier),
    };
    const hasSupplierReference=Object.values(supplierReference).some(Boolean);
    const matchesContextReference=contextSupplier&&hasSupplierReference&&[
      supplierReference.supplierId&&[contextSupplier.id,contextSupplier.code].filter(Boolean).some(value=>key(value||"")===key(supplierReference.supplierId)),
      supplierReference.taxId&&key(contextSupplier.tax_id||"")===key(supplierReference.taxId),
      supplierReference.code&&key(contextSupplier.code||"")===key(supplierReference.code),
      supplierReference.name&&key(contextSupplier.name)===key(supplierReference.name),
    ].some(Boolean);

    if(contextSupplier&&importScope==="context_only"&&hasSupplierReference&&!matchesContextReference){
      contextMismatchRows++;
      issue(
        issues,sheetName,row.rowNumber,"warning",
        "Registro fuera del proveedor de contexto; se omitirá en modo Solo este proveedor.",
        supplierReference.supplierId?"PROVEEDOR_ID":supplierReference.taxId?"NIT_PROVEEDOR":supplierReference.code?"CODIGO_PROVEEDOR":"PROVEEDOR",
        supplierReference.supplierId||supplierReference.taxId||supplierReference.code||supplierReference.name||"",
        "Cambia a Importar todo el archivo si quieres distribuir también estas filas.",
      );
      parsed.push({
        row:row.rowNumber,sku,name,description:textValue(row.values.description),itemType,category,
        subcategory:textValue(row.values.subcategory),brand:textValue(row.values.brand),model:textValue(row.values.model),
        presentation:textValue(row.values.presentation),unit,barcode:textValue(row.values.barcode),supplier:null,belongsContext:false,
        site:null,location:null,warehouseName:textValue(row.values.warehouse),warehouse:null,min:0,max:0,cost:0,referencePrice:0,taxRate:0,initial:0,
        lot:textValue(row.values.lot),expiresAt:isoDateValue(row.values.expires),active:boolValue(row.values.active,true),existing:null,
      });
      continue;
    }

    const resolution=hasSupplierReference
      ?resolveImportSupplier(catalog.suppliers,supplierReference)
      :contextSupplier
        ?{supplier:contextSupplier,matchedBy:"id" as const,error:null}
        :{supplier:null,matchedBy:null,error:"No se indicó un identificador de proveedor."};
    const supplier=resolution.supplier;

    if(resolution.error){
      issue(
        issues,sheetName,row.rowNumber,"error",resolution.error,
        supplierReference.supplierId?"PROVEEDOR_ID":supplierReference.taxId?"NIT_PROVEEDOR":supplierReference.code?"CODIGO_PROVEEDOR":"PROVEEDOR",
        supplierReference.supplierId||supplierReference.taxId||supplierReference.code||supplierReference.name||"",
        "Corrige el identificador o crea el proveedor antes de importar.",
      );
    }else if(supplier&&!["materials","both"].includes(supplier.supplier_type)){
      issue(issues,sheetName,row.rowNumber,"error","El proveedor no está habilitado para materiales/suministros.","PROVEEDOR",supplier.name,"Habilita al proveedor para materiales o usa otro proveedor.");
    }

    const belongsContext=supplierBelongsToContext(supplier,contextSupplier);
    if(contextSupplier&&supplier&&!belongsContext){
      contextMismatchRows++;
      issue(
        issues,sheetName,row.rowNumber,"warning",
        "Este registro pertenece a otro proveedor: "+supplier.name+".",
        "PROVEEDOR",supplier.name,
        "Puedes importar solo el proveedor de contexto o cambiar a Importar todo el archivo.",
      );
    }

    const previous=sku?firstBySku.get(sku):null;
    if(previous){
      const compatible=previous.name===key(name)&&previous.supplierId===(supplier?.id||null);
      issue(
        issues,sheetName,row.rowNumber,compatible?"warning":"error",
        compatible?"SKU repetido compatible; se procesará únicamente la primera fila.":"Duplicado incompatible para SKU "+sku+".",
        "SKU",sku,
        compatible?"Elimina la fila duplicada para mantener el archivo limpio.":"Unifica nombre/proveedor para el SKU o usa un SKU diferente.",
      );
      if(compatible)continue;
    }else if(sku){
      firstBySku.set(sku,{row:row.rowNumber,name:key(name),supplierId:supplier?.id||null});
    }

    const site=resolveSite(catalog.sites,textValue(row.values.site));
    if(!site){
      issue(issues,sheetName,row.rowNumber,"error",textValue(row.values.site)?"Sede no encontrada.":"Falta Sede y no existe una única sede para inferirla.","SEDE",textValue(row.values.site),"Usa una sede activa de la empresa.");
    }
    const location=site?resolveLocation(catalog.locations,site.id,textValue(row.values.location)):null;
    if(site&&!location){
      issue(issues,sheetName,row.rowNumber,"error",textValue(row.values.location)?"Sububicación no encontrada dentro de la sede.":"Falta Sububicación y no existe una única opción para inferirla.","UBICACION",textValue(row.values.location),"Usa una sububicación activa de la sede.");
    }

    const warehouseName=textValue(row.values.warehouse)||"Almacén principal";
    const warehouse=site&&location?resolveWarehouse(catalog.warehouses,site.id,location.id,warehouseName):findByName(catalog.warehouses,warehouseName);
    if(!warehouse&&!fileWarehouseNames.has(key(warehouseName))){
      issue(issues,sheetName,row.rowNumber,"error","Bodega inexistente y no definida en la hoja BODEGAS.","BODEGA",warehouseName,"Crea la bodega previamente o agrégala a la hoja BODEGAS.");
    }

    if(!allowedUnits.has(key(unit))){
      issue(issues,sheetName,row.rowNumber,"warning","Unidad no incluida en el catálogo conocido.","UNIDAD",unit,"Verifica que la unidad sea consistente con el producto.");
    }

    const minValue=numberValue(row.values.min),maxValue=numberValue(row.values.max),costValue=numberValue(row.values.cost);
    const initialValue=numberValue(row.values.initial),referenceValue=numberValue(row.values.referencePrice),taxValue=numberValue(row.values.taxRate);
    if(minValue!==null&&minValue<0)issue(issues,sheetName,row.rowNumber,"error","Stock mínimo inválido.","STOCK_MINIMO",String(minValue),"Usa un valor mayor o igual a cero.");
    if(maxValue!==null&&maxValue<0)issue(issues,sheetName,row.rowNumber,"error","Stock máximo inválido.","STOCK_MAXIMO",String(maxValue),"Usa un valor mayor o igual a cero.");
    if(initialValue!==null&&initialValue<0)issue(issues,sheetName,row.rowNumber,"error","Stock inicial inválido.","STOCK_INICIAL",String(initialValue),"Usa un valor mayor o igual a cero.");
    if(costValue!==null&&costValue<0)issue(issues,sheetName,row.rowNumber,"error","Costo unitario inválido.","COSTO_UNITARIO",String(costValue),"Usa un valor mayor o igual a cero.");
    if(referenceValue!==null&&referenceValue<0)issue(issues,sheetName,row.rowNumber,"error","Precio de referencia inválido.","PRECIO_REFERENCIA",String(referenceValue),"Usa un valor mayor o igual a cero.");
    if(taxValue!==null&&(taxValue<0||taxValue>100))issue(issues,sheetName,row.rowNumber,"error","IVA inválido.","IVA",String(taxValue),"Usa un porcentaje entre 0 y 100.");

    const expiresAt=isoDateValue(row.values.expires);
    if(textValue(row.values.expires)&&!expiresAt){
      issue(issues,sheetName,row.rowNumber,"error","Fecha de vencimiento inválida.","FECHA_VENCIMIENTO",textValue(row.values.expires),"Usa formato AAAA-MM-DD.");
    }

    const active=boolValue(row.values.active,true);
    const existing=catalog.items.find(item=>item.sku.toUpperCase()===sku)||null;
    if(existing){
      existingCount++;
      const supplierChange=existing.supplier_id&&supplier&&existing.supplier_id!==supplier.id;
      issue(
        issues,sheetName,row.rowNumber,"warning",
        supplierChange
          ?"SKU existente con proveedor diferente; Actualizar cambiará la relación maestra del producto."
          :"SKU existente: puedes actualizar datos maestros u omitirlo; el Kardex histórico no se reemplaza.",
        "SKU",sku,
        "Revisa la política de duplicados antes de confirmar.",
      );
      if(!existing.active&&active)newCount++;
    }else if(active)newCount++;

    if(category&&!catalog.categories.some(existingCategory=>key(existingCategory.name)===key(category))){
      issue(issues,sheetName,row.rowNumber,"warning","Categoría nueva: se creará al confirmar.","CATEGORIA",category,"Confirma que el nombre sea el deseado.");
    }

    parsed.push({
      row:row.rowNumber,sku,name,description:textValue(row.values.description),itemType,category,
      subcategory:textValue(row.values.subcategory),brand:textValue(row.values.brand),model:textValue(row.values.model),
      presentation:textValue(row.values.presentation),unit,barcode:textValue(row.values.barcode),supplier,belongsContext,site,location,
      warehouseName,warehouse,min:Math.max(0,minValue??0),max:Math.max(0,maxValue??0),cost:Math.max(0,costValue??0),
      referencePrice:Math.max(0,referenceValue??0),taxRate:Math.max(0,taxValue??0),initial:Math.max(0,initialValue??0),
      lot:textValue(row.values.lot),expiresAt,active,existing,
    });
  }

  if(catalog.limits&&catalog.counts&&catalog.counts.inventory+newCount>catalog.limits.max_inventory_items){
    issue(issues,sheetName,1,"error","La importación excede el límite de artículos de inventario del plan.","SKU","","Reduce productos nuevos o amplía el límite de la organización.");
  }
  return {parsed,issues,newCount,existingCount,skippedServices,contextMismatchRows};
}

function warehouseValidation(rows:ParsedSheetRow[],sheetName:string,catalog:Awaited<ReturnType<typeof catalogs>>){
  const issues:Issue[]=[];
  const parsed:ParsedWarehouse[]=[];
  const names=new Set<string>();
  for(const row of safeRows(rows)){
    const name=textValue(row.values.name);
    if(!name)continue;
    const normalized=key(name);
    if(names.has(normalized)){
      issue(issues,sheetName,row.rowNumber,"warning","Bodega repetida dentro del archivo: "+name+". Se conservará una sola definición.");
      continue;
    }
    names.add(normalized);
    const siteText=textValue(row.values.site);
    const site=siteText?resolveSite(catalog.sites,siteText):(catalog.sites.length===1?catalog.sites[0]:null);
    if(siteText&&!site)issue(issues,sheetName,row.rowNumber,"error","Sede de la bodega no encontrada: "+siteText);
    const locationText=textValue(row.values.location);
    const location=site&&locationText?resolveLocation(catalog.locations,site.id,locationText):null;
    if(site&&locationText&&!location)issue(issues,sheetName,row.rowNumber,"error","Sububicación de la bodega no encontrada dentro de la sede: "+locationText);
    parsed.push({
      row:row.rowNumber,
      code:textValue(row.values.code),
      name,
      type:textValue(row.values.type)||"storage",
      responsible:textValue(row.values.responsible),
      locationDetail:textValue(row.values.locationDetail),
      capacity:numberValue(row.values.capacity),
      active:boolValue(row.values.active,true),
      notes:textValue(row.values.notes),
      site,
      location,
    });
  }
  return {parsed,issues};
}

function assetValidation(rows:ParsedSheetRow[],sheetName:string,catalog:Awaited<ReturnType<typeof catalogs>>,existingCodes:Set<string>){
  const issues:Issue[]=[];
  const parsed=[] as Array<Record<string,unknown>>;
  const fileCodes=new Set<string>();
  let newCount=0;
  for(const row of safeRows(rows)){
    const code=textValue(row.values.code).toUpperCase();
    const name=textValue(row.values.name);
    if(!code&&!name)continue;
    if(!code)issue(issues,sheetName,row.rowNumber,"error","Falta Código.");
    if(!name)issue(issues,sheetName,row.rowNumber,"error","Falta Nombre.");
    if(code&&fileCodes.has(code))issue(issues,sheetName,row.rowNumber,"error","Código repetido dentro del archivo: "+code);
    fileCodes.add(code);
    const site=resolveSite(catalog.sites,textValue(row.values.site));
    if(!site)issue(issues,sheetName,row.rowNumber,"error",textValue(row.values.site)?"Sede no encontrada.":"Falta Sede y no existe una única sede para inferirla.");
    const location=site?resolveLocation(catalog.locations,site.id,textValue(row.values.location)):null;
    if(site&&!location)issue(issues,sheetName,row.rowNumber,"error",textValue(row.values.location)?"Sububicación no encontrada dentro de la sede.":"Falta Sububicación.");
    const supplierResolution=resolveImportSupplier(catalog.suppliers,{name:textValue(row.values.supplier)});
    const supplier=supplierResolution.supplier;
    if(!supplier)issue(issues,sheetName,row.rowNumber,"error","Proveedor no encontrado.");
    const status=assetStatus(textValue(row.values.status)||"Operativo");
    if(!status)issue(issues,sheetName,row.rowNumber,"error","Estado inválido.");
    const crit=criticality(textValue(row.values.criticality)||"Media");
    if(!crit)issue(issues,sheetName,row.rowNumber,"error","Criticidad inválida.");
    const existing=existingCodes.has(code);
    if(existing)issue(issues,sheetName,row.rowNumber,"warning","Código existente: se actualizarán sus datos.");
    else newCount++;
    parsed.push({row:row.rowNumber,code,name,description:textValue(row.values.description),category:textValue(row.values.category),site,location,supplier,manufacturer:textValue(row.values.manufacturer),model:textValue(row.values.model),serial:textValue(row.values.serial),status,criticality:crit,purchaseDate:isoDateValue(row.values.purchaseDate),installationDate:isoDateValue(row.values.installationDate),warrantyDate:isoDateValue(row.values.warrantyDate),purchaseCost:Math.max(0,numberValue(row.values.purchaseCost)??0),locationDetail:textValue(row.values.locationDetail),notes:textValue(row.values.notes),existing});
  }
  if(catalog.limits&&catalog.counts&&catalog.counts.assets+newCount>catalog.limits.max_assets){
    issue(issues,sheetName,1,"error","La importación excede el límite de activos del plan.");
  }
  return {parsed,issues,newCount};
}

export async function POST(request:Request){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"No autorizado"},{status:401});
  const form=await request.formData();
  const entity=String(form.get("entity")||"inventory")==="assets"?"assets":"inventory";
  const mode=String(form.get("mode")||"validate");
  const fixedSupplierId=String(form.get("supplier_id")||"");
  if(entity==="inventory"&&!can(session,"inventory.write"))return NextResponse.json({error:"Forbidden"},{status:403});
  if(entity==="assets"&&!can(session,"assets.write"))return NextResponse.json({error:"Forbidden"},{status:403});

  let organizationId=session.organizationId;
  if(fixedSupplierId){
    const scopedSupplier=await query<{organization_id:string}>(
      "SELECT organization_id FROM suppliers WHERE id=$1 AND active=true",
      [fixedSupplierId],
    );
    if(!scopedSupplier.rowCount)return NextResponse.json({error:"Proveedor no disponible para esta importación."},{status:400});
    if(session.platformRole==="user"&&scopedSupplier.rows[0].organization_id!==session.organizationId){
      return NextResponse.json({error:"Forbidden"},{status:403});
    }
    organizationId=scopedSupplier.rows[0].organization_id;
  }
  if(!organizationId)return NextResponse.json({error:"Selecciona una empresa para importar."},{status:400});

  const file=form.get("file");
  if(!(file instanceof File))return NextResponse.json({error:"Adjunta un archivo .xlsx"},{status:400});
  if(file.size>12*1024*1024)return NextResponse.json({error:"El archivo supera 12 MB."},{status:413});
  const buffer=Buffer.from(await file.arrayBuffer());
  const hash=createHash("sha256").update(buffer).digest("hex");
  let workbook;
  try{
    workbook=await loadWorkbook(buffer);
  }catch{
    return NextResponse.json({error:"No se pudo leer el archivo. Verifica que sea un Excel .xlsx válido y no esté protegido o dañado."},{status:400});
  }
  const catalog=await catalogs(organizationId);
  const fixedSupplier=fixedSupplierId?catalog.suppliers.find(supplier=>supplier.id===fixedSupplierId)||null:null;
  if(fixedSupplierId&&!fixedSupplier)return NextResponse.json({error:"Proveedor no disponible para esta importación."},{status:400});
  const issues:Issue[]=[];

  if(entity==="inventory"){
    const requestedScope=String(form.get("import_scope")||"");
    const importScope:InventoryImportScope=fixedSupplier&&requestedScope!=="all"?"context_only":"all";
    const contextSupplier=importScope==="context_only"?fixedSupplier:null;
    const importMode:InventoryImportMode=contextSupplier?"contextual":"global";
    const duplicatePolicy:DuplicatePolicy=String(form.get("duplicate_policy")||"update")==="skip"?"skip":"update";

    const warehouseSheet=findWorksheet(workbook,["Bodegas","Almacenes","Almacén","Almacen"]);
    const warehouseRows=warehouseSheet?parseSheet(warehouseSheet,WAREHOUSE_ALIASES).rows:[];
    const parsedWarehouses=warehouseSheet
      ?warehouseValidation(warehouseRows,warehouseSheet.name,catalog)
      :{parsed:[] as ParsedWarehouse[],issues:[] as Issue[]};
    issues.push(...parsedWarehouses.issues);
    const fileWarehouseNames=new Set(parsedWarehouses.parsed.map(row=>key(row.name)));

    const sheet=findWorksheet(workbook,["Inventario","Productos"]);
    if(!sheet)return NextResponse.json({error:"No se encontró la hoja INVENTARIO o Productos."},{status:400});
    const parsedSheet=parseSheet(sheet,INVENTORY_ALIASES,["sku","name"]);
    if(parsedSheet.missing.length){
      issue(issues,sheet.name,1,"error","Faltan columnas reconocibles: "+parsedSheet.missing.join(", "),parsedSheet.missing.join(", "),"","Usa la plantilla maestra sin modificar los encabezados.");
    }
    const inv=inventoryValidation(parsedSheet.rows,sheet.name,catalog,contextSupplier,fileWarehouseNames,importScope);
    issues.push(...inv.issues);

    // The PROVEEDORES sheet is a reference/validation catalog. It never bypasses
    // the canonical Supplier module: unknown providers must be created there first.
    const providerSheet=findWorksheet(workbook,["Proveedores"]);
    const providerRows=providerSheet?parseSheet(providerSheet,PROVIDER_ALIASES).rows:[];
    if(providerSheet){
      for(const row of safeRows(providerRows)){
        const reference={
          supplierId:textValue(row.values.supplierId),
          taxId:textValue(row.values.taxId),
          code:textValue(row.values.code),
          name:textValue(row.values.name),
        };
        if(!Object.values(reference).some(Boolean))continue;
        const resolved=resolveImportSupplier(catalog.suppliers,reference);
        if(resolved.error){
          issue(
            issues,providerSheet.name,row.rowNumber,"warning","Proveedor de referencia no registrado: "+resolved.error,
            reference.supplierId?"PROVEEDOR_ID":reference.taxId?"NIT_PROVEEDOR":reference.code?"CODIGO_PROVEEDOR":"PROVEEDOR",
            reference.supplierId||reference.taxId||reference.code||reference.name||"",
            "Crea o corrige el proveedor en el módulo Proveedores antes de confirmar.",
          );
        }
      }
    }

    const selectedInventory=inv.parsed.filter(row=>importScope==="all"||row.belongsContext);
    for(const row of selectedInventory){
      if(row.site&&!canAccessSite(session,row.site.id)){
        issue(issues,sheet.name,row.row,"error","No tienes autorización sobre la sede del producto.","SEDE",row.site.name,"Solicita acceso a la sede o retira la fila del alcance de importación.");
      }
    }

    const kardexSheet=findWorksheet(workbook,["Kardex"]);
    const kardexRows=kardexSheet?parseSheet(kardexSheet,KARDEX_ALIASES).rows:[];
    const selectedKnownSkus=new Set([
      ...catalog.items
        .filter(item=>importScope==="all"||!contextSupplier||item.supplier_id===contextSupplier.id)
        .map(item=>item.sku.toUpperCase()),
      ...selectedInventory.map(row=>row.sku),
    ]);
    const allKnownSkus=new Set([...catalog.items.map(item=>item.sku.toUpperCase()),...inv.parsed.map(row=>row.sku)]);
    const parsedKardex:ParsedKardex[]=[];
    const fileMovementIds=new Set<string>();
    let omittedKardex=0;

    if(kardexSheet){
      for(const row of safeRows(kardexRows)){
        const sku=textValue(row.values.sku).toUpperCase();
        const movementId=textValue(row.values.movementId);
        if(!sku){
          issue(issues,kardexSheet.name,row.rowNumber,"error","Movimiento Kardex sin SKU.","SKU","", "Completa el SKU del producto.");
          continue;
        }

        if(importScope==="context_only"&&!selectedKnownSkus.has(sku)){
          omittedKardex++;
          issue(issues,kardexSheet.name,row.rowNumber,"warning","Movimiento omitido: el SKU no pertenece al proveedor de contexto.","SKU",sku,"Cambia a Importar todo el archivo si deseas procesarlo.");
          continue;
        }
        if(!allKnownSkus.has(sku)){
          issue(issues,kardexSheet.name,row.rowNumber,"error","SKU no existe ni está incluido en la hoja INVENTARIO: "+sku,"SKU",sku,"Crea el producto en INVENTARIO o corrige el SKU.");
        }

        if(movementId){
          if(fileMovementIds.has(key(movementId))){
            issue(issues,kardexSheet.name,row.rowNumber,"error","MOVIMIENTO_ID duplicado dentro del archivo.","MOVIMIENTO_ID",movementId,"Usa un identificador único por movimiento.");
          }else fileMovementIds.add(key(movementId));
          if(catalog.movementIds.has(key(movementId))){
            issue(issues,kardexSheet.name,row.rowNumber,"error","MOVIMIENTO_ID ya fue importado anteriormente.","MOVIMIENTO_ID",movementId,"Elimina el movimiento duplicado o asigna el identificador correcto.");
          }
        }

        const movement=movementType(textValue(row.values.movement));
        if(!movement)issue(issues,kardexSheet.name,row.rowNumber,"error","Tipo de movimiento inválido.","TIPO_MOVIMIENTO",textValue(row.values.movement),"Usa Entrada, Salida, Ajuste positivo, Ajuste negativo, Devolución o Traslado.");

        let quantity=numberValue(row.values.quantity);
        if(quantity===null){
          const entry=numberValue(row.values.entry)??0,exit=numberValue(row.values.exit)??0;
          quantity=entry>0?entry:exit>0?exit:null;
        }
        if(quantity===null||quantity<=0)issue(issues,kardexSheet.name,row.rowNumber,"error","Cantidad inválida.","CANTIDAD",textValue(row.values.quantity),"Usa una cantidad mayor que cero.");
        const rawCost=numberValue(row.values.cost);
        if(rawCost!==null&&rawCost<0)issue(issues,kardexSheet.name,row.rowNumber,"error","Costo inválido.","COSTO_UNITARIO",String(rawCost),"Usa un valor mayor o igual a cero.");

        const date=isoDateValue(row.values.date);
        if(!date)issue(issues,kardexSheet.name,row.rowNumber,"error","Fecha inválida; usa AAAA-MM-DD.","FECHA",textValue(row.values.date),"Usa formato AAAA-MM-DD.");

        const warehouseName=textValue(row.values.warehouse);
        if(!warehouseName){
          issue(issues,kardexSheet.name,row.rowNumber,"error","Falta Bodega origen.","BODEGA","", "Indica una bodega existente o definida en la hoja BODEGAS.");
        }else if(!findByName(catalog.warehouses,warehouseName)&&!fileWarehouseNames.has(key(warehouseName))){
          issue(issues,kardexSheet.name,row.rowNumber,"error","Bodega origen inexistente y no definida en BODEGAS.","BODEGA",warehouseName,"Crea la bodega o agrégala a la hoja BODEGAS.");
        }

        const destination=textValue(row.values.destination);
        if(movement?.type==="transfer"){
          if(!destination)issue(issues,kardexSheet.name,row.rowNumber,"error","El traslado requiere Bodega destino.","BODEGA_DESTINO","", "Selecciona una bodega destino diferente.");
          else if(!findByName(catalog.warehouses,destination)&&!fileWarehouseNames.has(key(destination))){
            issue(issues,kardexSheet.name,row.rowNumber,"error","Bodega destino inexistente y no definida en BODEGAS.","BODEGA_DESTINO",destination,"Crea la bodega o agrégala a la hoja BODEGAS.");
          }
          if(destination&&key(destination)===key(warehouseName))issue(issues,kardexSheet.name,row.rowNumber,"error","La bodega destino debe ser diferente de la bodega origen.","BODEGA_DESTINO",destination,"Selecciona otra bodega.");
        }

        const expiresAt=isoDateValue(row.values.expires);
        if(textValue(row.values.expires)&&!expiresAt)issue(issues,kardexSheet.name,row.rowNumber,"error","Fecha de vencimiento inválida; usa AAAA-MM-DD.","FECHA_VENCIMIENTO",textValue(row.values.expires),"Usa formato AAAA-MM-DD.");

        const inventoryRow=inv.parsed.find(candidate=>candidate.sku===sku&&candidate.supplier)||null;
        const existingItem=catalog.items.find(candidate=>candidate.sku.toUpperCase()===sku)||null;
        const expectedSupplier=inventoryRow?.supplier||catalog.suppliers.find(supplier=>supplier.id===existingItem?.supplier_id)||null;
        const reference={
          supplierId:textValue(row.values.supplierId),
          taxId:textValue(row.values.supplierTaxId),
          code:textValue(row.values.supplierCode),
          name:textValue(row.values.supplier),
        };
        let movementSupplier=expectedSupplier;
        if(Object.values(reference).some(Boolean)){
          const resolved=resolveImportSupplier(catalog.suppliers,reference);
          if(resolved.error){
            issue(issues,kardexSheet.name,row.rowNumber,"error",resolved.error,"PROVEEDOR",reference.supplierId||reference.taxId||reference.code||reference.name||"","Corrige el proveedor del movimiento.");
          }else{
            movementSupplier=resolved.supplier;
            if(expectedSupplier&&resolved.supplier?.id!==expectedSupplier.id){
              issue(
                issues,kardexSheet.name,row.rowNumber,"error",
                "El proveedor del movimiento no coincide con el proveedor registrado para el SKU.",
                "PROVEEDOR",resolved.supplier?.name||"",
                "Deja el proveedor vacío para heredarlo del SKU o corrige el identificador.",
              );
            }
          }
        }

        parsedKardex.push({
          row:row.rowNumber,movementId,sku,movement:movement||{type:"receipt",sign:1},date,document:textValue(row.values.document),
          warehouseName,destination,quantity:quantity??0,cost:Math.max(0,rawCost??0),supplier:movementSupplier,
          belongsContext:supplierBelongsToContext(movementSupplier,contextSupplier),lot:textValue(row.values.lot),expiresAt,
          costCenter:textValue(row.values.costCenter),sourceUser:textValue(row.values.sourceUser),notes:textValue(row.values.notes),
        });
      }
    }

    const selectedKardex=parsedKardex.filter(row=>importScope==="all"||row.belongsContext);

    // Simulate the complete physical sequence before commit. PostgreSQL remains
    // the final stock authority, but users should see negative-stock failures in
    // the validation step instead of after pressing Confirmar.
    const simulatedStock=new Map<string,number>();
    for(const level of catalog.stockLevels){
      simulatedStock.set(level.sku.toUpperCase()+"|"+key(level.warehouse_name),Number(level.quantity||0));
    }
    for(const row of selectedInventory){
      if(!row.existing&&row.initial>0){
        const stockKey=row.sku+"|"+key(row.warehouseName);
        simulatedStock.set(stockKey,(simulatedStock.get(stockKey)||0)+row.initial);
      }
    }
    for(const row of selectedKardex){
      const sourceKey=row.sku+"|"+key(row.warehouseName);
      const current=simulatedStock.get(sourceKey)||0;
      let sourceDelta=0;
      if(row.movement.type==="receipt"||row.movement.type==="return")sourceDelta=Math.abs(row.quantity);
      else if(row.movement.type==="issue"||row.movement.type==="transfer")sourceDelta=-Math.abs(row.quantity);
      else if(row.movement.type==="adjustment")sourceDelta=row.quantity*row.movement.sign;

      if(current+sourceDelta<-0.000001){
        issue(
          issues,kardexSheet?.name||"KARDEX",row.row,"error",
          "El movimiento dejaría existencias negativas en la bodega de origen.",
          "CANTIDAD",String(row.quantity),
          "Ajusta la cantidad, registra antes la entrada correspondiente o corrige la bodega.",
        );
      }else{
        simulatedStock.set(sourceKey,current+sourceDelta);
        if(row.movement.type==="transfer"&&row.destination){
          const destinationKey=row.sku+"|"+key(row.destination);
          simulatedStock.set(destinationKey,(simulatedStock.get(destinationKey)||0)+Math.abs(row.quantity));
        }
      }
    }
    const selectedSupplierIds=new Set(selectedInventory.map(row=>row.supplier?.id).filter(Boolean) as string[]);
    selectedKardex.forEach(row=>{if(row.supplier)selectedSupplierIds.add(row.supplier.id);});
    const supplierGroups=[...selectedSupplierIds].map(supplierId=>{
      const supplier=catalog.suppliers.find(item=>item.id===supplierId)!;
      return {
        id:supplier.id,code:supplier.code,name:supplier.name,taxId:supplier.tax_id,
        products:selectedInventory.filter(row=>row.supplier?.id===supplier.id).length,
        movements:selectedKardex.filter(row=>row.supplier?.id===supplier.id).length,
        context:contextSupplier?.id===supplier.id,
      };
    }).sort((a,b)=>a.name.localeCompare(b.name,"es"));

    const neededWarehouseNames=new Set<string>();
    selectedInventory.forEach(row=>neededWarehouseNames.add(key(row.warehouseName)));
    selectedKardex.forEach(row=>{neededWarehouseNames.add(key(row.warehouseName));if(row.destination)neededWarehouseNames.add(key(row.destination));});
    const warehousesToCommit=parsedWarehouses.parsed.filter(row=>neededWarehouseNames.has(key(row.name)));
    for(const row of warehousesToCommit){
      if(row.site&&!canAccessSite(session,row.site.id)){
        issue(issues,warehouseSheet?.name||"BODEGAS",row.row,"error","No tienes autorización para administrar esta bodega.","SEDE",row.site.name,"Solicita acceso o retira la bodega del alcance.");
      }
    }

    const errors=issues.filter(item=>item.severity==="error");
    const otherSupplierRows=inv.contextMismatchRows+omittedKardex;
    const omittedByScope=importScope==="context_only"?otherSupplierRows:0;
    const summary={
      productsDetected:inv.parsed.length,
      inventoryRows:selectedInventory.length,
      newItems:selectedInventory.filter(row=>!row.existing).length,
      existingItems:selectedInventory.filter(row=>Boolean(row.existing)).length,
      kardexRows:selectedKardex.length,
      suppliersDetected:supplierGroups.length,
      warehouseRows:warehousesToCommit.length,
      skippedServices:inv.skippedServices,
      omittedRows:omittedByScope,
      warnings:issues.filter(item=>item.severity==="warning").length,
      errors:errors.length,
    };
    const context={
      mode:importMode,
      scope:importScope,
      supplier:fixedSupplier?{id:fixedSupplier.id,code:fixedSupplier.code,name:fixedSupplier.name,taxId:fixedSupplier.tax_id}:null,
      otherSupplierRows,
      canSwitchGlobal:Boolean(fixedSupplier),
    };

    if(mode!=="commit"||errors.length){
      return NextResponse.json({
        entity,valid:errors.length===0,summary,issues:issues.slice(0,350),supplierGroups,context,duplicatePolicy,
      });
    }

    const duplicate=await query("SELECT 1 FROM bulk_import_batches WHERE organization_id=$1 AND entity='inventory' AND file_hash=$2 AND status='committed'",[organizationId,hash]);
    if(duplicate.rowCount)return NextResponse.json({error:"Este mismo archivo ya fue importado anteriormente. Revisa el historial para evitar duplicar Kardex."},{status:409});

    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      const skippedExisting=duplicatePolicy==="skip"?selectedInventory.filter(row=>Boolean(row.existing)).length:0;
      const omittedRows=omittedByScope+inv.skippedServices+skippedExisting;
      const batch=await client.query<{id:string;import_number:string;created_at:string}>(
        `INSERT INTO bulk_import_batches(
           organization_id,user_id,entity,file_name,file_hash,status,total_rows,error_rows,warning_rows,origin,context_supplier_id,commit_scope,omitted_rows
         ) VALUES($1,$2,'inventory',$3,$4,'validated',$5,0,$6,$7,$8,$9,$10)
         RETURNING id,import_number::text,created_at::text`,
        [
          organizationId,session.userId||null,file.name,hash,
          inv.parsed.length+parsedKardex.length+warehousesToCommit.length+inv.skippedServices,
          issues.filter(item=>item.severity==="warning").length,
          importMode==="contextual"?"supplier":"global",fixedSupplier?.id||null,importScope,omittedRows,
        ],
      );
      const batchId=batch.rows[0].id;
      const itemMap=new Map<string,{id:string;site_id:string;location_id:string;warehouse_id:string;supplier_id:string|null}>();
      const warehouseCache=[...catalog.warehouses];

      for(const row of warehousesToCommit){
        const existingWarehouse=findByName(warehouseCache,row.name);
        let resolved:Warehouse;
        if(existingWarehouse){
          const updated=await client.query<Warehouse>(
            `UPDATE inventory_warehouses SET
               site_id=COALESCE($1,site_id),location_id=COALESCE($2,location_id),type=$3,responsible=$4,capacity=$5,
               active=$6,location_detail=$7,notes=$8,updated_at=now()
             WHERE id=$9 AND organization_id=$10
             RETURNING id,site_id,location_id,name`,
            [row.site?.id||null,row.location?.id||null,row.type,row.responsible||null,row.capacity,row.active,row.locationDetail||null,row.notes||null,existingWarehouse.id,organizationId],
          );
          resolved=updated.rows[0];
        }else{
          const warehouseCode=row.code?row.code.trim().toUpperCase():stableCode("ALM",row.name);
          const created=await client.query<Warehouse>(
            `INSERT INTO inventory_warehouses(
               organization_id,site_id,location_id,code,name,type,responsible,capacity,active,location_detail,notes,updated_at
             ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
             ON CONFLICT(organization_id,code) DO UPDATE SET
               site_id=COALESCE(EXCLUDED.site_id,inventory_warehouses.site_id),
               location_id=COALESCE(EXCLUDED.location_id,inventory_warehouses.location_id),
               name=EXCLUDED.name,type=EXCLUDED.type,responsible=EXCLUDED.responsible,capacity=EXCLUDED.capacity,
               active=EXCLUDED.active,location_detail=EXCLUDED.location_detail,notes=EXCLUDED.notes,updated_at=now()
             RETURNING id,site_id,location_id,name`,
            [organizationId,row.site?.id||null,row.location?.id||null,warehouseCode,row.name,row.type,row.responsible||null,row.capacity,row.active,row.locationDetail||null,row.notes||null],
          );
          resolved=created.rows[0];
        }
        const current=warehouseCache.findIndex(item=>key(item.name)===key(resolved.name));
        if(current>=0)warehouseCache[current]=resolved;else warehouseCache.push(resolved);
      }

      for(const row of selectedInventory){
        const supplier=row.supplier,site=row.site,location=row.location;
        if(!supplier||!site||!location)throw new Error("Relaciones no resueltas para SKU "+row.sku);
        if(!canAccessSite(session,site.id))throw new Error("Sede no autorizada: "+site.name);

        if(duplicatePolicy==="skip"&&row.existing){
          const current=await client.query<{id:string;site_id:string;location_id:string;warehouse_id:string;supplier_id:string|null}>(
            "SELECT id,site_id,location_id,warehouse_id,supplier_id FROM inventory_items WHERE id=$1 AND organization_id=$2",
            [row.existing.id,organizationId],
          );
          if(!current.rowCount)throw new Error("SKU existente no disponible: "+row.sku);
          itemMap.set(row.sku,current.rows[0]);
          continue;
        }

        const warehouse=findByName(warehouseCache,row.warehouseName);
        if(!warehouse)throw new Error("Bodega no resuelta: "+row.warehouseName);

        let categoryId:string|null=null;
        if(row.category){
          const categoryCode=stableCode("CAT",row.category);
          const category=await client.query<{id:string}>(
            "INSERT INTO inventory_categories(organization_id,code,name) VALUES($1,$2,$3) ON CONFLICT(organization_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id",
            [organizationId,categoryCode,row.category],
          );
          categoryId=category.rows[0].id;
        }

        const existing=await client.query<{id:string}>("SELECT id FROM inventory_items WHERE organization_id=$1 AND upper(sku)=upper($2)",[organizationId,row.sku]);
        let itemId:string;
        if(existing.rowCount){
          itemId=existing.rows[0].id;
          await client.query(
            `UPDATE inventory_items SET
               site_id=$1,location_id=$2,supplier_id=$3,category_id=$4,warehouse_id=$5,name=$6,description=$7,presentation=$8,unit=$9,
               min_quantity=$10,max_quantity=$11,unit_cost=$12,storage_location=$13,active=$14,subcategory=$15,brand=$16,model=$17,
               barcode=$18,reference_price=$19,tax_rate=$20,updated_at=now()
             WHERE id=$21`,
            [
              site.id,location.id,supplier.id,categoryId,warehouse.id,row.name,row.description||null,row.presentation||null,row.unit,
              row.min,row.max,row.cost,row.warehouseName,row.active,row.subcategory||null,row.brand||null,row.model||null,row.barcode||null,
              row.referencePrice,row.taxRate,itemId,
            ],
          );
        }else{
          const inserted=await client.query<{id:string}>(
            `INSERT INTO inventory_items(
               organization_id,site_id,location_id,supplier_id,category_id,warehouse_id,sku,name,description,presentation,unit,quantity,
               min_quantity,max_quantity,unit_cost,storage_location,active,subcategory,brand,model,barcode,reference_price,tax_rate
             ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING id`,
            [
              organizationId,site.id,location.id,supplier.id,categoryId,warehouse.id,row.sku,row.name,row.description||null,row.presentation||null,
              row.unit,row.min,row.max,row.cost,row.warehouseName,row.active,row.subcategory||null,row.brand||null,row.model||null,row.barcode||null,
              row.referencePrice,row.taxRate,
            ],
          );
          itemId=inserted.rows[0].id;
          if(row.initial>0){
            await client.query(
              `INSERT INTO inventory_transactions(
                 organization_id,item_id,type,quantity,unit_cost,warehouse_id,document_number,movement_at,created_by,import_batch_id,source_row,
                 lot_number,expires_at,notes
               ) VALUES($1,$2,'receipt',$3,$4,$5,'IMPORT-INICIAL',now(),$6,$7,$8,$9,$10,'Stock inicial de importación')`,
              [organizationId,itemId,row.initial,row.cost||null,warehouse.id,session.userId||null,batchId,row.row,row.lot||null,row.expiresAt||null],
            );
          }
        }

        await client.query(
          "INSERT INTO inventory_stock_levels(organization_id,item_id,warehouse_id,quantity,min_quantity,max_quantity) VALUES($1,$2,$3,0,$4,$5) ON CONFLICT(item_id,warehouse_id) DO UPDATE SET min_quantity=EXCLUDED.min_quantity,max_quantity=EXCLUDED.max_quantity,updated_at=now()",
          [organizationId,itemId,warehouse.id,row.min,row.max],
        );
        itemMap.set(row.sku,{id:itemId,site_id:site.id,location_id:location.id,warehouse_id:warehouse.id,supplier_id:supplier.id});
      }

      for(const row of selectedKardex){
        let item=itemMap.get(row.sku);
        if(!item){
          const found=await client.query<{id:string;site_id:string;location_id:string;warehouse_id:string;supplier_id:string|null}>(
            "SELECT id,site_id,location_id,warehouse_id,supplier_id FROM inventory_items WHERE organization_id=$1 AND upper(sku)=upper($2)",
            [organizationId,row.sku],
          );
          if(!found.rowCount)throw new Error("SKU no resuelto: "+row.sku);
          item=found.rows[0];
        }
        if(!canAccessSite(session,item.site_id))throw new Error("Sede no autorizada para SKU "+row.sku);
        if(row.supplier&&item.supplier_id&&row.supplier.id!==item.supplier_id)throw new Error("El proveedor del movimiento no coincide con el proveedor del SKU "+row.sku+".");

        const source=findByName(warehouseCache,row.warehouseName);
        if(!source)throw new Error("Bodega origen no resuelta: "+row.warehouseName);
        const destination=row.movement.type==="transfer"?findByName(warehouseCache,row.destination):null;
        if(row.movement.type==="transfer"&&!destination)throw new Error("Bodega destino no resuelta: "+row.destination);

        const signed=row.quantity*row.movement.sign;
        const auditNote=[row.notes,row.sourceUser?"Responsable origen archivo: "+row.sourceUser:""].filter(Boolean).join(" · ");
        await client.query(
          `INSERT INTO inventory_transactions(
             organization_id,item_id,type,quantity,unit_cost,warehouse_id,destination_warehouse_id,document_number,movement_at,
             created_by,import_batch_id,source_row,source_movement_id,lot_number,expires_at,cost_center,notes
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10,$11,$12,$13,$14,$15,$16,$17)`,
          [
            organizationId,item.id,row.movement.type,signed,row.cost||null,source.id,destination?.id||null,row.document||null,row.date,
            session.userId||null,batchId,row.row,row.movementId||null,row.lot||null,row.expiresAt||null,row.costCenter||null,auditNote||null,
          ],
        );
      }

      const importedRows=(duplicatePolicy==="skip"?selectedInventory.filter(row=>!row.existing).length:selectedInventory.length)+selectedKardex.length+warehousesToCommit.length;
      const committedSummary={
        items:duplicatePolicy==="skip"?selectedInventory.filter(row=>!row.existing).length:selectedInventory.length,
        existingSkipped:skippedExisting,kardex:selectedKardex.length,warehouses:warehousesToCommit.length,
        skippedServices:inv.skippedServices,omittedRows,warnings:issues.filter(item=>item.severity==="warning").length,
      };
      await client.query(
        "UPDATE bulk_import_batches SET status='committed',imported_rows=$1,omitted_rows=$2,committed_at=now(),summary=$3::jsonb WHERE id=$4",
        [importedRows,omittedRows,JSON.stringify(committedSummary),batchId],
      );
      await client.query(
        `INSERT INTO audit_log(organization_id,user_id,action,entity_type,entity_id,metadata)
         VALUES($1,$2,'inventory.bulk_import_committed','bulk_import_batch',$3,$4::jsonb)`,
        [
          organizationId,session.userId||null,batchId,
          JSON.stringify({origin:importMode,scope:importScope,context_supplier_id:fixedSupplier?.id||null,duplicate_policy:duplicatePolicy,file_name:file.name,summary:committedSummary}),
        ],
      );
      await client.query("COMMIT");

      return NextResponse.json({
        ok:true,
        importId:importBatchLabel(batch.rows[0].import_number,batch.rows[0].created_at),
        summary:{...summary,items:committedSummary.items,kardex:committedSummary.kardex,warehouses:committedSummary.warehouses,omittedRows},
        supplierGroups,context,
      });
    }catch(error){
      await client.query("ROLLBACK");
      return NextResponse.json({error:error instanceof Error?error.message:"No fue posible importar el archivo."},{status:400});
    }finally{client.release();}
  }

  const sheet=findWorksheet(workbook,["Activos"]);
  if(!sheet)return NextResponse.json({error:"No se encontró la hoja Activos."},{status:400});
  const parsedSheet=parseSheet(sheet,ASSET_ALIASES,["code","name","supplier"]);
  if(parsedSheet.missing.length)issue(issues,sheet.name,1,"error","Faltan columnas reconocibles: "+parsedSheet.missing.join(", "));
  const existingCodesResult=await query<{code:string}>("SELECT code FROM assets WHERE organization_id=$1",[organizationId]);
  const assets=assetValidation(parsedSheet.rows,sheet.name,catalog,new Set(existingCodesResult.rows.map(row=>row.code.toUpperCase())));
  issues.push(...assets.issues);
  const errors=issues.filter(item=>item.severity==="error");
  if(mode!=="commit"||errors.length){
    return NextResponse.json({entity,valid:errors.length===0,summary:{assetRows:assets.parsed.length,newAssets:assets.newCount,warnings:issues.filter(i=>i.severity==="warning").length,errors:errors.length},issues:issues.slice(0,250)});
  }
  const duplicate=await query("SELECT 1 FROM bulk_import_batches WHERE organization_id=$1 AND entity='assets' AND file_hash=$2 AND status='committed'",[organizationId,hash]);
  if(duplicate.rowCount)return NextResponse.json({error:"Este mismo archivo ya fue importado anteriormente."},{status:409});

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const batch=await client.query<{id:string}>(
      "INSERT INTO bulk_import_batches(organization_id,user_id,entity,file_name,file_hash,status,total_rows,error_rows,warning_rows) VALUES($1,$2,'assets',$3,$4,'validated',$5,0,$6) RETURNING id",
      [organizationId,session.userId||null,file.name,hash,assets.parsed.length,issues.filter(i=>i.severity==="warning").length],
    );
    for(const row of assets.parsed){
      const site=row.site as Site,location=row.location as Location,supplier=row.supplier as Supplier;
      if(!canAccessSite(session,site.id))throw new Error("Sede no autorizada: "+site.name);
      let categoryId:string|null=null;
      if(row.category){
        const cat=await client.query<{id:string}>(
          "INSERT INTO asset_categories(organization_id,name) VALUES($1,$2) ON CONFLICT(organization_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id",
          [organizationId,row.category],
        );
        categoryId=cat.rows[0].id;
      }
      const existing=await client.query<{id:string}>("SELECT id FROM assets WHERE organization_id=$1 AND upper(code)=upper($2)",[organizationId,row.code]);
      if(existing.rowCount){
        await client.query(
          "UPDATE assets SET site_id=$1,location_id=$2,supplier_id=$3,category_id=$4,name=$5,description=$6,manufacturer=$7,model=$8,serial_number=$9,status=$10,criticality=$11,purchase_date=$12,installation_date=$13,warranty_expires=$14,purchase_cost=$15,location_detail=$16,notes=$17,updated_at=now() WHERE id=$18",
          [site.id,location.id,supplier.id,categoryId,row.name,row.description||null,row.manufacturer||null,row.model||null,row.serial||null,row.status,row.criticality,row.purchaseDate||null,row.installationDate||null,row.warrantyDate||null,row.purchaseCost,row.locationDetail||null,row.notes||null,existing.rows[0].id],
        );
      }else{
        await client.query(
          "INSERT INTO assets(organization_id,site_id,location_id,supplier_id,category_id,code,name,description,manufacturer,model,serial_number,status,criticality,purchase_date,installation_date,warranty_expires,purchase_cost,location_detail,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)",
          [organizationId,site.id,location.id,supplier.id,categoryId,row.code,row.name,row.description||null,row.manufacturer||null,row.model||null,row.serial||null,row.status,row.criticality,row.purchaseDate||null,row.installationDate||null,row.warrantyDate||null,row.purchaseCost,row.locationDetail||null,row.notes||null],
        );
      }
    }
    await client.query("UPDATE bulk_import_batches SET status='committed',imported_rows=$1,committed_at=now(),summary=$2::jsonb WHERE id=$3",[assets.parsed.length,JSON.stringify({assets:assets.parsed.length}),batch.rows[0].id]);
    await client.query("COMMIT");
    return NextResponse.json({ok:true,summary:{assets:assets.parsed.length,warnings:issues.filter(i=>i.severity==="warning").length}});
  }catch(error){
    await client.query("ROLLBACK");
    return NextResponse.json({error:error instanceof Error?error.message:"No fue posible importar activos."},{status:400});
  }finally{client.release();}
}
