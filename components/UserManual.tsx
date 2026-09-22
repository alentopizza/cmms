"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  MANUAL_CHANGES,
  MANUAL_LAST_REVIEW,
  MANUAL_ROLES,
  articlesForRole,
  changesForRole,
  type ManualRole,
} from "@/lib/user-manual";

export default function UserManual({
  initialRole="all",
  authenticated=false,
}:{
  initialRole?:ManualRole;
  authenticated?:boolean;
}){
  const [role,setRole]=useState<ManualRole>(initialRole);
  const [query,setQuery]=useState("");

  const articles=useMemo(()=>{
    const normalized=query.trim().toLowerCase();
    return articlesForRole(role).filter(article=>{
      if(!normalized)return true;
      return [
        article.title,article.summary,article.module,...article.keywords,...article.steps,...(article.notes||[])
      ].join(" ").toLowerCase().includes(normalized);
    });
  },[role,query]);

  const changes=changesForRole(role);
  const roleMeta=MANUAL_ROLES.find(item=>item.id===role)||MANUAL_ROLES[0];

  return <div className="manual-page">
    <section className="manual-hero">
      <div className="manual-hero-copy">
        <span className="eyebrow">Centro de ayuda</span>
        <h1>Manual de usuario Desweb CMMS</h1>
        <p>Entiende primero lo que corresponde a tu rol y, cuando lo necesites, explora el alcance completo de la plataforma.</p>
        <div className="manual-hero-actions">
          {authenticated
            ? <Link className="button" href="/dashboard">Volver al panel</Link>
            : <Link className="button" href="/login">Ingresar al panel</Link>}
          <button className="button secondary" type="button" onClick={()=>setRole("all")}>Conocer toda la plataforma</button>
        </div>
      </div>
      <div className="manual-hero-status">
        <span>Manual vivo</span>
        <strong>Actualizado con el producto</strong>
        <small>Última revisión: {MANUAL_LAST_REVIEW}</small>
      </div>
    </section>

    <section className="manual-toolbar">
      <div className="manual-role-selector">
        <label htmlFor="manual-role">Ver manual para</label>
        <select id="manual-role" value={role} onChange={event=>setRole(event.target.value as ManualRole)}>
          {MANUAL_ROLES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <p><strong>{roleMeta.label}</strong><span>{roleMeta.summary}</span></p>
      </div>
      <div className="manual-search">
        <label htmlFor="manual-search">Buscar en el manual</label>
        <input id="manual-search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Ej. biometría, activos, geocerca, OT…"/>
      </div>
    </section>

    <section className="manual-overview-grid">
      <article><span>1</span><div><strong>Empieza por tu rol</strong><small>El manual prioriza procesos que puedes ejecutar realmente.</small></div></article>
      <article><span>2</span><div><strong>Entiende el flujo completo</strong><small>Puedes cambiar a Toda la plataforma para conocer cómo se conectan los módulos.</small></div></article>
      <article><span>3</span><div><strong>Consulta cambios</strong><small>Las novedades importantes se reflejan aquí junto con el producto.</small></div></article>
    </section>

    <section className="manual-section">
      <div className="section-heading">
        <div><span className="eyebrow">Guías</span><h2>{role==="all"?"Procesos de la plataforma":"Procesos para "+roleMeta.label}</h2><p className="muted">{articles.length} guías disponibles con el filtro actual.</p></div>
      </div>

      {articles.length===0 ? <div className="card empty-state"><strong>No encontramos resultados.</strong><span>Prueba otra palabra o cambia el rol seleccionado.</span></div> :
      <div className="manual-article-grid">
        {articles.map(article=><details key={article.id} className="manual-article-card">
          <summary>
            <span className="manual-article-icon" aria-hidden="true">{article.icon}</span>
            <span><small>{article.module}</small><strong>{article.title}</strong><p>{article.summary}</p></span>
            <i aria-hidden="true">⌄</i>
          </summary>
          <div className="manual-article-body">
            <ol>
              {article.steps.map((step,index)=><li key={index}>{step}</li>)}
            </ol>
            {article.notes?.length ? <div className="manual-notes">
              {article.notes.map((note,index)=><p key={index}><span aria-hidden="true">i</span>{note}</p>)}
            </div>:null}
            {authenticated&&article.href&&<Link className="button secondary manual-open-module" href={article.href}>Abrir {article.module}</Link>}
          </div>
        </details>)}
      </div>}
    </section>

    <section className="manual-section manual-changes">
      <div className="section-heading">
        <div><span className="eyebrow">Novedades</span><h2>Qué cambió</h2><p className="muted">Cambios recientes que modifican cómo se usa el CMMS.</p></div>
      </div>
      <div className="manual-change-list">
        {changes.map((change,index)=><article key={index}>
          <time>{change.date}</time>
          <div><strong>{change.title}</strong><p>{change.summary}</p></div>
        </article>)}
      </div>
    </section>

    <section className="manual-scope-note">
      <span aria-hidden="true">?</span>
      <div><strong>¿Por qué puedes ver toda la plataforma?</strong><p>El manual general explica cómo se conectan los procesos, pero dentro del panel tus permisos siguen definiendo exactamente qué módulos, registros y acciones puedes utilizar.</p></div>
    </section>
  </div>;
}
