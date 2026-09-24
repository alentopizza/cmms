"use client";

import { useMemo, useState } from "react";
import UiIcon from "@/components/UiIcon";

export type RequisitionSelectableItem={
  id:string;
  supplier_id:string;
  supplier_name:string;
  sku:string;
  name:string;
  unit:string;
  unit_cost:string;
  quantity:string;
  min_quantity:string;
  site_name:string|null;
  location_name:string|null;
  site_id?:string|null;
  location_id?:string|null;
  category_id?:string|null;
  category_name?:string|null;
  warehouse_id?:string|null;
  warehouse_name?:string|null;
  description?:string|null;
  presentation?:string|null;
  max_quantity?:string|null;
  storage_location?:string|null;
  active?:boolean;
  has_image?:boolean;
};

export default function RequisitionBuilder({
  items,
  returnTo="/dashboard/requisitions",
  title="Crear requisición",
  description="Selecciona insumos y cantidades. El sistema genera una requisición independiente por proveedor.",
}:{
  items:RequisitionSelectableItem[];
  returnTo?:string;
  title?:string;
  description?:string;
}){
  const [selected,setSelected]=useState<Record<string,boolean>>({});
  const [quantities,setQuantities]=useState<Record<string,string>>({});
  const availableItems=items.filter(item=>item.active!==false);
  const selectedItems=availableItems.filter(item=>selected[item.id]);
  const groups=useMemo(()=>{
    const map=new Map<string,{name:string;items:RequisitionSelectableItem[]}>();
    for(const item of selectedItems){
      const current=map.get(item.supplier_id)||{name:item.supplier_name,items:[]};
      current.items.push(item);
      map.set(item.supplier_id,current);
    }
    return [...map.entries()];
  },[selectedItems]);

  function toggle(id:string){
    setSelected(current=>({...current,[id]:!current[id]}));
    if(!quantities[id])setQuantities(current=>({...current,[id]:"1"}));
  }

  return <section className="requisition-builder">
    <div className="requisition-builder-head">
      <div><span className="eyebrow">Abastecimiento</span><h3>{title}</h3><p>{description}</p></div>
      <div className="requisition-builder-summary">
        <strong>{selectedItems.length}</strong><span>ítems seleccionados</span>
        <strong>{groups.length}</strong><span>requisiciones a generar</span>
      </div>
    </div>

    {availableItems.length?<form method="post" action="/api/requisitions/generate">
      <input type="hidden" name="return_to" value={returnTo}/>
      <div className="requisition-builder-options">
        <div className="field"><label>Fecha requerida</label><input type="date" name="needed_by"/></div>
        <div className="field requisition-notes-field"><label>Observaciones generales</label><input name="notes" placeholder="Uso, prioridad, entrega o instrucciones para el proveedor"/></div>
      </div>

      <div className="requisition-item-grid">
        {availableItems.map(item=>{
          const checked=Boolean(selected[item.id]);
          const low=Number(item.quantity||0)<=Number(item.min_quantity||0);
          return <label key={item.id} className={"requisition-select-item"+(checked?" selected":"")}>
            <input type="checkbox" name="item_id" value={item.id} checked={checked} onChange={()=>toggle(item.id)}/>
            <span className="requisition-check" aria-hidden="true">{checked?"✓":""}</span>
            <span className="requisition-item-main">
              <small>{item.sku}</small>
              <strong>{item.name}</strong>
              <span>{item.supplier_name}</span>
              <em>{item.site_name||"Sin sede"}{item.location_name?" · "+item.location_name:""}</em>
            </span>
            <span className={"requisition-stock "+(low?"low":"")}>Stock {item.quantity} {item.unit}</span>
            <span className="requisition-quantity">
              <small>Cantidad</small>
              <input
                type="number"
                min="0.001"
                step="0.001"
                name={"qty_"+item.id}
                value={quantities[item.id]||"1"}
                disabled={!checked}
                onClick={event=>event.stopPropagation()}
                onChange={event=>setQuantities(current=>({...current,[item.id]:event.target.value}))}
              />
              <em>{item.unit}</em>
            </span>
          </label>;
        })}
      </div>

      {groups.length>0&&<div className="requisition-group-preview">
        <strong>Se generará una requisición por proveedor</strong>
        <div>{groups.map(([id,group])=><span key={id}><UiIcon name="company" size={14}/>{group.name}<b>{group.items.length}</b></span>)}</div>
      </div>}

      <div className="form-actions requisition-builder-actions">
        <button className="button" type="submit" disabled={!selectedItems.length}><UiIcon name="file" size={16}/> Generar {groups.length||""} requisición{groups.length===1?"":"es"}</button>
      </div>
    </form>:<div className="location-detail-empty"><UiIcon name="asset" size={28}/><strong>No hay insumos disponibles para requisición.</strong><span>Relaciona artículos de inventario con un proveedor de materiales o mixto.</span></div>}
  </section>;
}
