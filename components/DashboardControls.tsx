"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import DashboardDateRangePicker from "@/components/DashboardDateRangePicker";
import UiIcon from "@/components/UiIcon";
import { Button } from "@/components/ui-kit/Button";
import { Select } from "@/components/ui-kit/FormControls";

type Option={value:string;label:string};

export default function DashboardControls({
  mode,
  companyStatusOptions=[],
  activityStatusOptions=[],
  siteOptions=[],
  priorityOptions=[],
}:{
  mode:"platform"|"operation"|"field"|"requester";
  companyStatusOptions?:Option[];
  activityStatusOptions?:Option[];
  siteOptions?:Option[];
  priorityOptions?:Option[];
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
  const siteId=searchParams.get("site_id")||"all";
  const priority=searchParams.get("priority")||"all";
  const compare=searchParams.get("compare")||"previous_period";

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

  return <section className={`dashboard-filterbar${exportOpen ? " export-open" : ""}`}>
    <div className="dashboard-filter-group">
      <DashboardDateRangePicker
        initialFrom={from}
        initialTo={to}
        initialMonth={month}
        onApply={({from:nextFrom,to:nextTo})=>apply({from:nextFrom,to:nextTo,month:""})}
      />
      {mode==="platform"&&companyStatusOptions.length>0&&<Select
        label="Empresa"
        value={companyStatus}
        onChange={event=>apply({company_status:event.target.value})}
        placeholder=""
        options={[{value:"all",label:"Todas"},...companyStatusOptions]}
      />}
      {siteOptions.length>0&&<Select
        label="Sede"
        value={siteId}
        onChange={event=>apply({site_id:event.target.value})}
        placeholder=""
        options={[{value:"all",label:"Todas"},...siteOptions]}
      />}
      {activityStatusOptions.length>0&&<Select
        label={mode==="platform"?"Suscripción":mode==="field"?"Actividad":"Estado"}
        value={activityStatus}
        onChange={event=>apply({activity_status:event.target.value})}
        placeholder=""
        options={[{value:"all",label:"Todos"},...activityStatusOptions]}
      />}
      {priorityOptions.length>0&&<Select
        label="Prioridad"
        value={priority}
        onChange={event=>apply({priority:event.target.value})}
        placeholder=""
        options={[{value:"all",label:"Todas"},...priorityOptions]}
      />}
      <Select
        label="Comparar con"
        value={compare}
        onChange={event=>apply({compare:event.target.value})}
        placeholder=""
        options={[{value:"previous_period",label:"Periodo anterior"},{value:"previous_year",label:"Mismo periodo año anterior"}]}
      />
      <Button className="dashboard-clear-filters" variant="ghost" size="sm" onClick={clear}>Limpiar</Button>
    </div>
    <div className="dashboard-export-menu" ref={exportRef}>
      <Button className="dashboard-export-trigger" onClick={()=>setExportOpen(value=>!value)} aria-expanded={exportOpen} aria-haspopup="menu" iconLeft="download" iconRight={exportOpen?"chevron-up":"chevron-down"}>
        Exportar
      </Button>
      {exportOpen&&<div className="dashboard-export-popover" role="menu" aria-label="Formatos de exportación">
        <a role="menuitem" href={href("xlsx")} onClick={()=>setExportOpen(false)}>
          <span className="dashboard-export-format-icon"><UiIcon name="file" size={17}/></span>
          <span><strong>Excel</strong><small>Libro .xlsx con resumen y datos</small></span>
        </a>
        <a role="menuitem" href={href("csv")} onClick={()=>setExportOpen(false)}>
          <span className="dashboard-export-format-icon"><UiIcon name="file" size={17}/></span>
          <span><strong>CSV</strong><small>Datos tabulares · compatible con Power BI</small></span>
        </a>
        <a role="menuitem" href={href("pdf")} onClick={()=>setExportOpen(false)}>
          <span className="dashboard-export-format-icon"><UiIcon name="file" size={17}/></span>
          <span><strong>PDF</strong><small>Reporte ejecutivo con gráficas y membrete</small></span>
        </a>
      </div>}
    </div>
  </section>;
}
