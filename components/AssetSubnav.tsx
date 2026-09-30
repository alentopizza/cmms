import { ModuleNavigation } from "@/components/ui-kit/Navigation";

export type AssetView="list"|"types"|"categories"|"brands"|"models"|"states"|"maintenance"|"history"|"documents"|"settings";

const items=[
  {label:"Lista de Activos",href:"/dashboard/assets?view=list",view:"list"},
  {label:"Tipos",href:"/dashboard/assets?view=types",view:"types"},
  {label:"Categorías",href:"/dashboard/assets?view=categories",view:"categories"},
  {label:"Marcas",href:"/dashboard/assets?view=brands",view:"brands"},
  {label:"Modelos",href:"/dashboard/assets?view=models",view:"models"},
  {label:"Estados",href:"/dashboard/assets?view=states",view:"states"},
  {label:"Mantenimientos",href:"/dashboard/assets?view=maintenance",view:"maintenance"},
  {label:"Historial",href:"/dashboard/assets?view=history",view:"history"},
  {label:"Documentos",href:"/dashboard/assets?view=documents",view:"documents"},
  {label:"Configuración",href:"/dashboard/assets?view=settings",view:"settings"},
] as const;

export default function AssetSubnav({activeView="list"}:{activeView?:AssetView}){
  const active=items.find(item=>item.view===activeView)?.href||items[0].href;
  return <section className="section phase7-subnav">
    <ModuleNavigation items={items.map(({label,href})=>({label,href}))} activeHref={active} label="Secciones de activos" exact/>
  </section>;
}
