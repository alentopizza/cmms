import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { isBusinessOpenNow, normalizeBusinessHoursRow } from "@/lib/business-hours";
import { e164Phone, nationalPhonePart } from "@/lib/country-calling-codes";

type CompanyRow={
  id:string;name:string;legal_name:string|null;tax_id:string|null;phone:string|null;contact_country:string;admin_email:string|null;
  website:string|null;primary_contact_name:string|null;primary_contact_phone:string|null;primary_contact_email:string|null;
  timezone:string;latitude:number;longitude:number;
  business_days:number[];business_open_time:string;business_close_time:string;business_schedule:unknown;has_logo:boolean;
};
type SiteRow={
  id:string;organization_id:string;organization_name:string;organization_timezone:string;name:string;code:string|null;
  address:string|null;city:string|null;country:string;contact_name:string|null;contact_phone:string|null;contact_email:string|null;
  latitude:number;longitude:number;geofence_radius_m:number;organization_has_logo:boolean;
  business_days:number[];business_open_time:string;business_close_time:string;business_schedule:unknown;
};
type TechRow={
  tracking_session_id:string;user_id:string;full_name:string;email:string;phone:string|null;role:string;
  organization_id:string;organization_name:string;organization_country:string;latitude:number;longitude:number;accuracy_m:number|null;
  last_seen_at:string;has_avatar:boolean;live:boolean;crew_ids:string[];
};
type SampleRow={tracking_session_id:string;latitude:number;longitude:number;recorded_at:string};
type ActivityRow={
  id:string;work_order_id:string;work_order_number:string;work_order_title:string;work_order_type:string;work_order_status:string;
  description:string;notes:string|null;status:string;priority:string;organization_id:string;organization_name:string;
  site_id:string;site_name:string;asset_name:string|null;
  assigned_user_id:string|null;assigned_user_name:string|null;
  crew_id:string|null;crew_name:string|null;
  service_supplier_id:string|null;supplier_name:string|null;
  responsible:string;operational_at:string;operational_date:string;due_at:string|null;
  date_state:"overdue"|"today"|"future";
};

