import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFImage } from "pdf-lib";
import ExcelJS from "exceljs";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { organizationScopeFor } from "@/lib/organization-scope";
import { roleLabel } from "@/lib/permissions";
import {
  appendCompanyStatus,
  appendPeriod,
  appendPriorityFilter,
  appendSiteFilter,
  appendValue,
  parseDashboardFilters,
  type DashboardFilterInput,
} from "@/lib/dashboard-filters";

type ExportRow={
  type:string;
  date:string;
  reference:string;
  subject:string;
  status:string;
  detail:string;
  value:string;
};

function csvCell(value:string){
  const safe=String(value??"").replaceAll('"','""');
  return '"'+safe+'"';
}
function csv(rows:ExportRow[]){
  const headers=["Tipo","Fecha","Referencia","Entidad / asunto","Estado","Detalle","Valor"];
  return "\uFEFF"+[
    headers.map(csvCell).join(","),
    ...rows.map(row=>[row.type,row.date,row.reference,row.subject,row.status,row.detail,row.value].map(csvCell).join(",")),
  ].join("\r\n");
}
async function excelReport(
  role:string,
  period:string,
  filters:string,
  rows:ExportRow[],
  branding:ReportBranding,
){
  const workbook=new ExcelJS.Workbook();
  workbook.creator="Desweb CMMS";
  workbook.created=new Date();
  workbook.modified=new Date();

  const primary=branding.primary.replace("#","");
  const secondary=branding.secondary.replace("#","");
  const mint="BAE3E0";
  const light="F7FAFA";
  const border="D8E2E6";
  const white="FFFFFF";

  const statusRows=distribution(rows);
  const typeRows=typeDistribution(rows);
  const completed=rows.filter(row=>["completed","closed","active"].includes(row.status)).length;
  const alerts=rows.filter(row=>["past_due","suspended","cancelled","canceled","paused"].includes(row.status)).length;

  const summary=workbook.addWorksheet("Resumen",{views:[{state:"frozen",ySplit:5}]});
  summary.properties.defaultRowHeight=20;
  summary.columns=[
    {width:22},{width:20},{width:20},{width:20},{width:20},{width:20},{width:20},
  ];

  summary.mergeCells("A1:G2");
  summary.getCell("A1").value="REPORTE DE DASHBOARD";
  summary.getCell("A1").font={bold:true,size:22,color:{argb:secondary}};
  summary.getCell("A1").alignment={vertical:"middle"};
  summary.mergeCells("A3:G3");
  summary.getCell("A3").value=branding.reportOwner+" · "+role;
  summary.getCell("A3").font={bold:true,size:11,color:{argb:primary}};
  summary.mergeCells("A4:G4");
  summary.getCell("A4").value="Periodo: "+period+" · "+filters;
  summary.getCell("A4").font={size:9,color:{argb:"66727A"}};

  const kpis=[
    ["Registros",rows.length,"Elementos del periodo"],
    ["Cumplidos",completed,rows.length?Math.round(completed/rows.length*100)+"% del total":"Sin registros"],
    ["Alertas",alerts,"Estados que requieren revisión"],
    ["Estados",statusRows.length,"Categorías presentes"],
  ];
  let row=6;
  for(const [label,value,hint] of kpis){
    summary.mergeCells(row,1,row,2);
    summary.getCell(row,1).value=label;
    summary.getCell(row,1).font={bold:true,size:9,color:{argb:"66727A"}};
    summary.mergeCells(row+1,1,row+2,2);
    summary.getCell(row+1,1).value=value as string|number;
    summary.getCell(row+1,1).font={bold:true,size:20,color:{argb:secondary}};
    summary.mergeCells(row+3,1,row+3,2);
    summary.getCell(row+3,1).value=hint as string;
    summary.getCell(row+3,1).font={size:8,color:{argb:"66727A"}};
    for(let rr=row;rr<=row+3;rr++){
      for(let cc=1;cc<=2;cc++){
        summary.getCell(rr,cc).fill={type:"pattern",pattern:"solid",fgColor:{argb:light}};
        summary.getCell(rr,cc).border={
          top:{style:"thin",color:{argb:border}},
          bottom:{style:"thin",color:{argb:border}},
          left:{style:"thin",color:{argb:border}},
          right:{style:"thin",color:{argb:border}},
        };
      }
    }
    row+=5;
  }

  summary.getCell("D6").value="Distribución por estado";
  summary.getCell("D6").font={bold:true,size:12,color:{argb:secondary}};
  summary.getCell("D7").value="Estado";
  summary.getCell("E7").value="Cantidad";
  summary.getCell("F7").value="%";
  [summary.getCell("D7"),summary.getCell("E7"),summary.getCell("F7")].forEach(cell=>{
    cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:secondary}};
    cell.font={bold:true,color:{argb:white}};
  });
  statusRows.forEach((item,index)=>{
    const rr=8+index;
    summary.getCell(rr,4).value=item.label;
    summary.getCell(rr,5).value=item.count;
    summary.getCell(rr,6).value=rows.length?item.count/rows.length:0;
    summary.getCell(rr,6).numFmt="0.0%";
  });

  const typeStart=Math.max(16,9+statusRows.length);
  summary.getCell(typeStart,4).value="Distribución por tipo";
  summary.getCell(typeStart,4).font={bold:true,size:12,color:{argb:secondary}};
  summary.getCell(typeStart+1,4).value="Tipo";
  summary.getCell(typeStart+1,5).value="Cantidad";
  [summary.getCell(typeStart+1,4),summary.getCell(typeStart+1,5)].forEach(cell=>{
    cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:primary}};
    cell.font={bold:true,color:{argb:white}};
  });
  typeRows.forEach((item,index)=>{
    summary.getCell(typeStart+2+index,4).value=item.label;
    summary.getCell(typeStart+2+index,5).value=item.count;
  });

  const data=workbook.addWorksheet("Datos",{views:[{state:"frozen",ySplit:1}]});
  data.columns=[
    {header:"Tipo",key:"type",width:20},
    {header:"Fecha",key:"date",width:16},
    {header:"Referencia",key:"reference",width:20},
    {header:"Entidad / asunto",key:"subject",width:34},
    {header:"Estado",key:"status",width:18},
    {header:"Detalle",key:"detail",width:48},
    {header:"Valor",key:"value",width:20},
  ];
  data.getRow(1).height=26;
  data.getRow(1).eachCell(cell=>{
    cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:secondary}};
    cell.font={bold:true,color:{argb:white}};
    cell.alignment={vertical:"middle"};
  });
  for(const item of rows){
    data.addRow({
      type:item.type,date:item.date,reference:item.reference,subject:item.subject,
      status:statusLabel(item.status),detail:item.detail,value:item.value,
    });
  }
  data.autoFilter={from:"A1",to:"G"+String(Math.max(1,data.rowCount))};
  data.eachRow((excelRow,rowNumber)=>{
    if(rowNumber===1)return;
    excelRow.alignment={vertical:"top",wrapText:true};
    if(rowNumber%2===0){
      excelRow.eachCell(cell=>cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:light}});
    }
  });
  data.getColumn("E").eachCell((cell,rowNumber)=>{
    if(rowNumber===1)return;
    cell.font={bold:true,color:{argb:primary}};
  });

  const meta=workbook.addWorksheet("Metadatos");
  meta.columns=[{width:25},{width:70}];
  meta.addRows([
    ["Reporte","Dashboard CMMS"],
    ["Organización / marca",branding.reportOwner],
    ["Rol",role],
    ["Periodo",period],
    ["Filtros",filters],
    ["Generado",new Date().toLocaleString("es-CO")],
    ["Registros",rows.length],
  ]);
  meta.getColumn(1).font={bold:true,color:{argb:secondary}};
  meta.getColumn(2).alignment={wrapText:true};

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function safeDate(value:string|null|undefined){
  if(!value) return "";
  const date=new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0,10) : date.toLocaleDateString("es-CO");
}
function cleanText(value:string){
  return String(value||"").replace(/[\u0000-\u001f]/g," ").replace(/\s+/g," ").trim();
}
function wrap(text:string,font:any,size:number,width:number){
  const words=cleanText(text).split(" ");
  const lines:string[]=[];
  let current="";
  for(const word of words){
    const candidate=current?current+" "+word:word;
    if(font.widthOfTextAtSize(candidate,size)<=width) current=candidate;
    else {
      if(current) lines.push(current);
      current=word;
    }
  }
  if(current) lines.push(current);
  return lines.length?lines:[""];
}
type ReportBranding={
  brandName:string;
  reportOwner:string;
  primary:string;
  secondary:string;
  logo:Buffer|null;
  logoMime:string|null;
  whiteLabel:boolean;
  showDeswebBranding:boolean;
};

