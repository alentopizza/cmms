"use client";

import { useEffect, useState } from "react";
import { ModuleNavigation } from "@/components/ui-kit/Navigation";

const items=[
  {label:"Lista de Activos",href:"/dashboard/assets"},
  {label:"Tipos",href:"/dashboard/assets#asset-types"},
  {label:"Categorías",href:"/dashboard/assets#asset-categories"},
  {label:"Marcas",href:"/dashboard/assets#asset-brands"},
  {label:"Modelos",href:"/dashboard/assets#asset-models"},
  {label:"Estados",href:"/dashboard/assets#asset-states"},
  {label:"Mantenimientos",href:"/dashboard/assets#asset-maintenance"},
  {label:"Historial",href:"/dashboard/assets#asset-history"},
  {label:"Documentos",href:"/dashboard/assets#asset-documents"},
  {label:"Configuración",href:"/dashboard/assets#asset-settings"},
];

export default function AssetSubnav(){
  const [activeHref,setActiveHref]=useState("/dashboard/assets");
  useEffect(()=>{
    const sync=()=>{
      const path=window.location.pathname;
      setActiveHref(/^\/dashboard\/assets\/[^/]+$/.test(path)?"/dashboard/assets":path+window.location.search+window.location.hash);
    };
    sync();
    window.addEventListener("hashchange",sync);
    window.addEventListener("popstate",sync);
    return()=>{window.removeEventListener("hashchange",sync);window.removeEventListener("popstate",sync);};
  },[]);
  return <section className="section phase7-subnav"><ModuleNavigation items={items} activeHref={activeHref} label="Secciones de activos" exact/></section>;
}
