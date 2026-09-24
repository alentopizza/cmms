import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import ExcelJS from "exceljs";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { countryDefinition } from "@/lib/international-catalog";
import { loadProcurementReconciliation,procurementDocumentTypeLabel,procurementMatchLabel,procurementReviewLabel,type ProcurementDocumentSummary,type ProcurementDocumentLine } from "@/lib/procurement-reconciliation";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Req={
  id:string;organization_id:string;organization_name:string;organization_country:string|null;supplier_name:string;supplier_tax_id:string|null;
  supplier_email:string|null;supplier_phone:string|null;number:string;status:string;needed_by:string|null;notes:string|null;
  requested_by_name:string|null;created_at:string;approval_required:boolean;approval_state:string;approval_decided_at:string|null;approval_decided_by_name:string|null;approval_decision_notes:string|null;
};
type Item={sku:string;description:string;unit:string;quantity_requested:string;quantity_received:string;quantity_returned:string;unit_cost_estimated:string;site_name:string|null;location_name:string|null};
type ReturnLine={
  return_number:string;reason_code:string;expected_resolution:string;reason_detail:string|null;document_number:string|null;returned_at:string;
  sku:string;description:string;unit:string;quantity:string;unit_cost:string;warehouse:string|null;source_receipt_at:string;created_by_name:string|null;
};

function fileSafe(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").toLowerCase();}
function money(value:number,currency:string){return new Intl.NumberFormat("es-CO",{style:"currency",currency,maximumFractionDigits:2}).format(value);}
function esc(value:string){return value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]||char));}
function returnReason(value:string){return ({damaged:"Producto averiado",wrong_item:"Artículo incorrecto",quality:"Problema de calidad",excess:"Exceso recibido",other:"Otro motivo"} as Record<string,string>)[value]||value;}
function returnResolution(value:string){return ({replacement:"Reposición",credit_note:"Nota crédito",other:"Otra resolución"} as Record<string,string>)[value]||value;}

async function load(id:string,session:NonNullable<Awaited<ReturnType<typeof getSession>>>){
  const req=await query<Req>(
    `SELECT r.id,r.organization_id,o.name organization_name,COALESCE(o.default_country,o.legal_country) organization_country,
            s.name supplier_name,s.tax_id supplier_tax_id,s.email supplier_email,s.phone supplier_phone,
            r.number::text,r.status,r.needed_by::text,r.notes,u.full_name requested_by_name,r.created_at::text,
            r.approval_required,r.approval_state,r.approval_decided_at::text,approver.full_name approval_decided_by_name,r.approval_decision_notes
     FROM supplier_requisitions r
     JOIN organizations o ON o.id=r.organization_id
     JOIN suppliers s ON s.id=r.supplier_id
     LEFT JOIN users u ON u.id=r.requested_by
     LEFT JOIN users approver ON approver.id=r.approval_decided_by
     WHERE r.id=$1`,[id],
  );
  if(!req.rowCount)return null;
  if(session.platformRole==="user"&&session.organizationId!==req.rows[0].organization_id)return null;
  const items=await query<Item>(
    `SELECT ri.sku,ri.description,ri.unit,ri.quantity_requested::text,ri.quantity_received::text,
            COALESCE((SELECT sum(sri.quantity) FROM supplier_return_items sri WHERE sri.requisition_item_id=ri.id),0)::text quantity_returned,
            ri.unit_cost_estimated::text,s.name site_name,l.name location_name
     FROM supplier_requisition_items ri
     LEFT JOIN sites s ON s.id=ri.site_id
     LEFT JOIN locations l ON l.id=ri.location_id
     WHERE ri.requisition_id=$1 ORDER BY ri.created_at,ri.description`,[id],
  );
  const returns=await query<ReturnLine>(
    `SELECT sr.number::text return_number,sr.reason_code,sr.expected_resolution,sr.reason_detail,sr.document_number,sr.returned_at::text,
            ri.sku,ri.description,ri.unit,sri.quantity::text,sri.unit_cost::text,w.name warehouse,
            source.movement_at::text source_receipt_at,u.full_name created_by_name
     FROM supplier_returns sr
     JOIN supplier_return_items sri ON sri.return_id=sr.id
     JOIN supplier_requisition_items ri ON ri.id=sri.requisition_item_id
     JOIN inventory_transactions source ON source.id=sri.receipt_transaction_id
     LEFT JOIN inventory_warehouses w ON w.id=sri.warehouse_id
     LEFT JOIN users u ON u.id=sr.created_by
     WHERE sr.requisition_id=$1
     ORDER BY sr.returned_at DESC,sr.number DESC,ri.sku`,
    [id],
  );
  const reconciliation=can(session,"requisitions.reconcile")?await loadProcurementReconciliation(id):{documents:[] as ProcurementDocumentSummary[],lines:[] as ProcurementDocumentLine[],events:[]};
  return {req:req.rows[0],items:items.rows,returns:returns.rows,reconciliation};
}

