import { ModuleNavigation } from "@/components/ui-kit/Navigation";

export type InventorySection="summary"|"products"|"categories"|"warehouses"|"entries"|"issues"|"adjustments"|"transfers"|"kardex"|"reports"|"settings";

const items:Array<{id:InventorySection;label:string;href:string}>=[
  {id:"summary",label:"Resumen",href:"/dashboard/inventory?view=summary"},
  {id:"products",label:"Productos",href:"/dashboard/inventory?view=products"},
  {id:"categories",label:"Categorías",href:"/dashboard/inventory/categories"},
  {id:"warehouses",label:"Almacenes",href:"/dashboard/inventory/warehouses"},
  {id:"entries",label:"Entradas",href:"/dashboard/inventory/kardex?type=receipt"},
  {id:"issues",label:"Salidas",href:"/dashboard/inventory/kardex?type=issue"},
  {id:"adjustments",label:"Ajustes",href:"/dashboard/inventory/kardex?type=adjustment"},
  {id:"transfers",label:"Transferencias",href:"/dashboard/inventory/kardex?type=transfer"},
  {id:"kardex",label:"Kardex",href:"/dashboard/inventory/kardex"},
  {id:"reports",label:"Reportes",href:"/dashboard/inventory?view=reports"},
  {id:"settings",label:"Configuración",href:"/dashboard/inventory?view=settings"},
];

export default function InventorySubnav({active}:{active:InventorySection}){
  const activeHref=items.find(item=>item.id===active)?.href||items[0].href;
  return <section className="section phase7-subnav">
    <ModuleNavigation items={items.map(({label,href})=>({label,href}))} activeHref={activeHref} label="Secciones de inventario" exact/>
  </section>;
}
