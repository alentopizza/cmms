import {
  KpiCard,
  MetricGrid,
  StatTiles,
  type KpiDirection,
  type KpiTone,
} from "@/components/ui-kit/Metrics";
import { LineChart, type LineChartSeries } from "@/components/ui-kit/Charts";
import type { UiIconName } from "@/components/UiIcon";

export type DashboardKpiTone=Exclude<KpiTone,"info">;
export type DashboardKpiDirection=KpiDirection;

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

export type DashboardTrendSeries=LineChartSeries;

export function DashboardKpis({cards}:{cards:DashboardKpiCard[]}){
  return <MetricGrid className="dashboard-kpi-grid">{cards.map(card=>
    <KpiCard
      key={card.label}
      {...card}
      className="dashboard-kpi"
    />
  )}</MetricGrid>;
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

export function DashboardTrendChart({
  labels,
  series,
  emptyLabel="No hay datos suficientes para construir la tendencia.",
}:{
  labels:string[];
  series:DashboardTrendSeries[];
  emptyLabel?:string;
}){
  return <LineChart labels={labels} series={series} emptyLabel={emptyLabel} ariaLabel="Tendencia mensual" className="dashboard-trend"/>;
}

export function DashboardStatTiles({
  items,
}:{
  items:Array<{label:string;value:string;hint:string;tone?:"default"|"success"|"warning"|"danger"}>;
}){
  return <StatTiles items={items} className="dashboard-stat-tiles"/>;
}
