"use client";

import { useMemo, useState, type ReactNode } from "react";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import { Button, IconButton, type ButtonVariant } from "@/components/ui-kit/Button";
import { Dropdown, type DropdownItemProps } from "@/components/ui-kit/TooltipDropdown";
import { EmptyState } from "@/components/ui-kit/Feedback";

export type DataTableColumn<T>={
  id:string;
  header:ReactNode;
  cell:(row:T)=>ReactNode;
  sortValue?:(row:T)=>string|number|null|undefined;
  align?:"start"|"center"|"end";
  width?:string;
};

export type DataTableBulkAction<T>={
  label:string;
  icon?:UiIconName;
  variant?:ButtonVariant;
  onSelect:(rows:T[])=>void;
};

export function RowActions({items,label="Acciones de fila"}:{items:DropdownItemProps[];label?:string}){
  return <Dropdown
    label={label}
    trigger={<IconButton icon="more" label={label} size="sm" variant="ghost"/>}
    items={items}
  />;
}

function compareValues(a:string|number|null|undefined,b:string|number|null|undefined){
  if(typeof a==="number"&&typeof b==="number")return a-b;
  return String(a??"").localeCompare(String(b??""),"es",{numeric:true,sensitivity:"base"});
}

export function DataTable<T extends {id:string}>({
  rows,
  columns,
  caption,
  selectable=false,
  bulkActions=[],
  rowActions,
  emptyTitle="No hay registros",
  emptyDescription="Ajusta los filtros o crea el primer registro para continuar.",
  getRowLabel=(row)=>row.id,
  className="",
}:{
  rows:T[];
  columns:DataTableColumn<T>[];
  caption?:string;
  selectable?:boolean;
  bulkActions?:DataTableBulkAction<T>[];
  rowActions?:(row:T)=>DropdownItemProps[];
  emptyTitle?:string;
  emptyDescription?:string;
  getRowLabel?:(row:T)=>string;
  className?:string;
}){
  const [sort,setSort]=useState<{id:string;direction:"asc"|"desc"}|null>(null);
  const [selected,setSelected]=useState<Set<string>>(()=>new Set());

  const sorted=useMemo(()=>{
    if(!sort)return rows;
    const column=columns.find(item=>item.id===sort.id);
    if(!column?.sortValue)return rows;
    return [...rows].sort((left,right)=>{
      const value=compareValues(column.sortValue!(left),column.sortValue!(right));
      return sort.direction==="asc"?value:-value;
    });
  },[rows,columns,sort]);

  const selectedRows=useMemo(()=>rows.filter(row=>selected.has(row.id)),[rows,selected]);
  const allSelected=rows.length>0&&rows.every(row=>selected.has(row.id));
  const partiallySelected=selectedRows.length>0&&!allSelected;

  function toggleAll(){
    setSelected(allSelected?new Set():new Set(rows.map(row=>row.id)));
  }
  function toggleOne(id:string){
    setSelected(previous=>{
      const next=new Set(previous);
      if(next.has(id))next.delete(id);else next.add(id);
      return next;
    });
  }
  function sortBy(id:string){
    const column=columns.find(item=>item.id===id);
    if(!column?.sortValue)return;
    setSort(current=>current?.id===id
      ?{id,direction:current.direction==="asc"?"desc":"asc"}
      :{id,direction:"asc"});
  }

  if(!rows.length)return <EmptyState icon="file" title={emptyTitle} description={emptyDescription}/>;

  return <div className={["ds-data-table-shell",className].filter(Boolean).join(" ")}>
    {selectable&&selectedRows.length>0&&<div className="ds-bulk-bar" role="region" aria-label="Acciones masivas">
      <div><strong>{selectedRows.length}</strong><span>{selectedRows.length===1?"registro seleccionado":"registros seleccionados"}</span></div>
      <div>{bulkActions.map(action=><Button
        key={action.label}
        size="sm"
        variant={action.variant||"secondary"}
        iconLeft={action.icon}
        onClick={()=>action.onSelect(selectedRows)}
      >{action.label}</Button>)}</div>
      <button type="button" onClick={()=>setSelected(new Set())}>Limpiar selección</button>
    </div>}
    <div className="ds-data-table-scroll">
      <table className="ds-data-table">
        {caption&&<caption>{caption}</caption>}
        <thead><tr>
          {selectable&&<th className="ds-table-select">
            <input
              type="checkbox"
              checked={allSelected}
              ref={node=>{if(node)node.indeterminate=partiallySelected;}}
              onChange={toggleAll}
              aria-label="Seleccionar todos los registros"
            />
          </th>}
          {columns.map(column=>{
            const active=sort?.id===column.id;
            const ariaSort:"ascending"|"descending"|"none"|undefined=column.sortValue?(active?(sort?.direction==="asc"?"ascending":"descending"):"none"):undefined;
            return <th key={column.id} style={column.width?{width:column.width}:undefined} data-align={column.align||"start"} aria-sort={ariaSort}>
              {column.sortValue?<button type="button" className="ds-table-sort" onClick={()=>sortBy(column.id)}>
                <span>{column.header}</span>
                <UiIcon name={active&&sort?.direction==="desc"?"chevron-down":"chevron-up"} size={13}/>
              </button>:column.header}
            </th>;
          })}
          {rowActions&&<th className="ds-table-actions"><span className="ds-visually-hidden">Acciones</span></th>}
        </tr></thead>
        <tbody>{sorted.map(row=><tr key={row.id} className={selected.has(row.id)?"selected":""}>
          {selectable&&<td className="ds-table-select"><input type="checkbox" checked={selected.has(row.id)} onChange={()=>toggleOne(row.id)} aria-label={"Seleccionar "+getRowLabel(row)}/></td>}
          {columns.map(column=><td key={column.id} data-align={column.align||"start"}>{column.cell(row)}</td>)}
          {rowActions&&<td className="ds-table-actions"><RowActions items={rowActions(row)} label={"Acciones de "+getRowLabel(row)}/></td>}
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  siblingCount=1,
  label="Paginación",
}:{
  page:number;
  pageCount:number;
  onPageChange:(page:number)=>void;
  siblingCount?:number;
  label?:string;
}){
  if(pageCount<=1)return null;
  const current=Math.min(Math.max(1,page),pageCount);
  const pages:number[]=[];
  const start=Math.max(1,current-siblingCount);
  const end=Math.min(pageCount,current+siblingCount);
  if(start>1)pages.push(1);
  for(let value=start;value<=end;value++)if(!pages.includes(value))pages.push(value);
  if(end<pageCount&&!pages.includes(pageCount))pages.push(pageCount);

  return <nav className="ds-pagination" aria-label={label}>
    <button type="button" onClick={()=>onPageChange(current-1)} disabled={current===1} aria-label="Página anterior"><UiIcon name="chevron-left" size={15}/></button>
    {pages.map((value,index)=>{
      const previous=pages[index-1];
      return <span className="ds-pagination-slot" key={value}>
        {previous&&value-previous>1&&<i aria-hidden="true">…</i>}
        <button type="button" className={value===current?"active":""} aria-current={value===current?"page":undefined} onClick={()=>onPageChange(value)}>{value}</button>
      </span>;
    })}
    <button type="button" onClick={()=>onPageChange(current+1)} disabled={current===pageCount} aria-label="Página siguiente"><UiIcon name="chevron-right" size={15}/></button>
  </nav>;
}
