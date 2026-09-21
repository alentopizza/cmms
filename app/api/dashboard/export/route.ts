import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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
async function pdfReport(role:string,period:string,filters:string,rows:ExportRow[]){
  const doc=await PDFDocument.create();
  const regular=await doc.embedFont(StandardFonts.Helvetica);
  const bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const teal=rgb(0.15,0.55,0.52);
  const dark=rgb(0.12,0.18,0.23);
  const soft=rgb(0.42,0.48,0.52);
  const border=rgb(0.86,0.89,0.9);
  const pageSize:[number,number]=[841.89,595.28];
  let page=doc.addPage(pageSize);
  let y=pageSize[1]-46;

  function header(){
    page.drawText("DESWEB CMMS", {x:42,y,size:18,font:bold,color:dark});
    page.drawText("Dashboard - "+cleanText(role), {x:42,y:y-24,size:11,font:bold,color:teal});
    page.drawText("Periodo: "+cleanText(period), {x:42,y:y-42,size:9,font:regular,color:soft});
    page.drawText(cleanText(filters), {x:42,y:y-57,size:8,font:regular,color:soft});
    page.drawLine({start:{x:42,y:y-68},end:{x:800,y:y-68},thickness:1,color:border});
    y-=92;
  }
  function newPage(){
    page=doc.addPage(pageSize);
    y=pageSize[1]-46;
    header();
  }
  header();

  const columnX=[42,112,180,280,465,535];
  const columnW=[64,62,94,179,64,260];
  const headers=["Tipo","Fecha","Referencia","Entidad / asunto","Estado","Detalle / valor"];
  headers.forEach((h,i)=>page.drawText(h,{x:columnX[i],y,size:8,font:bold,color:dark}));
  y-=14;
  page.drawLine({start:{x:42,y},end:{x:800,y},thickness:.7,color:border});
  y-=10;

  for(const row of rows.slice(0,250)){
    const cells=[
      row.type,row.date,row.reference,row.subject,row.status,
      row.detail+(row.value?" | "+row.value:""),
    ];
    const wrapped=cells.map((cell,i)=>wrap(cell,regular,7.5,columnW[i]));
    const lineCount=Math.max(...wrapped.map(lines=>lines.length));
    const rowHeight=Math.max(22,lineCount*10+8);
    if(y-rowHeight<42) newPage();
    wrapped.forEach((lines,i)=>{
      lines.slice(0,5).forEach((line,j)=>{
        page.drawText(line,{x:columnX[i],y:y-j*10,size:7.5,font:regular,color:dark});
      });
    });
    y-=rowHeight;
    page.drawLine({start:{x:42,y:y+4},end:{x:800,y:y+4},thickness:.35,color:border});
  }
  if(!rows.length){
    page.drawText("No hay registros para los filtros seleccionados.",{x:42,y,size:10,font:regular,color:soft});
  }

  const pages=doc.getPages();
  pages.forEach((p,index)=>{
    p.drawText("Generado por Desweb CMMS · "+String(index+1)+"/"+String(pages.length),{x:42,y:20,size:7,font:regular,color:soft});
  });
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
  const bytes=await pdfReport(roleLabel(session),filters.label,filterDescription,rows);
  return new NextResponse(Buffer.from(bytes),{
    headers:{
      "Content-Type":"application/pdf",
      "Content-Disposition":'attachment; filename="desweb-dashboard-'+stamp+'.pdf"',
      "Cache-Control":"no-store",
    },
  });
}
