import type { ReactNode } from "react";

export type StaticTableColumn={
  key:string;
  label:ReactNode;
  align?:"start"|"center"|"end";
  width?:string;
};

export type StaticTableRow={
  id:string;
  cells:Record<string,ReactNode>;
  recordProps?:Record<string,string|number|boolean|undefined>;
};

export function StaticDataTable({
  columns,
  rows,
  caption,
  empty,
  className="",
}:{
  columns:StaticTableColumn[];
  rows:StaticTableRow[];
  caption?:string;
  empty?:ReactNode;
  className?:string;
}){
  if(!rows.length&&empty)return <>{empty}</>;
  return <div className={["ds-data-table-shell","ds-static-data-table",className].filter(Boolean).join(" ")}>
    <div className="ds-data-table-scroll">
      <table className="ds-data-table">
        {caption&&<caption>{caption}</caption>}
        <thead><tr>{columns.map(column=><th
          key={column.key}
          data-align={column.align||"start"}
          style={column.width?{width:column.width}:undefined}
        >{column.label}</th>)}</tr></thead>
        <tbody>{rows.map(row=><tr key={row.id} {...row.recordProps}>
          {columns.map(column=><td key={column.key} data-align={column.align||"start"}>{row.cells[column.key]}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}
