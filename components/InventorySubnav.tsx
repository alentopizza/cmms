import Link from "next/link";
import UiIcon from "@/components/UiIcon";

type InventorySection="summary"|"products"|"categories"|"warehouses"|"entries"|"issues"|"adjustments"|"transfers"|"kardex";

const items:Array<{id:InventorySection;label:string;href:string;icon:"asset"|"file"|"location"|"download"|"upload"|"activity"}>=[
  {id:"summary",label:"Resumen",href:"/dashboard/inventory",icon:"asset"},
  {id:"products",label:"Productos",href:"/dashboard/inventory#productos",icon:"asset"},
  {id:"categories",label:"Categorías",href:"/dashboard/inventory/categories",icon:"file"},
  {id:"warehouses",label:"Almacenes",href:"/dashboard/inventory/warehouses",icon:"location"},
  {id:"entries",label:"Entradas",href:"/dashboard/inventory/kardex?type=receipt",icon:"download"},
  {id:"issues",label:"Salidas",href:"/dashboard/inventory/kardex?type=issue",icon:"upload"},
  {id:"adjustments",label:"Ajustes",href:"/dashboard/inventory/kardex?type=adjustment",icon:"activity"},
  {id:"transfers",label:"Transferencias",href:"/dashboard/inventory/kardex?type=transfer",icon:"activity"},
  {id:"kardex",label:"Kardex",href:"/dashboard/inventory/kardex",icon:"file"},
];

export default function InventorySubnav({active}:{active:InventorySection}){
  return <nav className="inventory-subnav section" aria-label="Secciones de inventario">
    {items.map(item=><Link key={item.id} href={item.href} className={active===item.id?"active":""}>
      <UiIcon name={item.icon} size={14}/><span>{item.label}</span>
    </Link>)}
  </nav>;
}
