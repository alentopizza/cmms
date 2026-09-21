import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFImage } from "pdf-lib";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { roleLabel } from "@/lib/permissions";
import {
  appendCompanyStatus,
  appendPeriod,
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
  const white=rgb(1,1,1);
  const logo=await embedReportLogo(doc,branding);
  const pageSize:[number,number]=[841.89,595.28];
  const statusRows=distribution(rows);
  const typeRows=typeDistribution(rows);
  const complete=rows.filter(row=>["completed","closed","active"].includes(row.status)).length;
  const alerts=rows.filter(row=>["past_due","suspended","cancelled","canceled","paused"].includes(row.status)).length;
  let page=doc.addPage(pageSize);
  let y=pageSize[1]-36;

  function drawLogo(target:any,x:number,top:number,maxW:number,maxH:number){
    if(!logo)return;
    const scale=Math.min(maxW/logo.width,maxH/logo.height,1);
    const w=logo.width*scale,h=logo.height*scale;
    target.drawImage(logo,{x,y:top-h,width:w,height:h});
  }
  function letterhead(){
    page.drawRectangle({x:0,y:pageSize[1]-88,width:pageSize[0],height:88,color:secondary});
    page.drawRectangle({x:0,y:pageSize[1]-88,width:pageSize[0],height:5,color:primary});
    if(logo)drawLogo(page,40,pageSize[1]-20,155,48);
    else page.drawText(branding.brandName,{x:42,y:pageSize[1]-54,size:22,font:bold,color:white});
    page.drawText("REPORTE EJECUTIVO",{x:pageSize[0]-210,y:pageSize[1]-42,size:10,font:bold,color:white});
    page.drawText(cleanText(role),{x:pageSize[0]-210,y:pageSize[1]-58,size:8,font:regular,color:rgb(.83,.9,.91)});
  }
  function footer(){
    const pages=doc.getPages();
    for(const [index,p] of pages.entries()){
      p.drawLine({start:{x:40,y:28},end:{x:802,y:28},thickness:.5,color:border});
      p.drawText(cleanText(branding.reportOwner),{x:40,y:14,size:7,font:bold,color:secondary});
      const powered=branding.whiteLabel&&!branding.showDeswebBranding?"":branding.whiteLabel?" · Tecnología Desweb CMMS":" · Desweb CMMS";
      p.drawText(powered,{x:180,y:14,size:7,font:regular,color:soft});
      p.drawText(String(index+1)+" / "+String(pages.length),{x:770,y:14,size:7,font:regular,color:soft});
    }
  }
  function newPage(){
    page=doc.addPage(pageSize);
    letterhead();
    y=pageSize[1]-118;
  }
  function card(x:number,top:number,w:number,label:string,value:string,hint:string){
    page.drawRectangle({x,y:top-72,width:w,height:72,color:white,borderColor:border,borderWidth:.7});
    page.drawRectangle({x,y:top-72,width:4,height:72,color:primary});
    page.drawText(label.toUpperCase(),{x:x+14,y:top-20,size:7,font:bold,color:soft});
    page.drawText(value,{x:x+14,y:top-45,size:18,font:bold,color:secondary});
    page.drawText(hint,{x:x+14,y:top-61,size:7,font:regular,color:soft});
  }
  function barChart(x:number,top:number,w:number,h:number,title:string,data:{label:string;count:number}[]){
    page.drawText(title,{x,y:top,size:10,font:bold,color:secondary});
    const list=data.slice(0,6);
    const max=Math.max(...list.map(row=>row.count),1);
    let cy=top-22;
    for(const item of list){
      page.drawText(cleanText(item.label).slice(0,26),{x,y:cy,size:7.5,font:regular,color:dark});
      const bx=x+120,bw=w-150;
      page.drawRectangle({x:bx,y:cy-2,width:bw,height:8,color:pale});
      page.drawRectangle({x:bx,y:cy-2,width:bw*(item.count/max),height:8,color:primary});
      page.drawText(String(item.count),{x:x+w-24,y:cy,size:7.5,font:bold,color:secondary});
      cy-=24;
    }
    if(!list.length)page.drawText("Sin datos para graficar.",{x,y:top-28,size:8,font:regular,color:soft});
    return Math.max(h,Math.max(list.length,1)*24+28);
  }

  // Cover / executive summary
  letterhead();
  y=pageSize[1]-122;
  page.drawText("Informe de Dashboard",{x:42,y,size:24,font:bold,color:secondary});
  page.drawText(cleanText(branding.reportOwner),{x:42,y:y-22,size:11,font:bold,color:primary});
  page.drawText("Periodo: "+cleanText(period),{x:42,y:y-42,size:9,font:regular,color:dark});
  page.drawText(cleanText(filters),{x:42,y:y-57,size:8,font:regular,color:soft});
  page.drawText("Generado: "+new Date().toLocaleString("es-CO"),{x:600,y:y-42,size:7.5,font:regular,color:soft});
  y-=86;

  card(42,y,175,"Registros",String(rows.length),"Elementos del periodo");
  card(229,y,175,"Cumplidos",String(complete),rows.length?String(Math.round(complete/rows.length*100))+"% del total":"Sin registros");
  card(416,y,175,"Alertas",String(alerts),"Estados que requieren revisión");
  card(603,y,197,"Estados",String(statusRows.length),"Categorías presentes");
  y-=102;

  const chartHeight=barChart(42,y,360,150,"Distribución por estado",statusRows);
  barChart(438,y,360,150,"Distribución por tipo",typeRows);
  y-=chartHeight+20;

  page.drawRectangle({x:42,y:y-54,width:756,height:54,color:pale,borderColor:border,borderWidth:.6});
  page.drawText("LECTURA EJECUTIVA",{x:56,y:y-18,size:7,font:bold,color:primary});
  const insight=rows.length
    ? "El reporte consolida los registros visibles para el rol y filtros seleccionados. Revise los estados con mayor volumen y las alertas para priorizar acciones."
    : "No se encontraron registros para el periodo y filtros seleccionados.";
  wrap(insight,regular,8,720).slice(0,3).forEach((line,index)=>page.drawText(line,{x:56,y:y-34-index*10,size:8,font:regular,color:dark}));

  // Detailed records
  newPage();
  page.drawText("Detalle de registros",{x:42,y,size:15,font:bold,color:secondary});
  page.drawText("Trazabilidad del periodo seleccionado",{x:42,y:y-16,size:8,font:regular,color:soft});
  y-=36;
  const columnX=[42,112,180,280,465,535];
  const columnW=[64,62,94,179,64,260];
  const headers=["Tipo","Fecha","Referencia","Entidad / asunto","Estado","Detalle / valor"];
  headers.forEach((h,i)=>page.drawText(h,{x:columnX[i],y,size:8,font:bold,color:secondary}));
  y-=14;
  page.drawLine({start:{x:42,y},end:{x:800,y},thickness:.7,color:border});
  y-=10;

  for(const row of rows.slice(0,350)){
    const cells=[row.type,row.date,row.reference,row.subject,statusLabel(row.status),row.detail+(row.value?" | "+row.value:"")];
    const wrapped=cells.map((cell,i)=>wrap(cell,regular,7.5,columnW[i]));
    const lineCount=Math.max(...wrapped.map(lines=>lines.length));
    const rowHeight=Math.max(22,lineCount*10+8);
    if(y-rowHeight<45){
      newPage();
      headers.forEach((h,i)=>page.drawText(h,{x:columnX[i],y,size:8,font:bold,color:secondary}));
      y-=22;
    }
    wrapped.forEach((lines,i)=>{
      lines.slice(0,5).forEach((line,j)=>page.drawText(line,{x:columnX[i],y:y-j*10,size:7.5,font:regular,color:dark}));
    });
    y-=rowHeight;
    page.drawLine({start:{x:42,y:y+4},end:{x:800,y:y+4},thickness:.35,color:border});
  }
  if(!rows.length)page.drawText("No hay registros para los filtros seleccionados.",{x:42,y,size:10,font:regular,color:soft});

  footer();
  return doc.save();
}

