"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Fragment, useEffect, useMemo, useState } from "react";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import { BusinessProfileStat } from "@/components/business-ui";

export type EntityProfileStat = {
  label: string;
  value: ReactNode;
  icon?: UiIconName;
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
  headingIcon = "activity",
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
  headingIcon?: UiIconName;
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

  return <section className="entity-profile-workspace ds-business-profile">
    <nav className="entity-breadcrumbs" aria-label="Migas de pan">
      {breadcrumbs.map((crumb, index) => <Fragment key={crumb.label + index}>
        {index > 0 && <span className="entity-breadcrumb-separator" aria-hidden="true"><UiIcon name="chevron-right" size={13}/></span>}
        {crumb.href
          ? <Link href={crumb.href}>{index===0&&<UiIcon name="home" size={13}/>}<span>{crumb.label}</span></Link>
          : crumb.onClick
            ? <button type="button" onClick={crumb.onClick}>{index===0&&<UiIcon name="home" size={13}/>}<span>{crumb.label}</span></button>
            : <span className="current" aria-current="page">{crumb.label}</span>}
      </Fragment>)}
    </nav>

    <header className="entity-profile-page-head">
      <div className="entity-profile-page-identity">
        <span className="entity-profile-page-icon" aria-hidden="true"><UiIcon name={headingIcon} size={27}/></span>
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
          {stats.map(stat => <BusinessProfileStat key={stat.label} label={stat.label} value={stat.value} icon={stat.icon||"activity"} hint={stat.hint}/>)}
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
