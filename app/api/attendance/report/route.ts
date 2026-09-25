import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFImage } from "pdf-lib";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { attendanceOrganizationId } from "@/lib/attendance-context";
import {
  AttendanceReportError,
  buildAttendanceOperationalReport,
  type AttendanceOperationalReport,
  type AttendanceReportDailyRow,
} from "@/lib/attendance-report";
import { query } from "@/lib/db";

type Branding={
  brandName:string;
  reportOwner:string;
  primary:string;
  secondary:string;
  logo:Buffer|null;
  logoMime:string|null;
  whiteLabel:boolean;
  showDeswebBranding:boolean;
};

function csvCell(value:unknown){
  return '"'+String(value??"").replaceAll('"','""')+'"';
}

function hours(minutes:number|null|undefined){
  if(minutes===null||minutes===undefined)return "";
  return (minutes/60).toFixed(2);
}

function dateLabel(value:string){
  const date=new Date(value+"T12:00:00Z");
  return Number.isFinite(date.getTime())
    ?date.toLocaleDateString("es-CO",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"UTC"})
    :value;
}

function varianceLabel(minutes:number|null){
  if(minutes===null)return "Sin comparación";
  const prefix=minutes>0?"+":"";
  return prefix+(minutes/60).toFixed(2)+" h";
}

function routeLabel(row:AttendanceReportDailyRow){
  const origin=row.originSites.join(" / ");
  const final=row.finalSites.join(" / ");
  if(!origin&&!final)return "Sin marcación";
  if(origin&&final&&origin!==final)return origin+" → "+final;
  return origin||final;
}

function scheduleLabel(row:AttendanceReportDailyRow){
  if(row.scheduleState==="none")return "Sin jornada individual";
  if(row.scheduleState==="day_off")return "Día no programado";
  return [row.plannedSiteName,row.scheduledStart&&row.scheduledEnd?row.scheduledStart+"–"+row.scheduledEnd:null].filter(Boolean).join(" · ");
}

