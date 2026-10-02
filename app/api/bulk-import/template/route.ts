import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { canAccessOrganization } from "@/lib/organization-scope";
import { query } from "@/lib/db";
import { hasLimitedInventorySiteScope } from "@/lib/inventory-scope";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Named={id:string;name:string};
type Site={id:string;name:string};
type Location={id:string;name:string;site_name:string};
type Supplier={id:string;code:string|null;name:string;tax_id:string|null;supplier_type:string};
type Category={id:string;name:string};
type Warehouse={id:string;code:string;name:string;type:string;responsible:string|null;capacity:string|null;active:boolean;location_detail:string|null;notes:string|null;site_name:string|null;location_name:string|null};
type InventoryRow={
  supplier_id:string|null;supplier_code:string|null;supplier_tax_id:string|null;supplier_name:string|null;sku:string;name:string;description:string|null;
  category:string|null;subcategory:string|null;brand:string|null;model:string|null;presentation:string|null;unit:string;barcode:string|null;
  site_name:string|null;location_name:string|null;warehouse_name:string|null;min_quantity:string;max_quantity:string;quantity:string;unit_cost:string;
  reference_price:string;tax_rate:string;active:boolean;
};
type AssetTemplateRow={
  id:string;updated_at:string;code:string;name:string;description:string|null;category:string|null;
  site_id:string;site_name:string;location_id:string;location_name:string;supplier_id:string;supplier_name:string;
  manufacturer:string|null;model:string|null;serial_number:string|null;status:string;criticality:string;
  purchase_date:string|null;installation_date:string|null;warranty_expires:string|null;purchase_cost:string|null;
  location_detail:string|null;notes:string|null;
};

function header(row:ExcelJS.Row){
  row.font={bold:true,color:{argb:"FFFFFFFF"}};
  row.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF1F7F79"}};
  row.alignment={vertical:"middle",wrapText:true};
}
function title(sheet:ExcelJS.Worksheet,text:string,lastColumn="H"){
  sheet.mergeCells("A1:"+lastColumn+"1");
  const cell=sheet.getCell("A1");
  cell.value=text;
  cell.font={bold:true,size:16,color:{argb:"FF17324A"}};
}
function fit(sheet:ExcelJS.Worksheet,freeze=true){
  sheet.columns.forEach(column=>{
    let max=10;
    column.eachCell?.({includeEmpty:true},cell=>{max=Math.min(42,Math.max(max,String(cell.value??"").length+2));});
    column.width=max;
  });
  if(freeze)sheet.views=[{state:"frozen",ySplit:1}];
}
function addSheetHeader(sheet:ExcelJS.Worksheet,headers:string[]){
  sheet.addRow(headers);
  header(sheet.getRow(1));
  sheet.autoFilter={from:"A1",to:{row:1,column:headers.length}};
}
function supplierTypeLabel(value:string){
  return value==="both"?"Materiales + servicios":value==="services"?"Servicios":"Materiales / suministros";
}

