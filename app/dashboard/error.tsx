"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}:{
  error:Error & {digest?:string};
  reset:()=>void;
}){
  useEffect(()=>{
    console.error("[dashboard:error-boundary]",error);
  },[error]);

  return <div className="dashboard-segment-error">
    <section className="card section dashboard-recovery-card">
      <span className="eyebrow">Dashboard</span>
      <h1>No pudimos cargar los indicadores</h1>
      <p>La sesión sigue activa. Puedes volver a intentar el Dashboard o continuar hacia los módulos operativos mientras se recupera la consulta.</p>
      {error.digest&&<small>Referencia técnica: {error.digest}</small>}
      <div className="dashboard-recovery-actions">
        <button className="button" type="button" onClick={reset}>Reintentar</button>
        <Link className="button secondary" href="/dashboard/work-orders">Órdenes de trabajo</Link>
        <Link className="button secondary" href="/dashboard/assets">Activos</Link>
      </div>
    </section>
  </div>;
}
