"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
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
  const [category,setCategory]=useState("all");

  const categoryOptions:Array<{id:string;label:string;icon:UiIconName;matches:(article:ReturnType<typeof articlesForRole>[number])=>boolean}>=[
    {id:"all",label:"Todos",icon:"dashboard",matches:()=>true},
    {id:"starter",label:"Primeros pasos",icon:"file",matches:article=>["navigation","role-dashboard","company-setup"].includes(article.id)},
    {id:"administration",label:"Administración",icon:"user",matches:article=>["Administración","Usuarios","Ubicaciones","Cuadrillas"].includes(article.module)},
    {id:"assets",label:"Gestión de activos",icon:"asset",matches:article=>article.module==="Activos"||article.keywords.includes("activos")},
    {id:"work-orders",label:"Órdenes de trabajo",icon:"work-order",matches:article=>article.module.includes("Órdenes")||article.keywords.includes("ot")},
    {id:"maintenance",label:"Rutinas de mantenimiento",icon:"maintenance",matches:article=>article.module.includes("Rutinas")||article.keywords.includes("rutina")},
    {id:"inventory",label:"Inventario",icon:"inventory",matches:article=>["Inventario","Requisiciones","Proveedores"].includes(article.module)},
    {id:"reports",label:"Reportes",icon:"report",matches:article=>article.module==="Reportes"||article.keywords.includes("reportes")||article.keywords.includes("reporte")},
    {id:"videos",label:"Video tutoriales",icon:"eye",matches:article=>article.keywords.includes("video")||article.keywords.includes("tutorial")},
  ];

  const roleArticles=useMemo(()=>articlesForRole(role),[role]);
  const articles=useMemo(()=>{
    const normalized=query.trim().toLowerCase();
    const categoryMeta=categoryOptions.find(item=>item.id===category)||categoryOptions[0];
    return roleArticles.filter(article=>{
      if(!categoryMeta.matches(article))return false;
      if(!normalized)return true;
      return [
        article.title,article.summary,article.module,...article.keywords,...article.steps,...(article.notes||[])
      ].join(" ").toLowerCase().includes(normalized);
    });
  },[roleArticles,query,category]);

  const changes=changesForRole(role);
  const roleMeta=MANUAL_ROLES.find(item=>item.id===role)||MANUAL_ROLES[0];

  return <div className="manual-page">
    <section className="manual-hero">
      <div className="manual-hero-copy">
        <span className="eyebrow">MANUAL / AYUDA</span>
        <h1>Manual / Ayuda</h1>
        <p>Encuentra guías, tutoriales y documentación según tu rol.</p>
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

    <section className="manual-category-section" aria-label="Categorías del manual">
      <div className="manual-category-heading"><span className="eyebrow">Categorías</span><h2>Explora por tema</h2><p>Las categorías organizan únicamente las guías reales disponibles para tu rol.</p></div>
      <div className="manual-category-grid">
        {categoryOptions.map(option=>{
          const count=roleArticles.filter(option.matches).length;
          return <button key={option.id} type="button" className={category===option.id?"active":""} onClick={()=>setCategory(option.id)} aria-pressed={category===option.id} disabled={option.id==="videos"&&count===0}>
            <span><UiIcon name={option.icon} size={18}/></span>
            <strong>{option.label}</strong>
            <small>{count} {count===1?"artículo":"artículos"}</small>
          </button>;
        })}
      </div>
    </section>

    <section className="manual-section">
      <div className="section-heading">
        <div><span className="eyebrow">Guías</span><h2>{role==="all"?"Procesos de la plataforma":"Procesos para "+roleMeta.label}</h2><p className="muted">{articles.length} guías disponibles con el filtro actual.</p></div>
      </div>

      {articles.length===0 ? <div className="card empty-state"><strong>No encontramos contenido publicado para este filtro.</strong><span>{category==="videos"?"Actualmente no hay video tutoriales publicados en el manual; no se generan contenidos ficticios.":"Prueba otra palabra, categoría o cambia el rol seleccionado."}</span></div> :
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
