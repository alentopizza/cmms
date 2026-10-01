import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool } from "@/lib/db";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_MIME=new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const MAX_FILE_BYTES=10*1024*1024;
const MAX_FILES=5;

async function authorizeLead(id:string){
  if(!UUID.test(id))return null;
  const result=await pool.query<{id:string}>("SELECT id FROM sales_leads WHERE id=$1",[id]);
  return result.rows[0]||null;
}

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"leads.manage"))return new NextResponse("Forbidden",{status:403});

  const {id}=await params;
  if(!await authorizeLead(id))return new NextResponse("Lead no encontrado",{status:404});

  const activities=await pool.query<{
    id:string;activity_type:"note"|"status";note:string|null;from_status:string|null;to_status:string|null;
    created_at:string;created_by:string|null;created_by_name:string|null;created_by_email:string|null;
  }>(
    `SELECT a.id::text,a.activity_type,a.note,a.from_status,a.to_status,a.created_at::text,
            a.created_by::text,u.full_name created_by_name,u.email created_by_email
     FROM sales_lead_activities a
     LEFT JOIN users u ON u.id=a.created_by
     WHERE a.lead_id=$1
     ORDER BY a.created_at DESC,a.id DESC`,
    [id],
  );
  const attachments=activities.rowCount
    ?await pool.query<{id:string;activity_id:string;file_name:string;file_mime_type:string;file_size_bytes:string;created_at:string}>(
      `SELECT id::text,activity_id::text,file_name,file_mime_type,file_size_bytes::text,created_at::text
       FROM sales_lead_activity_attachments
       WHERE lead_id=$1
       ORDER BY created_at,id`,
      [id],
    )
    :{rows:[]};
  const byActivity=new Map<string,typeof attachments.rows>();
  for(const file of attachments.rows){
    const current=byActivity.get(file.activity_id)||[];
    current.push(file);byActivity.set(file.activity_id,current);
  }
  return NextResponse.json({
    activities:activities.rows.map(item=>({...item,attachments:byActivity.get(item.id)||[]})),
  },{headers:{"Cache-Control":"private, no-store, max-age=0"}});
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"leads.manage"))return new NextResponse("Forbidden",{status:403});

  const {id}=await params;
  if(!await authorizeLead(id))return new NextResponse("Lead no encontrado",{status:404});

  const form=await request.formData();
  const note=String(form.get("note")||"").trim();
  const files=form.getAll("files").filter((value):value is File=>value instanceof File&&value.size>0);
  if(!note)return NextResponse.json({message:"Escribe una nota para registrar el seguimiento."},{status:422});
  if(note.length>5000)return NextResponse.json({message:"La nota no puede superar 5.000 caracteres."},{status:422});
  if(files.length>MAX_FILES)return NextResponse.json({message:"Puedes adjuntar máximo 5 archivos por nota."},{status:422});

  const prepared:Array<{name:string;mime:string;size:number;bytes:Buffer}>=[];
  for(const file of files){
    if(!ALLOWED_MIME.has(file.type))return NextResponse.json({message:"Formato no permitido. Usa PDF, imagen, TXT, Word o Excel."},{status:422});
    if(file.size>MAX_FILE_BYTES)return NextResponse.json({message:"Cada adjunto debe pesar máximo 10 MB."},{status:422});
    prepared.push({
      name:file.name.slice(0,240).replace(/[\r\n]/g,"_"),
      mime:file.type,
      size:file.size,
      bytes:Buffer.from(await file.arrayBuffer()),
    });
  }

  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const activity=await client.query<{id:string;created_at:string}>(
      `INSERT INTO sales_lead_activities(lead_id,activity_type,note,created_by)
       VALUES($1,'note',$2,$3)
       RETURNING id::text,created_at::text`,
      [id,note,session.userId||null],
    );
    const activityId=activity.rows[0].id;
    for(const file of prepared){
      await client.query(
        `INSERT INTO sales_lead_activity_attachments(
           activity_id,lead_id,file_name,file_mime_type,file_size_bytes,file_data,uploaded_by
         ) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [activityId,id,file.name,file.mime,file.size,file.bytes,session.userId||null],
      );
    }
    await client.query("UPDATE sales_leads SET updated_at=now() WHERE id=$1",[id]);
    await client.query("COMMIT");
    return NextResponse.json({
      activityId,
      createdAt:activity.rows[0].created_at,
      message:"Nota agregada al seguimiento.",
    },{status:201});
  }catch(error){
    try{await client.query("ROLLBACK");}catch{}
    throw error;
  }finally{
    client.release();
  }
}
