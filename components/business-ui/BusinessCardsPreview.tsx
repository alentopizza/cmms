"use client";

import { useState } from "react";
import Link from "next/link";
import UiIcon from "@/components/UiIcon";
import { AssetCard, CompanyCard, CrewCard, InventoryCard, LocationCard, MaintenanceCard, SupplierCard, WorkOrderCard } from "@/components/business-ui/BusinessCards";

export function BusinessCardsPreview(){
  const [message,setMessage]=useState("");
  return <section className="ds-preview-section" id="business-cards">
    <div className="ds-preview-heading">
      <span>Business UI</span><h2>Cards de dominio</h2>
      <p>Comparten shell, tokens y jerarquía, pero conservan la información y las acciones propias de cada dominio.</p>
    </div>
    {message&&<div className="ds-phase-note">{message}</div>}
    <div className="ds-business-preview-grid phase8-crews">
      <CompanyCard name="DESWEB Demo" plan="Enterprise" location="Bogotá · Colombia" active fallback="DD" profileCompletion={88} pendingDocuments={2} resources={[
        {label:"Ubicaciones",current:4,max:8,href:"/dashboard/locations",icon:"location"},
        {label:"Activos",current:84,max:250,href:"/dashboard/assets",icon:"asset"},
        {label:"Inventario",current:128,max:1000,href:"/dashboard/inventory",icon:"inventory"},
      ]} onOpen={()=>setMessage("Ficha de empresa")}/>
      <AssetCard name="Compresor C-04" code="ACT-004" category="Refrigeración" site="Planta Norte" location="Sala técnica" supplier="Servicios Técnicos" criticality="Alta" manufacturerModel="Copeland · ZR61" status="Operativo" statusTone="success" actions={<button className="ds-business-demo-action" type="button" onClick={()=>setMessage("Detalle de activo")}>Ver detalles</button>}/>
      <InventoryCard name="Filtro secador 3/8" sku="INV-038" category="Refrigeración" presentation="Unidad" quantity={18} unit="und" min={8} max={30} supplier="Suministros Central" warehouse="Almacén principal" unitValue="$ 48.000" status="En stock" statusTone="success" actions={<button className="ds-business-demo-action" type="button" onClick={()=>setMessage("Detalle de inventario")}>Ver detalles</button>}/>
      <MaintenanceCard name="Rutina compresor mensual" asset="Compresor C-04" company="DESWEB Demo" frequency="Cada 1 mes" nextDue="30/09/2026" active actions={<button className="ds-business-demo-action" type="button" onClick={()=>setMessage("Acciones de rutina")}>Acciones</button>}/>
      <WorkOrderCard id="demo" number="1042" title="Temperatura fuera de rango" asset="Cámara 02" company="DESWEB Demo" priority="Alta" status="in_progress" actions={<button className="ds-business-demo-icon" type="button" onClick={()=>setMessage("Acciones de OT")} aria-label="Acciones"><UiIcon name="more" size={15}/></button>}/>
      <SupplierCard name="Proveedor Andino" subtitle="Proveedor Andino SAS" location="Bogotá · Colombia" specialty="Refrigeración · Eléctrico" type="Materiales + servicios" status="active" fallback="PA" contact="Laura Gómez" phone="+57 300 000 0000" email="compras@proveedor.com" metrics={[{label:"Actividades",value:3,icon:"activity"},{label:"Suministros",value:28,icon:"inventory"},{label:"Requisiciones",value:4,icon:"requisition"}]} onOpen={()=>setMessage("Ficha de proveedor")} actions={<><button className="supplier-card-primary-action-v3" type="button" onClick={()=>setMessage("Ficha de proveedor")}><UiIcon name="file" size={16}/><span>Ver ficha</span><UiIcon name="chevron-right" size={16}/></button><button className="supplier-card-quick-action-v3" type="button" onClick={()=>setMessage("Editar proveedor")} aria-label="Editar proveedor" data-tooltip="Editar proveedor"><UiIcon name="edit" size={16}/></button></>}/>
      <CrewCard name="Cuadrilla Refrigeración" organization="DESWEB Demo" site="Planta Norte" active leaderName="Laura Gómez" leaderRole="Supervisora" fallback="LG" metrics={[
        {label:"Integrantes",value:5,icon:"user"},{label:"Actividades activas",value:3,icon:"activity"},{label:"Completadas",value:18,icon:"check"},
      ]} roster={<div className="ds-business-demo-copy">Equipo operativo con líder e integrantes diferenciados.</div>}/>
      <LocationCard name="Planta Norte" organization="DESWEB Demo" location="Bogotá · Colombia" address="Zona industrial" active fallback="DD" onOpen={()=>setMessage("Ficha de ubicación")} resources={<nav className="ds-business-resource-demo" aria-label="Recursos de Planta Norte"><button type="button" onClick={()=>setMessage("Sububicaciones")}>12 sububicaciones</button><Link href="/dashboard/assets">84 activos</Link></nav>}/>
    </div>
  </section>;
}
