import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";

type Named={id:string;name:string};
type Site={id:string;name:string};
type Location={id:string;name:string;site_name:string};
type Supplier={id:string;name:string;tax_id:string|null};
type Category={id:string;name:string};
type Warehouse={id:string;name:string;site_name:string|null;location_name:string|null};

function header(row:ExcelJS.Row){
  row.font={bold:true,color:{argb:"FFFFFFFF"}};
  row.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF1F7F79"}};
  row.alignment={vertical:"middle"};
}
function title(sheet:ExcelJS.Worksheet,text:string){
  sheet.mergeCells("A1:F1");
  const cell=sheet.getCell("A1");
  cell.value=text;
  cell.font={bold:true,size:16,color:{argb:"FF17324A"}};
}
function fit(sheet:ExcelJS.Worksheet){
  sheet.columns.forEach(column=>{
    let max=10;
    column.eachCell?.({includeEmpty:true},cell=>{max=Math.min(38,Math.max(max,String(cell.value??"").length+2));});
    column.width=max;
  });
  sheet.views=[{state:"frozen",ySplit:1}];
}

export async function GET(request:Request){
  const session=await getSession();
  if(!session)return new NextResponse("No autorizado",{status:401});
  const url=new URL(request.url);
  const entity=url.searchParams.get("entity")==="assets"?"assets":"inventory";
  const fixedSupplierId=url.searchParams.get("supplier")||"";
  if(entity==="inventory"&&!can(session,"inventory.write"))return new NextResponse("Forbidden",{status:403});
  if(entity==="assets"&&!can(session,"assets.write"))return new NextResponse("Forbidden",{status:403});
  if(!session.organizationId)return new NextResponse("Selecciona una empresa antes de descargar la plantilla.",{status:400});
  const organizationId=session.organizationId;

  const [org,sites,locations,suppliers,categories,warehouses]=await Promise.all([
    query<Named>("SELECT id,name FROM organizations WHERE id=$1",[organizationId]),
    query<Site>("SELECT id,name FROM sites WHERE organization_id=$1 AND active=true ORDER BY name",[organizationId]),
    query<Location>("SELECT l.id,l.name,s.name site_name FROM locations l JOIN sites s ON s.id=l.site_id WHERE l.organization_id=$1 AND l.active=true ORDER BY s.name,l.name",[organizationId]),
    fixedSupplierId
      ? query<Supplier>("SELECT id,name,tax_id FROM suppliers WHERE organization_id=$1 AND id=$2 AND active=true ORDER BY name",[organizationId,fixedSupplierId])
      : query<Supplier>("SELECT id,name,tax_id FROM suppliers WHERE organization_id=$1 AND active=true ORDER BY name",[organizationId]),
    query<Category>("SELECT id,name FROM inventory_categories WHERE organization_id=$1 AND active=true ORDER BY name",[organizationId]),
    query<Warehouse>("SELECT w.id,w.name,s.name site_name,l.name location_name FROM inventory_warehouses w LEFT JOIN sites s ON s.id=w.site_id LEFT JOIN locations l ON l.id=w.location_id WHERE w.organization_id=$1 AND w.active=true ORDER BY w.name",[organizationId]),
  ]);

  const workbook=new ExcelJS.Workbook();
  workbook.creator="Desweb CMMS";
  workbook.created=new Date();
  const readme=workbook.addWorksheet("LEEME",{views:[{showGridLines:false}]});
  title(readme,"PLANTILLA DE IMPORTACIÓN · DESWEB CMMS");
  const lines=entity==="inventory"?[
    ["Empresa",org.rows[0]?.name||""],
    ["Objetivo","Cargar catálogo de inventario y movimientos Kardex con validación previa."],
    ["Flujo recomendado","1) Revisa Bodegas. 2) Completa Inventario. 3) Completa Kardex. 4) Importa desde CMMS. 5) Corrige las filas señaladas antes de confirmar."],
    ["Regla SKU","El SKU debe ser único dentro de la empresa. Usa siempre el mismo SKU en Inventario y Kardex."],
    ["Proveedor","Debe existir previamente en Proveedores y tener capacidad de materiales/suministros."],
    ["Sede/Sububicación","Usa exactamente los nombres listados en Catálogos."],
    ["Bodega","La hoja Bodegas permite crear/actualizar almacenes. Si un artículo usa un nombre nuevo, también puede crearse durante la importación."],
    ["Stock inicial","Se registra como movimiento de entrada para mantener trazabilidad en Kardex."],
    ["Kardex","Tipos válidos: Entrada, Salida, Ajuste positivo, Ajuste negativo, Devolución, Traslado. Puedes registrar lote, vencimiento y centro de costo."],
    ["Traslado","Requiere Bodega origen y Bodega destino."],
    ["Compatibilidad","El importador también reconoce la hoja Productos y Kardex del archivo demo revisado, pero los servicios no se cargan como inventario."],
  ]:[
    ["Empresa",org.rows[0]?.name||""],
    ["Objetivo","Carga masiva de activos con relaciones validadas contra Sede, Sububicación, Proveedor y Categoría."],
    ["Regla código","El Código debe ser único dentro de la empresa."],
    ["Categoría","Si la categoría no existe, el importador puede crearla automáticamente."],
    ["Estados válidos","Operativo, En mantenimiento, Detenido, Retirado."],
    ["Criticidad válida","Baja, Media, Alta, Crítica."],
    ["Fechas","Usa formato AAAA-MM-DD."],
    ["Relaciones","Sede, Sububicación y Proveedor deben existir y pertenecer a la misma empresa."],
  ];
  readme.addRows(lines);
  readme.getColumn(1).font={bold:true};
  readme.getColumn(1).width=24;readme.getColumn(2).width=95;readme.getColumn(2).alignment={wrapText:true,vertical:"top"};

  const catalog=workbook.addWorksheet("Catálogos",{views:[{showGridLines:false}]});
  const catalogHeaders=["Proveedores","Sedes","Sububicaciones","Bodegas","Categorías","Unidades","Estados activo","Criticidad","Tipos Kardex"];
  catalog.addRow(catalogHeaders);header(catalog.getRow(1));
  const max=Math.max(suppliers.rowCount||0,sites.rowCount||0,locations.rowCount||0,warehouses.rowCount||0,categories.rowCount||0,12);
  const units=["unidad","caja","paquete","metro","rollo","litro","galón","kg","g","par","juego","bulto"];
  const assetStatuses=["Operativo","En mantenimiento","Detenido","Retirado"];
  const criticalities=["Baja","Media","Alta","Crítica"];
  const movements=["Entrada","Salida","Ajuste positivo","Ajuste negativo","Devolución","Traslado"];
  for(let i=0;i<max;i++)catalog.addRow([
    suppliers.rows[i]?[suppliers.rows[i].name,suppliers.rows[i].tax_id].filter(Boolean).join(" · "):"",
    sites.rows[i]?.name||"",
    locations.rows[i]?(locations.rows[i].site_name+" · "+locations.rows[i].name):"",
    warehouses.rows[i]?[warehouses.rows[i].name,warehouses.rows[i].site_name,warehouses.rows[i].location_name].filter(Boolean).join(" · "):"",
    categories.rows[i]?.name||"",
    units[i]||"",
    assetStatuses[i]||"",
    criticalities[i]||"",
    movements[i]||"",
  ]);
  fit(catalog);

  if(entity==="inventory"){
    const warehouseSheet=workbook.addWorksheet("Bodegas",{views:[{showGridLines:false}]});
    const warehouseHeaders=["Código","Bodega *","Tipo","Sede","Sububicación","Ubicación detalle","Responsable","Capacidad","Estado","Observaciones"];
    warehouseSheet.addRow(warehouseHeaders);header(warehouseSheet.getRow(1));
    warehouseSheet.addRow([
      warehouses.rows[0]?.id?"ALM-001":"ALM-001",
      warehouses.rows[0]?.name||"Almacén principal",
      "Almacenamiento",
      warehouses.rows[0]?.site_name||sites.rows[0]?.name||"",
      warehouses.rows[0]?.location_name||locations.rows[0]?.name||"",
      "Zona principal",
      "",
      1000,
      "Activa",
      "Bodega principal de inventario"
    ]);
    warehouseSheet.autoFilter={from:"A1",to:"J1"};
    fit(warehouseSheet);

    const inventory=workbook.addWorksheet("Inventario",{views:[{showGridLines:false}]});
    const headers=["SKU *","Nombre *","Descripción","Categoría","Presentación","Unidad *","Proveedor *","Sede *","Sububicación *","Bodega *","Stock mínimo","Stock máximo","Costo unitario","Stock inicial","Activo"];
    inventory.addRow(headers);header(inventory.getRow(1));
    inventory.addRow(["REP-001","Filtro plisado 20x20","Filtro para unidad HVAC","Repuestos HVAC","unidad","unidad",suppliers.rows[0]?.name||"",sites.rows[0]?.name||"",locations.rows[0]?.name||"","Almacén principal",2,20,35000,5,"Sí"]);
    inventory.autoFilter={from:"A1",to:"O1"};
    inventory.getColumn(3).width=34;
    fit(inventory);

    const kardex=workbook.addWorksheet("Kardex",{views:[{showGridLines:false}]});
    const kHeaders=["Fecha *","Tipo movimiento *","Documento","SKU *","Proveedor","Bodega origen *","Bodega destino","Cantidad *","Costo unitario","Lote","Vencimiento","Centro de costo","Usuario origen","Observaciones"];
    kardex.addRow(kHeaders);header(kardex.getRow(1));
    kardex.addRow([new Date().toISOString().slice(0,10),"Entrada","OC-0001","REP-001",suppliers.rows[0]?.name||"","Almacén principal","",10,35000,"LOTE-001","","Mantenimiento","","Compra inicial"]);
    kardex.autoFilter={from:"A1",to:"N1"};
    fit(kardex);
  }else{
    const assets=workbook.addWorksheet("Activos",{views:[{showGridLines:false}]});
    const headers=["Código *","Nombre *","Descripción","Categoría","Sede *","Sububicación *","Proveedor *","Fabricante","Modelo","Serial","Estado *","Criticidad *","Fecha compra","Fecha instalación","Garantía vence","Costo compra","Ubicación detalle","Notas"];
    assets.addRow(headers);header(assets.getRow(1));
    assets.addRow(["ACT-001","Unidad manejadora de aire","Activo de ejemplo","HVAC",sites.rows[0]?.name||"",locations.rows[0]?.name||"",suppliers.rows[0]?.name||"","Carrier","39HQ","SN-DEMO-001","Operativo","Alta","","","","0","",""]);
    assets.autoFilter={from:"A1",to:"R1"};
    assets.getColumn(3).width=34;assets.getColumn(18).width=34;
    fit(assets);
  }

  const body=Buffer.from(await workbook.xlsx.writeBuffer());
  const filename=entity==="inventory"?"plantilla-inventario-kardex-desweb.xlsx":"plantilla-activos-desweb.xlsx";
  return new NextResponse(new Uint8Array(body),{headers:{
    "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition":"attachment; filename=\""+filename+"\"",
    "Cache-Control":"private, no-store",
  }});
}