async function pdf(req:Req,items:Item[],returns:ReturnLine[],documents:ProcurementDocumentSummary[],currency:string){
  const doc=await PDFDocument.create();
  const regular=await doc.embedFont(StandardFonts.Helvetica);
  const bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const pageSize:[number,number]=[595.28,841.89];
  let page=doc.addPage(pageSize);
  const dark=rgb(41/255,54/255,68/255),teal=rgb(56/255,178/255,169/255),soft=rgb(98/255,115/255,126/255),line=rgb(222/255,230/255,233/255);
  const drawHeader=()=>{
    page.drawRectangle({x:0,y:812,width:595.28,height:30,color:dark});
    page.drawText("DESWEB CMMS · REQUISICIÓN",{x:38,y:822,size:9,font:bold,color:rgb(1,1,1)});
  };
  drawHeader();
  page.drawText("REQ-"+req.number.padStart(6,"0"),{x:38,y:775,size:20,font:bold,color:dark});
  page.drawText(req.supplier_name.slice(0,58),{x:38,y:752,size:12,font:bold,color:teal});
  page.drawText(req.organization_name.slice(0,70),{x:38,y:735,size:9,font:regular,color:soft});
  page.drawText("Estado: "+req.status,{x:395,y:775,size:9,font:bold,color:dark});
  page.drawText("Aprobación: "+(req.approval_required?req.approval_state:"no requerida"),{x:395,y:760,size:8,font:bold,color:teal});
  page.drawText("Creada: "+new Date(req.created_at).toLocaleDateString("es-CO"),{x:395,y:745,size:8,font:regular,color:soft});
  page.drawText("Requerida: "+(req.needed_by?new Date(req.needed_by+"T12:00:00").toLocaleDateString("es-CO"):"Sin fecha"),{x:395,y:730,size:8,font:regular,color:soft});
  let y=700;
  const cols={sku:38,desc:96,requested:288,received:330,returned:370,pending:414,cost:458,total:515};
  const drawTableHead=()=>{
    page.drawText("SKU",{x:cols.sku,y,size:6.6,font:bold,color:soft});
    page.drawText("INSUMO",{x:cols.desc,y,size:6.6,font:bold,color:soft});
    page.drawText("SOLIC.",{x:cols.requested,y,size:6.6,font:bold,color:soft});
    page.drawText("REC.",{x:cols.received,y,size:6.6,font:bold,color:soft});
    page.drawText("DEV.",{x:cols.returned,y,size:6.6,font:bold,color:soft});
    page.drawText("PEND.",{x:cols.pending,y,size:6.6,font:bold,color:soft});
    page.drawText("EST.",{x:cols.cost,y,size:6.6,font:bold,color:soft});
    page.drawText("SUBTOTAL",{x:cols.total,y,size:6.6,font:bold,color:soft});
    y-=10;page.drawLine({start:{x:38,y},end:{x:557,y},thickness:1,color:teal});y-=15;
  };
  drawTableHead();
  let grand=0;
  for(const item of items){
    if(y<90){page=doc.addPage(pageSize);drawHeader();y=785;drawTableHead();}
    const qty=Number(item.quantity_requested||0),received=Number(item.quantity_received||0),returned=Number(item.quantity_returned||0),pending=Math.max(0,qty-received),cost=Number(item.unit_cost_estimated||0),subtotal=qty*cost;grand+=subtotal;
    page.drawText(item.sku.slice(0,14),{x:cols.sku,y,size:7,font:regular,color:dark});
    page.drawText(item.description.slice(0,31),{x:cols.desc,y,size:7,font:regular,color:dark});
    page.drawText((String(qty)+" "+item.unit).slice(0,12),{x:cols.requested,y,size:6.6,font:regular,color:dark});
    page.drawText(String(received).slice(0,10),{x:cols.received,y,size:6.6,font:regular,color:dark});
    page.drawText(String(returned).slice(0,10),{x:cols.returned,y,size:6.6,font:regular,color:dark});
    page.drawText(String(pending).slice(0,10),{x:cols.pending,y,size:6.6,font:regular,color:dark});
    page.drawText(money(cost,currency).slice(0,13),{x:cols.cost,y,size:6.4,font:regular,color:dark});
    page.drawText(money(subtotal,currency).slice(0,13),{x:cols.total,y,size:6.4,font:bold,color:dark});
    y-=17;page.drawLine({start:{x:38,y:y+6},end:{x:557,y:y+6},thickness:.4,color:line});
  }
  y-=12;
  page.drawText("TOTAL ESTIMADO",{x:395,y,size:8,font:bold,color:soft});
  page.drawText(money(grand,currency),{x:480,y,size:9,font:bold,color:dark});
  y-=28;
  if(req.notes){page.drawText("Observaciones",{x:38,y,size:9,font:bold,color:dark});y-=15;page.drawText(req.notes.slice(0,95),{x:38,y,size:8,font:regular,color:soft});y-=24;}
  if(returns.length){
    if(y<120){page=doc.addPage(pageSize);drawHeader();y=785;}
    page.drawText("DEVOLUCIONES AL PROVEEDOR",{x:38,y,size:10,font:bold,color:teal});y-=17;
    for(const lineItem of returns){
      if(y<70){page=doc.addPage(pageSize);drawHeader();y=785;}
      const label="DEV-"+lineItem.return_number.padStart(6,"0")+" · "+lineItem.sku+" · -"+lineItem.quantity+" "+lineItem.unit;
      page.drawText(label.slice(0,64),{x:38,y,size:7.5,font:bold,color:dark});
      page.drawText((returnReason(lineItem.reason_code)+" · "+returnResolution(lineItem.expected_resolution)).slice(0,66),{x:300,y,size:7,font:regular,color:soft});
      y-=13;
      page.drawText(("Documento: "+(lineItem.document_number||"—")+" · Bodega: "+(lineItem.warehouse||"—")).slice(0,90),{x:38,y,size:6.8,font:regular,color:soft});
      y-=15;
    }
  }
  if(documents.length){
    if(y<140){page=doc.addPage(pageSize);drawHeader();y=785;}
    page.drawText("CONCILIACIÓN DOCUMENTAL",{x:38,y,size:10,font:bold,color:teal});y-=18;
    for(const document of documents){
      if(y<75){page=doc.addPage(pageSize);drawHeader();y=785;}
      const state=procurementMatchLabel(document.match_state)+" · "+(document.voided_at?"Anulado":procurementReviewLabel(document.review_status));
      page.drawText((procurementDocumentTypeLabel(document.document_type)+" · "+document.document_number).slice(0,62),{x:38,y,size:7.4,font:bold,color:dark});
      page.drawText(state.slice(0,44),{x:330,y,size:6.8,font:bold,color:document.match_state==="difference"?rgb(.65,.28,.22):teal});
      y-=12;
      const qty="Doc "+Number(document.document_quantity).toLocaleString("es-CO")+" / Esperado "+(document.expected_quantity===null?"—":document.expected_quantity.toLocaleString("es-CO"));
      const val="Dif. valor "+(document.value_difference===null?"—":money(document.value_difference,document.currency_code||currency));
      page.drawText((qty+" · "+val).slice(0,92),{x:38,y,size:6.6,font:regular,color:soft});
      y-=15;
    }
  }
  return Buffer.from(await doc.save());
}

