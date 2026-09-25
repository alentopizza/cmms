"use client";

import { useEffect, useState } from "react";
import { ModuleNavigation } from "@/components/ui-kit/Navigation";

export type InventorySection="summary"|"products"|"categories"|"warehouses"|"entries"|"issues"|"adjustments"|"transfers"|"kardex"|"reports"|"settings";

const items:Array<{id:InventorySection;label:string;href:string}>=[
  {id:"summary",label:"Resumen",href:"/dashboard/inventory"},
  {id:"products",label:"Productos",href:"/dashboard/inventory#inventory-products"},
  {id:"categories",label:"Categorías",href:"/dashboard/inventory/categories"},
  {id:"warehouses",label:"Almacenes",href:"/dashboard/inventory/warehouses"},
  {id:"entries",label:"Entradas",href:"/dashboard/inventory/kardex?type=receipt"},
  {id:"issues",label:"Salidas",href:"/dashboard/inventory/kardex?type=issue"},
  {id:"adjustments",label:"Ajustes",href:"/dashboard/inventory/kardex?type=adjustment"},
  {id:"transfers",label:"Transferencias",href:"/dashboard/inventory/kardex?type=transfer"},
  {id:"kardex",label:"Kardex",href:"/dashboard/inventory/kardex"},
  {id:"reports",label:"Reportes",href:"/dashboard/inventory#inventory-reports"},
  {id:"settings",label:"Configuración",href:"/dashboard/inventory#inventory-settings"},
];

export default function InventorySubnav({active}:{active:InventorySection}){
  const initial=items.find(item=>item.id===active)?.href||"/dashboard/inventory";
  const [activeHref,setActiveHref]=useState(initial);
  useEffect(()=>{
    const sync=()=>{
      const path=window.location.pathname;
      if(/^\/dashboard\/inventory\/[0-9a-f-]+$/i.test(path)){setActiveHref("/dashboard/inventory#inventory-products");return;}
      setActiveHref(path+window.location.search+window.location.hash);
    };
    sync();
    window.addEventListener("hashchange",sync);
    window.addEventListener("popstate",sync);
    return()=>{window.removeEventListener("hashchange",sync);window.removeEventListener("popstate",sync);};
  },[]);
  return <section className="section phase7-subnav"><ModuleNavigation items={items} activeHref={activeHref} label="Secciones de inventario" exact/></section>;
}