function validHex(value:string|null|undefined,fallback:string){
  return value&&/^#[0-9a-f]{6}$/i.test(value)?value:fallback;
}
function pdfColor(hex:string){
  const value=validHex(hex,"#38B2A9").slice(1);
  return rgb(
    Number.parseInt(value.slice(0,2),16)/255,
    Number.parseInt(value.slice(2,4),16)/255,
    Number.parseInt(value.slice(4,6),16)/255,
  );
}
async function getReportBranding(session:NonNullable<Awaited<ReturnType<typeof getSession>>>):Promise<ReportBranding>{
  const global=await query<{logo:Buffer|null;mime:string|null}>(
    "SELECT logo_on_light logo,logo_on_light_mime mime FROM app_customization WHERE id=1",
  );
  const globalLogo=global.rows[0]?.logo||null;
  const globalMime=global.rows[0]?.mime||null;

  if(session.platformRole!=="user"||!session.organizationId){
    return {
      brandName:"DESWEB",
      reportOwner:"Desweb CMMS",
      primary:"#38B2A9",
      secondary:"#293644",
      logo:globalLogo,
      logoMime:globalMime,
      whiteLabel:false,
      showDeswebBranding:true,
    };
  }

  const result=await query<{
    organization_name:string;
    legal_name:string|null;
    organization_logo:Buffer|null;
    organization_logo_mime:string|null;
    plan_code:string|null;
    white_label:boolean|null;
    app_name:string|null;
    primary_color:string|null;
    secondary_color:string|null;
    brand_logo:Buffer|null;
    brand_logo_mime:string|null;
    show_desweb_branding:boolean|null;
  }>(
    `SELECT
      o.name organization_name,o.legal_name,
      o.logo_data organization_logo,o.logo_mime_type organization_logo_mime,
      p.code plan_code,p.white_label,
      b.app_name,b.primary_color,b.secondary_color,
      b.logo_on_light brand_logo,b.logo_on_light_mime brand_logo_mime,
      b.show_desweb_branding
    FROM organizations o
    LEFT JOIN organization_subscriptions s ON s.organization_id=o.id
    LEFT JOIN billing_plans p ON p.id=s.plan_id
    LEFT JOIN organization_branding b ON b.organization_id=o.id
    WHERE o.id=$1`,
    [session.organizationId],
  );
  const row=result.rows[0];
  const pro=Boolean(row?.plan_code==="pro"&&row?.white_label);
  if(pro){
    return {
      brandName:row?.app_name||row?.organization_name||"Empresa",
      reportOwner:row?.legal_name||row?.organization_name||"Empresa",
      primary:validHex(row?.primary_color,"#38B2A9"),
      secondary:validHex(row?.secondary_color,"#293644"),
      logo:row?.brand_logo||row?.organization_logo||null,
      logoMime:row?.brand_logo_mime||row?.organization_logo_mime||null,
      whiteLabel:true,
      showDeswebBranding:row?.show_desweb_branding??false,
    };
  }
  return {
    brandName:"DESWEB",
    reportOwner:row?.legal_name||row?.organization_name||session.organizationName||"Desweb CMMS",
    primary:"#38B2A9",
    secondary:"#293644",
    logo:globalLogo,
    logoMime:globalMime,
    whiteLabel:false,
    showDeswebBranding:true,
  };
}

