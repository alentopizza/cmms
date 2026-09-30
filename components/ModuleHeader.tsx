"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { Search, FilterPanel, FilterGroup } from "@/components/ui-kit/DataControls";
import { Select } from "@/components/ui-kit/FormControls";

type FilterOption = { value: string; label: string };
export type ModuleFacet = { key:string; label:string; allLabel?:string };

export type ModuleFacetOptionMap=Record<string,FilterOption[]>;
export type ModuleHeaderServerState={
  search:string;
  filter:string;
  facetValues:Record<string,string>;
  facetOptions:ModuleFacetOptionMap;
  filteredCount:number;
  searchParam?:string;
  filterParam?:string;
  pageParam?:string;
};

type FacetOptionMap=ModuleFacetOptionMap;

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
  serverState,
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
  serverState?: ModuleHeaderServerState;
}) {
  const [search, setSearch] = useState(serverState?.search||"");
  const [filter, setFilter] = useState(serverState?.filter||filters[0]?.value||"all");
  const [facetValues,setFacetValues]=useState<Record<string,string>>(serverState?.facetValues||{});
  const [facetOptions,setFacetOptions]=useState<FacetOptionMap>(serverState?.facetOptions||{});
  const [visibleCount, setVisibleCount] = useState(serverState?.filteredCount??count);
  const [portalHost,setPortalHost]=useState<HTMLElement|null>(null);
  const [viewRevision,setViewRevision]=useState(0);
  const [serverPending,startServerTransition]=useTransition();
  const router=useRouter();
  const pathname=usePathname();
  const urlSearchParams=useSearchParams();
  const urlSignature=urlSearchParams.toString();

  const normalizedSearch = useMemo(() => search.trim().toLocaleLowerCase("es"), [search]);
  const facetSignature=JSON.stringify(facets);

  useEffect(()=>{
    if(!serverState)return;
    setSearch(serverState.search);
    setFilter(serverState.filter);
    setFacetValues(serverState.facetValues);
    setFacetOptions(serverState.facetOptions);
    setVisibleCount(serverState.filteredCount);
  },[serverState]);

  function replaceServerParams(updates:Record<string,string|null>,resetPage=true){
    if(!serverState)return;
    const next=new URLSearchParams(urlSignature);
    const searchKey=serverState.searchParam||"q";
    if(search!==serverState.search){
      if(search)next.set(searchKey,search);else next.delete(searchKey);
    }
    for(const [key,value] of Object.entries(updates)){
      if(!value||value==="all")next.delete(key);else next.set(key,value);
    }
    if(resetPage)next.delete(serverState.pageParam||"page");
    const query=next.toString();
    startServerTransition(()=>router.replace(query?pathname+"?"+query:pathname,{scroll:false}));
  }

  useEffect(()=>{
    if(!serverState||search===serverState.search)return;
    const timer=window.setTimeout(()=>{
      replaceServerParams({[serverState.searchParam||"q"]:search});
    },300);
    return()=>window.clearTimeout(timer);
  // URL signature is intentionally included so delayed search preserves unrelated URL state.
  },[search,serverState,urlSignature]);

  useEffect(()=>{
    setPortalHost(document.getElementById("context-header-tools"));
  },[]);

  useEffect(()=>{
    const onViewModeChange=()=>setViewRevision(value=>value+1);
    window.addEventListener("cmms:view-mode-change",onViewModeChange);
    return()=>window.removeEventListener("cmms:view-mode-change",onViewModeChange);
  },[]);

  useEffect(() => {
    if(serverState){
      setFacetOptions(serverState.facetOptions);
      setVisibleCount(serverState.filteredCount);
      return;
    }
    const records = Array.from(document.querySelectorAll<HTMLElement>("[data-module-record]")).filter(record=>{
      const pane=record.closest<HTMLElement>("[data-view-pane]");
      return !pane?.hidden;
    });
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
  }, [normalizedSearch, filter, count, facetSignature, facetValues, viewRevision, serverState]);

  if(!portalHost) return null;

  const visibleFacets=facets.filter(facet=>(facetOptions[facet.key]?.length||0)>1);
  const activeFilterCount=(filter!==(filters[0]?.value||"all")?1:0)+visibleFacets.filter(facet=>(facetValues[facet.key]||"all")!=="all").length;
  const hasFilterControls=filters.length>1||visibleFacets.length>0;

  return createPortal(
    <div className="module-page-tools module-page-tools-portal" aria-label={title} data-module-header-v2>
      <Search
        value={search}
        onValueChange={setSearch}
        placeholder={searchPlaceholder}
        ariaLabel={"Buscar en "+title}
        busy={serverState?serverPending:false}
        compact
      />

      {hasFilterControls&&<FilterPanel
        activeCount={activeFilterCount}
        label={"Filtros de "+title}
        onClear={()=>{
          const defaultFilter=filters[0]?.value||"all";
          setFilter(defaultFilter);
          setFacetValues({});
          if(serverState){
            const updates:Record<string,string|null>={[serverState.filterParam||"status"]:null};
            for(const facet of facets)updates[facet.key]=null;
            replaceServerParams(updates);
          }
        }}
      >
        {filters.length>1&&<FilterGroup label="Estado">
          <Select
            value={filter}
            onChange={event=>{
              const next=event.target.value;
              setFilter(next);
              if(serverState)replaceServerParams({[serverState.filterParam||"status"]:next});
            }}
            aria-label={"Filtrar "+title+" por estado"}
            placeholder=""
            options={filters}
          />
        </FilterGroup>}
        {visibleFacets.map(facet=><FilterGroup label={facet.label} key={facet.key}>
          <Select
            value={facetValues[facet.key]||"all"}
            onChange={event=>{
              const next=event.target.value;
              setFacetValues(previous=>({...previous,[facet.key]:next}));
              if(serverState)replaceServerParams({[facet.key]:next});
            }}
            aria-label={"Filtrar "+title+" por "+facet.label}
            placeholder=""
            options={[
              {value:"all",label:facet.allLabel||"Todos · "+facet.label},
              ...(facetOptions[facet.key]||[]),
            ]}
          />
        </FilterGroup>)}
      </FilterPanel>}

      <div id="module-view-mode-tools" className="module-view-mode-tools" aria-label="Modo de visualización"/>

      {action && <div className="module-add-action">{action}</div>}
      <span className="module-visible-count" aria-live="polite" title={countLabel}>{visibleCount}/{count}</span>
    </div>,
    portalHost,
  );
}
