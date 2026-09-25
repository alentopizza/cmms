"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import UiIcon from "@/components/UiIcon";

export type TabItem={id:string;label:string;content?:ReactNode;disabled?:boolean};

export function Tabs({items,activeId,onChange,label="Secciones"}:{items:TabItem[];activeId?:string;onChange?:(id:string)=>void;label?:string}){
  const firstEnabled=useMemo(()=>items.find(item=>!item.disabled)?.id||"",[items]);
  const [internal,setInternal]=useState(activeId||firstEnabled);
  const active=activeId??internal;
  function select(id:string){
    setInternal(id);
    onChange?.(id);
  }
  return <div className="ds-tabs-wrap">
    <div className="ds-tabs" role="tablist" aria-label={label}>
      {items.map(item=><button
        type="button"
        role="tab"
        key={item.id}
        aria-selected={active===item.id}
        disabled={item.disabled}
        className={active===item.id?"active":""}
        onClick={()=>select(item.id)}
      >{item.label}</button>)}
    </div>
    {items.some(item=>item.content!==undefined)&&<div className="ds-tab-panel" role="tabpanel">
      {items.find(item=>item.id===active)?.content}
    </div>}
  </div>;
}

export function Pills(props:Parameters<typeof Tabs>[0]){
  return <div className="ds-pills"><Tabs {...props}/></div>;
}

export function SegmentedControl({items,value,onChange,label="Opciones"}:{items:Array<{value:string;label:string;disabled?:boolean}>;value:string;onChange:(value:string)=>void;label?:string}){
  return <div className="ds-segmented" role="group" aria-label={label}>
    {items.map(item=><button
      type="button"
      key={item.value}
      className={value===item.value?"active":""}
      aria-pressed={value===item.value}
      disabled={item.disabled}
      onClick={()=>onChange(item.value)}
    >{item.label}</button>)}
  </div>;
}

export type BreadcrumbItem={label:string;href?:string};

export function Breadcrumb({items,label="Migas de pan"}:{items:BreadcrumbItem[];label?:string}){
  return <nav className="ds-breadcrumb" aria-label={label}>
    {items.map((item,index)=><span key={item.label+index}>
      {index>0&&<UiIcon name="chevron-right" size={12}/>}
      {item.href?<Link href={item.href}>{item.label}</Link>:<span aria-current={index===items.length-1?"page":undefined}>{item.label}</span>}
    </span>)}
  </nav>;
}

function moduleNavigationActive(activeHref:string|undefined,itemHref:string,exact=false){
  if(!activeHref)return false;
  if(exact||/[?#]/.test(itemHref))return activeHref===itemHref;
  const activePath=activeHref.split(/[?#]/)[0].replace(/\/$/,"");
  const itemPath=itemHref.replace(/\/$/,"");
  return activePath===itemPath||(itemPath!=="/dashboard"&&activePath.startsWith(itemPath+"/"));
}

export function ModuleNavigation({items,activeHref,label="Navegación del módulo",exact=false}:{items:Array<{label:string;href:string;disabled?:boolean}>;activeHref?:string;label?:string;exact?:boolean}){
  return <nav className="ds-module-nav" aria-label={label}>
    {items.map(item=>{
      const active=moduleNavigationActive(activeHref,item.href,exact);
      return item.disabled
        ?<span key={item.href} className="disabled" aria-disabled="true">{item.label}</span>
        :<Link key={item.href} href={item.href} className={active?"active":""} aria-current={active?"page":undefined}>{item.label}</Link>;
    })}
  </nav>;
}
