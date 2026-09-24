export type DashboardFilterInput = {
  month?: string;
  from?: string;
  to?: string;
  company_status?: string;
  activity_status?: string;
  site_id?: string;
  priority?: string;
  compare?: string;
};

export type DashboardFilters = {
  month: string;
  from: string;
  to: string;
  companyStatus: "all" | "active" | "inactive";
  activityStatus: string;
  siteId: string;
  priority: "all" | "low" | "medium" | "high" | "urgent";
  compare: "previous_period" | "previous_year";
  startDate: string;
  endDateExclusive: string;
  comparisonStartDate: string;
  comparisonEndDateExclusive: string;
  label: string;
  comparisonLabel: string;
  query: string;
};

const MONTH=/^\d{4}-(0[1-9]|1[0-2])$/;
const DATE=/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVITY_STATUSES=new Set([
  "all","active","trialing","trial_expired","past_due","suspended","canceled",
  "open","assigned","in_progress","paused","completed","cancelled",
  "pending",
]);
const PRIORITIES=new Set(["all","low","medium","high","urgent"]);

function isoDate(date:Date){
  return date.toISOString().slice(0,10);
}
function utcDate(value:string){
  const [year,month,day]=value.split("-").map(Number);
  return new Date(Date.UTC(year,month-1,day));
}
function currentMonth(){
  const now=new Date();
  return now.toISOString().slice(0,7);
}
function monthStart(month:string){
  return month+"-01";
}
function nextMonth(month:string){
  const [year,mon]=month.split("-").map(Number);
  return isoDate(new Date(Date.UTC(year,mon,1)));
}
function addDay(date:string){
  const value=utcDate(date);
  value.setUTCDate(value.getUTCDate()+1);
  return isoDate(value);
}
function monthLabel(month:string){
  const [year,mon]=month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(year,mon-1,1)));
}
function rangeLabel(start:string,endExclusive:string){
  const end=new Date(utcDate(endExclusive).getTime()-86400000);
  const formatter=new Intl.DateTimeFormat("es-CO",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"});
  return formatter.format(utcDate(start))+" → "+formatter.format(end);
}
function previousRange(start:string,endExclusive:string,mode:"previous_period"|"previous_year"){
  const startDate=utcDate(start);
  const endDate=utcDate(endExclusive);
  if(mode==="previous_year"){
    const comparisonStart=new Date(startDate);
    const comparisonEnd=new Date(endDate);
    comparisonStart.setUTCFullYear(comparisonStart.getUTCFullYear()-1);
    comparisonEnd.setUTCFullYear(comparisonEnd.getUTCFullYear()-1);
    return {start:isoDate(comparisonStart),end:isoDate(comparisonEnd)};
  }
  const duration=Math.max(86400000,endDate.getTime()-startDate.getTime());
  return {
    start:isoDate(new Date(startDate.getTime()-duration)),
    end:isoDate(startDate),
  };
}

export function parseDashboardFilters(input:DashboardFilterInput):DashboardFilters {
  const month=MONTH.test(String(input.month||"")) ? String(input.month) : currentMonth();
  const from=DATE.test(String(input.from||"")) ? String(input.from) : "";
  const to=DATE.test(String(input.to||"")) ? String(input.to) : "";
  const companyStatus=input.company_status==="active"||input.company_status==="inactive" ? input.company_status : "all";
  const activityStatus=ACTIVITY_STATUSES.has(String(input.activity_status||"")) ? String(input.activity_status) : "all";
  const siteId=UUID.test(String(input.site_id||"")) ? String(input.site_id) : "";
  const priority=PRIORITIES.has(String(input.priority||"")) ? String(input.priority) as DashboardFilters["priority"] : "all";
  const compare=input.compare==="previous_year" ? "previous_year" : "previous_period";

  let startDate=from || monthStart(month);
  let endDateExclusive=to ? addDay(to) : nextMonth(month);
  if(startDate>=endDateExclusive){
    startDate=monthStart(month);
    endDateExclusive=nextMonth(month);
  }

  const comparison=previousRange(startDate,endDateExclusive,compare);
  const label=(from||to)
    ? rangeLabel(startDate,endDateExclusive)
    : monthLabel(month);
  const comparisonLabel=(compare==="previous_year"?"Mismo periodo del año anterior · ":"Periodo anterior · ")+rangeLabel(comparison.start,comparison.end);

  const params=new URLSearchParams();
  params.set("month",month);
  if(from) params.set("from",from);
  if(to) params.set("to",to);
  if(companyStatus!=="all") params.set("company_status",companyStatus);
  if(activityStatus!=="all") params.set("activity_status",activityStatus);
  if(siteId) params.set("site_id",siteId);
  if(priority!=="all") params.set("priority",priority);
  if(compare!=="previous_period") params.set("compare",compare);

  return {
    month,from,to,companyStatus,activityStatus,siteId,priority,compare,
    startDate,endDateExclusive,
    comparisonStartDate:comparison.start,
    comparisonEndDateExclusive:comparison.end,
    label,comparisonLabel,query:params.toString(),
  };
}

export function comparisonFilters(filters:DashboardFilters):DashboardFilters{
  return {
    ...filters,
    startDate:filters.comparisonStartDate,
    endDateExclusive:filters.comparisonEndDateExclusive,
    label:filters.comparisonLabel,
  };
}

export function appendPeriod(params:unknown[],column:string,filters:DashboardFilters){
  const start=params.length+1;
  params.push(filters.startDate,filters.endDateExclusive);
  return `${column} >= $${start}::date AND ${column} < $${start+1}::date`;
}

export function appendValue(params:unknown[],column:string,value:string){
  const index=params.length+1;
  params.push(value);
  return `${column} = $${index}`;
}

export function appendCompanyStatus(params:unknown[],column:string,filters:DashboardFilters){
  if(filters.companyStatus==="all") return "TRUE";
  const index=params.length+1;
  params.push(filters.companyStatus==="active");
  return `${column} = $${index}`;
}

export function appendSiteFilter(params:unknown[],column:string,filters:DashboardFilters){
  if(!filters.siteId)return "";
  const index=params.length+1;
  params.push(filters.siteId);
  return ` AND ${column} = $${index}::uuid`;
}

export function appendPriorityFilter(params:unknown[],column:string,filters:DashboardFilters){
  if(filters.priority==="all")return "";
  const index=params.length+1;
  params.push(filters.priority);
  return ` AND ${column} = $${index}`;
}