export async function GET(request:Request){
  const session=await getSession();
  if(!session)return new NextResponse("No autorizado",{status:401});
  const url=new URL(request.url);
  const entity=url.searchParams.get("entity")==="assets"?"assets":"inventory";
  const contextSupplierId=url.searchParams.get("supplier")||"";
  const requestedOrganization=url.searchParams.get("organization")||"";
  const dataMode=url.searchParams.get("data")==="current"?"current":"blank";
  if(entity==="inventory"&&!can(session,"inventory.write"))return new NextResponse("Forbidden",{status:403});
  if(entity==="assets"&&!can(session,"assets.write"))return new NextResponse("Forbidden",{status:403});

  let organizationId=session.platformRole==="user"
    ?session.organizationId
    :UUID.test(requestedOrganization)?requestedOrganization:null;
  if(organizationId&&!canAccessOrganization(session,organizationId))return new NextResponse("Forbidden",{status:403});
  let contextSupplier:Supplier|null=null;
  if(contextSupplierId){
    const scoped=await query<Supplier&{organization_id:string}>(
      "SELECT id,organization_id,code,name,tax_id,supplier_type FROM suppliers WHERE id=$1 AND active=true",
      [contextSupplierId],
    );
    if(!scoped.rowCount)return new NextResponse("Proveedor no disponible para esta plantilla.",{status:400});
    if(!canAccessOrganization(session,scoped.rows[0].organization_id))return new NextResponse("Forbidden",{status:403});
    if(organizationId&&organizationId!==scoped.rows[0].organization_id)return new NextResponse("El proveedor no pertenece a la empresa seleccionada.",{status:422});
    organizationId=scoped.rows[0].organization_id;
    contextSupplier=scoped.rows[0];
  }
  if(!organizationId)return new NextResponse("Selecciona una empresa antes de descargar la plantilla.",{status:400});

  const limitedInventoryScope=hasLimitedInventorySiteScope(session);
  const [org,sites,locations,suppliers,categories,warehouses,presentations,subcategories,inventoryRows,assetCategories,assetRows]=await Promise.all([
    query<Named>("SELECT id,name FROM organizations WHERE id=$1",[organizationId]),
    limitedInventoryScope
      ?query<Site>("SELECT id,name FROM sites WHERE organization_id=$1 AND active=true AND id=ANY($2::uuid[]) ORDER BY name",[organizationId,session.siteIds])
      :query<Site>("SELECT id,name FROM sites WHERE organization_id=$1 AND active=true ORDER BY name",[organizationId]),
    limitedInventoryScope
      ?query<Location>("SELECT l.id,l.name,s.name site_name FROM locations l JOIN sites s ON s.id=l.site_id WHERE l.organization_id=$1 AND l.active=true AND l.site_id=ANY($2::uuid[]) ORDER BY s.name,l.name",[organizationId,session.siteIds])
      :query<Location>("SELECT l.id,l.name,s.name site_name FROM locations l JOIN sites s ON s.id=l.site_id WHERE l.organization_id=$1 AND l.active=true ORDER BY s.name,l.name",[organizationId]),
    query<Supplier>("SELECT id,code,name,tax_id,supplier_type FROM suppliers WHERE organization_id=$1 AND active=true ORDER BY name",[organizationId]),
    query<Category>("SELECT id,name FROM inventory_categories WHERE organization_id=$1 AND active=true ORDER BY name",[organizationId]),
    limitedInventoryScope
      ?query<Warehouse>(
        `SELECT w.id,w.code,w.name,w.type,w.responsible,w.capacity::text,w.active,w.location_detail,w.notes,
                s.name site_name,l.name location_name
         FROM inventory_warehouses w
         LEFT JOIN sites s ON s.id=w.site_id LEFT JOIN locations l ON l.id=w.location_id
         WHERE w.organization_id=$1 AND w.active=true AND w.site_id=ANY($2::uuid[]) ORDER BY w.name`,
        [organizationId,session.siteIds],
      )
      :query<Warehouse>(
        `SELECT w.id,w.code,w.name,w.type,w.responsible,w.capacity::text,w.active,w.location_detail,w.notes,
                s.name site_name,l.name location_name
         FROM inventory_warehouses w
         LEFT JOIN sites s ON s.id=w.site_id LEFT JOIN locations l ON l.id=w.location_id
         WHERE w.organization_id=$1 AND w.active=true ORDER BY w.name`,
        [organizationId],
      ),
    limitedInventoryScope
      ?query<{value:string}>("SELECT DISTINCT presentation value FROM inventory_items WHERE organization_id=$1 AND (site_id IS NULL OR site_id=ANY($2::uuid[])) AND presentation IS NOT NULL AND btrim(presentation)<>'' ORDER BY presentation",[organizationId,session.siteIds])
      :query<{value:string}>("SELECT DISTINCT presentation value FROM inventory_items WHERE organization_id=$1 AND presentation IS NOT NULL AND btrim(presentation)<>'' ORDER BY presentation",[organizationId]),
    limitedInventoryScope
      ?query<{value:string}>("SELECT DISTINCT subcategory value FROM inventory_items WHERE organization_id=$1 AND (site_id IS NULL OR site_id=ANY($2::uuid[])) AND subcategory IS NOT NULL AND btrim(subcategory)<>'' ORDER BY subcategory",[organizationId,session.siteIds])
      :query<{value:string}>("SELECT DISTINCT subcategory value FROM inventory_items WHERE organization_id=$1 AND subcategory IS NOT NULL AND btrim(subcategory)<>'' ORDER BY subcategory",[organizationId]),
    dataMode==="current"
      ?limitedInventoryScope
        ?query<InventoryRow>(
          `SELECT i.supplier_id,s.code supplier_code,s.tax_id supplier_tax_id,s.name supplier_name,i.sku,i.name,i.description,
                  c.name category,i.subcategory,i.brand,i.model,i.presentation,i.unit,i.barcode,site.name site_name,l.name location_name,
                  w.name warehouse_name,i.min_quantity::text,i.max_quantity::text,
                  COALESCE((SELECT sum(sl.quantity) FROM inventory_stock_levels sl JOIN inventory_warehouses sw ON sw.id=sl.warehouse_id WHERE sl.item_id=i.id AND sw.site_id=ANY($3::uuid[])),0)::text quantity,
                  i.unit_cost::text,i.reference_price::text,i.tax_rate::text,i.active
           FROM inventory_items i
           LEFT JOIN suppliers s ON s.id=i.supplier_id
           LEFT JOIN inventory_categories c ON c.id=i.category_id
           LEFT JOIN sites site ON site.id=i.site_id
           LEFT JOIN locations l ON l.id=i.location_id
           LEFT JOIN inventory_warehouses w ON w.id=i.warehouse_id AND w.site_id=ANY($3::uuid[])
           WHERE i.organization_id=$1 AND ($2::uuid IS NULL OR i.supplier_id=$2::uuid)
             AND (i.site_id IS NULL OR i.site_id=ANY($3::uuid[]))
           ORDER BY s.name,i.sku`,
          [organizationId,contextSupplierId||null,session.siteIds],
        )
        :query<InventoryRow>(
          `SELECT i.supplier_id,s.code supplier_code,s.tax_id supplier_tax_id,s.name supplier_name,i.sku,i.name,i.description,
                  c.name category,i.subcategory,i.brand,i.model,i.presentation,i.unit,i.barcode,site.name site_name,l.name location_name,
                  w.name warehouse_name,i.min_quantity::text,i.max_quantity::text,i.quantity::text,i.unit_cost::text,
                  i.reference_price::text,i.tax_rate::text,i.active
           FROM inventory_items i
           LEFT JOIN suppliers s ON s.id=i.supplier_id
           LEFT JOIN inventory_categories c ON c.id=i.category_id
           LEFT JOIN sites site ON site.id=i.site_id
           LEFT JOIN locations l ON l.id=i.location_id
           LEFT JOIN inventory_warehouses w ON w.id=i.warehouse_id
           WHERE i.organization_id=$1 AND ($2::uuid IS NULL OR i.supplier_id=$2::uuid)
           ORDER BY s.name,i.sku`,
          [organizationId,contextSupplierId||null],
        )
      :Promise.resolve({rows:[]} as {rows:InventoryRow[]}),
    query<Category>("SELECT id,name FROM asset_categories WHERE organization_id=$1 ORDER BY name",[organizationId]),
    dataMode==="current"&&entity==="assets"
      ?limitedInventoryScope
        ?query<AssetTemplateRow>(
          `SELECT a.id::text,a.updated_at::text,a.code,a.name,a.description,c.name category,
                  a.site_id::text,site.name site_name,a.location_id::text,l.name location_name,
                  a.supplier_id::text,s.name supplier_name,a.manufacturer,a.model,a.serial_number,a.status,a.criticality,
                  a.purchase_date::text,a.installation_date::text,a.warranty_expires::text,a.purchase_cost::text,
                  a.location_detail,a.notes
           FROM assets a
           JOIN sites site ON site.id=a.site_id
           JOIN locations l ON l.id=a.location_id
           JOIN suppliers s ON s.id=a.supplier_id
           LEFT JOIN asset_categories c ON c.id=a.category_id
           WHERE a.organization_id=$1 AND a.site_id=ANY($2::uuid[])
           ORDER BY a.code`,
          [organizationId,session.siteIds],
        )
        :query<AssetTemplateRow>(
          `SELECT a.id::text,a.updated_at::text,a.code,a.name,a.description,c.name category,
                  a.site_id::text,site.name site_name,a.location_id::text,l.name location_name,
                  a.supplier_id::text,s.name supplier_name,a.manufacturer,a.model,a.serial_number,a.status,a.criticality,
                  a.purchase_date::text,a.installation_date::text,a.warranty_expires::text,a.purchase_cost::text,
                  a.location_detail,a.notes
           FROM assets a
           JOIN sites site ON site.id=a.site_id
           JOIN locations l ON l.id=a.location_id
           JOIN suppliers s ON s.id=a.supplier_id
           LEFT JOIN asset_categories c ON c.id=a.category_id
           WHERE a.organization_id=$1
           ORDER BY a.code`,
          [organizationId],
        )
      :Promise.resolve({rows:[]} as {rows:AssetTemplateRow[]}),
  ]);

  const workbook=new ExcelJS.Workbook();
  workbook.creator="Desweb CMMS";
  workbook.created=new Date();

  if(entity==="assets"){
    const instructions=workbook.addWorksheet("INSTRUCCIONES",{views:[{showGridLines:false}]});
    title(instructions,"PLANTILLA DE ACTIVOS · DESWEB CMMS");
    instructions.addRows([
      ["Empresa",org.rows[0]?.name||""],
      ["Objetivo","Crear o actualizar activos sin borrar información existente ni duplicar registros."],
      ["Identificación","Para actualizar, prioriza ACTIVO_ID. Si no existe, el Código identifica el activo dentro de la empresa."],
      ["Celdas vacías","En una actualización, una celda vacía conserva el valor actual. Nunca borra información automáticamente."],
      ["Relaciones","SEDE_ID, SUBUBICACION_ID y PROVEEDOR_ID son la referencia más segura. Si están vacíos, el CMMS intenta resolver los nombres normalizados."],
      ["Coincidencias","Tildes, mayúsculas, puntos, guiones y espacios no crean registros distintos. Las coincidencias dudosas se resuelven en CMMS antes de confirmar."],
      ["Conflictos","ACTUALIZADO_EN permite detectar si el activo cambió en CMMS después de descargar la plantilla. Un conflicto no se sobrescribe automáticamente."],
      ["Base de conocimiento","La hoja REFERENCIAS_CMMS contiene IDs y nombres vigentes de Sedes, Sububicaciones, Proveedores y Categorías."],
      ["Fechas","Usa formato AAAA-MM-DD."],
    ]);
    instructions.getColumn(1).font={bold:true};instructions.getColumn(1).width=29;instructions.getColumn(2).width=105;instructions.getColumn(2).alignment={wrapText:true,vertical:"top"};

    const references=workbook.addWorksheet("REFERENCIAS_CMMS",{views:[{showGridLines:false}]});
    addSheetHeader(references,["TIPO","ID","NOMBRE","CONTEXTO","CODIGO","NIT"]);
    for(const site of sites.rows)references.addRow(["SEDE",site.id,site.name,"","",""]);
    for(const location of locations.rows)references.addRow(["SUBUBICACION",location.id,location.name,location.site_name,"",""]);
    for(const supplier of suppliers.rows)references.addRow(["PROVEEDOR",supplier.id,supplier.name,"",supplier.code||"",supplier.tax_id||""]);
    for(const category of assetCategories.rows)references.addRow(["CATEGORIA",category.id,category.name,"","",""]);
    fit(references);

    const catalogs=workbook.addWorksheet("CATALOGOS",{views:[{showGridLines:false}]});
    addSheetHeader(catalogs,["PROVEEDORES","SEDES","SUBUBICACIONES","CATEGORIAS","ESTADOS","CRITICIDAD"]);
    const max=Math.max(suppliers.rowCount||0,sites.rowCount||0,locations.rowCount||0,assetCategories.rowCount||0,4);
    const statuses=["Operativo","En mantenimiento","Detenido","Retirado"],criticalities=["Baja","Media","Alta","Crítica"];
    for(let i=0;i<max;i++)catalogs.addRow([
      suppliers.rows[i]?.name||"",sites.rows[i]?.name||"",locations.rows[i]?(locations.rows[i].site_name+" · "+locations.rows[i].name):"",
      assetCategories.rows[i]?.name||"",statuses[i]||"",criticalities[i]||"",
    ]);
    fit(catalogs);

    const assets=workbook.addWorksheet("ACTIVOS",{views:[{showGridLines:false}]});
    const assetHeaders=[
      "ACTIVO_ID","ACTUALIZADO_EN","Código *","Nombre *","Descripción","Categoría",
      "SEDE_ID","Sede *","SUBUBICACION_ID","Sububicación *","PROVEEDOR_ID","Proveedor *",
      "Fabricante","Modelo","Serial","Estado *","Criticidad *","Fecha compra","Fecha instalación",
      "Garantía vence","Costo compra","Ubicación detalle","Notas",
    ];
    addSheetHeader(assets,assetHeaders);
    for(const row of assetRows.rows){
      assets.addRow([
        row.id,row.updated_at,row.code,row.name,row.description||"",row.category||"",
        row.site_id,row.site_name,row.location_id,row.location_name,row.supplier_id,row.supplier_name,
        row.manufacturer||"",row.model||"",row.serial_number||"",
        row.status==="maintenance"?"En mantenimiento":row.status==="down"?"Detenido":row.status==="retired"?"Retirado":"Operativo",
        row.criticality==="critical"?"Crítica":row.criticality==="high"?"Alta":row.criticality==="low"?"Baja":"Media",
        row.purchase_date||"",row.installation_date||"",row.warranty_expires||"",row.purchase_cost?Number(row.purchase_cost):"",
        row.location_detail||"",row.notes||"",
      ]);
    }
    fit(assets);
    assets.views=[{state:"frozen",ySplit:1,xSplit:2}];
    const body=Buffer.from(await workbook.xlsx.writeBuffer());
    return new NextResponse(new Uint8Array(body),{headers:{
      "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":"attachment; filename=\"plantilla-activos-desweb.xlsx\"",
      "Cache-Control":"private, no-store",
    }});
  }

  const instructions=workbook.addWorksheet("INSTRUCCIONES",{views:[{showGridLines:false}]});
  title(instructions,"PLANTILLA_INVENTARIO_KARDEX_DESWEB", "J");
  const origin=contextSupplier?"IMPORTACIÓN CONTEXTUAL · "+contextSupplier.name:"IMPORTACIÓN GLOBAL";
  instructions.addRows([
    ["Empresa",org.rows[0]?.name||""],
    ["Contexto de descarga",origin],
    ["Regla principal","Esta es la única plantilla maestra. Puede cargarse desde Inventario o desde un Proveedor."],
    ["Proveedor","Prioridad de identificación: PROVEEDOR_ID → NIT_PROVEEDOR → CODIGO_PROVEEDOR → PROVEEDOR exacto. En modo contextual puedes dejar estos campos vacíos para heredar el proveedor abierto."],
    ["Servicios","TIPO=SERVICIO se detecta y se omite del inventario físico. No genera stock ni Kardex."],
    ["Bodegas","Una bodega nueva debe definirse primero en la hoja BODEGAS. No se crean bodegas silenciosamente desde una fila de inventario o Kardex."],
    ["Stock inicial","Solo aplica a productos nuevos y se registra como Entrada de Kardex. En productos existentes nunca reemplaza el saldo histórico."],
    ["Duplicados","Un SKU existente se compara antes de confirmar; podrás elegir Actualizar datos maestros u Omitir. El Kardex histórico nunca se reemplaza."],
    ["Kardex","El proveedor se hereda del SKU. Si informas un proveedor diferente al producto, la validación bloquea el movimiento."],
    ["MOVIMIENTO_ID","Úsalo cuando el movimiento proviene de otro sistema. Debe ser único y evita reimportar el mismo movimiento."],
    ["Contexto proveedor","Si el archivo contiene otros proveedores, podrás elegir Importar solo este proveedor o Importar todo el archivo."],
    ["Validación","El archivo se analiza completamente antes de guardar. Con errores bloqueantes no se confirma ninguna fila."],
    ["Plantilla con datos actuales","Las filas existentes se precargan solo como datos maestros. STOCK_INICIAL queda en 0 y KARDEX queda vacío para evitar duplicar movimientos históricos."],
  ]);
  instructions.getColumn(1).font={bold:true};instructions.getColumn(1).width=29;instructions.getColumn(2).width=105;instructions.getColumn(2).alignment={wrapText:true,vertical:"top"};

  const inventory=workbook.addWorksheet("INVENTARIO",{views:[{showGridLines:false}]});
  const inventoryHeaders=[
    "PROVEEDOR_ID","NIT_PROVEEDOR","CODIGO_PROVEEDOR","PROVEEDOR","SKU","NOMBRE_PRODUCTO","DESCRIPCION","TIPO",
    "CATEGORIA","SUBCATEGORIA","MARCA","MODELO","PRESENTACION","UNIDAD","CODIGO_BARRAS","SEDE","UBICACION","BODEGA",
    "STOCK_MINIMO","STOCK_MAXIMO","STOCK_INICIAL","STOCK_ACTUAL_REFERENCIA","COSTO_UNITARIO","PRECIO_REFERENCIA","IVA",
    "LOTE","FECHA_VENCIMIENTO","ESTADO",
  ];
  addSheetHeader(inventory,inventoryHeaders);
  for(const item of inventoryRows.rows){
    inventory.addRow([
      item.supplier_id||"",item.supplier_tax_id||"",item.supplier_code||"",item.supplier_name||"",item.sku,item.name,item.description||"","PRODUCTO",
      item.category||"",item.subcategory||"",item.brand||"",item.model||"",item.presentation||"",item.unit,item.barcode||"",item.site_name||"",
      item.location_name||"",item.warehouse_name||"",Number(item.min_quantity),Number(item.max_quantity),0,Number(item.quantity),Number(item.unit_cost),
      Number(item.reference_price),Number(item.tax_rate),"","",item.active?"ACTIVO":"INACTIVO",
    ]);
  }
  fit(inventory);

  const kardex=workbook.addWorksheet("KARDEX",{views:[{showGridLines:false}]});
  addSheetHeader(kardex,[
    "MOVIMIENTO_ID","FECHA","TIPO_MOVIMIENTO","DOCUMENTO","PROVEEDOR_ID","NIT_PROVEEDOR","CODIGO_PROVEEDOR","PROVEEDOR",
    "SKU","BODEGA","BODEGA_DESTINO","UBICACION","LOTE","FECHA_VENCIMIENTO","CANTIDAD","COSTO_UNITARIO","CENTRO_COSTO",
    "RESPONSABLE","OBSERVACIONES",
  ]);
  fit(kardex);

  const providers=workbook.addWorksheet("PROVEEDORES",{views:[{showGridLines:false}]});
  addSheetHeader(providers,["PROVEEDOR_ID","CODIGO_PROVEEDOR","NIT_PROVEEDOR","PROVEEDOR","TIPO","ESTADO"]);
  for(const supplier of suppliers.rows)providers.addRow([supplier.id,supplier.code||"",supplier.tax_id||"",supplier.name,supplierTypeLabel(supplier.supplier_type),"ACTIVO"]);
  fit(providers);

  const warehousesSheet=workbook.addWorksheet("BODEGAS",{views:[{showGridLines:false}]});
  addSheetHeader(warehousesSheet,["CODIGO_BODEGA","BODEGA","TIPO","SEDE","SUBUBICACION","UBICACION_DETALLE","RESPONSABLE","CAPACIDAD","ESTADO","OBSERVACIONES"]);
  for(const warehouse of warehouses.rows)warehousesSheet.addRow([
    warehouse.code,warehouse.name,warehouse.type,warehouse.site_name||"",warehouse.location_name||"",warehouse.location_detail||"",
    warehouse.responsible||"",warehouse.capacity?Number(warehouse.capacity):"",warehouse.active?"ACTIVA":"INACTIVA",warehouse.notes||"",
  ]);
  fit(warehousesSheet);

  const catalogs=workbook.addWorksheet("CATALOGOS",{views:[{showGridLines:false}]});
  addSheetHeader(catalogs,["CATEGORIAS","SUBCATEGORIAS","PRESENTACIONES","UNIDADES","SEDES","UBICACIONES","TIPOS_PRODUCTO","TIPOS_KARDEX","ESTADOS"]);
  const units=["unidad","caja","paquete","metro","rollo","litro","galón","kg","g","par","juego","bulto","pieza","set"];
  const movements=["Entrada","Salida","Ajuste positivo","Ajuste negativo","Devolución","Traslado"];
  const types=["PRODUCTO","SERVICIO"],statuses=["ACTIVO","INACTIVO"];
  const max=Math.max(categories.rowCount||0,subcategories.rowCount||0,presentations.rowCount||0,units.length,sites.rowCount||0,locations.rowCount||0,movements.length);
  for(let i=0;i<max;i++)catalogs.addRow([
    categories.rows[i]?.name||"",subcategories.rows[i]?.value||"",presentations.rows[i]?.value||"",units[i]||"",sites.rows[i]?.name||"",
    locations.rows[i]?(locations.rows[i].site_name+" · "+locations.rows[i].name):"",types[i]||"",movements[i]||"",statuses[i]||"",
  ]);
  fit(catalogs);

  const body=Buffer.from(await workbook.xlsx.writeBuffer());
  return new NextResponse(new Uint8Array(body),{headers:{
    "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition":"attachment; filename=\"PLANTILLA_INVENTARIO_KARDEX_DESWEB.xlsx\"",
    "Cache-Control":"private, no-store",
  }});
}
