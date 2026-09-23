import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import ExcelJS from "exceljs";
import { canAccessSite, getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { can, ROLE_LABELS } from "@/lib/permissions";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Field={label:string;value:string};
type Section={title:string;fields:Field[]};
type LifeProfile={
  entityLabel:string;
  title:string;
  subtitle:string;
  status:string;
  fields:Field[];
  stats:Field[];
  sections:Section[];
  image:Buffer|null;
  imageMime:string|null;
};

function safe(value:unknown,fallback="—"){const text=String(value??"").trim();return text||fallback;}
function filename(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").toLowerCase()||"registro";}
function roleName(role:string|null){return role ? (ROLE_LABELS[role as keyof typeof ROLE_LABELS]||role) : "Acceso de plataforma";}
function dateText(value:string|null){if(!value)return "—";const d=new Date(value);return Number.isNaN(d.getTime())?value:d.toLocaleString("es-CO");}


async function loadOrganization(id:string,session:NonNullable<Awaited<ReturnType<typeof getSession>>>):Promise<LifeProfile|null>{
  if(!can(session,"companies.manage")) return null;
  const result=await query<{
    id:string;name:string;legal_name:string|null;tax_id:string|null;legal_address:string|null;legal_city:string|null;legal_country:string|null;
    phone:string|null;admin_email:string|null;primary_contact_name:string|null;active:boolean;timezone:string;logo_data:Buffer|null;logo_mime_type:string|null;
    site_count:number;sublocation_count:number;asset_count:number;technician_count:number;document_count:number;pending_document_count:number;plan_name:string|null;
  }>(`SELECT o.id,o.name,o.legal_name,o.tax_id,o.legal_address,o.legal_city,o.legal_country,o.phone,o.admin_email,o.primary_contact_name,
            o.active,o.timezone,o.logo_data,o.logo_mime_type,bp.name plan_name,
            (SELECT count(*)::int FROM sites s WHERE s.organization_id=o.id) site_count,
            (SELECT count(*)::int FROM locations l WHERE l.organization_id=o.id) sublocation_count,
            (SELECT count(*)::int FROM assets a WHERE a.organization_id=o.id) asset_count,
            (SELECT count(*)::int FROM organization_members om WHERE om.organization_id=o.id AND om.role='technician') technician_count,
            (SELECT count(*)::int FROM organization_documents od WHERE od.organization_id=o.id AND od.archived_at IS NULL) document_count,
            (SELECT count(*)::int FROM organization_documents od WHERE od.organization_id=o.id AND od.archived_at IS NULL
              AND od.requirement_level='required' AND (od.file_data IS NULL OR (od.expires_at IS NOT NULL AND od.expires_at<current_date))) pending_document_count
     FROM organizations o
     LEFT JOIN organization_subscriptions os ON os.organization_id=o.id
     LEFT JOIN billing_plans bp ON bp.id=os.plan_id
     WHERE o.id=$1`,[id]);
  if(!result.rowCount)return null;
  const row=result.rows[0];
  if(session.platformRole==="user"&&session.organizationId!==row.id)return null;
  return {
    entityLabel:"Empresa",title:row.name,subtitle:row.legal_name||row.name,status:row.active?"Activa":"Inactiva",
    fields:[
      {label:"Razón social",value:safe(row.legal_name,"Sin registrar")},{label:"NIT / Identificación",value:safe(row.tax_id,"Sin registrar")},
      {label:"Dirección administrativa",value:safe(row.legal_address,"Sin registrar")},{label:"Ciudad",value:safe(row.legal_city,"Sin registrar")},
      {label:"País",value:safe(row.legal_country,"Sin registrar")},{label:"Teléfono",value:safe(row.phone,"Sin registrar")},
      {label:"Correo administrativo",value:safe(row.admin_email,"Sin registrar")},{label:"Contacto principal",value:safe(row.primary_contact_name,"Sin registrar")},
      {label:"Zona horaria",value:safe(row.timezone)},{label:"Plan",value:safe(row.plan_name,"Sin plan")},
    ],
    stats:[
      {label:"Ubicaciones",value:String(row.site_count)},{label:"Sububicaciones",value:String(row.sublocation_count)},
      {label:"Activos",value:String(row.asset_count)},{label:"Técnicos",value:String(row.technician_count)},
      {label:"Documentos vigentes",value:String(row.document_count)},{label:"Documentos pendientes",value:String(row.pending_document_count)},
    ],
    sections:[],image:row.logo_data,imageMime:row.logo_mime_type,
  };
}

async function loadSite(id:string,session:NonNullable<Awaited<ReturnType<typeof getSession>>>):Promise<LifeProfile|null>{
  if(!can(session,"locations.manage")) return null;
  const result=await query<{
    id:string;organization_id:string;organization_name:string;name:string;code:string|null;address:string|null;city:string|null;country:string;active:boolean;
    contact_name:string|null;contact_phone:string|null;contact_email:string|null;latitude:number|null;longitude:number|null;geofence_radius_m:number;
    location_count:number;asset_count:number;active_order_count:number;technician_count:number;image_data:Buffer|null;image_mime_type:string|null;
  }>(`SELECT s.id,s.organization_id,o.name organization_name,s.name,s.code,s.address,s.city,s.country,s.active,
            s.contact_name,s.contact_phone,s.contact_email,s.latitude,s.longitude,s.geofence_radius_m,
            (SELECT count(*)::int FROM locations l WHERE l.site_id=s.id AND l.active=true) location_count,
            (SELECT count(*)::int FROM assets a WHERE a.site_id=s.id AND a.status<>'retired') asset_count,
            (SELECT count(*)::int FROM work_orders w WHERE w.site_id=s.id AND w.status NOT IN ('completed','cancelled')) active_order_count,
            (SELECT count(*)::int FROM organization_members om
              WHERE om.organization_id=s.organization_id AND om.role='technician'
                AND (om.access_all_sites=true OR EXISTS(
                  SELECT 1 FROM organization_member_sites oms
                  WHERE oms.organization_id=om.organization_id AND oms.user_id=om.user_id AND oms.site_id=s.id
                ))) technician_count,
            s.image_data,s.image_mime_type
     FROM sites s JOIN organizations o ON o.id=s.organization_id WHERE s.id=$1`,[id]);
  if(!result.rowCount)return null;
  const row=result.rows[0];
  if(session.platformRole==="user"&&(session.organizationId!==row.organization_id||!canAccessSite(session,row.id)))return null;
  return {
    entityLabel:"Ubicación principal",title:row.name,subtitle:row.organization_name,status:row.active?"Activa":"Inactiva",
    fields:[
      {label:"Código",value:safe(row.code,"Sin código")},{label:"Dirección",value:safe(row.address,"Sin registrar")},
      {label:"Ciudad",value:safe(row.city,"Sin registrar")},{label:"País",value:safe(row.country)},
      {label:"Contacto",value:safe(row.contact_name,"Sin registrar")},{label:"Teléfono",value:safe(row.contact_phone,"Sin registrar")},
      {label:"Correo",value:safe(row.contact_email,"Sin registrar")},
    ],
    stats:[
      {label:"Sububicaciones",value:String(row.location_count)},{label:"Activos",value:String(row.asset_count)},
      {label:"OT activas",value:String(row.active_order_count)},{label:"Técnicos",value:String(row.technician_count)},
    ],
    sections:[
      {title:"Geocerca",fields:[
        {label:"Latitud",value:row.latitude===null?"—":String(row.latitude)},
        {label:"Longitud",value:row.longitude===null?"—":String(row.longitude)},
        {label:"Radio",value:String(row.geofence_radius_m)+" m"},
      ]},
    ],
    image:row.image_data,imageMime:row.image_mime_type,
  };
}

async function loadLocation(id:string,session:NonNullable<Awaited<ReturnType<typeof getSession>>>):Promise<LifeProfile|null>{
  if(!can(session,"locations.manage")) return null;
  const result=await query<{
    id:string;organization_id:string;site_id:string;organization_name:string;site_name:string;name:string;code:string|null;type:string;description:string|null;active:boolean;
    child_count:number;asset_count:number;active_order_count:number;image_data:Buffer|null;image_mime_type:string|null;
  }>(`SELECT l.id,l.organization_id,l.site_id,o.name organization_name,s.name site_name,l.name,l.code,l.type,l.description,l.active,
            (SELECT count(*)::int FROM locations c WHERE c.parent_id=l.id AND c.active=true) child_count,
            (SELECT count(*)::int FROM assets a WHERE a.location_id=l.id AND a.status<>'retired') asset_count,
            (SELECT count(*)::int FROM work_orders w JOIN assets a ON a.id=w.asset_id WHERE a.location_id=l.id AND w.status NOT IN ('completed','cancelled')) active_order_count,
            l.image_data,l.image_mime_type
     FROM locations l JOIN sites s ON s.id=l.site_id JOIN organizations o ON o.id=l.organization_id WHERE l.id=$1`,[id]);
  if(!result.rowCount)return null;
  const row=result.rows[0];
  if(session.platformRole==="user"&&(session.organizationId!==row.organization_id||!canAccessSite(session,row.site_id)))return null;
  return {
    entityLabel:"Sububicación",title:row.name,subtitle:row.site_name+" · "+row.organization_name,status:row.active?"Activa":"Inactiva",
    fields:[
      {label:"Código",value:safe(row.code,"Sin código")},{label:"Tipo",value:safe(row.type)},
      {label:"Descripción",value:safe(row.description,"Sin descripción")},{label:"Sede principal",value:row.site_name},
      {label:"Empresa",value:row.organization_name},
    ],
    stats:[
      {label:"Sububicaciones internas",value:String(row.child_count)},{label:"Activos",value:String(row.asset_count)},
      {label:"OT activas",value:String(row.active_order_count)},{label:"Estado",value:row.active?"Activa":"Inactiva"},
    ],
    sections:[],image:row.image_data,imageMime:row.image_mime_type,
  };
}

async function loadUser(id:string,session:NonNullable<Awaited<ReturnType<typeof getSession>>>):Promise<LifeProfile|null>{
  if(!can(session,"users.manage")) return null;
  const result=await query<{
    id:string;full_name:string;email:string;phone:string|null;active:boolean;platform_role:string;last_login_at:string|null;
    organization_id:string|null;organization_name:string|null;role:string|null;access_all_sites:boolean|null;site_names:string[]|null;
    biometric_status:string;assigned_orders:number;pending_activities:number;completed_30d:number;attendance_hours_30d:number;tracking_live:boolean;
    avatar_data:Buffer|null;avatar_mime_type:string|null;
  }>(`SELECT u.id,u.full_name,u.email,u.phone,u.active,u.platform_role,u.last_login_at::text,
            om.organization_id,o.name organization_name,om.role,om.access_all_sites,
            COALESCE((SELECT array_agg(s.name ORDER BY s.name) FROM organization_member_sites oms JOIN sites s ON s.id=oms.site_id
                      WHERE oms.organization_id=om.organization_id AND oms.user_id=om.user_id),ARRAY[]::text[]) site_names,
            CASE WHEN bp.revoked_at IS NOT NULL THEN 'Revocada'
                 WHEN bp.enrollment_method='supervised_camera' AND bp.identity_verified_at IS NOT NULL AND bp.encrypted_embedding IS NOT NULL THEN 'Verificada'
                 WHEN bp.user_id IS NOT NULL THEN 'Reenrolar' ELSE 'Pendiente' END biometric_status,
            (SELECT count(*)::int FROM work_orders w WHERE w.assigned_to=u.id AND w.status NOT IN ('completed','cancelled')) assigned_orders,
            (SELECT count(*)::int FROM work_order_tasks wt WHERE wt.assigned_to=u.id AND wt.status IN ('pending','in_progress')) pending_activities,
            (SELECT count(*)::int FROM activity_execution_events aee WHERE aee.user_id=u.id AND aee.event_type='completed' AND aee.occurred_at>=now()-interval '30 days') completed_30d,
            COALESCE((SELECT ROUND((SUM(EXTRACT(EPOCH FROM (COALESCE(ats.check_out_at,now())-ats.check_in_at)))/3600)::numeric,1)::float8
                      FROM attendance_shifts ats WHERE ats.user_id=u.id AND ats.check_in_at>=now()-interval '30 days'),0)::float8 attendance_hours_30d,
            EXISTS(SELECT 1 FROM technician_tracking_sessions ts WHERE ts.user_id=u.id AND ts.status='active' AND ts.last_seen_at>now()-interval '2 minutes') tracking_live,
            u.avatar_data,u.avatar_mime_type
     FROM users u
     LEFT JOIN LATERAL (SELECT om.* FROM organization_members om WHERE om.user_id=u.id ORDER BY om.created_at ASC LIMIT 1) om ON true
     LEFT JOIN organizations o ON o.id=om.organization_id
     LEFT JOIN user_biometric_profiles bp ON bp.user_id=u.id AND bp.organization_id=om.organization_id
     WHERE u.id=$1`,[id]);
  if(!result.rowCount)return null;
  const row=result.rows[0];
  if(session.platformRole==="user"&&session.organizationId!==row.organization_id)return null;
  const scope=row.platform_role!=="user"?"Todas las empresas":row.access_all_sites!==false?"Todas las sedes":(row.site_names||[]).join(", ")||"Sin sedes asignadas";
  return {
    entityLabel:row.role==="technician"?"Técnico":"Usuario",title:row.full_name,subtitle:row.organization_name||"Desweb CMMS",status:row.active?"Activo":"Inactivo",
    fields:[
      {label:"Correo",value:row.email},{label:"Teléfono / WhatsApp",value:safe(row.phone,"Sin registrar")},
      {label:"Rol",value:row.platform_role==="user"?roleName(row.role):row.platform_role==="platform_owner"?"Propietario Desweb":"Superadministrador"},
      {label:"Empresa",value:safe(row.organization_name,"Acceso global")},{label:"Alcance",value:scope},
      {label:"Último acceso",value:dateText(row.last_login_at)},{label:"Biometría",value:row.biometric_status},
    ],
    stats:[
      {label:"OT asignadas",value:String(row.assigned_orders)},{label:"Actividades pendientes",value:String(row.pending_activities)},
      {label:"Completadas · 30 días",value:String(row.completed_30d)},{label:"Horas campo · 30 días",value:String(row.attendance_hours_30d)},
    ],
    sections:[
      {title:"Operación de campo",fields:[
        {label:"Conexión Reacción",value:row.tracking_live?"En línea":"Sin conexión en vivo"},
        {label:"Estado biométrico",value:row.biometric_status},
      ]},
    ],
    image:row.avatar_data,imageMime:row.avatar_mime_type,
  };
}

async function profile(entity:string,id:string,session:NonNullable<Awaited<ReturnType<typeof getSession>>>){
  if(entity==="organization")return loadOrganization(id,session);
  if(entity==="site")return loadSite(id,session);
  if(entity==="location")return loadLocation(id,session);
  if(entity==="user")return loadUser(id,session);
  return null;
}

function allRows(data:LifeProfile){
  const rows:Field[]=[...data.fields,...data.stats.map(item=>({label:"Indicador · "+item.label,value:item.value}))];
  for(const section of data.sections)for(const field of section.fields)rows.push({label:section.title+" · "+field.label,value:field.value});
  return rows;
}

async function pdf(data:LifeProfile){
  const doc=await PDFDocument.create();
  const regular=await doc.embedFont(StandardFonts.Helvetica);
  const bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const pageSize:[number,number]=[595.28,841.89];
  let page=doc.addPage(pageSize);
  let y=790;
  const teal=rgb(56/255,178/255,169/255), dark=rgb(41/255,54/255,68/255), soft=rgb(96/255,111/255,120/255), line=rgb(222/255,230/255,233/255);
  page.drawRectangle({x:0,y:814,width:595.28,height:28,color:dark});
  page.drawText("DESWEB CMMS · HOJA DE VIDA",{x:42,y:823,size:9,font:bold,color:rgb(1,1,1)});
  if(data.image&&data.imageMime){
    try{
      const image=data.imageMime.includes("png")?await doc.embedPng(data.image):data.imageMime.includes("jpeg")||data.imageMime.includes("jpg")?await doc.embedJpg(data.image):null;
      if(image){const scale=Math.min(74/image.width,74/image.height);page.drawImage(image,{x:42,y:700,width:image.width*scale,height:image.height*scale});}
    }catch{}
  }
  page.drawText(data.entityLabel.toUpperCase(),{x:140,y:777,size:8,font:bold,color:teal});
  page.drawText(data.title.slice(0,55),{x:140,y:753,size:20,font:bold,color:dark});
  page.drawText(data.subtitle.slice(0,80),{x:140,y:735,size:10,font:regular,color:soft});
  page.drawText("Estado: "+data.status,{x:140,y:718,size:9,font:bold,color:dark});
  y=675;

  const drawSection=(title:string,fields:Field[])=>{
    if(y<115){page=doc.addPage(pageSize);y=790;}
    page.drawText(title,{x:42,y,size:12,font:bold,color:dark}); y-=10;
    page.drawLine({start:{x:42,y},end:{x:553,y},thickness:1,color:teal}); y-=18;
    for(const field of fields){
      if(y<80){page=doc.addPage(pageSize);y=790;}
      page.drawText(field.label.slice(0,38),{x:42,y,size:8,font:bold,color:soft});
      page.drawText(field.value.slice(0,82),{x:205,y,size:9,font:regular,color:dark});
      y-=18;
      page.drawLine({start:{x:42,y:y+6},end:{x:553,y:y+6},thickness:.5,color:line});
    }
    y-=12;
  };

  drawSection("Información general",data.fields);
  drawSection("Indicadores",data.stats);
  for(const section of data.sections)drawSection(section.title,section.fields);
  page.drawText("Generado "+new Date().toLocaleString("es-CO")+" · Desweb CMMS",{x:42,y:35,size:7,font:regular,color:soft});
  return Buffer.from(await doc.save());
}

async function xlsx(data:LifeProfile){
  const workbook=new ExcelJS.Workbook();workbook.creator="Desweb CMMS";
  const sheet=workbook.addWorksheet("Hoja de vida",{views:[{showGridLines:false}]});
  sheet.columns=[{width:30},{width:58}];
  sheet.mergeCells("A1:B2");sheet.getCell("A1").value="DESWEB CMMS · HOJA DE VIDA";sheet.getCell("A1").font={bold:true,size:18,color:{argb:"293644"}};
  sheet.mergeCells("A3:B3");sheet.getCell("A3").value=data.entityLabel+" · "+data.title;sheet.getCell("A3").font={bold:true,size:13,color:{argb:"38B2A9"}};
  sheet.mergeCells("A4:B4");sheet.getCell("A4").value=data.subtitle+" · "+data.status;
  let row=6;
  const add=(title:string,fields:Field[])=>{
    sheet.mergeCells(row,1,row,2);sheet.getCell(row,1).value=title;sheet.getCell(row,1).font={bold:true,color:{argb:"FFFFFF"}};
    sheet.getCell(row,1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"293644"}};row++;
    for(const field of fields){sheet.getCell(row,1).value=field.label;sheet.getCell(row,1).font={bold:true,color:{argb:"53646E"}};sheet.getCell(row,2).value=field.value;row++;}
    row++;
  };
  add("Información general",data.fields);add("Indicadores",data.stats);for(const section of data.sections)add(section.title,section.fields);
  sheet.getCell(row,1).value="Generado";sheet.getCell(row,2).value=new Date().toLocaleString("es-CO");
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function word(data:LifeProfile){
  const image=data.image&&data.imageMime?`<img class="avatar" src="data:${data.imageMime};base64,${data.image.toString("base64")}" alt="">`:"";
  const table=(title:string,fields:Field[])=>`<h2>${title}</h2><table>${fields.map(f=>`<tr><th>${escapeHtml(f.label)}</th><td>${escapeHtml(f.value)}</td></tr>`).join("")}</table>`;
  const html=`<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;color:#293644;margin:36px}.top{border-top:18px solid #293644;padding-top:24px;display:flex;gap:24px;align-items:center}
    .avatar{width:92px;height:92px;object-fit:cover;border-radius:18px;border:4px solid #eaf8f7}.kicker{color:#38B2A9;font-weight:700;font-size:10px;text-transform:uppercase}
    h1{font-size:26px;margin:6px 0}p{color:#66747c;margin:4px 0}h2{font-size:14px;margin-top:26px;border-bottom:2px solid #38B2A9;padding-bottom:7px}
    table{width:100%;border-collapse:collapse}th,td{padding:8px 7px;border-bottom:1px solid #dde6e9;text-align:left;font-size:10px}th{width:32%;color:#66747c}
    .footer{margin-top:28px;font-size:8px;color:#86939a}
  </style></head><body><div class="top">${image}<div><div class="kicker">${escapeHtml(data.entityLabel)}</div><h1>${escapeHtml(data.title)}</h1><p>${escapeHtml(data.subtitle)}</p><p><b>Estado:</b> ${escapeHtml(data.status)}</p></div></div>
  ${table("Información general",data.fields)}${table("Indicadores",data.stats)}${data.sections.map(s=>table(s.title,s.fields)).join("")}
  <div class="footer">Generado ${escapeHtml(new Date().toLocaleString("es-CO"))} · Desweb CMMS</div></body></html>`;
  return Buffer.from("\uFEFF"+html,"utf8");
}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]||char));}

export async function GET(request:Request){
  const session=await getSession();if(!session)return new NextResponse("No autorizado",{status:401});
  const url=new URL(request.url);const entity=url.searchParams.get("entity")||"";const id=url.searchParams.get("id")||"";const format=url.searchParams.get("format")||"pdf";
  if(!UUID.test(id)||!["organization","site","location","user"].includes(entity)||!["pdf","xlsx","word"].includes(format))return new NextResponse("Solicitud inválida",{status:400});
  const data=await profile(entity,id,session);if(!data)return new NextResponse("Registro no encontrado o sin permiso",{status:404});
  const base="hoja-de-vida-"+filename(data.title);
  if(format==="xlsx"){
    const body=await xlsx(data);return new NextResponse(new Uint8Array(body),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="${base}.xlsx"`,"Cache-Control":"private, no-store"}});
  }
  if(format==="word"){
    const body=word(data);return new NextResponse(new Uint8Array(body),{headers:{"Content-Type":"application/msword; charset=utf-8","Content-Disposition":`attachment; filename="${base}.doc"`,"Cache-Control":"private, no-store"}});
  }
  const body=await pdf(data);return new NextResponse(new Uint8Array(body),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${base}.pdf"`,"Cache-Control":"private, no-store"}});
}
