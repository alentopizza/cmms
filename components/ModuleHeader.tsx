"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type FilterOption = { value: string; label: string };

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
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  count: number;
  countLabel: string;
  searchPlaceholder?: string;
  filters?: FilterOption[];
  action?: React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(filters[0]?.value || "all");
  const [visibleCount, setVisibleCount] = useState(count);
  const [portalHost,setPortalHost]=useState<HTMLElement|null>(null);

  const normalizedSearch = useMemo(() => search.trim().toLocaleLowerCase("es"), [search]);

  useEffect(()=>{
    setPortalHost(document.getElementById("context-header-tools"));
  },[]);

  useEffect(() => {
    const records = Array.from(document.querySelectorAll<HTMLElement>("[data-module-record]"));
    let visible = 0;

    for (const record of records) {
      const haystack = (record.dataset.search || record.textContent || "").toLocaleLowerCase("es");
      const status = record.dataset.status || "all";
      const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
      const matchesFilter = filter === "all" || status === filter;
      const show = matchesSearch && matchesFilter;
      record.hidden = !show;
      if (show) visible += 1;
    }

    setVisibleCount(records.length ? visible : count);
  }, [normalizedSearch, filter, count]);

  if(!portalHost) return null;

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

      <label className="module-filter-control">
        <span aria-hidden="true">☷</span>
        <select value={filter} onChange={event => setFilter(event.target.value)} aria-label={`Filtrar ${title}`}>
          {filters.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
      </label>

      {action && <div className="module-add-action">{action}</div>}
      <span className="module-visible-count" aria-live="polite">{visibleCount}/{count}</span>
    </div>,
    portalHost,
  );
}
