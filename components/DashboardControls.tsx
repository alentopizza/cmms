"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import DashboardDateRangePicker from "@/components/DashboardDateRangePicker";

type Option={value:string;label:string};

export default function DashboardControls({
  mode,
  companyStatusOptions=[],
  activityStatusOptions=[],
}:{
  mode:"platform"|"operation"|"field"|"requester";
  companyStatusOptions?:Option[];
  activityStatusOptions?:Option[];
}){
  const router=useRouter();
  const pathname=usePathname();
  const searchParams=useSearchParams();
  const exportRef=useRef<HTMLDivElement>(null);
  const [exportOpen,setExportOpen]=useState(false);

  const month=searchParams.get("month")||new Date().toISOString().slice(0,7);
  const from=searchParams.get("from")||"";
  const to=searchParams.get("to")||"";
  const companyStatus=searchParams.get("company_status")||"all";
  const activityStatus=searchParams.get("activity_status")||"all";

  const exportQuery=useMemo(()=>{
    const params=new URLSearchParams(searchParams.toString());
    params.delete("format");
    return params.toString();
  },[searchParams]);

  useEffect(()=>{
    if(!exportOpen)return;
    const onPointer=(event:MouseEvent)=>{
      if(exportRef.current&&!exportRef.current.contains(event.target as Node))setExportOpen(false);
    };
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setExportOpen(false)};
    document.addEventListener("mousedown",onPointer);
    document.addEventListener("keydown",onKey);
    return ()=>{
      document.removeEventListener("mousedown",onPointer);
      document.removeEventListener("keydown",onKey);
    };
  },[exportOpen]);

  function apply(patch:Record<string,string>){
    const params=new URLSearchParams(searchParams.toString());
    for(const [key,value] of Object.entries(patch)){
      if(value&&value!=="all") params.set(key,value);
      else params.delete(key);
    }
    router.replace(pathname+(params.size?"?"+params.toString():""),{scroll:false});
  }

  function clear(){
    router.replace(pathname,{scroll:false});
  }

  const base="/api/dashboard/export";
  const suffix=exportQuery?"&"+exportQuery:"";
  const href=(format:"xlsx"|"csv"|"pdf")=>base+"?format="+format+suffix;

  return <section className="dashboard-filterbar">
    <div className="dashboard-filter-group">
      <DashboardDateRangePicker
        initialFrom={from}
        initialTo={to}
        initialMonth={month}
        onApply={({from:nextFrom,to:nextTo})=>apply({from:nextFrom,to:nextTo,month:""})}
      />
      {mode==="platform"&&companyStatusOptions.length>0&&<label><span>Empresa</span><select value={companyStatus} onChange={event=>apply({company_status:event.target.value})}><option value="all">Todas</option>{companyStatusOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>}
      {activityStatusOptions.length>0&&<label><span>{mode==="platform"?"Suscripción":mode==="field"?"Actividad":"Estado"}</span><select value={activityStatus} onChange={event=>apply({activity_status:event.target.value})}><option value="all">Todos</option>{activityStatusOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>}
      <button className="text-button dashboard-clear-filters" type="button" onClick={clear}>Limpiar</button>
    </div>
    <div className="dashboard-export-menu" ref={exportRef}>
      <button className="button dashboard-export-trigger" type="button" onClick={()=>setExportOpen(value=>!value)} aria-expanded={exportOpen}>
        <span>Exportar</span><span aria-hidden="true">⌄</span>
      </button>
      {exportOpen&&<div className="dashboard-export-popover">
        <a href={href("xlsx")} onClick={()=>setExportOpen(false)}>
          <span className="dashboard-export-format-icon">XLS</span>
          <span><strong>Excel</strong><small>Libro .xlsx con resumen y datos</small></span>
        </a>
        <a href={href("csv")} onClick={()=>setExportOpen(false)}>
          <span className="dashboard-export-format-icon">CSV</span>
          <span><strong>CSV</strong><small>Datos tabulares · compatible con Power BI</small></span>
        </a>
        <a href={href("pdf")} onClick={()=>setExportOpen(false)}>
          <span className="dashboard-export-format-icon">PDF</span>
          <span><strong>PDF</strong><small>Reporte ejecutivo con gráficas y membrete</small></span>
        </a>
      </div>}
    </div>
  </section>;
}
