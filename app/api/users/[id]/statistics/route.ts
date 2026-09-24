import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { pool } from "@/lib/db";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DayRow={date:string;hours:number};
type ActivityRow={
  id:string;work_order_id:string;order_number:string;order_title:string;description:string;status:string;due_date:string|null;site_name:string|null;
};

function dateKey(date:Date){return date.toISOString().slice(0,10);}

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();
  if(!session)return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"users.manage"))return new NextResponse("Forbidden",{status:403});

  const {id}=await params;
  if(!UUID.test(id))return NextResponse.json({message:"Usuario inválido."},{status:400});

  const client=await pool.connect();
  try{
    const target=await client.query<{platform_role:string;organization_id:string|null}>(
      `SELECT u.platform_role,om.organization_id
       FROM users u
       LEFT JOIN LATERAL (
         SELECT organization_id
         FROM organization_members
         WHERE user_id=u.id
         ORDER BY created_at ASC
         LIMIT 1
       ) om ON true
       WHERE u.id=$1`,
      [id],
    );
    if(!target.rowCount)return NextResponse.json({message:"Usuario no encontrado."},{status:404});
    const row=target.rows[0];
    if(session.platformRole==="user"&&(row.platform_role!=="user"||row.organization_id!==session.organizationId)){
      return new NextResponse("Forbidden",{status:403});
    }

    const [daily,openShift,completed7d,overdue,upcoming]=await Promise.all([
      client.query<DayRow>(
        `SELECT check_in_at::date::text date,
                ROUND((SUM(EXTRACT(EPOCH FROM (COALESCE(check_out_at,now())-check_in_at)))/3600)::numeric,1)::float8 hours
         FROM attendance_shifts
         WHERE user_id=$1 AND check_in_at>=current_date-interval '6 days'
         GROUP BY check_in_at::date
         ORDER BY check_in_at::date`,
        [id],
      ),
      client.query<{check_in_at:string|null}>(
        `SELECT check_in_at::text check_in_at
         FROM attendance_shifts
         WHERE user_id=$1 AND status='open'
         ORDER BY check_in_at DESC
         LIMIT 1`,
        [id],
      ),
      client.query<{count:number}>(
        `SELECT count(*)::int count
         FROM activity_execution_events
         WHERE user_id=$1 AND event_type='completed' AND occurred_at>=now()-interval '7 days'`,
        [id],
      ),
      client.query<{count:number}>(
        `SELECT count(*)::int count
         FROM work_order_tasks
         WHERE assigned_to=$1 AND status IN ('pending','in_progress') AND due_date<current_date`,
        [id],
      ),
      client.query<ActivityRow>(
        `SELECT wt.id,w.id work_order_id,w.number::text order_number,w.title order_title,wt.description,wt.status,
                wt.due_date::text,s.name site_name
         FROM work_order_tasks wt
         JOIN work_orders w ON w.id=wt.work_order_id
         JOIN sites s ON s.id=w.site_id
         WHERE wt.assigned_to=$1 AND wt.status IN ('pending','in_progress')
         ORDER BY wt.due_date NULLS LAST,w.number
         LIMIT 8`,
        [id],
      ),
    ]);

    const dailyMap=new Map(daily.rows.map(item=>[item.date,Number(item.hours||0)]));
    const attendanceDaily7d=[] as Array<{date:string;hours:number}>;
    const now=new Date();
    for(let offset=6;offset>=0;offset--){
      const day=new Date(now);
      day.setUTCHours(12,0,0,0);
      day.setUTCDate(day.getUTCDate()-offset);
      const key=dateKey(day);
      attendanceDaily7d.push({date:key,hours:dailyMap.get(key)||0});
    }
    const todayKey=dateKey(now);
    return NextResponse.json({
      attendance_hours_today:dailyMap.get(todayKey)||0,
      attendance_daily_7d:attendanceDaily7d,
      completed_activities_7d:completed7d.rows[0]?.count||0,
      overdue_activities:overdue.rows[0]?.count||0,
      open_shift_started_at:openShift.rows[0]?.check_in_at||null,
      upcoming_activities:upcoming.rows,
    });
  }finally{
    client.release();
  }
}
