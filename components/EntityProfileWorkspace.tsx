"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Fragment, useEffect, useMemo, useState } from "react";

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

export type EntityProfileBreadcrumb = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export default function EntityProfileWorkspace({
  eyebrow,
  headingLabel,
  headingIcon = "◇",
  title,
  subtitle,
  meta = [],
  breadcrumbs = [],
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
}: {
  eyebrow: string;
  headingLabel?: string;
  headingIcon?: string;
  title: string;
  subtitle?: string | null;
  meta?: string[];
  breadcrumbs?: EntityProfileBreadcrumb[];
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
}) {
  const available = useMemo(() => tabs.filter(tab => Boolean(tab.content)), [tabs]);
  const firstTab = initialTab && available.some(tab => tab.id === initialTab)
    ? initialTab
    : available[0]?.id || "";
  const [activeTab, setActiveTab] = useState(firstTab);

  useEffect(() => {
    setActiveTab(firstTab);
  }, [firstTab, title]);

  const active = available.find(tab => tab.id === activeTab) || available[0];

  return <section className="entity-profile-workspace">
    <nav className="entity-breadcrumbs" aria-label="Migas de pan">
      {breadcrumbs.map((crumb, index) => <Fragment key={crumb.label + index}>
        {index > 0 && <span className="entity-breadcrumb-separator" aria-hidden="true">›</span>}
        {crumb.href
          ? <Link href={crumb.href}>{crumb.label}</Link>
          : crumb.onClick
            ? <button type="button" onClick={crumb.onClick}>{crumb.label}</button>
            : <span className="current" aria-current="page">{crumb.label}</span>}
      </Fragment>)}
    </nav>

    <header className="entity-profile-page-head">
      <div className="entity-profile-page-identity">
        <span className="entity-profile-page-icon" aria-hidden="true">{headingIcon}</span>
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{headingLabel ? headingLabel + " / " : ""}{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      <div className="entity-profile-toolbar-actions">{toolbarActions}</div>
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
            <span className="entity-profile-stat-arrow" aria-hidden="true">›</span>
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
