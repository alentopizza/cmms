import Link from "next/link";
import UiIcon, { type UiIconName } from "@/components/UiIcon";

export type KpiTone="default"|"success"|"warning"|"danger"|"info";
export type KpiDirection="higher-better"|"lower-better"|"neutral";

function delta(current:number,previous:number){
  if(previous===0)return current===0?0:null;
  return ((current-previous)/Math.abs(previous))*100;
}
function changeClass(value:number|null,direction:KpiDirection){
  if(value===null||value===0||direction==="neutral")return "neutral";
  const improves=direction==="higher-better"?value>0:value<0;
  return improves?"positive":"negative";
}
function Sparkline({previous,current}:{previous:number;current:number}){
  const max=Math.max(previous,current,1);
  const y1=20-(previous/max)*13;
  const y2=20-(current/max)*13;
  return <svg className="ds-kpi-spark" viewBox="0 0 76 24" role="img" aria-label={"Tendencia de "+String(previous)+" a "+String(current)}>
    <path className="ds-kpi-spark-grid" d="M2 20H74"/>
    <path className="ds-kpi-spark-line" d={"M4 "+y1.toFixed(1)+" L72 "+y2.toFixed(1)}/>
    <circle cx="4" cy={y1} r="2.5"/><circle cx="72" cy={y2} r="2.5"/>
  </svg>;
}

export type KpiCardProps={
  label:string;
  value:string;
  hint?:string;
  icon?:UiIconName;
  tone?:KpiTone;
  href?:string;
  current?:number;
  previous?:number;
  comparisonLabel?:string;
  direction?:KpiDirection;
  className?:string;
};

function KpiBody({label,value,hint,icon,tone="default",current,previous,comparisonLabel,direction="neutral",className=""}:KpiCardProps){
  const hasComparison=typeof current==="number"&&typeof previous==="number";
  const change=hasComparison?delta(current!,previous!):null;
  return <article className={["ds-kpi-card","ds-kpi-"+tone,className].filter(Boolean).join(" ")}>
    <div className="ds-kpi-topline">
      {icon&&<div className="ds-kpi-icon"><UiIcon name={icon} size={20}/></div>}
      {hasComparison&&<span className={"ds-kpi-change "+changeClass(change,direction)}>
        {change===null?"Nuevo":(change>=0?"+":"")+Math.round(change)+"%"}
      </span>}
    </div>
    <div className="ds-kpi-copy"><span>{label}</span><strong>{value}</strong>{hint&&<small>{hint}</small>}</div>
    {hasComparison&&<div className="ds-kpi-trend"><Sparkline previous={previous!} current={current!}/><small>{comparisonLabel||"vs. periodo anterior"}</small></div>}
  </article>;
}

export function KpiCard(props:KpiCardProps){
  return props.href?<Link href={props.href} className="ds-kpi-link"><KpiBody {...props}/></Link>:<KpiBody {...props}/>;
}

export function MetricGrid({children,className=""}:{children:React.ReactNode;className?:string}){
  return <section className={["ds-metric-grid",className].filter(Boolean).join(" ")}>{children}</section>;
}

export function StatTiles({
  items,
  className="",
}:{
  items:Array<{label:string;value:string;hint?:string;tone?:KpiTone}>;
  className?:string;
}){
  return <div className={["ds-stat-tiles",className].filter(Boolean).join(" ")}>{items.map(item=><div className={"ds-stat-tile ds-stat-"+(item.tone||"default")} key={item.label}>
    <span>{item.label}</span><strong>{item.value}</strong>{item.hint&&<small>{item.hint}</small>}
  </div>)}</div>;
}
