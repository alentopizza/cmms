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

type Issue={sheet:string;row:number;severity:"error"|"warning";message:string};
type Supplier={id:string;name:string;tax_id:string|null;supplier_type:string};
type Site={id:string;name:string};
type Location={id:string;site_id:string;name:string};
type Warehouse={id:string;site_id:string|null;location_id:string|null;name:string};
type Item={id:string;sku:string;site_id:string|null;location_id:string|null;warehouse_id:string|null;quantity:string};

const INVENTORY_ALIASES={
  sku:["SKU *","SKU","Código","Codigo","Item"],
  name:["Nombre *","Nombre","Nombre producto/servicio","Producto"],
  description:["Descripción","Descripcion"],
  category:["Categoría","Categoria"],
  presentation:["Presentación","Presentacion"],
  unit:["Unidad *","Unidad"],
  supplier:["Proveedor *","Proveedor"],
  supplierType:["Tipo proveedor"],
  site:["Sede *","Sede"],
  location:["Sububicación *","Sububicacion","Ubicación física","Ubicacion fisica"],
  warehouse:["Bodega *","Bodega","Almacén","Almacen","Ubicación","Ubicacion"],
  min:["Stock mínimo","Stock minimo"],
  max:["Stock máximo","Stock maximo"],
  cost:["Costo unitario","Valor unitario"],
  initial:["Stock inicial","Existencia inicial"],
  active:["Activo"],
};
const KARDEX_ALIASES={
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
  notes:["Observaciones"],
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
function issue(issues:Issue[],sheet:string,row:number,severity:Issue["severity"],message:string){
  issues.push({sheet,row,severity,message});
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
function resolveSupplier(rows:Supplier[],value:string){
  const normalized=key(value);
  return rows.find(row=>key(row.name)===normalized||key(row.tax_id||"")===normalized)||null;
}

async function catalogs(organizationId:string){
  const [suppliers,sites,locations,warehouses,items,limits,counts]=await Promise.all([
    query<Supplier>("SELECT id,name,tax_id,supplier_type FROM suppliers WHERE organization_id=$1 AND active=true ORDER BY name",[organizationId]),
    query<Site>("SELECT id,name FROM sites WHERE organization_id=$1 AND active=true ORDER BY name",[organizationId]),
    query<Location>("SELECT id,site_id,name FROM locations WHERE organization_id=$1 AND active=true ORDER BY name",[organizationId]),
    query<Warehouse>("SELECT id,site_id,location_id,name FROM inventory_warehouses WHERE organization_id=$1 AND active=true ORDER BY name",[organizationId]),
    query<Item>("SELECT id,sku,site_id,location_id,warehouse_id,quantity::text FROM inventory_items WHERE organization_id=$1 AND active=true",[organizationId]),
    query<{max_assets:number;max_inventory_items:number}>("SELECT max_assets,max_inventory_items FROM organization_limits WHERE organization_id=$1",[organizationId]),
    query<{assets:number;inventory:number}>("SELECT (SELECT count(*)::int FROM assets WHERE organization_id=$1) assets,(SELECT count(*)::int FROM inventory_items WHERE organization_id=$1 AND active=true) inventory",[organizationId]),
  ]);
  return {suppliers:suppliers.rows,sites:sites.rows,locations:locations.rows,warehouses:warehouses.rows,items:items.rows,limits:limits.rows[0],counts:counts.rows[0]};
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

function inventoryValidation(rows:ParsedSheetRow[],sheetName:string,catalog:Awaited<ReturnType<typeof catalogs>>){
  const issues:Issue[]=[];
  const parsed=[] as Array<Record<string,unknown>>;
  const fileSkus=new Set<string>();
  let newCount=0;
  for(const row of safeRows(rows)){
    const sku=textValue(row.values.sku).toUpperCase();
    const name=textValue(row.values.name);
    if(!sku&&!name)continue;
    if(!sku)issue(issues,sheetName,row.rowNumber,"error","Falta SKU.");
    if(!name)issue(issues,sheetName,row.rowNumber,"error","Falta nombre.");
    if(sku&&fileSkus.has(sku))issue(issues,sheetName,row.rowNumber,"error","SKU repetido dentro del archivo: "+sku);
    fileSkus.add(sku);
    const supplier=resolveSupplier(catalog.suppliers,textValue(row.values.supplier));
    if(!supplier)issue(issues,sheetName,row.rowNumber,"error","Proveedor no encontrado en la empresa.");
    else if(!["materials","both"].includes(supplier.supplier_type))issue(issues,sheetName,row.rowNumber,"error","El proveedor no está habilitado para materiales/suministros.");
    const site=resolveSite(catalog.sites,textValue(row.values.site));
    if(!site)issue(issues,sheetName,row.rowNumber,"error",textValue(row.values.site)?"Sede no encontrada.":"Falta Sede y no existe una única sede para inferirla.");
    const location=site?resolveLocation(catalog.locations,site.id,textValue(row.values.location)):null;
    if(site&&!location)issue(issues,sheetName,row.rowNumber,"error",textValue(row.values.location)?"Sububicación no encontrada dentro de la sede.":"Falta Sububicación y no existe una única opción para inferirla.");
    const warehouseName=textValue(row.values.warehouse)||"Almacén principal";
    const warehouse=site&&location?resolveWarehouse(catalog.warehouses,site.id,location.id,warehouseName):null;
    if(site&&location&&!warehouse)issue(issues,sheetName,row.rowNumber,"warning","La bodega '"+warehouseName+"' se creará durante la importación.");
    const unit=textValue(row.values.unit)||"unidad";
    const min=Math.max(0,numberValue(row.values.min)??0);
    const max=Math.max(0,numberValue(row.values.max)??0);
    const cost=Math.max(0,numberValue(row.values.cost)??0);
    const initial=Math.max(0,numberValue(row.values.initial)??0);
    const existing=catalog.items.find(item=>item.sku.toUpperCase()===sku);
    if(existing)issue(issues,sheetName,row.rowNumber,"warning","SKU existente: se actualizarán datos maestros; Stock inicial no reemplazará existencias actuales.");
    else newCount++;
    parsed.push({row:row.rowNumber,sku,name,description:textValue(row.values.description),category:textValue(row.values.category),presentation:textValue(row.values.presentation),unit,supplier,site,location,warehouseName,warehouse,min,max,cost,initial,active:boolValue(row.values.active,true),existing});
  }
  if(catalog.limits&&catalog.counts&&catalog.counts.inventory+newCount>catalog.limits.max_inventory_items){
    issue(issues,sheetName,1,"error","La importación excede el límite de artículos de inventario del plan.");
  }
  return {parsed,issues,newCount};
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
    const supplier=resolveSupplier(catalog.suppliers,textValue(row.values.supplier));
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
  if(entity==="inventory"&&!can(session,"inventory.write"))return NextResponse.json({error:"Forbidden"},{status:403});
  if(entity==="assets"&&!can(session,"assets.write"))return NextResponse.json({error:"Forbidden"},{status:403});
  if(!session.organizationId)return NextResponse.json({error:"Selecciona una empresa para importar."},{status:400});
  const file=form.get("file");
  if(!(file instanceof File))return NextResponse.json({error:"Adjunta un archivo .xlsx"},{status:400});
  if(file.size>12*1024*1024)return NextResponse.json({error:"El archivo supera 12 MB."},{status:413});
  const buffer=Buffer.from(await file.arrayBuffer());
  const hash=createHash("sha256").update(buffer).digest("hex");
  const organizationId=session.organizationId;
  const workbook=await loadWorkbook(buffer);
  const catalog=await catalogs(organizationId);
  const issues:Issue[]=[];

  if(entity==="inventory"){
    const sheet=findWorksheet(workbook,["Inventario","Productos"]);
    if(!sheet)return NextResponse.json({error:"No se encontró la hoja Inventario o Productos."},{status:400});
    const parsedSheet=parseSheet(sheet,INVENTORY_ALIASES,["sku","name","supplier"]);
    if(parsedSheet.missing.length)issue(issues,sheet.name,1,"error","Faltan columnas reconocibles: "+parsedSheet.missing.join(", "));
    const inv=inventoryValidation(parsedSheet.rows,sheet.name,catalog);
    issues.push(...inv.issues);

    const kardexSheet=findWorksheet(workbook,["Kardex"]);
    const kardexRows=kardexSheet?parseSheet(kardexSheet,KARDEX_ALIASES).rows:[];
    const knownSkus=new Set([...catalog.items.map(item=>item.sku.toUpperCase()),...inv.parsed.map(row=>String(row.sku))]);
    const parsedKardex=[] as Array<Record<string,unknown>>;
    if(kardexSheet){
      for(const row of safeRows(kardexRows)){
        const sku=textValue(row.values.sku).toUpperCase();
        if(!sku)continue;
        if(!knownSkus.has(sku))issue(issues,kardexSheet.name,row.rowNumber,"error","SKU no existe ni está incluido en la hoja Inventario: "+sku);
        const movement=movementType(textValue(row.values.movement));
        if(!movement)issue(issues,kardexSheet.name,row.rowNumber,"error","Tipo de movimiento inválido.");
        let quantity=numberValue(row.values.quantity);
        if(quantity===null){
          const entry=numberValue(row.values.entry)??0,exit=numberValue(row.values.exit)??0;
          quantity=entry>0?entry:exit>0?exit:null;
        }
        if(quantity===null||quantity<=0)issue(issues,kardexSheet.name,row.rowNumber,"error","Cantidad inválida.");
        const date=isoDateValue(row.values.date);
        if(!date)issue(issues,kardexSheet.name,row.rowNumber,"error","Fecha inválida; usa AAAA-MM-DD.");
        const warehouseName=textValue(row.values.warehouse);
        if(!warehouseName)issue(issues,kardexSheet.name,row.rowNumber,"error","Falta Bodega origen.");
        const destination=textValue(row.values.destination);
        if(movement?.type==="transfer"&&!destination)issue(issues,kardexSheet.name,row.rowNumber,"error","El traslado requiere Bodega destino.");
        parsedKardex.push({row:row.rowNumber,sku,movement,date,document:textValue(row.values.document),warehouseName,destination,quantity:quantity??0,cost:Math.max(0,numberValue(row.values.cost)??0),notes:textValue(row.values.notes)});
      }
    }

    const errors=issues.filter(item=>item.severity==="error");
    if(mode!=="commit"||errors.length){
      return NextResponse.json({entity,valid:errors.length===0,summary:{inventoryRows:inv.parsed.length,kardexRows:parsedKardex.length,newItems:inv.newCount,warnings:issues.filter(i=>i.severity==="warning").length,errors:errors.length},issues:issues.slice(0,250)});
    }

    const duplicate=await query("SELECT 1 FROM bulk_import_batches WHERE organization_id=$1 AND entity='inventory' AND file_hash=$2 AND status='committed'",[organizationId,hash]);
    if(duplicate.rowCount)return NextResponse.json({error:"Este mismo archivo ya fue importado anteriormente."},{status:409});

    const client=await pool.connect();
    try{
      await client.query("BEGIN");
      const batch=await client.query<{id:string}>(
        "INSERT INTO bulk_import_batches(organization_id,user_id,entity,file_name,file_hash,status,total_rows,error_rows,warning_rows) VALUES($1,$2,'inventory',$3,$4,'validated',$5,0,$6) RETURNING id",
        [organizationId,session.userId||null,file.name,hash,inv.parsed.length+parsedKardex.length,issues.filter(i=>i.severity==="warning").length],
      );
      const batchId=batch.rows[0].id;
      const itemMap=new Map<string,{id:string;site_id:string;location_id:string;warehouse_id:string}>();
      const warehouseCache=[...catalog.warehouses];

      for(const row of inv.parsed){
        const supplier=row.supplier as Supplier,site=row.site as Site,location=row.location as Location;
        let warehouse=row.warehouse as Warehouse|null;
        if(!warehouse){
          const code=stableCode("ALM",site.name+"-"+location.name+"-"+String(row.warehouseName));
          const created=await client.query<Warehouse>(
            "INSERT INTO inventory_warehouses(organization_id,site_id,location_id,code,name) VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,code) DO UPDATE SET name=EXCLUDED.name RETURNING id,site_id,location_id,name",
            [organizationId,site.id,location.id,code,row.warehouseName],
          );
          warehouse=created.rows[0];warehouseCache.push(warehouse);
        }
        let categoryId:string|null=null;
        if(row.category){
          const code=stableCode("CAT",String(row.category));
          const category=await client.query<{id:string}>(
            "INSERT INTO inventory_categories(organization_id,code,name) VALUES($1,$2,$3) ON CONFLICT(organization_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id",
            [organizationId,code,row.category],
          );
          categoryId=category.rows[0].id;
        }
        const existing=await client.query<{id:string;quantity:string}>("SELECT id,quantity::text FROM inventory_items WHERE organization_id=$1 AND upper(sku)=upper($2)",[organizationId,row.sku]);
        let itemId:string;
        if(existing.rowCount){
          itemId=existing.rows[0].id;
          await client.query(
            "UPDATE inventory_items SET site_id=$1,location_id=$2,supplier_id=$3,category_id=$4,warehouse_id=$5,name=$6,description=$7,presentation=$8,unit=$9,min_quantity=$10,max_quantity=$11,unit_cost=$12,storage_location=$13,active=$14,updated_at=now() WHERE id=$15",
            [site.id,location.id,supplier.id,categoryId,warehouse.id,row.name,row.description||null,row.presentation||null,row.unit,row.min,row.max,row.cost,row.warehouseName,row.active,itemId],
          );
        }else{
          const inserted=await client.query<{id:string}>(
            "INSERT INTO inventory_items(organization_id,site_id,location_id,supplier_id,category_id,warehouse_id,sku,name,description,presentation,unit,quantity,min_quantity,max_quantity,unit_cost,storage_location,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,$12,$13,$14,$15,$16) RETURNING id",
            [organizationId,site.id,location.id,supplier.id,categoryId,warehouse.id,row.sku,row.name,row.description||null,row.presentation||null,row.unit,row.min,row.max,row.cost,row.warehouseName,row.active],
          );
          itemId=inserted.rows[0].id;
          if(Number(row.initial)>0){
            await client.query(
              "INSERT INTO inventory_transactions(organization_id,item_id,type,quantity,unit_cost,warehouse_id,document_number,movement_at,created_by,import_batch_id,source_row,notes) VALUES($1,$2,'receipt',$3,$4,$5,'IMPORT-INICIAL',now(),$6,$7,$8,'Stock inicial de importación')",
              [organizationId,itemId,row.initial,row.cost,warehouse.id,session.userId||null,batchId,row.row],
            );
          }
        }
        await client.query(
          "INSERT INTO inventory_stock_levels(organization_id,item_id,warehouse_id,quantity,min_quantity,max_quantity) VALUES($1,$2,$3,0,$4,$5) ON CONFLICT(item_id,warehouse_id) DO UPDATE SET min_quantity=EXCLUDED.min_quantity,max_quantity=EXCLUDED.max_quantity,updated_at=now()",
          [organizationId,itemId,warehouse.id,row.min,row.max],
        );
        itemMap.set(String(row.sku),{id:itemId,site_id:site.id,location_id:location.id,warehouse_id:warehouse.id});
      }

      for(const row of parsedKardex){
        let item=itemMap.get(String(row.sku));
        if(!item){
          const found=await client.query<{id:string;site_id:string;location_id:string;warehouse_id:string}>("SELECT id,site_id,location_id,warehouse_id FROM inventory_items WHERE organization_id=$1 AND upper(sku)=upper($2)",[organizationId,row.sku]);
          if(!found.rowCount)throw new Error("SKU no resuelto: "+row.sku);
          item=found.rows[0];
        }
        if(!canAccessSite(session,item.site_id))throw new Error("Sede no autorizada para SKU "+row.sku);
        let source=findByName(warehouseCache,String(row.warehouseName));
        if(!source){
          const location=catalog.locations.find(loc=>loc.id===item!.location_id);
          const site=catalog.sites.find(s=>s.id===item!.site_id);
          const code=stableCode("ALM",(site?.name||"")+"-"+(location?.name||"")+"-"+String(row.warehouseName));
          const created=await client.query<Warehouse>(
            "INSERT INTO inventory_warehouses(organization_id,site_id,location_id,code,name) VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,code) DO UPDATE SET name=EXCLUDED.name RETURNING id,site_id,location_id,name",
            [organizationId,item.site_id,item.location_id,code,row.warehouseName],
          );
          source=created.rows[0];warehouseCache.push(source);
        }
        let destination:Warehouse|null=null;
        if(row.movement.type==="transfer"){
          destination=findByName(warehouseCache,String(row.destination));
          if(!destination){
            const code=stableCode("ALM","DEST-"+String(row.destination));
            const created=await client.query<Warehouse>(
              "INSERT INTO inventory_warehouses(organization_id,site_id,location_id,code,name) VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,code) DO UPDATE SET name=EXCLUDED.name RETURNING id,site_id,location_id,name",
              [organizationId,item.site_id,item.location_id,code,row.destination],
            );
            destination=created.rows[0];warehouseCache.push(destination);
          }
        }
        const signed=Number(row.quantity)*Number(row.movement.sign);
        await client.query(
          "INSERT INTO inventory_transactions(organization_id,item_id,type,quantity,unit_cost,warehouse_id,destination_warehouse_id,document_number,movement_at,created_by,import_batch_id,source_row,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10,$11,$12,$13)",
          [organizationId,item.id,row.movement.type,signed,row.cost||null,source.id,destination?.id||null,row.document||null,row.date,session.userId||null,batchId,row.row,row.notes||null],
        );
      }
      await client.query("UPDATE bulk_import_batches SET status='committed',imported_rows=$1,committed_at=now(),summary=$2::jsonb WHERE id=$3",[inv.parsed.length+parsedKardex.length,JSON.stringify({items:inv.parsed.length,kardex:parsedKardex.length}),batchId]);
      await client.query("COMMIT");
      return NextResponse.json({ok:true,summary:{items:inv.parsed.length,kardex:parsedKardex.length,warnings:issues.filter(i=>i.severity==="warning").length}});
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
