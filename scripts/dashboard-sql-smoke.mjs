import pg from "pg";

const { Client } = pg;
const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error("DATABASE_URL is required");

const client=new Client({connectionString:databaseUrl});
await client.connect();

const org="00000000-0000-4000-8000-000000000001";
const start="2026-09-01";
const end="2026-10-01";
const trendStart="2026-04-01";
const trendEnd="2026-10-01";

const checks=[
  ["operation-open",
    "SELECT count(*)::text count FROM work_orders w WHERE w.organization_id=$1 AND w.created_at >= $2::date AND w.created_at < $3::date AND w.status IN ('open','assigned','in_progress','paused')",
    [org,start,end]],
  ["operation-completed",
    "SELECT count(*)::text count FROM work_orders w WHERE w.organization_id=$1 AND w.completed_at >= $2::date AND w.completed_at < $3::date AND w.status='completed'",
    [org,start,end]],
  ["operation-late",
    "SELECT count(*)::text count FROM work_orders w WHERE w.organization_id=$1 AND w.due_at >= $2::date AND w.due_at < $3::date AND w.due_at<now() AND w.status NOT IN ('completed','cancelled')",
    [org,start,end]],
  ["operation-impact",
    "SELECT COALESCE(sum(w.labor_cost+w.parts_cost+w.external_cost),0)::text cost,COALESCE(sum(w.downtime_minutes),0)::text downtime FROM work_orders w WHERE w.organization_id=$1 AND w.created_at >= $2::date AND w.created_at < $3::date",
    [org,start,end]],
  ["operation-preventive",
    "SELECT count(*)::text count FROM work_orders w WHERE w.organization_id=$1 AND w.created_at >= $2::date AND w.created_at < $3::date AND w.type='preventive'",
    [org,start,end]],
  ["operation-trend-created",
    "SELECT to_char(date_trunc('month',w.created_at),'YYYY-MM') AS \"month\",count(*)::text count FROM work_orders w WHERE w.organization_id=$1 AND w.created_at >= $2::date AND w.created_at < $3::date GROUP BY 1 ORDER BY 1",
    [org,trendStart,trendEnd]],
  ["operation-trend-completed",
    "SELECT to_char(date_trunc('month',w.completed_at),'YYYY-MM') AS \"month\",count(*)::text count FROM work_orders w WHERE w.organization_id=$1 AND w.status='completed' AND w.completed_at >= $2::date AND w.completed_at < $3::date GROUP BY 1 ORDER BY 1",
    [org,trendStart,trendEnd]],
  ["platform-trend-companies",
    "SELECT to_char(date_trunc('month',o.created_at),'YYYY-MM') AS \"month\",count(*)::text count FROM organizations o WHERE o.created_at >= $1::date AND o.created_at < $2::date GROUP BY 1 ORDER BY 1",
    [trendStart,trendEnd]],
  ["platform-trend-subscriptions",
    "SELECT to_char(date_trunc('month',s.created_at),'YYYY-MM') AS \"month\",count(*)::text count FROM organization_subscriptions s WHERE s.created_at >= $1::date AND s.created_at < $2::date GROUP BY 1 ORDER BY 1",
    [trendStart,trendEnd]],
  ["platform-trend-leads",
    "SELECT to_char(date_trunc('month',created_at),'YYYY-MM') AS \"month\",count(*)::text count FROM sales_leads WHERE created_at >= $1::date AND created_at < $2::date GROUP BY 1 ORDER BY 1",
    [trendStart,trendEnd]],
  ["field-trend-activities",
    "SELECT to_char(date_trunc('month',COALESCE(t.completed_at,t.started_at,w.updated_at)),'YYYY-MM') AS \"month\",count(*)::text count FROM work_order_tasks t JOIN work_orders w ON w.id=t.work_order_id WHERE t.organization_id=$1 AND COALESCE(t.completed_at,t.started_at,w.updated_at) >= $2::date AND COALESCE(t.completed_at,t.started_at,w.updated_at) < $3::date GROUP BY 1 ORDER BY 1",
    [org,trendStart,trendEnd]],
  ["requester-trend-created",
    "SELECT to_char(date_trunc('month',w.requested_at),'YYYY-MM') AS \"month\",count(*)::text count FROM work_orders w WHERE w.organization_id=$1 AND w.requested_at >= $2::date AND w.requested_at < $3::date GROUP BY 1 ORDER BY 1",
    [org,trendStart,trendEnd]],
  ["requester-trend-completed",
    "SELECT to_char(date_trunc('month',w.completed_at),'YYYY-MM') AS \"month\",count(*)::text count FROM work_orders w WHERE w.organization_id=$1 AND w.status='completed' AND w.completed_at >= $2::date AND w.completed_at < $3::date GROUP BY 1 ORDER BY 1",
    [org,trendStart,trendEnd]],
  ["operation-assets",
    "SELECT count(*)::text count FROM assets a WHERE a.organization_id=$1 AND a.status<>'retired'",
    [org]],
  ["operation-stock",
    "SELECT count(*)::text count FROM inventory_items WHERE organization_id=$1 AND active=true AND quantity<=min_quantity",
    [org]],
  ["operation-workforce",
    "SELECT count(*)::text count FROM organization_members om JOIN users u ON u.id=om.user_id WHERE om.organization_id=$1 AND u.active=true AND om.role IN ('manager','technician','external')",
    [org]],
  ["operation-status-distribution",
    "SELECT w.status,count(*)::text count FROM work_orders w WHERE w.organization_id=$1 AND w.created_at >= $2::date AND w.created_at < $3::date GROUP BY w.status ORDER BY count(*) DESC",
    [org,start,end]],
  ["operation-type-distribution",
    "SELECT w.type,count(*)::text count FROM work_orders w WHERE w.organization_id=$1 AND w.created_at >= $2::date AND w.created_at < $3::date GROUP BY w.type ORDER BY count(*) DESC",
    [org,start,end]],
  ["operation-site-distribution",
    "SELECT s.name site,count(*)::text count FROM work_orders w JOIN sites s ON s.id=w.site_id WHERE w.organization_id=$1 AND w.created_at >= $2::date AND w.created_at < $3::date GROUP BY s.name ORDER BY count(*) DESC LIMIT 6",
    [org,start,end]],
  ["operation-recent",
    "SELECT w.id,w.number::text,w.title,w.status,w.priority,a.name asset FROM work_orders w LEFT JOIN assets a ON a.id=w.asset_id WHERE w.organization_id=$1 AND w.created_at >= $2::date AND w.created_at < $3::date ORDER BY w.updated_at DESC LIMIT 10",
    [org,start,end]],
];

try{
  for(const [name,sql,params] of checks){
    await client.query(sql,params);
    console.log("Dashboard SQL OK:",name);
  }
  console.log("Dashboard SQL smoke checks passed.");
}finally{
  await client.end();
}
