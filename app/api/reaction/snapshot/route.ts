import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { isBusinessOpenNow, normalizeBusinessHoursRow } from "@/lib/business-hours";

type CompanyRow={
  id:string;name:string;timezone:string;latitude:number;longitude:number;
  business_days:number[];business_open_time:string;business_close_time:string;has_logo:boolean;
};
type SiteRow={
  id:string;organization_id:string;organization_name:string;organization_timezone:string;name:string;
  latitude:number;longitude:number;geofence_radius_m:number;organization_has_logo:boolean;
  business_days:number[];business_open_time:string;business_close_time:string;
};
type TechRow={
  tracking_session_id:string;user_id:string;full_name:string;organization_id:string;organization_name:string;
  latitude:number;longitude:number;accuracy_m:number|null;last_seen_at:string;has_avatar:boolean;
  live:boolean;
};
type SampleRow={tracking_session_id:string;latitude:number;longitude:number;recorded_at:string};

export async function GET(){
  const session=await getSession();
  if(!session) return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"reaction.view")) return new NextResponse("Forbidden",{status:403});

  const global=session.platformRole!=="user";
  const organizationId=session.organizationId;

  const companies=await query<CompanyRow>(
    global
      ? `SELECT o.id,o.name,o.timezone,o.business_days,o.business_open_time::text,o.business_close_time::text,
                (o.logo_data IS NOT NULL) has_logo,
                representative.latitude,representative.longitude
         FROM organizations o
         JOIN LATERAL (
           SELECT s.latitude,s.longitude
           FROM sites s
           WHERE s.organization_id=o.id AND s.active=true
             AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
           ORDER BY s.created_at ASC
           LIMIT 1
         ) representative ON true
         WHERE o.active=true
         ORDER BY o.name`
      : `SELECT o.id,o.name,o.timezone,o.business_days,o.business_open_time::text,o.business_close_time::text,
                (o.logo_data IS NOT NULL) has_logo,
                representative.latitude,representative.longitude
         FROM organizations o
         JOIN LATERAL (
           SELECT s.latitude,s.longitude
           FROM sites s
           WHERE s.organization_id=o.id AND s.active=true
             AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
             AND ($2::boolean OR s.id=ANY($3::uuid[]))
           ORDER BY s.created_at ASC
           LIMIT 1
         ) representative ON true
         WHERE o.active=true AND o.id=$1
         ORDER BY o.name`,
    global?[]:[organizationId,session.accessAllSites,session.siteIds],
  );

  const sites=await query<SiteRow>(
    global
      ? `SELECT s.id,s.organization_id,o.name organization_name,o.timezone organization_timezone,s.name,
                s.latitude,s.longitude,s.geofence_radius_m,
                (o.logo_data IS NOT NULL) organization_has_logo,
                s.business_days,s.business_open_time::text,s.business_close_time::text
         FROM sites s
         JOIN organizations o ON o.id=s.organization_id
         WHERE s.active=true AND o.active=true
           AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
         ORDER BY o.name,s.name`
      : `SELECT s.id,s.organization_id,o.name organization_name,o.timezone organization_timezone,s.name,
                s.latitude,s.longitude,s.geofence_radius_m,
                (o.logo_data IS NOT NULL) organization_has_logo,
                s.business_days,s.business_open_time::text,s.business_close_time::text
         FROM sites s
         JOIN organizations o ON o.id=s.organization_id
         WHERE s.active=true AND o.active=true AND s.organization_id=$1
           AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
           AND ($2::boolean OR s.id=ANY($3::uuid[]))
         ORDER BY s.name`,
    global?[]:[organizationId,session.accessAllSites,session.siteIds],
  );

  const technicians=await query<TechRow>(
    global
      ? `SELECT ts.id tracking_session_id,u.id user_id,u.full_name,
                ts.organization_id,o.name organization_name,
                ts.last_latitude latitude,ts.last_longitude longitude,
                ts.last_accuracy_m accuracy_m,ts.last_seen_at::text,
                (ts.last_seen_at > now()-interval '2 minutes') live,
                (u.avatar_data IS NOT NULL) has_avatar
         FROM technician_tracking_sessions ts
         JOIN users u ON u.id=ts.user_id
         JOIN organization_members om ON om.user_id=u.id AND om.organization_id=ts.organization_id
         JOIN organizations o ON o.id=ts.organization_id
         WHERE ts.status='active' AND om.role='technician'
           AND ts.last_latitude IS NOT NULL AND ts.last_longitude IS NOT NULL
           AND ts.last_seen_at > now()-interval '30 minutes'
         ORDER BY ts.last_seen_at DESC`
      : `SELECT ts.id tracking_session_id,u.id user_id,u.full_name,
                ts.organization_id,o.name organization_name,
                ts.last_latitude latitude,ts.last_longitude longitude,
                ts.last_accuracy_m accuracy_m,ts.last_seen_at::text,
                (ts.last_seen_at > now()-interval '2 minutes') live,
                (u.avatar_data IS NOT NULL) has_avatar
         FROM technician_tracking_sessions ts
         JOIN users u ON u.id=ts.user_id
         JOIN organization_members om ON om.user_id=u.id AND om.organization_id=ts.organization_id
         JOIN organizations o ON o.id=ts.organization_id
         WHERE ts.status='active' AND ts.organization_id=$1 AND om.role='technician'
           AND ts.last_latitude IS NOT NULL AND ts.last_longitude IS NOT NULL
           AND ts.last_seen_at > now()-interval '30 minutes'
         ORDER BY ts.last_seen_at DESC`,
    global?[]:[organizationId],
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
    companies:companies.rows.map(company=>{
      const hours=normalizeBusinessHoursRow(company);
      return {
        id:company.id,
        name:company.name,
        lat:Number(company.latitude),
        lng:Number(company.longitude),
        timezone:company.timezone,
        businessHours:hours,
        openNow:isBusinessOpenNow(hours,company.timezone),
        logoUrl:company.has_logo?`/api/organizations/${company.id}/assets/logo`:null,
      };
    }),
    sites:sites.rows.map(site=>{
      const hours=normalizeBusinessHoursRow(site);
      return {
        id:site.id,
        organizationId:site.organization_id,
        organizationName:site.organization_name,
        name:site.name,
        lat:Number(site.latitude),
        lng:Number(site.longitude),
        radius:Number(site.geofence_radius_m),
        businessHours:hours,
        openNow:isBusinessOpenNow(hours,site.organization_timezone),
        logoUrl:site.organization_has_logo?`/api/organizations/${site.organization_id}/assets/logo`:null,
      };
    }),
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
      telemetryState:tech.live?"live":"paused",
      avatarUrl:tech.has_avatar?`/api/users/${tech.user_id}/avatar`:null,
      route:routes[tech.tracking_session_id]||[],
    })),
  },{headers:{"Cache-Control":"private, no-store, max-age=0"}});
}
