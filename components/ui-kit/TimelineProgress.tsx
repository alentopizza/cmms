import type { ReactNode } from "react";
import UiIcon, { type UiIconName } from "@/components/UiIcon";

export type ProgressTone="brand"|"success"|"warning"|"danger"|"info";

function clamp(value:number,min=0,max=100){return Math.min(max,Math.max(min,value));}

export function ProgressBar({
  value,
  max=100,
  label,
  caption,
  tone="brand",
  showValue=true,
  compact=false,
  className="",
}:{
  value:number;
  max?:number;
  label?:string;
  caption?:string;
  tone?:ProgressTone;
  showValue?:boolean;
  compact?:boolean;
  className?:string;
}){
  const percent=max>0?clamp(value/max*100):0;
  return <div className={["ds-progress","ds-progress-"+tone,compact?"ds-progress-compact":"",className].filter(Boolean).join(" ")}>
    {(label||showValue)&&<div className="ds-progress-head">{label&&<strong>{label}</strong>}{showValue&&<span>{Math.round(percent)}%</span>}</div>}
    <div className="ds-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={clamp(value,0,max)} aria-label={label||"Progreso"}>
      <span style={{width:percent+"%"}}/>
    </div>
    {caption&&<small>{caption}</small>}
  </div>;
}

export function CircularProgress({value,label,tone="brand",size=88}:{value:number;label?:string;tone?:ProgressTone;size?:number}){
  const percent=clamp(value);
  return <div className={"ds-circular-progress ds-progress-"+tone} style={{width:size,height:size}}>
    <svg viewBox="0 0 42 42" aria-hidden="true">
      <circle className="ds-circular-track" cx="21" cy="21" r="16" pathLength="100"/>
      <circle className="ds-circular-value" cx="21" cy="21" r="16" pathLength="100" strokeDasharray="100" strokeDashoffset={100-percent}/>
    </svg>
    <div><strong>{Math.round(percent)}%</strong>{label&&<small>{label}</small>}</div>
  </div>;
}

export type TimelineItem={
  id:string;
  title:string;
  description?:ReactNode;
  meta?:ReactNode;
  icon?:UiIconName;
  tone?:ProgressTone|"neutral";
};

export function Timeline({items,label="Historial"}:{items:TimelineItem[];label?:string}){
  return <ol className="ds-timeline" aria-label={label}>{items.map(item=><li key={item.id} className={"ds-timeline-"+(item.tone||"neutral")}>
    <span className="ds-timeline-marker" aria-hidden="true">{item.icon?<UiIcon name={item.icon} size={14}/>:<i/>}</span>
    <div className="ds-timeline-content">
      <div><strong>{item.title}</strong>{item.meta&&<small>{item.meta}</small>}</div>
      {item.description&&<div className="ds-timeline-description">{item.description}</div>}
    </div>
  </li>)}</ol>;
}

export function StepProgress({
  steps,
  label="Progreso del proceso",
}:{
  steps:Array<{id:string;label:string;description?:string;status:"complete"|"current"|"upcoming"}>;
  label?:string;
}){
  return <ol className="ds-step-progress" aria-label={label}>{steps.map((step,index)=><li key={step.id} className={"ds-step-"+step.status} aria-current={step.status==="current"?"step":undefined}>
    <span className="ds-step-marker">{step.status==="complete"?<UiIcon name="check" size={13}/>:index+1}</span>
    <div><strong>{step.label}</strong>{step.description&&<small>{step.description}</small>}</div>
  </li>)}</ol>;
}
