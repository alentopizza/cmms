export type DashboardFilterInput = {
  month?: string;
  from?: string;
  to?: string;
  company_status?: string;
  activity_status?: string;
};

export type DashboardFilters = {
  month: string;
  from: string;
  to: string;
  companyStatus: "all" | "active" | "inactive";
  activityStatus: string;
  startDate: string;
  endDateExclusive: string;
  label: string;
  query: string;
};

const MONTH=/^\d{4}-(0[1-9]|1[0-2])$/;
const DATE=/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const ACTIVITY_STATUSES=new Set([
  "all","active","trialing","trial_expired","past_due","suspended","canceled",
  "open","assigned","in_progress","paused","completed","cancelled",
  "pending",
]);

function isoDate(date:Date){
  return date.toISOString().slice(0,10);
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
  const [year,month,day]=date.split("-").map(Number);
  return isoDate(new Date(Date.UTC(year,month-1,day+1)));
}
function monthLabel(month:string){
  const [year,mon]=month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(year,mon-1,1)));
}

export function parseDashboardFilters(input:DashboardFilterInput):DashboardFilters {
  const month=MONTH.test(String(input.month||"")) ? String(input.month) : currentMonth();
  const from=DATE.test(String(input.from||"")) ? String(input.from) : "";
  const to=DATE.test(String(input.to||"")) ? String(input.to) : "";
  const companyStatus=input.company_status==="active"||input.company_status==="inactive" ? input.company_status : "all";
  const activityStatus=ACTIVITY_STATUSES.has(String(input.activity_status||"")) ? String(input.activity_status) : "all";

  let startDate=from || monthStart(month);
  let endDateExclusive=to ? addDay(to) : nextMonth(month);
  if(startDate>=endDateExclusive){
    startDate=monthStart(month);
    endDateExclusive=nextMonth(month);
  }

  const label=(from||to)
    ? (from||monthStart(month))+" → "+(to||isoDate(new Date(Date.parse(endDateExclusive)-86400000)))
    : monthLabel(month);

  const params=new URLSearchParams();
  params.set("month",month);
  if(from) params.set("from",from);
  if(to) params.set("to",to);
  if(companyStatus!=="all") params.set("company_status",companyStatus);
  if(activityStatus!=="all") params.set("activity_status",activityStatus);

  return {month,from,to,companyStatus,activityStatus,startDate,endDateExclusive,label,query:params.toString()};
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
