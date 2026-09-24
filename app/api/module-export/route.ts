import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";

type Row=Record<string,string|number|null>;

function csvCell(value:unknown){
  const text=String(value??"");
  return '"'+text.replace(/"/g,'""')+'"';
}
function safeName(value:string){return value.replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/-+/g,"-").toLowerCase();}

async function inventoryRows(session:NonNullable<Awaited<ReturnType<typeof getSession>>>){
  const base=`SELECT i.sku,i.name,COALESCE(i.description,'') description,COALESCE(c.name,'') category,
    COALESCE(i.presentation,'') presentation,i.unit,i.quantity::text quantity,i.min_quantity::text min_quantity,i.max_quantity::text max_quantity,
    i.unit_cost::text unit_cost,o.name company,COALESCE(s.name,'') site,COALESCE(l.name,'') location,COALESCE(w.name,'') warehouse,
    COALESCE(p.name,'') supplier,CASE WHEN i.active THEN 'Activo' ELSE 'Inactivo' END status
    FROM inventory_items i JOIN organizations o ON o.id=i.organization_id
    LEFT JOIN sites s ON s.id=i.site_id LEFT JOIN locations l ON l.id=i.location_id
    LEFT JOIN suppliers p ON p.id=i.supplier_id LEFT JOIN inventory_categories c ON c.id=i.category_id
    LEFT JOIN inventory_warehouses w ON w.id=i.warehouse_id`;
  if(session.platformRole!=="user")return query<Row>(base+" ORDER BY o.name,i.name");
  if(session.accessAllSites)return query<Row>(base+" WHERE i.organization_id=$1 ORDER BY i.name",[session.organizationId]);
  return query<Row>(base+" WHERE i.organization_id=$1 AND (i.site_id IS NULL OR i.site_id=ANY($2::uuid[])) ORDER BY i.name",[session.organizationId,session.siteIds]);
}
async function assetRows(session:NonNullable<Awaited<ReturnType<typeof getSession>>>){
  const base=`SELECT a.code,a.name,COALESCE(a.description,'') description,COALESCE(c.name,'') category,o.name company,s.name site,
    COALESCE(l.name,'') location,COALESCE(p.name,'') supplier,COALESCE(a.manufacturer,'') manufacturer,COALESCE(a.model,'') model,
    COALESCE(a.serial_number,'') serial,a.status,a.criticality,COALESCE(a.purchase_date::text,'') purchase_date,
    COALESCE(a.installation_date::text,'') installation_date,COALESCE(a.warranty_expires::text,'') warranty_expires,
    COALESCE(a.purchase_cost,0)::text purchase_cost
    FROM assets a JOIN organizations o ON o.id=a.organization_id JOIN sites s ON s.id=a.site_id
    LEFT JOIN locations l ON l.id=a.location_id LEFT JOIN suppliers p ON p.id=a.supplier_id LEFT JOIN asset_categories c ON c.id=a.category_id`;
  if(session.platformRole!=="user")return query<Row>(base+" ORDER BY o.name,a.name");
  if(session.accessAllSites)return query<Row>(base+" WHERE a.organization_id=$1 ORDER BY a.name",[session.organizationId]);
  return query<Row>(base+" WHERE a.organization_id=$1 AND a.site_id=ANY($2::uuid[]) ORDER BY a.name",[session.organizationId,session.siteIds]);
}

async function xlsx(headers:string[],keys:string[],rows:Row[],sheetName:string){
  const wb=new ExcelJS.Workbook();wb.creator="Desweb CMMS";
  const sh=wb.addWorksheet(sheetName,{views:[{state:"frozen",ySplit:1,showGridLines:false}]});
  sh.addRow(headers);
  sh.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};
  sh.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF1F7F79"}};
  for(const row of rows)sh.addRow(keys.map(key=>row[key]??""));
  sh.autoFilter={from:"A1",to:String.fromCharCode(64+Math.min(headers.length,26))+"1"};
  sh.columns.forEach(column=>{
    let max=10;column.eachCell?.({includeEmpty:true},cell=>max=Math.min(34,Math.max(max,String(cell.value??"").length+2)));column.width=max;
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
async function pdf(title:string,headers:string[],keys:string[],rows:Row[]){
  const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);const bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const pageSize:[number,number]=[841.89,595.28];let page=doc.addPage(pageSize);let y=555;
  const drawHead=()=>{page.drawText(title,{x:30,y,size:16,font:bold,color:rgb(.12,.2,.28)});y-=24;};
  drawHead();
  const cols=Math.min(headers.length,8),width=(780/cols);
  const visibleHeaders=headers.slice(0,cols),visibleKeys=keys.slice(0,cols);
  const tableHead=()=>{visibleHeaders.forEach((h,i)=>page.drawText(h.slice(0,16),{x:30+i*width,y,size:7,font:bold,color:rgb(.1,.45,.42)}));y-=12;};
  tableHead();
  for(const row of rows.slice(0,250)){
    if(y<35){page=doc.addPage(pageSize);y=555;drawHead();tableHead();}
    visibleKeys.forEach((key,i)=>page.drawText(String(row[key]??"").slice(0,18),{x:30+i*width,y,size:6.5,font,color:rgb(.18,.25,.32)}));
    y-=11;
  }
  return Buffer.from(await doc.save());
}

export async function GET(request:Request){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  const url=new URL(request.url),entity=url.searchParams.get("entity")==="assets"?"assets":"inventory",format=url.searchParams.get("format")||"xlsx";
  if(entity==="inventory"&&!can(session,"inventory.read"))return new NextResponse("Forbidden",{status:403});
  if(entity==="assets"&&!can(session,"assets.read"))return new NextResponse("Forbidden",{status:403});
  const result=entity==="inventory"?await inventoryRows(session):await assetRows(session);
  const headers=entity==="inventory"
    ?["SKU","Artículo","Descripción","Categoría","Presentación","Unidad","Existencia","Mínimo","Máximo","Costo unitario","Empresa","Sede","Sububicación","Bodega","Proveedor","Estado"]
    :["Código","Activo","Descripción","Categoría","Empresa","Sede","Sububicación","Proveedor","Fabricante","Modelo","Serial","Estado","Criticidad","Fecha compra","Fecha instalación","Garantía","Costo compra"];
  const keys=entity==="inventory"
    ?["sku","name","description","category","presentation","unit","quantity","min_quantity","max_quantity","unit_cost","company","site","location","warehouse","supplier","status"]
    :["code","name","description","category","company","site","location","supplier","manufacturer","model","serial","status","criticality","purchase_date","installation_date","warranty_expires","purchase_cost"];
  const base=safeName(entity==="inventory"?"inventario-desweb":"activos-desweb");
  if(format==="csv"){
    const body=[headers.map(csvCell).join(","),...result.rows.map(row=>keys.map(key=>csvCell(row[key])).join(","))].join("\n");
    return new NextResponse("\uFEFF"+body,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=\""+base+".csv\""}});
  }
  if(format==="pdf"){
    const body=await pdf(entity==="inventory"?"Inventario Desweb CMMS":"Activos Desweb CMMS",headers,keys,result.rows);
    return new NextResponse(new Uint8Array(body),{headers:{"Content-Type":"application/pdf","Content-Disposition":"attachment; filename=\""+base+".pdf\""}});
  }
  const body=await xlsx(headers,keys,result.rows,entity==="inventory"?"Inventario":"Activos");
  return new NextResponse(new Uint8Array(body),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":"attachment; filename=\""+base+".xlsx\""}});
}
