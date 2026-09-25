"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import UiIcon from "@/components/UiIcon";
import { Button } from "@/components/ui-kit/Button";

type Range={from:string;to:string};

const MONTHS=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const WEEKDAYS=["L","M","X","J","V","S","D"];

function pad(value:number){return String(value).padStart(2,"0")}
function iso(date:Date){return date.getFullYear()+"-"+pad(date.getMonth()+1)+"-"+pad(date.getDate())}
function fromIso(value:string){
  const [y,m,d]=value.split("-").map(Number);
  return new Date(y,m-1,d);
}
function startOfMonth(date:Date){return new Date(date.getFullYear(),date.getMonth(),1)}
function endOfMonth(date:Date){return new Date(date.getFullYear(),date.getMonth()+1,0)}
function addMonths(date:Date,amount:number){return new Date(date.getFullYear(),date.getMonth()+amount,1)}
function addDays(date:Date,amount:number){const next=new Date(date);next.setDate(next.getDate()+amount);return next}
function mondayIndex(day:number){return day===0?6:day-1}
function labelDate(value:string){
  if(!value)return "Sin seleccionar";
  return new Intl.DateTimeFormat("es-CO",{day:"2-digit",month:"short",year:"numeric"}).format(fromIso(value));
}
function labelRange(from:string,to:string){
  if(!from&&!to)return "Seleccionar periodo";
  if(from===to)return labelDate(from);
  return labelDate(from)+" - "+labelDate(to||from);
}
function daysForMonth(month:Date){
  const first=startOfMonth(month);
  const before=mondayIndex(first.getDay());
  const start=addDays(first,-before);
  return Array.from({length:42},(_,index)=>addDays(start,index));
}
function isSameDay(a:Date,b:Date){return iso(a)===iso(b)}
function isBetween(value:Date,from:string,to:string){
  if(!from||!to)return false;
  const key=iso(value);
  return key>from&&key<to;
}

function Calendar({
  month,
  from,
  to,
  onPick,
}:{
  month:Date;
  from:string;
  to:string;
  onPick:(value:string)=>void;
}){
  const days=useMemo(()=>daysForMonth(month),[month]);
  return <div className="range-calendar">
    <strong className="range-calendar-title">{MONTHS[month.getMonth()]} {month.getFullYear()}</strong>
    <div className="range-calendar-week">{WEEKDAYS.map(day=><span key={day}>{day}</span>)}</div>
    <div className="range-calendar-grid">
      {days.map(day=>{
        const key=iso(day);
        const outside=day.getMonth()!==month.getMonth();
        const start=from===key;
        const end=to===key;
        const middle=isBetween(day,from,to);
        const today=isSameDay(day,new Date());
        return <button
          key={key}
          type="button"
          className={[
            "range-calendar-day",
            outside?"outside":"",
            middle?"in-range":"",
            start?"range-start":"",
            end?"range-end":"",
            today?"today":"",
          ].filter(Boolean).join(" ")}
          onClick={()=>onPick(key)}
          aria-label={new Intl.DateTimeFormat("es-CO",{dateStyle:"full"}).format(day)}
        >{day.getDate()}</button>;
      })}
    </div>
  </div>;
}

