export type LineChartSeries={name:string;values:number[]};

function pointPath(values:number[],max:number,width:number,height:number){
  if(!values.length)return "";
  const step=values.length>1?width/(values.length-1):width;
  return values.map((value,index)=>{
    const x=values.length>1?index*step:width/2;
    const y=height-(value/max)*height;
    return (index===0?"M":"L")+x.toFixed(1)+" "+y.toFixed(1);
  }).join(" ");
}

export function LineChart({
  labels,
  series,
  emptyLabel="No hay datos suficientes para construir la tendencia.",
  ariaLabel="Tendencia",
  className="",
}:{
  labels:string[];
  series:LineChartSeries[];
  emptyLabel?:string;
  ariaLabel?:string;
  className?:string;
}){
  const all=series.flatMap(item=>item.values);
  const max=Math.max(...all,0);
  if(!labels.length||!series.length||max===0)return <div className="ds-chart-empty">{emptyLabel}</div>;
  const width=640,height=190;
  return <div className={["ds-line-chart",className].filter(Boolean).join(" ")}>
    <div className="ds-line-chart-legend">{series.map((item,index)=><span key={item.name} className={"ds-chart-series-"+(index%10)}><i/>{item.name}</span>)}</div>
    <div className="ds-line-chart-plot">
      <svg viewBox={"0 0 "+width+" "+height} preserveAspectRatio="none" role="img" aria-label={ariaLabel}>
        {[0,.25,.5,.75,1].map(level=><line key={level} x1="0" y1={height*level} x2={width} y2={height*level} className="ds-line-chart-gridline"/>)}
        {series.map((item,index)=><path key={item.name} d={pointPath(item.values,max,width,height-12)} className={"ds-line-chart-series ds-chart-series-"+(index%10)}/>)}
      </svg>
      <div className="ds-line-chart-labels" style={{gridTemplateColumns:"repeat("+Math.max(labels.length,1)+",minmax(0,1fr))"}}>{labels.map((label,index)=><span key={label+index}>{label}</span>)}</div>
    </div>
    <div className="ds-line-chart-values">{series.map((item,index)=><div key={item.name} className={"ds-chart-series-"+(index%10)}><span>{item.name}</span><strong>{item.values[item.values.length-1]||0}</strong><small>último punto</small></div>)}</div>
  </div>;
}
