import {
  DEFAULT_BUSINESS_HOURS,
  businessHoursFromSchedule,
  businessScheduleWeeklyMinutes,
  type BusinessDaySchedule,
  type BusinessHours,
} from "@/lib/business-hours";

export const ATTENDANCE_SCHEDULE_SOURCES = ["organization","site","custom"] as const;
export type AttendanceScheduleSource = typeof ATTENDANCE_SCHEDULE_SOURCES[number];

export type AttendanceScheduleRecord = {
  id:string;
  organization_id:string;
  user_id:string;
  base_site_id:string;
  base_site_name:string;
  schedule_source:AttendanceScheduleSource;
  source_site_id:string|null;
  source_site_name:string|null;
  business_schedule:BusinessDaySchedule[];
  timezone:string;
  effective_from:string;
  effective_until:string|null;
  notes:string|null;
  created_at:string;
  updated_at:string;
};

const DATE=/^\d{4}-\d{2}-\d{2}$/;

export class AttendanceScheduleValidationError extends Error {
  code:"schedule"|"effective-date"|"overlap";
  constructor(code:"schedule"|"effective-date"|"overlap",message:string){
    super(message);
    this.name="AttendanceScheduleValidationError";
    this.code=code;
  }
}

export function normalizeAttendanceSchedule(value:unknown,fallback:BusinessHours=DEFAULT_BUSINESS_HOURS){
  try{
    return businessHoursFromSchedule(value,fallback);
  }catch(error){
    const message=error instanceof Error?error.message:"El horario individual no es válido.";
    throw new AttendanceScheduleValidationError("schedule",message);
  }
}

export function attendanceScheduleWeeklyHours(schedule:BusinessDaySchedule[]){
  return businessScheduleWeeklyMinutes(schedule)/60;
}

export function validIsoDate(value:unknown){
  const text=typeof value==="string"?value.trim():"";
  if(!DATE.test(text))return null;
  const parsed=new Date(text+"T12:00:00Z");
  return Number.isFinite(parsed.getTime())?text:null;
}

export function organizationLocalDate(timezone:string,at=new Date()){
  try{
    const parts=new Intl.DateTimeFormat("en-CA",{
      timeZone:timezone||"America/Bogota",
      year:"numeric",
      month:"2-digit",
      day:"2-digit",
    }).formatToParts(at);
    const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }catch{
    return at.toISOString().slice(0,10);
  }
}

export function weekdayForLocalDate(date:string,timezone:string){
  try{
    const instant=new Date(date+"T12:00:00Z");
    const weekday=new Intl.DateTimeFormat("en-US",{timeZone:timezone,weekday:"short"}).format(instant);
    return ({Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7} as Record<string,number>)[weekday]||0;
  }catch{
    return 0;
  }
}

export function scheduleDayForDate(schedule:BusinessDaySchedule[],date:string,timezone:string){
  const day=weekdayForLocalDate(date,timezone);
  return schedule.find(item=>item.day===day)||null;
}

export function rangesOverlap(
  leftStart:string,
  leftEnd:string|null,
  rightStart:string,
  rightEnd:string|null,
){
  const max="9999-12-31";
  return leftStart<=(rightEnd||max)&&rightStart<=(leftEnd||max);
}

export function scheduleStatus(
  effectiveFrom:string,
  effectiveUntil:string|null,
  today:string,
){
  if(effectiveFrom>today)return "upcoming" as const;
  if(effectiveUntil&&effectiveUntil<today)return "past" as const;
  return "current" as const;
}