export async function GET(){
  const session=await getSession();
  if(!session) return new NextResponse("Unauthorized",{status:401});
  if(!can(session,"reaction.view")) return new NextResponse("Forbidden",{status:403});

  const global=session.platformRole!=="user";
  const organizationId=session.organizationId;

  const companies=await query<CompanyRow>(
    global
      ? `SELECT o.id,o.name,o.legal_name,o.tax_id,o.phone,
                COALESCE(o.legal_country,(SELECT sc.country FROM sites sc WHERE sc.organization_id=o.id ORDER BY sc.created_at ASC LIMIT 1),'CO') contact_country,
                o.admin_email,o.website,
                o.primary_contact_name,o.primary_contact_phone,o.primary_contact_email,
                o.timezone,o.business_days,o.business_open_time::text,o.business_close_time::text,o.business_schedule,
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
      : `SELECT o.id,o.name,o.legal_name,o.tax_id,o.phone,
                COALESCE(o.legal_country,(SELECT sc.country FROM sites sc WHERE sc.organization_id=o.id ORDER BY sc.created_at ASC LIMIT 1),'CO') contact_country,
                o.admin_email,o.website,
                o.primary_contact_name,o.primary_contact_phone,o.primary_contact_email,
                o.timezone,o.business_days,o.business_open_time::text,o.business_close_time::text,o.business_schedule,
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
      ? `SELECT s.id,s.organization_id,o.name organization_name,o.timezone organization_timezone,s.name,s.code,
                s.address,s.city,s.country,s.contact_name,s.contact_phone,s.contact_email,
                s.latitude,s.longitude,s.geofence_radius_m,
                (o.logo_data IS NOT NULL) organization_has_logo,
                s.business_days,s.business_open_time::text,s.business_close_time::text,s.business_schedule
         FROM sites s
         JOIN organizations o ON o.id=s.organization_id
         WHERE s.active=true AND o.active=true
           AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
         ORDER BY o.name,s.name`
      : `SELECT s.id,s.organization_id,o.name organization_name,o.timezone organization_timezone,s.name,s.code,
                s.address,s.city,s.country,s.contact_name,s.contact_phone,s.contact_email,
                s.latitude,s.longitude,s.geofence_radius_m,
                (o.logo_data IS NOT NULL) organization_has_logo,
                s.business_days,s.business_open_time::text,s.business_close_time::text,s.business_schedule
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
      ? `SELECT ts.id tracking_session_id,u.id user_id,u.full_name,u.email,u.phone,om.role,
                ts.organization_id,o.name organization_name,
                COALESCE(o.legal_country,(SELECT sc.country FROM sites sc WHERE sc.organization_id=o.id ORDER BY sc.created_at ASC LIMIT 1),'CO') organization_country,
                ts.last_latitude latitude,ts.last_longitude longitude,
                ts.last_accuracy_m accuracy_m,ts.last_seen_at::text,
                (ts.last_seen_at > now()-interval '2 minutes') live,
                (u.avatar_data IS NOT NULL) has_avatar,
                COALESCE((
                  SELECT array_agg(cm.crew_id::text ORDER BY cm.crew_id::text)
                  FROM crew_members cm
                  WHERE cm.organization_id=ts.organization_id AND cm.user_id=u.id
                ),ARRAY[]::text[]) crew_ids
         FROM technician_tracking_sessions ts
         JOIN users u ON u.id=ts.user_id
         JOIN organization_members om ON om.user_id=u.id AND om.organization_id=ts.organization_id
         JOIN organizations o ON o.id=ts.organization_id
         WHERE ts.status='active' AND om.role='technician'
           AND ts.last_latitude IS NOT NULL AND ts.last_longitude IS NOT NULL
           AND ts.last_seen_at > now()-interval '30 minutes'
         ORDER BY ts.last_seen_at DESC`
      : `SELECT ts.id tracking_session_id,u.id user_id,u.full_name,u.email,u.phone,om.role,
                ts.organization_id,o.name organization_name,
                COALESCE(o.legal_country,(SELECT sc.country FROM sites sc WHERE sc.organization_id=o.id ORDER BY sc.created_at ASC LIMIT 1),'CO') organization_country,
                ts.last_latitude latitude,ts.last_longitude longitude,
                ts.last_accuracy_m accuracy_m,ts.last_seen_at::text,
                (ts.last_seen_at > now()-interval '2 minutes') live,
                (u.avatar_data IS NOT NULL) has_avatar,
                COALESCE((
                  SELECT array_agg(cm.crew_id::text ORDER BY cm.crew_id::text)
                  FROM crew_members cm
                  WHERE cm.organization_id=ts.organization_id AND cm.user_id=u.id
                ),ARRAY[]::text[]) crew_ids
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

  const activities=await query<ActivityRow>(
    global
      ? `SELECT t.id,w.id work_order_id,w.number::text work_order_number,w.title work_order_title,
                w.type work_order_type,w.status work_order_status,
                t.description,t.notes,t.status,w.priority,w.organization_id,o.name organization_name,
                w.site_id,s.name site_name,a.name asset_name,
                t.assigned_to assigned_user_id,u.full_name assigned_user_name,
                t.crew_id,c.name crew_name,
                t.service_supplier_id,sp.name supplier_name,
                COALESCE(u.full_name,c.name,sp.name,'Sin asignar') responsible,
                COALESCE(t.due_date,(w.due_at AT TIME ZONE o.timezone)::date,(w.requested_at AT TIME ZONE o.timezone)::date)::text operational_at,
                COALESCE(t.due_date,(w.due_at AT TIME ZONE o.timezone)::date,(w.requested_at AT TIME ZONE o.timezone)::date)::text operational_date,
                w.due_at::text due_at,
                CASE
                  WHEN COALESCE(t.due_date,(w.due_at AT TIME ZONE o.timezone)::date,(w.requested_at AT TIME ZONE o.timezone)::date)
                       < (now() AT TIME ZONE o.timezone)::date THEN 'overdue'
                  WHEN COALESCE(t.due_date,(w.due_at AT TIME ZONE o.timezone)::date,(w.requested_at AT TIME ZONE o.timezone)::date)
                       = (now() AT TIME ZONE o.timezone)::date THEN 'today'
                  ELSE 'future'
                END date_state
         FROM work_order_tasks t
         JOIN work_orders w ON w.id=t.work_order_id
         JOIN organizations o ON o.id=w.organization_id
         JOIN sites s ON s.id=w.site_id
         LEFT JOIN assets a ON a.id=w.asset_id
         LEFT JOIN users u ON u.id=t.assigned_to
         LEFT JOIN crews c ON c.id=t.crew_id
         LEFT JOIN suppliers sp ON sp.id=t.service_supplier_id
         WHERE t.status IN ('pending','in_progress')
           AND COALESCE(t.completed,false)=false
           AND w.status NOT IN ('completed','cancelled')
         ORDER BY
           CASE
             WHEN COALESCE(t.due_date,(w.due_at AT TIME ZONE o.timezone)::date,(w.requested_at AT TIME ZONE o.timezone)::date)
                  < (now() AT TIME ZONE o.timezone)::date THEN 0
             WHEN COALESCE(t.due_date,(w.due_at AT TIME ZONE o.timezone)::date,(w.requested_at AT TIME ZONE o.timezone)::date)
                  = (now() AT TIME ZONE o.timezone)::date THEN 1
             ELSE 2
           END,
           COALESCE(t.due_date,(w.due_at AT TIME ZONE o.timezone)::date,(w.requested_at AT TIME ZONE o.timezone)::date) ASC,
           CASE w.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
           w.number
         LIMIT 500`
      : `SELECT t.id,w.id work_order_id,w.number::text work_order_number,w.title work_order_title,
                w.type work_order_type,w.status work_order_status,
                t.description,t.notes,t.status,w.priority,w.organization_id,o.name organization_name,
                w.site_id,s.name site_name,a.name asset_name,
                t.assigned_to assigned_user_id,u.full_name assigned_user_name,
                t.crew_id,c.name crew_name,
                t.service_supplier_id,sp.name supplier_name,
                COALESCE(u.full_name,c.name,sp.name,'Sin asignar') responsible,
                COALESCE(t.due_date,(w.due_at AT TIME ZONE o.timezone)::date,(w.requested_at AT TIME ZONE o.timezone)::date)::text operational_at,
                COALESCE(t.due_date,(w.due_at AT TIME ZONE o.timezone)::date,(w.requested_at AT TIME ZONE o.timezone)::date)::text operational_date,
                w.due_at::text due_at,
                CASE
                  WHEN COALESCE(t.due_date,(w.due_at AT TIME ZONE o.timezone)::date,(w.requested_at AT TIME ZONE o.timezone)::date)
                       < (now() AT TIME ZONE o.timezone)::date THEN 'overdue'
                  WHEN COALESCE(t.due_date,(w.due_at AT TIME ZONE o.timezone)::date,(w.requested_at AT TIME ZONE o.timezone)::date)
                       = (now() AT TIME ZONE o.timezone)::date THEN 'today'
                  ELSE 'future'
                END date_state
         FROM work_order_tasks t
         JOIN work_orders w ON w.id=t.work_order_id
         JOIN organizations o ON o.id=w.organization_id
         JOIN sites s ON s.id=w.site_id
         LEFT JOIN assets a ON a.id=w.asset_id
         LEFT JOIN users u ON u.id=t.assigned_to
         LEFT JOIN crews c ON c.id=t.crew_id
         LEFT JOIN suppliers sp ON sp.id=t.service_supplier_id
         WHERE t.status IN ('pending','in_progress')
           AND COALESCE(t.completed,false)=false
           AND w.status NOT IN ('completed','cancelled')
           AND w.organization_id=$1
           AND ($2::boolean OR w.site_id=ANY($3::uuid[]))
         ORDER BY
           CASE
             WHEN COALESCE(t.due_date,(w.due_at AT TIME ZONE o.timezone)::date,(w.requested_at AT TIME ZONE o.timezone)::date)
                  < (now() AT TIME ZONE o.timezone)::date THEN 0
             WHEN COALESCE(t.due_date,(w.due_at AT TIME ZONE o.timezone)::date,(w.requested_at AT TIME ZONE o.timezone)::date)
                  = (now() AT TIME ZONE o.timezone)::date THEN 1
             ELSE 2
           END,
           COALESCE(t.due_date,(w.due_at AT TIME ZONE o.timezone)::date,(w.requested_at AT TIME ZONE o.timezone)::date) ASC,
           CASE w.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
           w.number
         LIMIT 500`,
    global?[]:[organizationId,session.accessAllSites,session.siteIds],
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
        legalName:company.legal_name,
        taxId:company.tax_id,
        phone:company.phone?e164Phone(company.contact_country,nationalPhonePart(company.phone,company.contact_country)):null,
        adminEmail:company.admin_email,
        website:company.website,
        primaryContactName:company.primary_contact_name,
        primaryContactPhone:company.primary_contact_phone
          ? e164Phone(company.contact_country,nationalPhonePart(company.primary_contact_phone,company.contact_country))
          : null,
        primaryContactEmail:company.primary_contact_email,
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
        code:site.code,
        address:site.address,
        city:site.city,
        country:site.country,
        contactName:site.contact_name,
        contactPhone:site.contact_phone?e164Phone(site.country,nationalPhonePart(site.contact_phone,site.country)):null,
        contactEmail:site.contact_email,
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
      email:tech.email,
      phone:tech.phone?e164Phone(tech.organization_country,nationalPhonePart(tech.phone,tech.organization_country)):null,
      country:tech.organization_country,
      role:tech.role,
      organizationId:tech.organization_id,
      organizationName:tech.organization_name,
      crewIds:tech.crew_ids||[],
      lat:Number(tech.latitude),
      lng:Number(tech.longitude),
      accuracy:tech.accuracy_m===null?null:Number(tech.accuracy_m),
      lastSeenAt:tech.last_seen_at,
      telemetryState:tech.live?"live":"paused",
      avatarUrl:tech.has_avatar?`/api/users/${tech.user_id}/avatar`:null,
      route:routes[tech.tracking_session_id]||[],
    })),
    activities:activities.rows.map(activity=>({
      id:activity.id,
      workOrderId:activity.work_order_id,
      workOrderNumber:activity.work_order_number,
      workOrderTitle:activity.work_order_title,
      workOrderType:activity.work_order_type,
      workOrderStatus:activity.work_order_status,
      description:activity.description,
      notes:activity.notes,
      status:activity.status,
      priority:activity.priority,
      organizationId:activity.organization_id,
      organizationName:activity.organization_name,
      siteId:activity.site_id,
      siteName:activity.site_name,
      assetName:activity.asset_name,
      assignedToUserId:activity.assigned_user_id,
      assignedUserName:activity.assigned_user_name,
      crewId:activity.crew_id,
      crewName:activity.crew_name,
      serviceSupplierId:activity.service_supplier_id,
      supplierName:activity.supplier_name,
      responsible:activity.responsible,
      operationalAt:activity.operational_at,
      operationalDate:activity.operational_date,
      dueAt:activity.due_at,
      dateState:activity.date_state,
    })),
  },{headers:{"Cache-Control":"private, no-store, max-age=0"}});
}
