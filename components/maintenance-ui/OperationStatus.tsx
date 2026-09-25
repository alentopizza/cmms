import { Badge, type BadgeVariant } from "@/components/ui-kit/Badge";

export function workOrderStatusLabel(status:string){
  return ({open:"Abierta",assigned:"Asignada",in_progress:"En progreso",paused:"Pausada",completed:"Completada",cancelled:"Cancelada"} as Record<string,string>)[status]||status.replaceAll("_"," ");
}
export function activityStatusLabel(status:string){
  return ({pending:"Pendiente",in_progress:"En ejecución",completed:"Completada",cancelled:"Cancelada"} as Record<string,string>)[status]||status.replaceAll("_"," ");
}
export function priorityLabel(priority:string){
  return ({low:"Baja",medium:"Media",high:"Alta",urgent:"Urgente"} as Record<string,string>)[priority]||priority;
}
export function operationStatusTone(status:string):BadgeVariant{
  if(status==="completed")return "success";
  if(status==="cancelled")return "neutral";
  if(status==="paused")return "warning";
  if(status==="assigned"||status==="in_progress")return "info";
  if(status==="open"||status==="pending")return "brand";
  return "neutral";
}
export function priorityTone(priority:string):BadgeVariant{
  if(priority==="urgent")return "danger";
  if(priority==="high")return "warning";
  if(priority==="medium")return "info";
  return "neutral";
}
export function WorkOrderStatusBadge({status}:{status:string}){
  return <Badge variant={operationStatusTone(status)} icon={status==="completed"?"check":status==="paused"?"clock":status==="cancelled"?"x":"work-order"}>{workOrderStatusLabel(status)}</Badge>;
}
export function ActivityStatusBadge({status}:{status:string}){
  return <Badge variant={operationStatusTone(status)} icon={status==="completed"?"check":status==="in_progress"?"activity":status==="cancelled"?"x":"clock"}>{activityStatusLabel(status)}</Badge>;
}
export function PriorityBadge({priority}:{priority:string}){
  return <Badge variant={priorityTone(priority)} icon={priority==="urgent"||priority==="high"?"warning":undefined}>{priorityLabel(priority)}</Badge>;
}