export default function DashboardDateRangePicker({
  initialFrom,
  initialTo,
  initialMonth,
  onApply,
}:{
  initialFrom:string;
  initialTo:string;
  initialMonth:string;
  onApply:(range:Range)=>void;
}){
  const host=useRef<HTMLDivElement>(null);
  const [open,setOpen]=useState(false);
  const defaultMonth=useMemo(()=>{
    const source=initialFrom || (initialMonth ? initialMonth+"-01" : iso(new Date()));
    return startOfMonth(fromIso(source));
  },[initialFrom,initialMonth]);
  const [viewMonth,setViewMonth]=useState(defaultMonth);
  const [from,setFrom]=useState(initialFrom||iso(startOfMonth(defaultMonth)));
  const [to,setTo]=useState(initialTo||iso(endOfMonth(defaultMonth)));

  useEffect(()=>{
    if(open)return;
    const month=initialFrom || (initialMonth ? initialMonth+"-01" : iso(new Date()));
    const base=startOfMonth(fromIso(month));
    setViewMonth(base);
    setFrom(initialFrom||iso(startOfMonth(base)));
    setTo(initialTo||iso(endOfMonth(base)));
  },[initialFrom,initialTo,initialMonth,open]);

  useEffect(()=>{
    if(!open)return;
    const handler=(event:MouseEvent)=>{
      if(host.current&&!host.current.contains(event.target as Node))setOpen(false);
    };
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false)};
    document.addEventListener("mousedown",handler);
    document.addEventListener("keydown",key);
    return ()=>{document.removeEventListener("mousedown",handler);document.removeEventListener("keydown",key)};
  },[open]);

  function pick(value:string){
    if(!from||to){
      setFrom(value);
      setTo("");
      return;
    }
    if(value<from){
      setFrom(value);
      setTo("");
      return;
    }
    setTo(value);
  }

  function preset(key:"today"|"7"|"30"|"month"|"previous"){
    const today=new Date();
    let start=today,end=today;
    if(key==="7")start=addDays(today,-6);
    if(key==="30")start=addDays(today,-29);
    if(key==="month"){start=startOfMonth(today);end=endOfMonth(today)}
    if(key==="previous"){const previous=addMonths(startOfMonth(today),-1);start=startOfMonth(previous);end=endOfMonth(previous)}
    const startKey=iso(start),endKey=iso(end);
    setFrom(startKey);setTo(endKey);setViewMonth(startOfMonth(start));
  }

  function apply(){
    const finalFrom=from;
    const finalTo=to||from;
    if(!finalFrom)return;
    onApply({from:finalFrom,to:finalTo});
    setOpen(false);
  }

  return <div className="dashboard-date-range" ref={host}>
    <button className={"dashboard-range-trigger"+(open?" active":"")} type="button" onClick={()=>setOpen(value=>!value)} aria-expanded={open} aria-haspopup="dialog">
      <span className="dashboard-range-icon" aria-hidden="true"><UiIcon name="clock" size={16}/></span>
      <span><small>Periodo</small><strong>{labelRange(initialFrom||from,initialTo||to)}</strong></span>
      <span className="dashboard-range-chevron" aria-hidden="true"><UiIcon name={open?"chevron-up":"chevron-down"} size={14}/></span>
    </button>

    {open&&<div className="dashboard-range-popover" role="dialog" aria-label="Seleccionar periodo del dashboard">
      <div className="dashboard-range-main">
        <div className="dashboard-range-inputs">
          <label><span>Desde</span><input type="date" value={from} onChange={event=>{setFrom(event.target.value);setTo("");if(event.target.value)setViewMonth(startOfMonth(fromIso(event.target.value)))}}/></label>
          <label><span>Hasta</span><input type="date" value={to} min={from||undefined} onChange={event=>setTo(event.target.value)}/></label>
        </div>
        <div className="dashboard-range-calendar-nav">
          <button type="button" onClick={()=>setViewMonth(month=>addMonths(month,-1))} aria-label="Mes anterior"><UiIcon name="chevron-left" size={15}/></button>
          <span>Selecciona el rango</span>
          <button type="button" onClick={()=>setViewMonth(month=>addMonths(month,1))} aria-label="Mes siguiente"><UiIcon name="chevron-right" size={15}/></button>
        </div>
        <div className="dashboard-range-calendars">
          <Calendar month={viewMonth} from={from} to={to} onPick={pick}/>
          <Calendar month={addMonths(viewMonth,1)} from={from} to={to} onPick={pick}/>
        </div>
      </div>
      <aside className="dashboard-range-presets">
        <div>
          <span className="eyebrow">Rangos rápidos</span>
          <button type="button" onClick={()=>preset("today")}>Hoy</button>
          <button type="button" onClick={()=>preset("7")}>Últimos 7 días</button>
          <button type="button" onClick={()=>preset("30")}>Últimos 30 días</button>
          <button type="button" onClick={()=>preset("month")}>Este mes</button>
          <button type="button" onClick={()=>preset("previous")}>Mes anterior</button>
          <button className="active" type="button">Rango personalizado</button>
        </div>
        <div className="dashboard-range-summary">
          <span>Rango seleccionado</span>
          <strong>{labelRange(from,to||from)}</strong>
        </div>
        <Button className="dashboard-range-apply" disabled={!from} onClick={apply}>Aplicar</Button>
      </aside>
    </div>}
  </div>;
}