async function embedReportLogo(doc:PDFDocument,branding:ReportBranding):Promise<PDFImage|null>{
  if(!branding.logo||!branding.logoMime)return null;
  try{
    if(branding.logoMime.includes("png"))return await doc.embedPng(branding.logo);
    if(branding.logoMime.includes("jpeg")||branding.logoMime.includes("jpg"))return await doc.embedJpg(branding.logo);
  }catch{}
  return null;
}

function statusLabel(status:string){
  const labels:Record<string,string>={
    active:"Activa",trialing:"Prueba",trial_expired:"Prueba vencida",past_due:"Pago pendiente",suspended:"Suspendida",canceled:"Cancelada",
    open:"Abierta",assigned:"Asignada",in_progress:"En progreso",paused:"Pausada",completed:"Completada",cancelled:"Cancelada",
    pending:"Pendiente",closed:"Cerrada",contacted:"Contactado",qualified:"Calificado",new:"Nuevo",discarded:"Descartado",
  };
  return labels[status]||status.replaceAll("_"," ");
}
function distribution(rows:ExportRow[]){
  const map=new Map<string,number>();
  for(const row of rows)map.set(row.status,(map.get(row.status)||0)+1);
  return [...map.entries()].map(([key,count])=>({key,label:statusLabel(key),count})).sort((a,b)=>b.count-a.count);
}
function typeDistribution(rows:ExportRow[]){
  const map=new Map<string,number>();
  for(const row of rows)map.set(row.type,(map.get(row.type)||0)+1);
  return [...map.entries()].map(([key,count])=>({key,label:key,count})).sort((a,b)=>b.count-a.count);
}
async function pdfReport(
  role:string,
  period:string,
  filters:string,
  rows:ExportRow[],
  branding:ReportBranding,
){
  const doc=await PDFDocument.create();
  const regular=await doc.embedFont(StandardFonts.Helvetica);
  const bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const primary=pdfColor(branding.primary);
  const secondary=pdfColor(branding.secondary);
  const dark=rgb(0.10,0.15,0.19);
  const soft=rgb(0.42,0.48,0.52);
  const border=rgb(0.86,0.89,0.90);
  const pale=rgb(0.96,0.98,0.98);
  const watermark=rgb(0.90,0.91,0.92);
  const white=rgb(1,1,1);
  const logo=await embedReportLogo(doc,branding);
  const pageSize:[number,number]=[842,596];
  const statusRows=distribution(rows);
  const typeRows=typeDistribution(rows);
  const complete=rows.filter(row=>["completed","closed","active"].includes(row.status)).length;
  const alerts=rows.filter(row=>["past_due","suspended","cancelled","canceled","paused"].includes(row.status)).length;
  let page=doc.addPage(pageSize);
  let y=pageSize[1]-112;

  function drawLogoCentered(target:any,top:number,maxW:number,maxH:number){
    if(logo){
      const scale=Math.min(maxW/logo.width,maxH/logo.height,1);
      const w=logo.width*scale,h=logo.height*scale;
      target.drawImage(logo,{x:(pageSize[0]-w)/2,y:top-h,width:w,height:h});
      return;
    }
    const label=cleanText(branding.brandName);
    const size=22;
    const w=bold.widthOfTextAtSize(label,size);
    target.drawText(label,{x:(pageSize[0]-w)/2,y:top-size,size,font:bold,color:secondary});
  }
  function drawWatermark(target:any){
    const letter=branding.whiteLabel ? (cleanText(branding.brandName)[0]||"D").toUpperCase() : "D";
    const size=250;
    const width=bold.widthOfTextAtSize(letter,size);
    target.drawText(letter,{x:(pageSize[0]-width)/2,y:154,size,font:bold,color:watermark,opacity:.32});
    if(!branding.whiteLabel){
      target.drawRectangle({x:pageSize[0]/2-92,y:205,width:80,height:94,color:rgb(.76,.97,.96),opacity:.45});
      target.drawRectangle({x:pageSize[0]/2-92,y:205,width:80,height:30,color:primary,opacity:.16});
    }
  }
  function letterhead(){
    page.drawRectangle({x:0,y:0,width:pageSize[0],height:pageSize[1],color:white});
    drawLogoCentered(page,pageSize[1]-48,180,48);
    drawWatermark(page);
  }
  function footer(){
    const pages=doc.getPages();
    for(const [index,p] of pages.entries()){
      const isDesweb=!branding.whiteLabel||branding.showDeswebBranding;
      const slogan=isDesweb
        ?"Donde la tecnología se encuentra con la visión, creamos el futuro juntos."
        :cleanText(branding.reportOwner);
      const sw=bold.widthOfTextAtSize(slogan,6.8);
      p.drawText(slogan,{x:Math.max(38,(pageSize[0]-sw)/2),y:23,size:6.8,font:bold,color:dark});
      p.drawText(String(index+1),{x:pageSize[0]-48,y:14,size:8,font:regular,color:dark});
    }
  }
  function newPage(){
    page=doc.addPage(pageSize);
    letterhead();
    y=pageSize[1]-112;
  }
  function card(x:number,top:number,w:number,label:string,value:string,hint:string){
    page.drawRectangle({x,y:top-66,width:w,height:66,color:white,borderColor:border,borderWidth:.7,opacity:.97});
    page.drawRectangle({x,y:top-66,width:4,height:66,color:primary});
    page.drawText(label.toUpperCase(),{x:x+14,y:top-18,size:7,font:bold,color:soft});
    page.drawText(value,{x:x+14,y:top-42,size:17,font:bold,color:secondary});
    page.drawText(hint,{x:x+14,y:top-57,size:6.8,font:regular,color:soft});
  }
  function barChart(x:number,top:number,w:number,title:string,data:{label:string;count:number}[]){
    page.drawRectangle({x,y:top-156,width:w,height:164,color:white,borderColor:border,borderWidth:.6,opacity:.97});
    page.drawText(title,{x:x+12,y:top-16,size:10,font:bold,color:secondary});
    const list=data.slice(0,6);
    const max=Math.max(...list.map(row=>row.count),1);
    let cy=top-39;
    for(const item of list){
      page.drawText(cleanText(item.label).slice(0,23),{x:x+12,y:cy,size:7,font:regular,color:dark});
      const bx=x+116,bw=w-154;
      page.drawRectangle({x:bx,y:cy-1,width:bw,height:7,color:pale});
      page.drawRectangle({x:bx,y:cy-1,width:bw*(item.count/max),height:7,color:primary});
      page.drawText(String(item.count),{x:x+w-25,y:cy,size:7,font:bold,color:secondary});
      cy-=20;
    }
    if(!list.length)page.drawText("Sin datos para graficar.",{x:x+12,y:top-42,size:8,font:regular,color:soft});
  }

  letterhead();
  page.drawText("INFORME EJECUTIVO DE DASHBOARD",{x:42,y:y,size:18,font:bold,color:secondary});
  page.drawText(cleanText(branding.reportOwner)+" · "+cleanText(role),{x:42,y:y-20,size:9.5,font:bold,color:primary});
  page.drawText("Periodo: "+cleanText(period),{x:42,y:y-38,size:8,font:regular,color:dark});
  page.drawText(cleanText(filters),{x:42,y:y-53,size:7.5,font:regular,color:soft});
  page.drawText("Generado: "+new Date().toLocaleString("es-CO"),{x:620,y:y-38,size:7,font:regular,color:soft});
  y-=76;

  card(42,y,176,"Registros",String(rows.length),"Elementos del periodo");
  card(230,y,176,"Cumplidos",String(complete),rows.length?String(Math.round(complete/rows.length*100))+"% del total":"Sin registros");
  card(418,y,176,"Alertas",String(alerts),"Estados que requieren revisión");
  card(606,y,194,"Estados",String(statusRows.length),"Categorías presentes");
  y-=88;

  barChart(42,y,365,"Distribución por estado",statusRows);
  barChart(435,y,365,"Distribución por tipo",typeRows);
  y-=178;

  page.drawRectangle({x:42,y:y-46,width:758,height:46,color:white,borderColor:border,borderWidth:.6,opacity:.97});
  page.drawText("LECTURA EJECUTIVA",{x:55,y:y-16,size:7,font:bold,color:primary});
  const insight=rows.length
    ?"El reporte consolida los registros visibles para el rol y filtros seleccionados. Revise los estados con mayor volumen y las alertas para priorizar acciones."
    :"No se encontraron registros para el periodo y filtros seleccionados.";
  wrap(insight,regular,7.5,720).slice(0,2).forEach((line,index)=>page.drawText(line,{x:55,y:y-30-index*9,size:7.5,font:regular,color:dark}));

  newPage();
  page.drawText("DETALLE DE REGISTROS",{x:42,y,size:14,font:bold,color:secondary});
  page.drawText("Trazabilidad del periodo seleccionado",{x:42,y:y-15,size:7.5,font:regular,color:soft});
  y-=34;
  const columnX=[42,112,180,280,465,535];
  const columnW=[64,62,94,179,64,260];
  const headers=["Tipo","Fecha","Referencia","Entidad / asunto","Estado","Detalle / valor"];
  const drawTableHeader=()=>{
    page.drawRectangle({x:38,y:y-5,width:766,height:18,color:rgb(.96,.98,.98),opacity:.96});
    headers.forEach((h,i)=>page.drawText(h,{x:columnX[i],y,size:7.5,font:bold,color:secondary}));
    y-=20;
  };
  drawTableHeader();

  for(const row of rows.slice(0,350)){
    const cells=[row.type,row.date,row.reference,row.subject,statusLabel(row.status),row.detail+(row.value?" | "+row.value:"")];
    const wrapped=cells.map((cell,i)=>wrap(cell,regular,7,columnW[i]));
    const lineCount=Math.max(...wrapped.map(lines=>lines.length));
    const rowHeight=Math.max(21,lineCount*9+7);
    if(y-rowHeight<48){
      newPage();
      page.drawText("DETALLE DE REGISTROS (continuación)",{x:42,y,size:12,font:bold,color:secondary});
      y-=24;
      drawTableHeader();
    }
    page.drawRectangle({x:38,y:y-rowHeight+5,width:766,height:rowHeight,color:white,opacity:.93});
    wrapped.forEach((lines,i)=>{
      lines.slice(0,5).forEach((line,j)=>page.drawText(line,{x:columnX[i],y:y-j*9,size:7,font:regular,color:dark}));
    });
    y-=rowHeight;
    page.drawLine({start:{x:42,y:y+4},end:{x:800,y:y+4},thickness:.3,color:border});
  }
  if(!rows.length)page.drawText("No hay registros para los filtros seleccionados.",{x:42,y,size:9,font:regular,color:soft});

  footer();
  return doc.save();
}

