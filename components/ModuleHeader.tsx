"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search, FilterPanel, FilterGroup } from "@/components/ui-kit/DataControls";
import { Select } from "@/components/ui-kit/FormControls";

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
  const [viewRevision,setViewRevision]=useState(0);

  const normalizedSearch = useMemo(() => search.trim().toLocaleLowerCase("es"), [search]);
  const facetSignature=JSON.stringify(facets);

  useEffect(()=>{
    setPortalHost(document.getElementById("context-header-tools"));
  },[]);

  useEffect(()=>{
    const onViewModeChange=()=>setViewRevision(value=>value+1);
    window.addEventListener("cmms:view-mode-change",onViewModeChange);
    return()=>window.removeEventListener("cmms:view-mode-change",onViewModeChange);
  },[]);

  useEffect(() => {
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
  }, [normalizedSearch, filter, count, facetSignature, facetValues, facets, viewRevision]);

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
        compact
      />

      {hasFilterControls&&<FilterPanel
        activeCount={activeFilterCount}
        label={"Filtros de "+title}
        onClear={()=>{setFilter(filters[0]?.value||"all");setFacetValues({});}}
      >
        {filters.length>1&&<FilterGroup label="Estado">
          <Select
            value={filter}
            onChange={event=>setFilter(event.target.value)}
            aria-label={"Filtrar "+title+" por estado"}
            placeholder=""
            options={filters}
          />
        </FilterGroup>}
        {visibleFacets.map(facet=><FilterGroup label={facet.label} key={facet.key}>
          <Select
            value={facetValues[facet.key]||"all"}
            onChange={event=>setFacetValues(previous=>({...previous,[facet.key]:event.target.value}))}
            aria-label={"Filtrar "+title+" por "+facet.label}
            placeholder=""
            options={[
              {value:"all",label:facet.allLabel||"Todos · "+facet.label},
              ...(facetOptions[facet.key]||[]),
            ]}
          />
        </FilterGroup>)}
      </FilterPanel>}

      {action && <div className="module-add-action">{action}</div>}
      <span className="module-visible-count" aria-live="polite" title={countLabel}>{visibleCount}/{count}</span>
    </div>,
    portalHost,
  );
}