async function xlsx(req:Req,items:Item[],returns:ReturnLine[],documents:ProcurementDocumentSummary[],documentLines:ProcurementDocumentLine[],currency:string){
  const wb=new ExcelJS.Workbook();wb.creator="Desweb CMMS";
  const sh=wb.addWorksheet("Requisición",{views:[{showGridLines:false}]});
  sh.columns=[{width:18},{width:38},{width:12},{width:12},{width:12},{width:12},{width:14},{width:18},{width:18},{width:28}];
  sh.mergeCells("A1:J2");sh.getCell("A1").value="DESWEB CMMS · REQUISICIÓN "+req.number.padStart(6,"0");sh.getCell("A1").font={bold:true,size:17,color:{argb:"293644"}};
  sh.mergeCells("A3:J3");sh.getCell("A3").value=req.supplier_name+" · "+req.organization_name;sh.getCell("A3").font={bold:true,color:{argb:"38B2A9"}};
  sh.addRow(["Estado",req.status,"Aprobación",req.approval_required?req.approval_state:"No requerida","Fecha requerida",req.needed_by||"Sin fecha","Solicitante",req.requested_by_name||"Sin registrar","Moneda "+currency]);
  if(req.approval_decided_at)sh.addRow(["Decisión por",req.approval_decided_by_name||"Operador de plataforma","Fecha decisión",req.approval_decided_at,"Observación",req.approval_decision_notes||""]);
  sh.addRow([]);
  sh.addRow(["SKU","Insumo","Solicitado","Recibido","Devuelto","Pendiente","Unidad","Costo estimado","Subtotal","Destino"]);
  const head=sh.lastRow!;head.font={bold:true,color:{argb:"FFFFFF"}};head.fill={type:"pattern",pattern:"solid",fgColor:{argb:"293644"}};
  let grand=0;
  for(const item of items){
    const qty=Number(item.quantity_requested||0),received=Number(item.quantity_received||0),pending=Math.max(0,qty-received),cost=Number(item.unit_cost_estimated||0),subtotal=qty*cost;grand+=subtotal;
    const returned=Number(item.quantity_returned||0);
    sh.addRow([item.sku,item.description,qty,received,returned,pending,item.unit,cost,subtotal,[item.site_name,item.location_name].filter(Boolean).join(" · ")]);
  }
  sh.addRow([]);sh.addRow(["","","","","","","","TOTAL",grand,currency]);
  sh.lastRow!.font={bold:true};
  if(req.notes){sh.addRow([]);sh.addRow(["Observaciones",req.notes]);}
  if(returns.length){
    const rs=wb.addWorksheet("Devoluciones",{views:[{state:"frozen",ySplit:1,showGridLines:false}]});
    rs.columns=[{width:14},{width:20},{width:18},{width:34},{width:12},{width:14},{width:22},{width:20},{width:20},{width:26},{width:22}];
    rs.addRow(["DEV","Fecha","SKU","Artículo","Cantidad","Costo unitario","Motivo","Resolución","Documento","Bodega","Recepción origen"]);
    rs.getRow(1).font={bold:true,color:{argb:"FFFFFF"}};rs.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"293644"}};
    for(const lineItem of returns)rs.addRow([
      "DEV-"+lineItem.return_number.padStart(6,"0"),lineItem.returned_at,lineItem.sku,lineItem.description,Number(lineItem.quantity),Number(lineItem.unit_cost),
      returnReason(lineItem.reason_code)+(lineItem.reason_detail?" · "+lineItem.reason_detail:""),returnResolution(lineItem.expected_resolution),
      lineItem.document_number||"",lineItem.warehouse||"",lineItem.source_receipt_at,
    ]);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function word(req:Req,items:Item[],returns:ReturnLine[],documents:ProcurementDocumentSummary[],currency:string){
  let grand=0;
  const rows=items.map(item=>{
    const qty=Number(item.quantity_requested||0),received=Number(item.quantity_received||0),returned=Number(item.quantity_returned||0),pending=Math.max(0,qty-received),cost=Number(item.unit_cost_estimated||0),subtotal=qty*cost;grand+=subtotal;
    return `<tr><td>${esc(item.sku)}</td><td>${esc(item.description)}</td><td>${qty}</td><td>${received}</td><td>${returned}</td><td>${pending}</td><td>${esc(item.unit)}</td><td>${esc(money(cost,currency))}</td><td>${esc(money(subtotal,currency))}</td></tr>`;
  }).join("");
  const html=`<!doctype html><html><head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;color:#293644;margin:34px;border-top:18px solid #293644;padding-top:24px}h1{font-size:24px;margin:0}h2{font-size:15px;color:#38b2a9;margin:7px 0 18px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}.meta div{border:1px solid #dde6e9;padding:9px}.meta span{display:block;font-size:8px;color:#71818a;text-transform:uppercase}.meta strong{font-size:10px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{padding:8px;border-bottom:1px solid #dde6e9;text-align:left;font-size:9px}th{background:#293644;color:#fff}.total{text-align:right;font-size:12px;font-weight:bold;margin-top:15px}.notes{margin-top:22px;padding:12px;background:#f6f9fa}</style></head><body>
  <h1>Requisición REQ-${req.number.padStart(6,"0")}</h1><h2>${esc(req.supplier_name)}</h2>
  <div class="meta"><div><span>Empresa</span><strong>${esc(req.organization_name)}</strong></div><div><span>Estado</span><strong>${esc(req.status)}</strong></div><div><span>Aprobación</span><strong>${esc(req.approval_required?req.approval_state:"No requerida")}</strong></div></div>
  ${req.approval_decided_at?`<div class="notes"><b>Decisión de aprobación</b><p>${esc(req.approval_decided_by_name||"Operador de plataforma")} · ${esc(req.approval_decided_at)}${req.approval_decision_notes?" · "+esc(req.approval_decision_notes):""}</p></div>`:""}
  <table><thead><tr><th>SKU</th><th>Insumo</th><th>Solicitado</th><th>Recibido</th><th>Devuelto</th><th>Pendiente</th><th>Unidad</th><th>Costo est.</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="total">Total estimado: ${esc(money(grand,currency))}</div>
  ${returns.length?`<h2>Devoluciones al proveedor</h2><table><thead><tr><th>DEV</th><th>Fecha</th><th>SKU</th><th>Cantidad</th><th>Motivo</th><th>Resolución</th><th>Documento</th><th>Bodega</th></tr></thead><tbody>${returns.map(lineItem=>`<tr><td>DEV-${lineItem.return_number.padStart(6,"0")}</td><td>${esc(lineItem.returned_at)}</td><td>${esc(lineItem.sku)}</td><td>-${esc(lineItem.quantity)} ${esc(lineItem.unit)}</td><td>${esc(returnReason(lineItem.reason_code)+(lineItem.reason_detail?" · "+lineItem.reason_detail:""))}</td><td>${esc(returnResolution(lineItem.expected_resolution))}</td><td>${esc(lineItem.document_number||"—")}</td><td>${esc(lineItem.warehouse||"—")}</td></tr>`).join("")}</tbody></table>`:""}
  ${req.notes?`<div class="notes"><b>Observaciones</b><p>${esc(req.notes)}</p></div>`:""}
  </body></html>`;
  return Buffer.from("\uFEFF"+html,"utf8");
}

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("No autorizado",{status:401});
  if(!can(session,"requisitions.read"))return new NextResponse("Forbidden",{status:403});
  const {id}=await params;
  if(!UUID.test(id))return new NextResponse("Solicitud inválida",{status:400});
  const format=new URL(request.url).searchParams.get("format")||"pdf";
  if(!["pdf","xlsx","word"].includes(format))return new NextResponse("Formato inválido",{status:400});
  const data=await load(id,session);
  if(!data)return new NextResponse("Requisición no encontrada",{status:404});
  const currency=countryDefinition(data.req.organization_country)?.currency||"USD";
  const base="requisicion-"+data.req.number.padStart(6,"0")+"-"+fileSafe(data.req.supplier_name);
  if(format==="xlsx"){
    const body=await xlsx(data.req,data.items,data.returns,currency);
    return new NextResponse(new Uint8Array(body),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="${base}.xlsx"`,"Cache-Control":"private, no-store"}});
  }
  if(format==="word"){
    const body=word(data.req,data.items,data.returns,currency);
    return new NextResponse(new Uint8Array(body),{headers:{"Content-Type":"application/msword; charset=utf-8","Content-Disposition":`attachment; filename="${base}.doc"`,"Cache-Control":"private, no-store"}});
  }
  const body=await pdf(data.req,data.items,data.returns,currency);
  return new NextResponse(new Uint8Array(body),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${base}.pdf"`,"Cache-Control":"private, no-store"}});
}
