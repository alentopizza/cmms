"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pagination } from "@/components/ui-kit/DataTable";

export function UrlPagination({
  page,
  pageCount,
  param="page",
  label="Paginación",
}:{
  page:number;
  pageCount:number;
  param?:string;
  label?:string;
}){
  const router=useRouter();
  const pathname=usePathname();
  const searchParams=useSearchParams();

  return <Pagination
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
}
