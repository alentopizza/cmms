"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

export type EntityProfileStat = {
  label: string;
  value: ReactNode;
  icon?: string;
  hint?: string;
};

export type EntityProfileTab = {
  id: string;
  label: string;
  content: ReactNode;
};

export default function EntityProfileWorkspace({
  eyebrow,
  title,
  subtitle,
  meta = [],
  imageSrc,
  imageAlt = "",
  fallback = "D",
  coverSrc,
  status,
  stats,
  quickActions,
  toolbarActions,
  tabs,
  initialTab,
  onClose,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  meta?: string[];
  imageSrc?: string | null;
  imageAlt?: string;
  fallback?: string;
  coverSrc?: string | null;
  status?: ReactNode;
  stats: EntityProfileStat[];
  quickActions?: ReactNode;
  toolbarActions?: ReactNode;
  tabs: EntityProfileTab[];
  initialTab?: string;
  onClose?: () => void;
}) {
  const available = useMemo(() => tabs.filter(tab => Boolean(tab.content)), [tabs]);
  const firstTab = initialTab && available.some(tab => tab.id === initialTab)
    ? initialTab
    : available[0]?.id || "";
  const [activeTab, setActiveTab] = useState(firstTab);
  const active = available.find(tab => tab.id === activeTab) || available[0];

  return <section className="entity-profile-workspace">
    <header className="entity-profile-toolbar">
      <div className="entity-profile-title">
        <span className="eyebrow">{eyebrow}</span>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      <div className="entity-profile-toolbar-actions">
        {toolbarActions}
        {onClose && <button className="entity-profile-close" type="button" onClick={onClose} aria-label="Cerrar">×</button>}
      </div>
    </header>

    <div className="entity-profile-grid">
      <aside className="entity-profile-identity-card">
        <div className={"entity-profile-cover" + (coverSrc ? " has-image" : "")}>
          {coverSrc && <img src={coverSrc} alt="" />}
        </div>
        <div className="entity-profile-avatar">
          {imageSrc ? <img src={imageSrc} alt={imageAlt} /> : <span>{fallback}</span>}
        </div>
        <div className="entity-profile-identity-copy">
          <div className="entity-profile-name-row">
            <h3>{title}</h3>
            {status}
          </div>
          {subtitle && <strong>{subtitle}</strong>}
          {meta.map((item, index) => <span key={index}>{item}</span>)}
        </div>

        <div className="entity-profile-stats">
          {stats.map(stat => <div className="entity-profile-stat" key={stat.label}>
            <span className="entity-profile-stat-icon" aria-hidden="true">{stat.icon || "•"}</span>
            <div><small>{stat.label}</small><strong>{stat.value}</strong>{stat.hint && <em>{stat.hint}</em>}</div>
          </div>)}
        </div>

        {quickActions && <div className="entity-profile-quick-actions">
          <span>Acciones rápidas</span>
          <div>{quickActions}</div>
        </div>}
      </aside>

      <section className="entity-profile-content-card">
        <nav className="entity-profile-tabs" aria-label={"Secciones de " + title}>
          {available.map(tab => <button
            key={tab.id}
            type="button"
            className={active?.id === tab.id ? "active" : ""}
            aria-pressed={active?.id === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>)}
        </nav>
        <div className="entity-profile-tab-body" key={active?.id}>
          {active?.content}
        </div>
      </section>
    </div>
  </section>;
}