function scope(session:NonNullable<Awaited<ReturnType<typeof getSession>>>,alias:string){
  return session.accessAllSites
    ? {sql:alias+".organization_id=$1",params:[session.organizationId] as unknown[]}
    : {sql:alias+".organization_id=$1 AND "+alias+".site_id=ANY($2::uuid[])",params:[session.organizationId,session.siteIds] as unknown[]};
}

async function platformRows(session:NonNullable<Awaited<ReturnType<typeof getSession>>>,filters:ReturnType<typeof parseDashboardFilters>){
  const subParams:unknown[]=[];
  const subPeriod=appendPeriod(subParams,"s.created_at",filters);
  const companyStatus=appendCompanyStatus(subParams,"o.active",filters);
  const subscriptionStatus=filters.activityStatus!=="all" ? " AND "+appendValue(subParams,"s.status",filters.activityStatus) : "";
  const organizationScope=organizationScopeFor(session);
  const subscriptionScope=organizationScope.unrestricted
    ?""
    :(()=>{subParams.push(organizationScope.organizationIds);return " AND o.id=ANY($"+subParams.length+"::uuid[])";})();
  const subscriptions=await query<{created_at:string;organization:string;plan:string;status:string;price:string|null}>(
    "SELECT s.created_at::text,o.name organization,p.name plan,s.status,p.monthly_price_cop::text price FROM organization_subscriptions s JOIN organizations o ON o.id=s.organization_id JOIN billing_plans p ON p.id=s.plan_id WHERE "+subPeriod+" AND "+companyStatus+subscriptionScope+subscriptionStatus+" ORDER BY s.created_at DESC LIMIT 1000",
    subParams,
  );
  const leadParams:unknown[]=[];
  const leadPeriod=appendPeriod(leadParams,"created_at",filters);
  const leads=session.platformRole==="platform_owner"
    ?await query<{created_at:string;full_name:string;company_name:string;status:string;interest:string}>(
      "SELECT created_at::text,full_name,company_name,status,interest FROM sales_leads WHERE "+leadPeriod+" ORDER BY created_at DESC LIMIT 1000",
      leadParams,
    )
    :{rows:[] as {created_at:string;full_name:string;company_name:string;status:string;interest:string}[]};
  return [
    ...subscriptions.rows.map(row=>({
      type:"Suscripción",date:safeDate(row.created_at),reference:row.plan,subject:row.organization,status:row.status,
      detail:"Plan "+row.plan,value:row.price?new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(row.price)):"",
    })),
    ...leads.rows.map(row=>({
      type:"Lead",date:safeDate(row.created_at),reference:row.interest,subject:row.company_name,status:row.status,
      detail:row.full_name,value:"",
    })),
  ] satisfies ExportRow[];
}
async function operationRows(session:NonNullable<Awaited<ReturnType<typeof getSession>>>,filters:ReturnType<typeof parseDashboardFilters>){
  const sc=scope(session,"w");
  const params=[...sc.params];
  const period=appendPeriod(params,"w.created_at",filters);
  const status=filters.activityStatus!=="all" ? " AND "+appendValue(params,"w.status",filters.activityStatus) : "";
  const site=appendSiteFilter(params,"w.site_id",filters);
  const priority=appendPriorityFilter(params,"w.priority",filters);
  const result=await query<{created_at:string;number:string;title:string;status:string;priority:string;asset:string|null;site:string;cost:string;downtime:string}>(
    "SELECT w.created_at::text,w.number::text,w.title,w.status,w.priority,a.name asset,s.name site,(w.labor_cost+w.parts_cost+w.external_cost)::text cost,w.downtime_minutes::text downtime FROM work_orders w JOIN sites s ON s.id=w.site_id LEFT JOIN assets a ON a.id=w.asset_id WHERE "+sc.sql+" AND "+period+status+site+priority+" ORDER BY w.created_at DESC LIMIT 2000",
    params,
  );
  return result.rows.map(row=>({
    type:"Orden de trabajo",date:safeDate(row.created_at),reference:"#"+row.number,subject:row.title,status:row.status,
    detail:[row.asset||"Sin activo",row.site,row.priority,String(row.downtime)+" min downtime"].join(" · "),
    value:new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(row.cost||0)),
  }));
}
async function fieldRows(session:NonNullable<Awaited<ReturnType<typeof getSession>>>,filters:ReturnType<typeof parseDashboardFilters>){
  if(!session.userId||!session.organizationId) return [];
  const provider=session.role==="provider",sid=session.externalSupplierId,org=session.organizationId,uid=session.userId;
  let pred=provider
    ? "t.organization_id=$1 AND t.service_supplier_id=$2"
    : "t.organization_id=$1 AND (t.assigned_to=$2 OR EXISTS(SELECT 1 FROM crew_members cm WHERE cm.crew_id=t.crew_id AND cm.user_id=$2))";
  const params=provider?[org,sid] as unknown[]:[org,uid] as unknown[];
  if(!session.accessAllSites){
    const index=params.length+1;
    params.push(session.siteIds);
    pred+=" AND w.site_id=ANY($"+index+"::uuid[])";
  }
  const site=appendSiteFilter(params,"w.site_id",filters);
  const priority=appendPriorityFilter(params,"w.priority",filters);
  const period=appendPeriod(params,"COALESCE(t.completed_at,t.started_at,w.updated_at)",filters);
  const status=filters.activityStatus!=="all" ? " AND "+appendValue(params,"t.status",filters.activityStatus) : "";
  const result=await query<{date:string;description:string;status:string;number:string;title:string;site:string;priority:string}>(
    "SELECT COALESCE(t.completed_at,t.started_at,w.updated_at)::text date,t.description,t.status,w.number::text,w.title,s.name site,w.priority FROM work_order_tasks t JOIN work_orders w ON w.id=t.work_order_id JOIN sites s ON s.id=w.site_id WHERE "+pred+site+priority+" AND "+period+status+" ORDER BY COALESCE(t.completed_at,t.started_at,w.updated_at) DESC LIMIT 2000",
    params,
  );
  return result.rows.map(row=>({
    type:"Actividad",date:safeDate(row.date),reference:"#"+row.number,subject:row.description,status:row.status,
    detail:[row.title,row.site,"Prioridad "+row.priority].join(" · "),value:"",
  }));
}
async function requesterRows(session:NonNullable<Awaited<ReturnType<typeof getSession>>>,filters:ReturnType<typeof parseDashboardFilters>){
  if(!session.userId||!session.organizationId) return [];
  const params:unknown[]=[session.organizationId,session.userId];
  let where="w.organization_id=$1 AND w.requested_by=$2";
  if(!session.accessAllSites){
    const index=params.length+1;
    params.push(session.siteIds);
    where+=" AND w.site_id=ANY($"+index+"::uuid[])";
  }
  where+=appendSiteFilter(params,"w.site_id",filters);
  where+=appendPriorityFilter(params,"w.priority",filters);
  const period=appendPeriod(params,"w.requested_at",filters);
  const status=filters.activityStatus!=="all" ? " AND "+appendValue(params,"w.status",filters.activityStatus) : "";
  const result=await query<{requested_at:string;number:string;title:string;status:string;priority:string;site:string}>(
    "SELECT w.requested_at::text,w.number::text,w.title,w.status,w.priority,s.name site FROM work_orders w JOIN sites s ON s.id=w.site_id WHERE "+where+" AND "+period+status+" ORDER BY w.requested_at DESC LIMIT 2000",
    params,
  );
  return result.rows.map(row=>({
    type:"Solicitud",date:safeDate(row.requested_at),reference:"#"+row.number,subject:row.title,status:row.status,
    detail:[row.site,"Prioridad "+row.priority].join(" · "),value:"",
  }));
}

