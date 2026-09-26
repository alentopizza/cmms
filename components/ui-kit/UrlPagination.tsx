"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pagination } from "@/components/ui-kit/DataTable";

export function UrlPagination({
  page,
  pageCount,
  param="page",
  label="Paginación",
  pageSize,
  pageSizeOptions,
  pageSizeParam="pageSize",
  total,
}:{
  page:number;
  pageCount:number;
  param?:string;
  label?:string;
  pageSize?:number;
  pageSizeOptions?:number[];
  pageSizeParam?:string;
  total?:number;
}){
  const router=useRouter();
  const pathname=usePathname();
  const searchParams=useSearchParams();

  const pagination=<Pagination
    page={page}
    pageCount={pageCount}
    label={label}
    onPageChange={nextPage=>{
      const next=new URLSearchParams(searchParams.toString());
      if(nextPage<=1)next.delete(param);else next.set(param,String(nextPage));
      const query=next.toString();
      router.push(query?pathname+"?"+query:pathname,{scroll:false});
    }}
  />;

  if(!pageSize||!pageSizeOptions?.length)return pagination;

  return <div className="ds-pagination-layout">
    <div className="ds-pagination-meta">
      <span>{typeof total==="number"?total+" resultados · ":""}Página {Math.min(Math.max(1,page),Math.max(1,pageCount))} de {Math.max(1,pageCount)}</span>
      <label>
        <span>Por página</span>
        <select
          className="ds-input ds-select"
          value={pageSize}
          aria-label="Tamaño de página"
          onChange={event=>{
            const next=new URLSearchParams(searchParams.toString());
            const value=event.target.value;
            next.set(pageSizeParam,value);
            next.delete(param);
            const query=next.toString();
            router.push(query?pathname+"?"+query:pathname,{scroll:false});
          }}
        >
          {pageSizeOptions.map(value=><option key={value} value={value}>{value}</option>)}
        </select>
      </label>
    </div>
    {pagination}
  </div>;
}