function scope(session:NonNullable<Awaited<ReturnType<typeof getSession>>>,alias:string){
  return session.accessAllSites
    ? {sql:alias+".organization_id=$1",params:[session.organizationId] as unknown[]}
    : {sql:alias+".organization_id=$1 AND "+alias+".site_id=ANY($2::uuid[])",params:[session.organizationId,session.siteIds] as unknown[]};
}

async function platformRows(filters:ReturnType<typeof parseDashboardFilters>){
  const subParams:unknown[]=[];
  const subPeriod=appendPeriod(subParams,"s.created_at",filters);
  const companyStatus=appendCompanyStatus(subParams,"o.active",filters);
  const subscriptionStatus=filters.activityStatus!=="all" ? " AND "+appendValue(subParams,"s.status",filters.activityStatus) : "";
  const subscriptions=await query<{created_at:string;organization:string;plan:string;status:string;price:string|null}>(
    "SELECT s.created_at::text,o.name organization,p.name plan,s.status,p.monthly_price_cop::text price FROM organization_subscriptions s JOIN organizations o ON o.id=s.organization_id JOIN billing_plans p ON p.id=s.plan_id WHERE "+subPeriod+" AND "+companyStatus+subscriptionStatus+" ORDER BY s.created_at DESC LIMIT 1000",
    subParams,
  );
  const leadParams:unknown[]=[];
  const leadPeriod=appendPeriod(leadParams,"created_at",filters);
  const leads=await query<{created_at:string;full_name:string;company_name:string;status:string;interest:string}>(
    "SELECT created_at::text,full_name,company_name,status,interest FROM sales_leads WHERE "+leadPeriod+" ORDER BY created_at DESC LIMIT 1000",
    leadParams,
  );
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
  const result=await query<{created_at:string;number:string;title:string;status:string;priority:string;asset:string|null;site:string;cost:string;downtime:string}>(
    "SELECT w.created_at::text,w.number::text,w.title,w.status,w.priority,a.name asset,s.name site,(w.labor_cost+w.parts_cost+w.external_cost)::text cost,w.downtime_minutes::text downtime FROM work_orders w JOIN sites s ON s.id=w.site_id LEFT JOIN assets a ON a.id=w.asset_id WHERE "+sc.sql+" AND "+period+status+" ORDER BY w.created_at DESC LIMIT 2000",
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
  const pred=provider&&sid
    ? "t.organization_id=$1 AND t.service_supplier_id=$2"
    : "t.organization_id=$1 AND (t.assigned_to=$2 OR EXISTS(SELECT 1 FROM crew_members cm WHERE cm.crew_id=t.crew_id AND cm.user_id=$2))";
  const params=provider&&sid?[org,sid] as unknown[]:[org,uid] as unknown[];
  const period=appendPeriod(params,"COALESCE(t.completed_at,t.started_at,w.updated_at)",filters);
  const status=filters.activityStatus!=="all" ? " AND "+appendValue(params,"t.status",filters.activityStatus) : "";
  const result=await query<{date:string;description:string;status:string;number:string;title:string}>(
    "SELECT COALESCE(t.completed_at,t.started_at,w.updated_at)::text date,t.description,t.status,w.number::text,w.title FROM work_order_tasks t JOIN work_orders w ON w.id=t.work_order_id WHERE "+pred+" AND "+period+status+" ORDER BY COALESCE(t.completed_at,t.started_at,w.updated_at) DESC LIMIT 2000",
    params,
  );
  return result.rows.map(row=>({
    type:"Actividad",date:safeDate(row.date),reference:"#"+row.number,subject:row.description,status:row.status,detail:row.title,value:"",
  }));
}
async function requesterRows(session:NonNullable<Awaited<ReturnType<typeof getSession>>>,filters:ReturnType<typeof parseDashboardFilters>){
  if(!session.userId||!session.organizationId) return [];
  const params:unknown[]=[session.organizationId,session.userId];
  const period=appendPeriod(params,"requested_at",filters);
  const status=filters.activityStatus!=="all" ? " AND "+appendValue(params,"status",filters.activityStatus) : "";
  const result=await query<{requested_at:string;number:string;title:string;status:string;priority:string}>(
    "SELECT requested_at::text,number::text,title,status,priority FROM work_orders WHERE organization_id=$1 AND requested_by=$2 AND "+period+status+" ORDER BY requested_at DESC LIMIT 2000",
    params,
  );
  return result.rows.map(row=>({
    type:"Solicitud",date:safeDate(row.requested_at),reference:"#"+row.number,subject:row.title,status:row.status,detail:"Prioridad "+row.priority,value:"",
  }));
}

export async function GET(request:Request){
  const session=await getSession();
  if(!session) return new NextResponse("Unauthorized",{status:401});
  const url=new URL(request.url);
  const format=url.searchParams.get("format")==="pdf"?"pdf":"powerbi";
  const input:DashboardFilterInput={
    month:url.searchParams.get("month")||undefined,
    from:url.searchParams.get("from")||undefined,
    to:url.searchParams.get("to")||undefined,
    company_status:url.searchParams.get("company_status")||undefined,
    activity_status:url.searchParams.get("activity_status")||undefined,
  };
  const filters=parseDashboardFilters(input);

  let rows:ExportRow[]=[];
  if(session.platformRole==="platform_owner"||session.platformRole==="superadmin") rows=await platformRows(filters);
  else if(session.role==="technician"||session.role==="external"||session.role==="provider") rows=await fieldRows(session,filters);
  else if(session.role==="requester") rows=await requesterRows(session,filters);
  else rows=await operationRows(session,filters);

  const stamp=new Date().toISOString().slice(0,10);
  if(format==="powerbi"){
    const body=csv(rows);
    return new NextResponse(body,{
      headers:{
        "Content-Type":"text/csv; charset=utf-8",
        "Content-Disposition":'attachment; filename="desweb-dashboard-powerbi-'+stamp+'.csv"',
        "Cache-Control":"no-store",
      },
    });
  }

  const filterDescription=[
    filters.companyStatus!=="all"?"Empresa: "+filters.companyStatus:"",
    filters.activityStatus!=="all"?"Estado: "+filters.activityStatus:"",
  ].filter(Boolean).join(" · ")||"Sin filtros de estado";
  const branding=await getReportBranding(session);
  const bytes=await pdfReport(roleLabel(session),filters.label,filterDescription,rows,branding);
  return new NextResponse(Buffer.from(bytes),{
    headers:{
      "Content-Type":"application/pdf",
      "Content-Disposition":'attachment; filename="desweb-dashboard-'+stamp+'.pdf"',
      "Cache-Control":"no-store",
    },
  });
}
