"use client";

import { useRef, useState } from "react";
import UiIcon from "@/components/UiIcon";

type ImportIssue={sheet:string;row:number;severity:"error"|"warning";message:string};
type ImportResult={
  valid?:boolean;
  ok?:boolean;
  error?:string;
  summary?:Record<string,number>;
  issues?:ImportIssue[];
};

export default function BulkImportModal({
  entity,
  label="Importar",
  compact=false,
}:{
  entity:"inventory"|"assets";
  label?:string;
  compact?:boolean;
}){
  const [open,setOpen]=useState(false);
  const [file,setFile]=useState<File|null>(null);
  const [result,setResult]=useState<ImportResult|null>(null);
  const [busy,setBusy]=useState(false);
  const inputRef=useRef<HTMLInputElement>(null);

  const title=entity==="inventory"?"Importar inventario y Kardex":"Importar activos";
  const template=entity==="inventory"?"/api/bulk-import/template?entity=inventory":"/api/bulk-import/template?entity=assets";

  async function run(mode:"validate"|"commit"){
    if(!file)return;
    setBusy(true);
    try{
      const body=new FormData();
      body.set("entity",entity);
      body.set("mode",mode);
      body.set("file",file);
      const response=await fetch("/api/bulk-import",{method:"POST",body});
      const payload=await response.json() as ImportResult;
      setResult(payload);
      if(response.ok&&payload.ok){
        window.setTimeout(()=>window.location.reload(),650);
      }
    }catch{
      setResult({error:"No fue posible procesar el archivo."});
    }finally{
      setBusy(false);
    }
  }

  function choose(next:File|null){
    setFile(next);
    setResult(null);
  }

  return <>
    <button className={compact?"button secondary":"button secondary entity-action-button"} type="button" onClick={()=>setOpen(true)}>
      <UiIcon name="upload" size={16}/><span>{label}</span>
    </button>
    {open&&<div className="modal-backdrop bulk-import-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false);}}>
      <section className="modal-card bulk-import-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <div><span className="eyebrow">Carga masiva validada</span><h2>{title}</h2><p>{entity==="inventory"?"Carga catálogo, stock inicial y movimientos sin perder la trazabilidad del Kardex.":"Carga o actualiza activos identificados por Código."}</p></div>
          <button className="modal-close" type="button" onClick={()=>setOpen(false)} aria-label="Cerrar">×</button>
        </header>

        <div className="bulk-import-guide">
          <div><b>1</b><span><strong>Descarga la plantilla</strong><small>Incluye los catálogos actuales de tu empresa.</small></span></div>
          <div><b>2</b><span><strong>Completa el archivo</strong><small>No cambies los encabezados obligatorios.</small></span></div>
          <div><b>3</b><span><strong>Validar antes de importar</strong><small>Ninguna fila se guarda si existen errores.</small></span></div>
        </div>

        <div className="bulk-import-actions-top">
          <a className="button secondary" href={template}><UiIcon name="download" size={16}/> Descargar plantilla</a>
          <button className="button secondary" type="button" onClick={()=>inputRef.current?.click()}><UiIcon name="upload" size={16}/> Seleccionar Excel</button>
          <input ref={inputRef} type="file" accept=".xlsx" hidden onChange={event=>choose(event.target.files?.[0]||null)}/>
        </div>

        <div className={"bulk-import-drop "+(file?"has-file":"")}>
          <UiIcon name="file" size={26}/>
          {file?<><strong>{file.name}</strong><span>{(file.size/1024/1024).toFixed(2)} MB</span></>:<><strong>Adjunta un archivo .xlsx</strong><span>Máximo 12 MB. Primero se ejecuta una validación completa.</span></>}
        </div>

        {result&&<div className="bulk-import-result">
          {result.error&&<div className="notice error">{result.error}</div>}
          {result.summary&&<div className="bulk-import-summary">{Object.entries(result.summary).map(([key,value])=><span key={key}><strong>{value}</strong><small>{key.replace(/([A-Z])/g," $1")}</small></span>)}</div>}
          {result.issues&&result.issues.length>0&&<div className="bulk-import-issues">
            <div className="bulk-import-issues-head"><strong>Resultado de validación</strong><span>{result.issues.length} observaciones mostradas</span></div>
            <div>{result.issues.map((item,index)=><article key={item.sheet+"-"+item.row+"-"+index} className={item.severity}>
              <span>{item.severity==="error"?"Error":"Aviso"}</span><strong>{item.sheet} · fila {item.row}</strong><p>{item.message}</p>
            </article>)}</div>
          </div>}
          {result.valid&&<div className="notice success">Validación correcta. Puedes confirmar la importación.</div>}
          {result.ok&&<div className="notice success">Importación completada. Actualizando el módulo…</div>}
        </div>}

        <footer className="modal-actions">
          <button className="button secondary" type="button" onClick={()=>setOpen(false)}>Cancelar</button>
          <button className="button secondary" type="button" disabled={!file||busy} onClick={()=>run("validate")}>{busy?"Validando…":"Validar archivo"}</button>
          <button className="button" type="button" disabled={!file||busy||!result?.valid} onClick={()=>run("commit")}><UiIcon name="upload" size={15}/> Confirmar importación</button>
        </footer>
      </section>
    </div>}
  </>;
}