export async function GET(request:Request){
  const session=await getSession();
  if(!session) return new NextResponse("Unauthorized",{status:401});
  const url=new URL(request.url);
  const requestedFormat=url.searchParams.get("format");
  const format=requestedFormat==="pdf"||requestedFormat==="xlsx"||requestedFormat==="csv" ? requestedFormat : "csv";
  const input:DashboardFilterInput={
    month:url.searchParams.get("month")||undefined,
    from:url.searchParams.get("from")||undefined,
    to:url.searchParams.get("to")||undefined,
    company_status:url.searchParams.get("company_status")||undefined,
    activity_status:url.searchParams.get("activity_status")||undefined,
    site_id:url.searchParams.get("site_id")||undefined,
    priority:url.searchParams.get("priority")||undefined,
    compare:url.searchParams.get("compare")||undefined,
  };
  const filters=parseDashboardFilters(input);

  let rows:ExportRow[]=[];
  if(session.platformRole==="platform_owner"||session.platformRole==="superadmin") rows=await platformRows(session,filters);
  else if(session.role==="technician"||session.role==="external"||session.role==="provider") rows=await fieldRows(session,filters);
  else if(session.role==="requester") rows=await requesterRows(session,filters);
  else rows=await operationRows(session,filters);

  const stamp=new Date().toISOString().slice(0,10);
  if(format==="csv"){
    const body=csv(rows);
    return new NextResponse(body,{
      headers:{
        "Content-Type":"text/csv; charset=utf-8",
        "Content-Disposition":'attachment; filename="dashboard-'+stamp+'.csv"',
        "Cache-Control":"no-store",
      },
    });
  }

  const filterDescription=[
    filters.companyStatus!=="all"?"Empresa: "+filters.companyStatus:"",
    filters.activityStatus!=="all"?"Estado: "+filters.activityStatus:"",
    filters.siteId?"Sede: "+filters.siteId:"",
    filters.priority!=="all"?"Prioridad: "+filters.priority:"",
  ].filter(Boolean).join(" · ")||"Sin filtros adicionales";
  const branding=await getReportBranding(session);
  if(format==="xlsx"){
    const bytes=await excelReport(roleLabel(session),filters.label,filterDescription,rows,branding);
    return new NextResponse(bytes,{
      headers:{
        "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":'attachment; filename="dashboard-'+stamp+'.xlsx"',
        "Cache-Control":"no-store",
      },
    });
  }

  const bytes=await pdfReport(roleLabel(session),filters.label,filterDescription,rows,branding);
  return new NextResponse(Buffer.from(bytes),{
    headers:{
      "Content-Type":"application/pdf",
      "Content-Disposition":'attachment; filename="desweb-dashboard-'+stamp+'.pdf"',
      "Cache-Control":"no-store",
    },
  });
}
