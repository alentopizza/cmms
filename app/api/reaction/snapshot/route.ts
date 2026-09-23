import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";

type SiteRow={
  id:string;organization_id:string;organization_name:string;name:string;
  latitude:number;longitude:number;geofence_radius_m:number;organization_has_logo:boolean;
};
type TechRow={
  tracking_session_id:string;user_id:string;full_name:string;organization_id:string;organization_name:string;
  latitude:number;longitude:number;accuracy_m:number|null;last_seen_at:string;has_avatar:boolean;
};
type SampleRow={tracking_session_id:string;latitude:number;longitude:number;recorded_at:string};

export async function GET(){
  const session=await getSession();
  if(!session) return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"reaction.view")) return new NextResponse("Forbidden",{status:403});

  const global=session.platformRole!=="user";
  const params=global?[]:[session.organizationId];

  const sites=await query<SiteRow>(
    global
      ? `SELECT s.id,s.organization_id,o.name organization_name,s.name,
                s.latitude,s.longitude,s.geofence_radius_m,
                (o.logo_data IS NOT NULL) organization_has_logo
         FROM sites s
         JOIN organizations o ON o.id=s.organization_id
         WHERE s.active=true AND o.active=true
           AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
         ORDER BY o.name,s.name`
      : `SELECT s.id,s.organization_id,o.name organization_name,s.name,
                s.latitude,s.longitude,s.geofence_radius_m,
                (o.logo_data IS NOT NULL) organization_has_logo
         FROM sites s
         JOIN organizations o ON o.id=s.organization_id
         WHERE s.active=true AND o.active=true AND s.organization_id=$1
           AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
         ORDER BY s.name`,
    params,
  );

  const technicians=await query<TechRow>(
    global
      ? `SELECT ts.id tracking_session_id,u.id user_id,u.full_name,
                ts.organization_id,o.name organization_name,
                ts.last_latitude latitude,ts.last_longitude longitude,
                ts.last_accuracy_m accuracy_m,ts.last_seen_at::text,
                (u.avatar_data IS NOT NULL) has_avatar
         FROM technician_tracking_sessions ts
         JOIN users u ON u.id=ts.user_id
         JOIN organization_members om ON om.user_id=u.id AND om.organization_id=ts.organization_id
         JOIN organizations o ON o.id=ts.organization_id
         WHERE ts.status='active' AND om.role='technician'
           AND ts.last_latitude IS NOT NULL AND ts.last_longitude IS NOT NULL
           AND ts.last_seen_at > now()-interval '2 minutes'
         ORDER BY ts.last_seen_at DESC`
      : `SELECT ts.id tracking_session_id,u.id user_id,u.full_name,
                ts.organization_id,o.name organization_name,
                ts.last_latitude latitude,ts.last_longitude longitude,
                ts.last_accuracy_m accuracy_m,ts.last_seen_at::text,
                (u.avatar_data IS NOT NULL) has_avatar
         FROM technician_tracking_sessions ts
         JOIN users u ON u.id=ts.user_id
         JOIN organization_members om ON om.user_id=u.id AND om.organization_id=ts.organization_id
         JOIN organizations o ON o.id=ts.organization_id
         WHERE ts.status='active' AND ts.organization_id=$1 AND om.role='technician'
           AND ts.last_latitude IS NOT NULL AND ts.last_longitude IS NOT NULL
           AND ts.last_seen_at > now()-interval '2 minutes'
         ORDER BY ts.last_seen_at DESC`,
    params,
  );

  const ids=technicians.rows.map(row=>row.tracking_session_id);
  let samples:{rows:SampleRow[]}={rows:[]};
  if(ids.length){
    samples=await query<SampleRow>(
      `SELECT tracking_session_id,latitude,longitude,recorded_at::text
       FROM technician_location_samples
       WHERE tracking_session_id=ANY($1::uuid[])
         AND recorded_at > now()-interval '2 hours'
       ORDER BY recorded_at ASC
       LIMIT 5000`,
      [ids],
    );
  }

  const routes:Record<string,Array<{lat:number;lng:number;at:string}>>={};
  for(const row of samples.rows){
    (routes[row.tracking_session_id] ||= []).push({
      lat:Number(row.latitude),lng:Number(row.longitude),at:row.recorded_at,
    });
  }

  return NextResponse.json({
    generatedAt:new Date().toISOString(),
    sites:sites.rows.map(site=>({
      id:site.id,
      organizationId:site.organization_id,
      organizationName:site.organization_name,
      name:site.name,
      lat:Number(site.latitude),
      lng:Number(site.longitude),
      radius:Number(site.geofence_radius_m),
      logoUrl:site.organization_has_logo?`/api/organizations/${site.organization_id}/assets/logo`:null,
    })),
    technicians:technicians.rows.map(tech=>({
      trackingSessionId:tech.tracking_session_id,
      userId:tech.user_id,
      fullName:tech.full_name,
      organizationId:tech.organization_id,
      organizationName:tech.organization_name,
      lat:Number(tech.latitude),
      lng:Number(tech.longitude),
      accuracy:tech.accuracy_m===null?null:Number(tech.accuracy_m),
      lastSeenAt:tech.last_seen_at,
      avatarUrl:tech.has_avatar?`/api/users/${tech.user_id}/avatar`:null,
      route:routes[tech.tracking_session_id]||[],
    })),
  },{headers:{"Cache-Control":"private, no-store, max-age=0"}});
}
