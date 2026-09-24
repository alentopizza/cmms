import Link from "next/link";
import UiIcon, { type UiIconName } from "@/components/UiIcon";

export type DashboardKpiTone="default"|"success"|"warning"|"danger";
export type DashboardKpiDirection="higher-better"|"lower-better"|"neutral";

export type DashboardKpiCard={
  label:string;
  value:string;
  hint:string;
  icon:UiIconName;
  tone?:DashboardKpiTone;
  href?:string;
  current?:number;
  previous?:number;
  comparisonLabel?:string;
  direction?:DashboardKpiDirection;
};

export type DashboardTrendSeries={
  name:string;
  values:number[];
};

function delta(current:number,previous:number){
  if(previous===0){
    if(current===0)return 0;
    return null;
  }
  return ((current-previous)/Math.abs(previous))*100;
}

function changeClass(value:number|null,direction:DashboardKpiDirection){
  if(value===null||value===0||direction==="neutral")return "neutral";
  const improves=direction==="higher-better"?value>0:value<0;
  return improves?"positive":"negative";
}

function Sparkline({previous,current}:{previous:number;current:number}){
  const max=Math.max(previous,current,1);
  const y1=20-(previous/max)*13;
  const y2=20-(current/max)*13;
  return <svg className="dashboard-kpi-spark" viewBox="0 0 76 24" role="img" aria-label={"Tendencia de "+String(previous)+" a "+String(current)}>
    <path className="dashboard-kpi-spark-grid" d="M2 20H74"/>
    <path className="dashboard-kpi-spark-line" d={"M4 "+y1.toFixed(1)+" L72 "+y2.toFixed(1)}/>
    <circle cx="4" cy={y1} r="2.5"/>
    <circle cx="72" cy={y2} r="2.5"/>
  </svg>;
}

function KpiBody({card}:{card:DashboardKpiCard}){
  const hasComparison=typeof card.current==="number"&&typeof card.previous==="number";
  const change=hasComparison?delta(card.current!,card.previous!):undefined;
  const direction=card.direction||"neutral";
  return <article className={"dashboard-kpi dashboard-kpi-"+(card.tone||"default")}>
    <div className="dashboard-kpi-topline">
      <div className="dashboard-kpi-icon"><UiIcon name={card.icon} size={20}/></div>
      {hasComparison&&<span className={"dashboard-kpi-change "+changeClass(change??null,direction)}>
        {change===null?"Nuevo":(change>=0?"+":"")+Math.round(change)+"%"}
      </span>}
    </div>
    <div className="dashboard-kpi-copy">
      <span>{card.label}</span>
      <strong>{card.value}</strong>
      <small>{card.hint}</small>
    </div>
    {hasComparison&&<div className="dashboard-kpi-trend-row">
      <Sparkline previous={card.previous!} current={card.current!}/>
      <small>{card.comparisonLabel||"vs. periodo anterior"}</small>
    </div>}
  </article>;
}

export function DashboardKpis({cards}:{cards:DashboardKpiCard[]}){
  return <section className="dashboard-kpi-grid">{cards.map(card=>
    card.href
      ?<Link className="dashboard-kpi-link" href={card.href} key={card.label}><KpiBody card={card}/></Link>
      :<KpiBody card={card} key={card.label}/>
  )}</section>;
}

export function DashboardRoleIntro({
  eyebrow,
  title,
  description,
  period,
  comparison,
}:{
  eyebrow:string;
  title:string;
  description:string;
  period:string;
  comparison:string;
}){
  return <section className="dashboard-role-intro">
    <div>
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    <div className="dashboard-period-comparison">
      <div><span>Periodo analizado</span><strong>{period}</strong></div>
      <div><span>Comparación</span><strong>{comparison}</strong></div>
    </div>
  </section>;
}

function pointPath(values:number[],max:number,width:number,height:number){
  if(!values.length)return "";
  const step=values.length>1?width/(values.length-1):width;
  return values.map((value,index)=>{
    const x=values.length>1?index*step:width/2;
    const y=height-(value/max)*height;
    return (index===0?"M":"L")+x.toFixed(1)+" "+y.toFixed(1);
  }).join(" ");
}

export function DashboardTrendChart({
  labels,
  series,
  emptyLabel="No hay datos suficientes para construir la tendencia.",
}:{
  labels:string[];
  series:DashboardTrendSeries[];
  emptyLabel?:string;
}){
  const all=series.flatMap(item=>item.values);
  const max=Math.max(...all,0);
  if(!labels.length||!series.length||max===0){
    return <div className="dashboard-trend-empty">{emptyLabel}</div>;
  }
  const width=640,height=190;
  return <div className="dashboard-trend">
    <div className="dashboard-trend-legend">{series.map((item,index)=><span key={item.name} className={"series-"+index}><i/>{item.name}</span>)}</div>
    <div className="dashboard-trend-plot">
      <svg viewBox={"0 0 "+width+" "+height} preserveAspectRatio="none" role="img" aria-label="Tendencia mensual">
        {[0,.25,.5,.75,1].map(level=><line key={level} x1="0" y1={height*level} x2={width} y2={height*level} className="dashboard-trend-gridline"/>)}
        {series.map((item,index)=><path key={item.name} d={pointPath(item.values,max,width,height-12)} className={"dashboard-trend-line series-"+index}/>)}
      </svg>
      <div className="dashboard-trend-labels">{labels.map(label=><span key={label}>{label}</span>)}</div>
    </div>
    <div className="dashboard-trend-values">{series.map((item,index)=><div key={item.name} className={"series-"+index}><span>{item.name}</span><strong>{item.values[item.values.length-1]||0}</strong><small>último mes</small></div>)}</div>
  </div>;
}

export function DashboardStatTiles({
  items,
}:{
  items:Array<{label:string;value:string;hint:string;tone?:"default"|"success"|"warning"|"danger"}>;
}){
  return <div className="dashboard-stat-tiles">{items.map(item=><div className={"dashboard-stat-tile "+(item.tone||"default")} key={item.label}>
    <span>{item.label}</span><strong>{item.value}</strong><small>{item.hint}</small>
  </div>)}</div>;
}