function csvReport(report:AttendanceOperationalReport){
  const headers=[
    "Fecha","Persona","Rol","Jornada programada","Horas programadas","Horas reales","Diferencia programado/real",
    "Horas en sede","Horas en desplazamiento","Origen → final","Sedes visitadas","Jornadas","Jornadas multi-sede",
    "Desplazamientos","Actividades en jornada","Actividades fuera de jornada","Contingencias solicitadas",
    "Contingencias utilizadas","Marcaciones por contingencia","Muestras Reacción","Jornada abierta",
  ];
  const rows=report.daily.map(row=>[
    row.date,row.fullName,row.role,scheduleLabel(row),hours(row.scheduledMinutes),hours(row.actualMinutes),
    row.varianceMinutes===null?"":hours(row.varianceMinutes),hours(row.onSiteMinutes),hours(row.travelMinutes),
    routeLabel(row),row.visitedSites.join(" / "),row.shiftCount,row.multiSiteShiftCount,row.travelCount,
    row.completedInShift,row.completedOutsideShift,row.contingencyRequests,row.contingencyUsed,row.contingencyMarkings,
    row.reactionSamples,row.openNow?"Sí":"No",
  ]);
  return "﻿"+[headers,...rows].map(row=>row.map(csvCell).join(",")).join("
");
}

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

async function reportBranding(session:NonNullable<Awaited<ReturnType<typeof getSession>>>,organizationId:string):Promise<Branding>{
  const global=await query<{logo:Buffer|null;mime:string|null}>(
    "SELECT logo_on_light logo,logo_on_light_mime mime FROM app_customization WHERE id=1",
  );
  const globalLogo=global.rows[0]?.logo||null;
  const globalMime=global.rows[0]?.mime||null;

  if(session.platformRole!=="user"){
    return{
      brandName:"DESWEB",reportOwner:"Desweb CMMS",primary:"#38B2A9",secondary:"#293644",
      logo:globalLogo,logoMime:globalMime,whiteLabel:false,showDeswebBranding:true,
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
    `SELECT o.name organization_name,o.legal_name,
            o.logo_data organization_logo,o.logo_mime_type organization_logo_mime,
            plan.code plan_code,plan.white_label,
            branding.app_name,branding.primary_color,branding.secondary_color,
            branding.logo_on_light brand_logo,branding.logo_on_light_mime brand_logo_mime,
            branding.show_desweb_branding
     FROM organizations o
     LEFT JOIN organization_subscriptions subscription ON subscription.organization_id=o.id
     LEFT JOIN billing_plans plan ON plan.id=subscription.plan_id
     LEFT JOIN organization_branding branding ON branding.organization_id=o.id
     WHERE o.id=$1`,
    [organizationId],
  );
  const row=result.rows[0];
  const pro=Boolean(row?.plan_code==="pro"&&row?.white_label);
  if(pro){
    return{
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
  return{
    brandName:"DESWEB",
    reportOwner:row?.legal_name||row?.organization_name||session.organizationName||"Desweb CMMS",
    primary:"#38B2A9",secondary:"#293644",
    logo:globalLogo,logoMime:globalMime,whiteLabel:false,showDeswebBranding:true,
  };
}

async function embedLogo(doc:PDFDocument,branding:Branding):Promise<PDFImage|null>{
  if(!branding.logo||!branding.logoMime)return null;
  try{
    if(branding.logoMime.includes("png"))return await doc.embedPng(branding.logo);
    if(branding.logoMime.includes("jpeg")||branding.logoMime.includes("jpg"))return await doc.embedJpg(branding.logo);
  }catch{}
  return null;
}

async function xlsxReport(report:AttendanceOperationalReport,branding:Branding){
  const workbook=new ExcelJS.Workbook();
  workbook.creator="Desweb CMMS";
  workbook.created=new Date();

  const primary=branding.primary.replace("#","");
  const secondary=branding.secondary.replace("#","");
  const white="FFFFFF";
  const pale="F6F9F9";

  const summary=workbook.addWorksheet("Resumen",{views:[{state:"frozen",ySplit:5}]});
  summary.columns=[{width:25},{width:18},{width:18},{width:18},{width:18},{width:18},{width:18},{width:18}];
  summary.mergeCells("A1:H2");
  summary.getCell("A1").value="REPORTE OPERATIVO DE ASISTENCIA";
  summary.getCell("A1").font={bold:true,size:20,color:{argb:secondary}};
  summary.mergeCells("A3:H3");
  summary.getCell("A3").value=report.organization.name+" · "+dateLabel(report.filters.from)+" – "+dateLabel(report.filters.to);
  summary.getCell("A3").font={bold:true,size:10,color:{argb:primary}};
  summary.mergeCells("A4:H4");
  summary.getCell("A4").value="Datos descriptivos para revisión humana. No constituyen ranking ni calificación laboral.";
  summary.getCell("A4").font={size:9,color:{argb:"66727A"}};

  const kpis=[
    ["Personas",report.summary.people],
    ["Jornadas",report.summary.shifts],
    ["Horas programadas",hours(report.summary.scheduledMinutes)],
    ["Horas reales",hours(report.summary.actualMinutes)],
    ["Horas en sede",hours(report.summary.onSiteMinutes)],
    ["Horas desplazamiento",hours(report.summary.travelMinutes)],
    ["Actividades en jornada",report.summary.completedInShift],
    ["Contingencias usadas",report.summary.contingencyUsed],
  ];
  kpis.forEach(([label,value],index)=>{
    const col=(index%4)*2+1;
    const row=6+Math.floor(index/4)*3;
    summary.mergeCells(row,col,row,col+1);
    summary.getCell(row,col).value=label;
    summary.getCell(row,col).font={bold:true,size:8,color:{argb:"66727A"}};
    summary.mergeCells(row+1,col,row+1,col+1);
    summary.getCell(row+1,col).value=value as string|number;
    summary.getCell(row+1,col).font={bold:true,size:16,color:{argb:secondary}};
    for(let rr=row;rr<=row+1;rr++)for(let cc=col;cc<=col+1;cc++){
      summary.getCell(rr,cc).fill={type:"pattern",pattern:"solid",fgColor:{argb:pale}};
    }
  });

  const people=workbook.addWorksheet("Personas",{views:[{state:"frozen",ySplit:1}]});
  people.columns=[
    {header:"Persona",key:"person",width:30},{header:"Rol",key:"role",width:20},
    {header:"Días programados",key:"scheduledDays",width:17},{header:"Días con asistencia",key:"attendedDays",width:18},
    {header:"Días programados sin marcación",key:"missingDays",width:27},{header:"Días con asistencia no programada",key:"unplannedDays",width:30},
    {header:"Horas programadas",key:"scheduled",width:18},{header:"Horas reales",key:"actual",width:15},
    {header:"Diferencia en días programados",key:"variance",width:28},{header:"Horas no programadas",key:"unplanned",width:21},
    {header:"Horas en sede",key:"onsite",width:16},{header:"Horas desplazamiento",key:"travel",width:22},
    {header:"Jornadas",key:"shifts",width:12},{header:"Jornadas multi-sede",key:"multiSite",width:20},
    {header:"Desplazamientos",key:"travels",width:18},{header:"Actividades en jornada",key:"activities",width:21},
    {header:"Actividades fuera jornada",key:"outside",width:23},{header:"Contingencias solicitadas",key:"requests",width:23},
    {header:"Contingencias usadas",key:"used",width:20},{header:"Marcaciones contingencia",key:"markings",width:24},
    {header:"Muestras Reacción",key:"reaction",width:18},
  ];
  for(const person of report.people)people.addRow({
    person:person.fullName,role:person.role,scheduledDays:person.scheduledDays,attendedDays:person.daysWithAttendance,
    missingDays:person.scheduledDaysWithoutAttendance,unplannedDays:person.daysWithUnplannedAttendance,
    scheduled:hours(person.scheduledMinutes),actual:hours(person.actualMinutes),variance:hours(person.varianceMinutes),
    unplanned:hours(person.unplannedMinutes),onsite:hours(person.onSiteMinutes),travel:hours(person.travelMinutes),
    shifts:person.shifts,multiSite:person.multiSiteShifts,travels:person.travelCount,activities:person.completedInShift,
    outside:person.completedOutsideShift,requests:person.contingencyRequests,used:person.contingencyUsed,
    markings:person.contingencyMarkings,reaction:person.reactionSamples,
  });

  const detail=workbook.addWorksheet("Detalle diario",{views:[{state:"frozen",ySplit:1}]});
  detail.columns=[
    {header:"Fecha",key:"date",width:14},{header:"Persona",key:"person",width:30},{header:"Rol",key:"role",width:20},
    {header:"Programación",key:"schedule",width:35},{header:"Horas programadas",key:"scheduled",width:18},
    {header:"Horas reales",key:"actual",width:15},{header:"Diferencia",key:"variance",width:16},
    {header:"Horas en sede",key:"onsite",width:16},{header:"Horas desplazamiento",key:"travel",width:22},
    {header:"Origen → final",key:"route",width:38},{header:"Sedes visitadas",key:"sites",width:45},
    {header:"Jornadas",key:"shifts",width:12},{header:"Jornadas multi-sede",key:"multiSite",width:20},
    {header:"Desplazamientos",key:"travels",width:18},{header:"Act. en jornada",key:"inside",width:17},
    {header:"Act. fuera jornada",key:"outside",width:18},{header:"Contingencias",key:"contingencies",width:16},
    {header:"Contingencias usadas",key:"used",width:20},{header:"Marcaciones contingencia",key:"markings",width:24},
    {header:"Muestras Reacción",key:"reaction",width:18},{header:"Abierta",key:"open",width:10},
  ];
  for(const row of report.daily)detail.addRow({
    date:row.date,person:row.fullName,role:row.role,schedule:scheduleLabel(row),scheduled:hours(row.scheduledMinutes),
    actual:hours(row.actualMinutes),variance:row.varianceMinutes===null?"":hours(row.varianceMinutes),
    onsite:hours(row.onSiteMinutes),travel:hours(row.travelMinutes),route:routeLabel(row),sites:row.visitedSites.join(" / "),
    shifts:row.shiftCount,multiSite:row.multiSiteShiftCount,travels:row.travelCount,inside:row.completedInShift,
    outside:row.completedOutsideShift,contingencies:row.contingencyRequests,used:row.contingencyUsed,
    markings:row.contingencyMarkings,reaction:row.reactionSamples,open:row.openNow?"Sí":"No",
  });

  for(const sheet of [people,detail]){
    sheet.getRow(1).height=26;
    sheet.getRow(1).eachCell(cell=>{
      cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:secondary}};
      cell.font={bold:true,color:{argb:white}};
    });
    sheet.autoFilter={from:"A1",to:sheet.getRow(1).getCell(sheet.columnCount).address};
    sheet.eachRow((row,rowNumber)=>{
      if(rowNumber===1)return;
      row.alignment={vertical:"top",wrapText:true};
      if(rowNumber%2===0)row.eachCell(cell=>cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:pale}});
    });
  }

  const meta=workbook.addWorksheet("Metadatos");
  meta.addRows([
    ["Reporte","Asistencia operativa"],
    ["Empresa",report.organization.name],
    ["Periodo",report.filters.from+" a "+report.filters.to],
    ["Persona",report.filters.userId||"Todas las autorizadas"],
    ["Sede relacionada",report.filters.siteId||"Todas las autorizadas"],
    ["Alcance limitado",report.scope.limited?"Sí":"No"],
    ["Generado",new Date().toLocaleString("es-CO")],
    ["Nota","Comparación descriptiva. La diferencia programado/real no es una calificación laboral."],
  ]);
  meta.columns=[{width:28},{width:80}];
  meta.getColumn(1).font={bold:true,color:{argb:secondary}};

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function pdfReport(report:AttendanceOperationalReport,branding:Branding){
  const doc=await PDFDocument.create();
  const regular=await doc.embedFont(StandardFonts.Helvetica);
  const bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const primary=pdfColor(branding.primary);
  const secondary=pdfColor(branding.secondary);
  const dark=rgb(.12,.17,.21);
  const soft=rgb(.4,.46,.50);
  const border=rgb(.85,.89,.90);
  const pale=rgb(.96,.98,.98);
  const white=rgb(1,1,1);
  const logo=await embedLogo(doc,branding);
  const pageSize:[number,number]=[842,596];
  let page=doc.addPage(pageSize);
  let y=pageSize[1]-105;

  function header(){
    page.drawRectangle({x:0,y:0,width:pageSize[0],height:pageSize[1],color:white});
    if(logo){
      const scale=Math.min(160/logo.width,42/logo.height,1);
      const width=logo.width*scale,height=logo.height*scale;
      page.drawImage(logo,{x:(pageSize[0]-width)/2,y:pageSize[1]-50,width,height});
    }else{
      const label=branding.brandName;
      const width=bold.widthOfTextAtSize(label,20);
      page.drawText(label,{x:(pageSize[0]-width)/2,y:pageSize[1]-42,size:20,font:bold,color:secondary});
    }
  }
  function footer(){
    for(const [index,item] of doc.getPages().entries()){
      const attribution=!branding.whiteLabel||branding.showDeswebBranding?"Desweb CMMS":branding.reportOwner;
      item.drawText(attribution,{x:42,y:18,size:7,font:regular,color:soft});
      item.drawText(String(index+1),{x:pageSize[0]-48,y:18,size:7,font:regular,color:soft});
    }
  }
  function newPage(){
    page=doc.addPage(pageSize);
    header();
    y=pageSize[1]-92;
  }
  function metric(x:number,top:number,width:number,label:string,value:string){
    page.drawRectangle({x,y:top-58,width,height:58,color:pale,borderColor:border,borderWidth:.6});
    page.drawText(label.toUpperCase(),{x:x+12,y:top-17,size:6.8,font:bold,color:soft});
    page.drawText(value,{x:x+12,y:top-42,size:16,font:bold,color:secondary});
  }

  header();
  page.drawText("REPORTE OPERATIVO DE ASISTENCIA",{x:42,y,size:17,font:bold,color:secondary});
  page.drawText(report.organization.name,{x:42,y:y-19,size:10,font:bold,color:primary});
  page.drawText("Periodo: "+dateLabel(report.filters.from)+" – "+dateLabel(report.filters.to),{x:42,y:y-35,size:8,font:regular,color:dark});
  page.drawText("Generado: "+new Date().toLocaleString("es-CO"),{x:610,y:y-35,size:7,font:regular,color:soft});
  y-=62;

  const metrics=[
    ["Personas",String(report.summary.people)],
    ["Jornadas",String(report.summary.shifts)],
    ["Programado",hours(report.summary.scheduledMinutes)+" h"],
    ["Real",hours(report.summary.actualMinutes)+" h"],
    ["En sede",hours(report.summary.onSiteMinutes)+" h"],
    ["Desplazamiento",hours(report.summary.travelMinutes)+" h"],
    ["Actividades",String(report.summary.completedInShift)],
    ["Contingencias",String(report.summary.contingencyUsed)],
  ];
  metrics.forEach(([label,value],index)=>{
    const col=index%4,row=Math.floor(index/4);
    metric(42+col*192,y-row*68,180,label,value);
  });
  y-=150;

  page.drawRectangle({x:42,y:y-45,width:758,height:45,color:white,borderColor:border,borderWidth:.6});
  page.drawText("LECTURA DEL REPORTE",{x:54,y:y-15,size:7,font:bold,color:primary});
  page.drawText("La diferencia programado/real se calcula únicamente sobre días con jornada individual programada.",{x:54,y:y-28,size:7.2,font:regular,color:dark});
  page.drawText("Las horas no programadas, desplazamientos, contingencias y actividades se muestran por separado para revisión humana.",{x:54,y:y-38,size:7.2,font:regular,color:dark});
  y-=63;

  page.drawText("RESUMEN POR PERSONA",{x:42,y,size:11,font:bold,color:secondary});
  y-=18;
  const headers=["Persona","Prog.","Real","Dif.","En sede","Viaje","Jorn.","Multi","Act.","Cont."];
  const xs=[42,250,306,360,416,478,544,590,642,704];
  headers.forEach((header,index)=>page.drawText(header,{x:xs[index],y,size:6.8,font:bold,color:secondary}));
  y-=12;

  for(const person of report.people){
    if(y<55){
      newPage();
      page.drawText("RESUMEN POR PERSONA (continuación)",{x:42,y,size:10,font:bold,color:secondary});
      y-=20;
      headers.forEach((header,index)=>page.drawText(header,{x:xs[index],y,size:6.8,font:bold,color:secondary}));
      y-=12;
    }
    page.drawText(person.fullName.slice(0,34),{x:42,y,size:7,font:regular,color:dark});
    const values=[
      hours(person.scheduledMinutes),hours(person.actualMinutes),varianceLabel(person.varianceMinutes),
      hours(person.onSiteMinutes),hours(person.travelMinutes),String(person.shifts),String(person.multiSiteShifts),
      String(person.completedInShift),String(person.contingencyUsed),
    ];
    values.forEach((value,index)=>page.drawText(String(value),{x:xs[index+1],y,size:6.8,font:regular,color:dark}));
    y-=14;
  }

  newPage();
  page.drawText("DETALLE DIARIO",{x:42,y,size:11,font:bold,color:secondary});
  page.drawText("Primeras 120 filas del periodo; Excel/CSV conservan el detalle completo.",{x:42,y:y-13,size:7,font:regular,color:soft});
  y-=31;
  const detailHeaders=["Fecha","Persona","Programación","Real","Dif.","Ruta","Viaje","Act."];
  const dx=[42,94,245,420,466,520,690,752];
  detailHeaders.forEach((header,index)=>page.drawText(header,{x:dx[index],y,size:6.6,font:bold,color:secondary}));
  y-=12;

  for(const row of report.daily.slice(0,120)){
    if(y<50){
      newPage();
      detailHeaders.forEach((header,index)=>page.drawText(header,{x:dx[index],y,size:6.6,font:bold,color:secondary}));
      y-=12;
    }
    page.drawText(dateLabel(row.date).slice(0,10),{x:42,y,size:6.4,font:regular,color:dark});
    page.drawText(row.fullName.slice(0,24),{x:94,y,size:6.4,font:regular,color:dark});
    page.drawText(scheduleLabel(row).slice(0,28),{x:245,y,size:6.4,font:regular,color:dark});
    page.drawText(hours(row.actualMinutes),{x:420,y,size:6.4,font:regular,color:dark});
    page.drawText(varianceLabel(row.varianceMinutes),{x:466,y,size:6.4,font:regular,color:dark});
    page.drawText(routeLabel(row).slice(0,27),{x:520,y,size:6.4,font:regular,color:dark});
    page.drawText(hours(row.travelMinutes),{x:690,y,size:6.4,font:regular,color:dark});
    page.drawText(String(row.completedInShift),{x:752,y,size:6.4,font:regular,color:dark});
    y-=13;
  }

  footer();
  return Buffer.from(await doc.save());
}

// ── Authenticated report boundary ───────────────────────────────────────────
// Browser filters are advisory. Organization, Site and person visibility are
// recomputed server-side before JSON or any export format is generated.
export async function GET(request:Request){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"attendance.reports"))return new NextResponse("Forbidden",{status:403});

  const url=new URL(request.url);
  const organizationId=attendanceOrganizationId(session,url.searchParams.get("organization_id"));
  if(!organizationId)return NextResponse.json({message:"Selecciona una empresa válida para generar el reporte."},{status:422});

  try{
    const report=await buildAttendanceOperationalReport(session,{
      organizationId,
      from:url.searchParams.get("from"),
      to:url.searchParams.get("to"),
      userId:url.searchParams.get("user_id"),
      siteId:url.searchParams.get("site_id"),
    });

    const format=url.searchParams.get("format")||"json";
    if(format==="csv"){
      return new NextResponse(csvReport(report),{
        headers:{
          "Content-Type":"text/csv; charset=utf-8",
          "Content-Disposition":'attachment; filename="asistencia-operativa-'+report.filters.from+'-'+report.filters.to+'.csv"',
          "Cache-Control":"no-store",
        },
      });
    }

    const branding=format==="xlsx"||format==="pdf"?await reportBranding(session,organizationId):null;
    if(format==="xlsx"&&branding){
      const body=await xlsxReport(report,branding);
      return new NextResponse(new Uint8Array(body),{
        headers:{
          "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition":'attachment; filename="asistencia-operativa-'+report.filters.from+'-'+report.filters.to+'.xlsx"',
          "Cache-Control":"no-store",
        },
      });
    }
    if(format==="pdf"&&branding){
      const body=await pdfReport(report,branding);
      return new NextResponse(new Uint8Array(body),{
        headers:{
          "Content-Type":"application/pdf",
          "Content-Disposition":'attachment; filename="asistencia-operativa-'+report.filters.from+'-'+report.filters.to+'.pdf"',
          "Cache-Control":"no-store",
        },
      });
    }
    if(format!=="json"){
      return NextResponse.json({message:"Formato de reporte no soportado."},{status:422});
    }

    return NextResponse.json(report,{headers:{"Cache-Control":"private, no-store, max-age=0"}});
  }catch(error){
    if(error instanceof AttendanceReportError){
      return NextResponse.json({message:error.message},{status:error.status});
    }
    throw error;
  }
}
