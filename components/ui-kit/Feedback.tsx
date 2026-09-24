import type { ReactNode } from "react";
import UiIcon from "@/components/UiIcon";
import { Button } from "@/components/ui-kit/Button";

export type FeedbackVariant="success"|"warning"|"danger"|"info";

const icons:Record<FeedbackVariant,"check"|"warning"|"error"|"info">={
  success:"check",warning:"warning",danger:"error",info:"info",
};

export function Alert({variant="info",title,children}:{variant?:FeedbackVariant;title?:string;children:ReactNode}){
  return <div className={["ds-alert","ds-alert-"+variant].join(" ")} role={variant==="danger"?"alert":"status"}>
    <UiIcon name={icons[variant]} size={18}/>
    <div>{title&&<strong>{title}</strong>}<div>{children}</div></div>
  </div>;
}

export function Toast({variant="info",title,message,onClose}:{variant?:FeedbackVariant;title?:string;message:string;onClose?:()=>void}){
  return <div className={["ds-toast","ds-toast-"+variant].join(" ")} role={variant==="danger"?"alert":"status"}>
    <UiIcon name={icons[variant]} size={17}/>
    <div>{title&&<strong>{title}</strong>}<span>{message}</span></div>
    {onClose&&<button type="button" onClick={onClose} aria-label="Cerrar notificación"><UiIcon name="x" size={14}/></button>}
  </div>;
}

export function EmptyState({icon="info",title,description,action}:{icon?:"info"|"file"|"asset";title:string;description:string;action?:ReactNode}){
  return <div className="ds-empty-state">
    <span className="ds-empty-icon" aria-hidden="true"><UiIcon name={icon} size={24}/></span>
    <h3>{title}</h3><p>{description}</p>{action&&<div>{action}</div>}
  </div>;
}

export function Spinner({label="Cargando",size="md"}:{label?:string;size?:"sm"|"md"|"lg"}){
  return <span className="ds-loading-inline" role="status"><span className={["ds-spinner","ds-spinner-"+size].join(" ")} aria-hidden="true"/><span>{label}</span></span>;
}

export function Skeleton({width="100%",height=16,radius="md"}:{width?:string|number;height?:number;radius?:"sm"|"md"|"lg"}){
  return <span className={["ds-skeleton","ds-skeleton-"+radius].join(" ")} style={{width,height}} aria-hidden="true"/>;
}

export function LoadingCard(){
  return <div className="ds-loading-card" aria-label="Cargando contenido">
    <Skeleton width="42%" height={14}/><Skeleton height={24}/><Skeleton height={14}/><Skeleton width="70%" height={14}/>
  </div>;
}

export function LoadingTable({rows=4}:{rows?:number}){
  return <div className="ds-loading-table" aria-label="Cargando tabla">
    <div className="ds-loading-table-row ds-loading-table-head"><Skeleton width="34%" height={12}/><Skeleton width="24%" height={12}/><Skeleton width="20%" height={12}/></div>
    {Array.from({length:rows},(_,index)=><div className="ds-loading-table-row" key={index}>
      <Skeleton width="58%" height={14}/><Skeleton width="42%" height={14}/><Skeleton width="66%" height={14}/>
    </div>)}
  </div>;
}

export function LoadingPage({label="Cargando contenido"}:{label?:string}){
  return <div className="ds-loading-page" role="status">
    <Spinner label={label} size="lg"/>
    <div><Skeleton width="38%" height={28} radius="lg"/><Skeleton height={120} radius="lg"/><Skeleton height={120} radius="lg"/></div>
  </div>;
}

export function EmptyStateAction({children,onClick}:{children:ReactNode;onClick?:()=>void}){
  return <Button variant="secondary" onClick={onClick}>{children}</Button>;
}
