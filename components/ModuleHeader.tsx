"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type FilterOption = { value: string; label: string };
export type ModuleFacet = { key:string; label:string; allLabel?:string };

type FacetOptionMap=Record<string,FilterOption[]>;

function splitFacet(value:string|null|undefined){
  return String(value||"").split("|").map(item=>item.trim()).filter(Boolean);
}

export default function ModuleHeader({
  eyebrow,
  title,
  description,
  count,
  countLabel,
  searchPlaceholder = "Buscar por palabra clave",
  filters = [
    { value: "all", label: "Todos" },
    { value: "active", label: "Activos" },
    { value: "inactive", label: "Inactivos" },
  ],
  facets=[],
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  count: number;
  countLabel: string;
  searchPlaceholder?: string;
  filters?: FilterOption[];
  facets?: ModuleFacet[];
  action?: React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(filters[0]?.value || "all");
  const [facetValues,setFacetValues]=useState<Record<string,string>>({});
  const [facetOptions,setFacetOptions]=useState<FacetOptionMap>({});
  const [visibleCount, setVisibleCount] = useState(count);
  const [portalHost,setPortalHost]=useState<HTMLElement|null>(null);

  const normalizedSearch = useMemo(() => search.trim().toLocaleLowerCase("es"), [search]);
  const facetSignature=JSON.stringify(facets);

  useEffect(()=>{
    setPortalHost(document.getElementById("context-header-tools"));
  },[]);

  useEffect(() => {
    const records = Array.from(document.querySelectorAll<HTMLElement>("[data-module-record]"));
    const options:FacetOptionMap={};

    const recordMatchesFacet=(record:HTMLElement,facet:ModuleFacet,selected:string)=>{
      if(!selected||selected==="all")return true;
      return splitFacet(record.getAttribute("data-filter-"+facet.key)).includes(selected);
    };
    const recordMatchesBase=(record:HTMLElement)=>{
      const haystack = (record.dataset.search || record.textContent || "").toLocaleLowerCase("es");
      const status = record.dataset.status || "all";
      return (!normalizedSearch || haystack.includes(normalizedSearch)) && (filter === "all" || status === filter);
    };

    for(const facet of facets){
      const values=new Map<string,string>();
      for(const record of records){
        if(!recordMatchesBase(record))continue;
        const matchesOthers=facets.every(other=>other.key===facet.key||recordMatchesFacet(record,other,facetValues[other.key]||"all"));
        if(!matchesOthers)continue;
        const rawValues=splitFacet(record.getAttribute("data-filter-"+facet.key));
        const rawLabels=splitFacet(record.getAttribute("data-filter-"+facet.key+"-label"));
        rawValues.forEach((value,index)=>values.set(value,rawLabels[index]||value));
      }
      options[facet.key]=[...values.entries()].sort((a,b)=>a[1].localeCompare(b[1],"es")).map(([value,label])=>({value,label}));
    }

    let visible = 0;
    for (const record of records) {
      const matchesBase=recordMatchesBase(record);
      const matchesFacets=facets.every(facet=>recordMatchesFacet(record,facet,facetValues[facet.key]||"all"));
      const show = matchesBase && matchesFacets;
      record.hidden = !show;
      if (show) visible += 1;
    }

    setFacetOptions(options);
    setVisibleCount(records.length ? visible : count);
    setFacetValues(previous=>{
      let changed=false;
      const next={...previous};
      for(const facet of facets){
        const selected=previous[facet.key]||"all";
        if(selected!=="all"&&!options[facet.key]?.some(option=>option.value===selected)){
          next[facet.key]="all";
          changed=true;
        }
      }
      return changed?next:previous;
    });
  }, [normalizedSearch, filter, count, facetSignature, facetValues]);

  if(!portalHost) return null;

  const visibleFacets=facets.filter(facet=>(facetOptions[facet.key]?.length||0)>1);

  return createPortal(
    <div className="module-page-tools module-page-tools-portal" aria-label={title}>
      <label className="module-search-control">
        <span aria-hidden="true">⌕</span>
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={`Buscar en ${title}`}
        />
      </label>

      {filters.length>1&&<label className="module-filter-control">
        <span aria-hidden="true">☷</span>
        <select value={filter} onChange={event => setFilter(event.target.value)} aria-label={`Filtrar ${title}`}>
          {filters.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
      </label>}

      {visibleFacets.map(facet=><label className="module-filter-control module-facet-control" key={facet.key}>
        <span aria-hidden="true">⌄</span>
        <select
          value={facetValues[facet.key]||"all"}
          onChange={event=>setFacetValues(previous=>({...previous,[facet.key]:event.target.value}))}
          aria-label={`Filtrar ${title} por ${facet.label}`}
        >
          <option value="all">{facet.allLabel||"Todos · "+facet.label}</option>
          {(facetOptions[facet.key]||[]).map(option=><option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
      </label>)}

      {(filter!==(filters[0]?.value||"all")||normalizedSearch||Object.values(facetValues).some(value=>value&&value!=="all"))&&
        <button className="text-button module-filter-reset" type="button" onClick={()=>{setSearch("");setFilter(filters[0]?.value||"all");setFacetValues({});}}>Limpiar</button>}

      {action && <div className="module-add-action">{action}</div>}
      <span className="module-visible-count" aria-live="polite">{visibleCount}/{count}</span>
    </div>,
    portalHost,
  );
}
