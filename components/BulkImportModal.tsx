"use client";

import { useEffect, useRef, useState } from "react";
import UiIcon from "@/components/UiIcon";

type ImportIssue={
  sheet:string;row:number;severity:"error"|"warning";message:string;
  field?:string;value?:string;problem?:string;suggestion?:string;
};
type SupplierGroup={id:string;code:string|null;name:string;taxId:string|null;products:number;movements:number;context:boolean};
type ImportContext={
  mode:"global"|"contextual";scope:"all"|"context_only";
  supplier:{id:string;code:string|null;name:string;taxId:string|null}|null;
  otherSupplierRows:number;canSwitchGlobal:boolean;
};
type ImportResult={
  valid?:boolean;ok?:boolean;error?:string;importId?:string;
  summary?:Record<string,number>;
  issues?:ImportIssue[];
  supplierGroups?:SupplierGroup[];
  context?:ImportContext;
};
type ImportBatch={
  id:string;import_number:string;file_name:string;status:string;total_rows:number;imported_rows:number;omitted_rows:number;error_rows:number;warning_rows:number;
  origin:"global"|"supplier";commit_scope:"all"|"context_only";context_supplier_name:string|null;
  summary:Record<string,unknown>|null;created_at:string;committed_at:string|null;user_name:string|null;
};

function batchLabel(batch:ImportBatch){
  const year=new Date(batch.committed_at||batch.created_at).getFullYear();
  return "IMP-"+year+"-"+String(batch.import_number||"0").padStart(6,"0");
}

export default function BulkImportModal({
  entity,
  label="Importar",
  compact=false,
  supplierId="",
  supplierName="",
  supplierTaxId="",
  supplierCode="",
}:{
  entity:"inventory"|"assets";
  label?:string;
  compact?:boolean;
  supplierId?:string;
  supplierName?:string;
  supplierTaxId?:string;
  supplierCode?:string;
}){
  const [open,setOpen]=useState(false);
  const [file,setFile]=useState<File|null>(null);
  const [result,setResult]=useState<ImportResult|null>(null);
  const [busy,setBusy]=useState(false);
  const [history,setHistory]=useState<ImportBatch[]>([]);
  const [historyBusy,setHistoryBusy]=useState(false);
  const [importScope,setImportScope]=useState<"context_only"|"all">(supplierId?"context_only":"all");
  const [duplicateMode,setDuplicateMode]=useState<"compare"|"update"|"skip">("compare");
  const inputRef=useRef<HTMLInputElement>(null);

  const title=entity==="inventory"?"Importar inventario y Kardex":"Importar activos";
  const templateBase=entity==="inventory"
    ?"/api/bulk-import/template?entity=inventory"+(supplierId?"&supplier="+encodeURIComponent(supplierId):"")
    :"/api/bulk-import/template?entity=assets";
  const currentTemplate=templateBase+(entity==="inventory"?"&data=current":"");

  useEffect(()=>{
    setImportScope(supplierId?"context_only":"all");
    setResult(null);
    setDuplicateMode("compare");
  },[supplierId]);

  useEffect(()=>{
    if(!open)return;
    let cancelled=false;
    setHistoryBusy(true);
    const url="/api/bulk-import/history?entity="+entity+(supplierId?"&supplier="+encodeURIComponent(supplierId):"");
    fetch(url,{cache:"no-store"})
      .then(async response=>response.ok?response.json():{batches:[]})
      .then((payload:{batches?:ImportBatch[]})=>{if(!cancelled)setHistory(payload.batches||[]);})
      .catch(()=>{if(!cancelled)setHistory([]);})
      .finally(()=>{if(!cancelled)setHistoryBusy(false);});
    return ()=>{cancelled=true;};
  },[open,entity,supplierId]);

  async function run(mode:"validate"|"commit"){
    if(!file)return;
    if(mode==="commit"&&Number(result?.summary?.existingItems||0)>0&&duplicateMode==="compare")return;
    setBusy(true);
    try{
      const body=new FormData();
      body.set("entity",entity);
      body.set("mode",mode);
      body.set("file",file);
      if(supplierId)body.set("supplier_id",supplierId);
      if(entity==="inventory"){
        body.set("import_scope",importScope);
        body.set("duplicate_policy",duplicateMode==="skip"?"skip":"update");
      }
      const response=await fetch("/api/bulk-import",{method:"POST",body});
      const payload=await response.json() as ImportResult;
      setResult(payload);
      if(response.ok&&payload.ok){
        window.setTimeout(()=>window.location.reload(),900);
      }
    }catch{
      setResult({error:"No fue posible procesar el archivo."});
    }finally{
      setBusy(false);
    }
  }

  function choose(next:File|null){
    if(!next){
      setFile(null);setResult(null);setDuplicateMode("compare");return;
    }
    if(!next.name.toLowerCase().endsWith(".xlsx")){
      setFile(null);setResult({error:"Formato no permitido. Usa un archivo Excel .xlsx."});return;
    }
    if(next.size>12*1024*1024){
      setFile(null);setResult({error:"El archivo supera el máximo permitido de 12 MB."});return;
    }
    setFile(next);setResult(null);setDuplicateMode("compare");
  }

  function changeScope(scope:"context_only"|"all"){
    setImportScope(scope);
    setResult(null);
    setDuplicateMode("compare");
  }

  function summaryLabel(key:string){
    const labels:Record<string,string>={
      productsDetected:"productos detectados",
      inventoryRows:"productos en alcance",
      newItems:"productos nuevos",
      existingItems:"productos existentes",
      kardexRows:"movimientos Kardex",
      suppliersDetected:"proveedores detectados",
      warehouseRows:"bodegas en alcance",
      skippedServices:"servicios omitidos",
      omittedRows:"filas omitidas",
      assetRows:"filas de activos",
      newAssets:"activos nuevos",
      items:"artículos procesados",
      kardex:"movimientos procesados",
      warehouses:"bodegas procesadas",
      assets:"activos procesados",
      warnings:"advertencias",
      errors:"errores",
    };
    return labels[key]||key.replace(/([A-Z])/g," $1").toLowerCase();
  }

  const existingItems=Number(result?.summary?.existingItems||0);
  const commitBlockedByDuplicates=existingItems>0&&duplicateMode==="compare";

  return <>
    <button className={compact?"button secondary":"button secondary entity-action-button"} type="button" onClick={()=>setOpen(true)}>
      <UiIcon name="upload" size={16}/><span>{label}</span>
    </button>
    {open&&<div className="modal-backdrop bulk-import-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false);}}>
      <section className="modal-card bulk-import-modal bulk-import-master-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <div><span className="eyebrow">Carga masiva validada</span><h2>{title}</h2><p>{entity==="inventory"?"Una plantilla maestra para productos, bodegas y Kardex; el contexto decide cómo se distribuyen los proveedores.":"Carga o actualiza activos identificados por Código."}</p></div>
          <button className="modal-close" type="button" onClick={()=>setOpen(false)} aria-label="Cerrar">×</button>
        </header>

        {entity==="inventory"&&<div className={"bulk-import-context "+(importScope==="context_only"?"contextual":"global")}>
          <div><span className="eyebrow">{importScope==="context_only"?"Importación contextual":"Importación global"}</span>
            <strong>{importScope==="context_only"?(supplierName||"Proveedor seleccionado"):"Distribución automática por proveedor"}</strong>
            <small>{importScope==="context_only"
              ?[supplierCode,supplierTaxId&&"NIT "+supplierTaxId].filter(Boolean).join(" · ")||"El proveedor puede heredarse del contexto cuando la fila no lo repite."
              :"Cada producto se asignará por PROVEEDOR_ID, NIT, código o nombre exacto."}</small>
          </div>
          {supplierId&&<div className="bulk-import-scope-switch">
            <label className={importScope==="context_only"?"active":""}><input type="radio" checked={importScope==="context_only"} onChange={()=>changeScope("context_only")}/><span><b>Solo este proveedor</b><small>Ignora filas de otros proveedores.</small></span></label>
            <label className={importScope==="all"?"active":""}><input type="radio" checked={importScope==="all"} onChange={()=>changeScope("all")}/><span><b>Importar todo</b><small>Cambia a modo global y distribuye cada fila.</small></span></label>
          </div>}
        </div>}

        <div className="bulk-import-guide">
          <div><b>1</b><span><strong>Descarga la plantilla maestra</strong><small>El formato es idéntico desde Inventario y Proveedores.</small></span></div>
          <div><b>2</b><span><strong>Completa el archivo</strong><small>Inventario, Kardex, Proveedores, Bodegas y catálogos viven en el mismo Excel.</small></span></div>
          <div><b>3</b><span><strong>Analiza y confirma</strong><small>Ninguna fila se guarda antes de superar la validación completa.</small></span></div>
        </div>

        <div className="bulk-import-actions-top bulk-import-template-actions">
          {entity==="inventory"?<>
            <a className="button secondary" href={templateBase}><UiIcon name="download" size={16}/> Plantilla vacía</a>
            <a className="button secondary" href={currentTemplate}><UiIcon name="download" size={16}/> {supplierId?"Con productos de este proveedor":"Con datos actuales"}</a>
          </>:<a className="button secondary" href={templateBase}><UiIcon name="download" size={16}/> Descargar plantilla</a>}
          <button className="button secondary" type="button" onClick={()=>inputRef.current?.click()}><UiIcon name="upload" size={16}/> Seleccionar Excel</button>
          <input ref={inputRef} type="file" accept=".xlsx" hidden onChange={event=>choose(event.target.files?.[0]||null)}/>
        </div>

        <div
          className={"bulk-import-drop "+(file?"has-file":"")}
          onDragOver={event=>event.preventDefault()}
          onDrop={event=>{event.preventDefault();choose(event.dataTransfer.files?.[0]||null);}}
          onClick={()=>inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();inputRef.current?.click();}}}
        >
          <UiIcon name="file" size={26}/>
          {file?<><strong>{file.name}</strong><span>{(file.size/1024/1024).toFixed(2)} MB · haz clic para reemplazar</span></>:<><strong>Arrastra aquí tu archivo .xlsx o haz clic para seleccionarlo</strong><span>Máximo 12 MB. Primero se ejecuta una validación completa y atómica.</span></>}
        </div>

        {result&&<div className="bulk-import-result">
          {result.error&&<div className="notice error">{result.error}</div>}
          {result.importId&&<div className="notice success"><strong>{result.importId}</strong> · Importación confirmada y auditada.</div>}
          {result.summary&&<div className="bulk-import-summary">{Object.entries(result.summary).filter(([,value])=>typeof value==="number").map(([key,value])=><span key={key}><strong>{value}</strong><small>{summaryLabel(key)}</small></span>)}</div>}

          {entity==="inventory"&&result.context?.otherSupplierRows&&result.context.otherSupplierRows>0&&supplierId&&<div className="bulk-import-context-warning">
            <strong>El archivo contiene {result.context.otherSupplierRows} fila{result.context.otherSupplierRows===1?"":"s"} fuera del proveedor de contexto.</strong>
            <span>{importScope==="context_only"?"Se omitirán al confirmar. Puedes cambiar a Importar todo para validarlas y distribuirlas.":"Se están validando en modo global y deben identificar su proveedor correctamente."}</span>
          </div>}

          {result.supplierGroups&&result.supplierGroups.length>0&&<div className="bulk-import-provider-groups">
            <div className="bulk-import-issues-head"><strong>Proveedores detectados</strong><span>{result.supplierGroups.length} grupos</span></div>
            <div>{result.supplierGroups.map(group=><details key={group.id}>
              <summary><span><b>{group.name}</b><small>{[group.code,group.taxId&&"NIT "+group.taxId].filter(Boolean).join(" · ")}</small></span><em>{group.products} productos · {group.movements} movimientos</em></summary>
              <div><span>Productos: <b>{group.products}</b></span><span>Movimientos Kardex: <b>{group.movements}</b></span>{group.context&&<span>Proveedor de contexto</span>}</div>
            </details>)}</div>
          </div>}

          {result.issues&&result.issues.length>0&&<div className="bulk-import-issues">
            <div className="bulk-import-issues-head"><strong>Resultado de validación</strong><span>{result.issues.length} observaciones mostradas</span></div>
            <div>{result.issues.map((item,index)=><article key={item.sheet+"-"+item.row+"-"+index} className={item.severity}>
              <span>{item.severity==="error"?"Error":"Aviso"}</span>
              <strong>{item.sheet} · fila {item.row}{item.field?" · "+item.field:""}</strong>
              {item.value&&<small className="bulk-import-issue-value">Valor: {item.value}</small>}
              <p>{item.problem||item.message}</p>
              {item.suggestion&&<small className="bulk-import-issue-suggestion">Solución sugerida: {item.suggestion}</small>}
            </article>)}</div>
          </div>}

          {entity==="inventory"&&result.valid&&existingItems>0&&<div className="bulk-import-duplicate-policy">
            <div><strong>{existingItems} SKU{existingItems===1?"":"s"} ya existen</strong><span>El Kardex histórico nunca se reemplaza. Decide qué hacer con la información maestra.</span></div>
            <div>
              <label className={duplicateMode==="compare"?"active":""}><input type="radio" checked={duplicateMode==="compare"} onChange={()=>setDuplicateMode("compare")}/><span><b>Comparar</b><small>Revisa avisos antes de decidir.</small></span></label>
              <label className={duplicateMode==="update"?"active":""}><input type="radio" checked={duplicateMode==="update"} onChange={()=>setDuplicateMode("update")}/><span><b>Actualizar</b><small>Actualiza datos maestros; no toca Kardex previo.</small></span></label>
              <label className={duplicateMode==="skip"?"active":""}><input type="radio" checked={duplicateMode==="skip"} onChange={()=>setDuplicateMode("skip")}/><span><b>Omitir</b><small>Conserva el maestro existente sin cambios.</small></span></label>
            </div>
          </div>}

          {result.valid&&<div className="notice success">Validación completa. {commitBlockedByDuplicates?"Selecciona Actualizar u Omitir para los SKU existentes antes de confirmar.":"Puedes confirmar la importación."}</div>}
          {result.ok&&<div className="notice success">Importación completada. Actualizando el módulo…</div>}
        </div>}

        <div className="bulk-import-history">
          <div className="bulk-import-history-head"><div><strong>Historial reciente</strong><span>Origen, alcance, usuario y resultado de las últimas importaciones.</span></div></div>
          {historyBusy?<div className="bulk-import-history-empty">Consultando historial…</div>:history.length?<div className="bulk-import-history-list">
            {history.map(batch=><article key={batch.id}>
              <span className={"bulk-import-history-state "+batch.status}>{batch.status==="committed"?"Importada":batch.status==="rejected"?"Rechazada":"Validada"}</span>
              <div><strong>{batchLabel(batch)} · {batch.file_name}</strong><small>{batch.origin==="supplier"?"Proveedor · "+(batch.context_supplier_name||"contextual"):"Global"} · {new Date(batch.committed_at||batch.created_at).toLocaleString("es-CO")}{batch.user_name?" · "+batch.user_name:""}</small></div>
              <div className="bulk-import-history-counts"><span><b>{batch.imported_rows}</b> importadas</span><span><b>{batch.omitted_rows}</b> omitidas</span><span><b>{batch.warning_rows}</b> avisos</span><span><b>{batch.error_rows}</b> errores</span></div>
            </article>)}
          </div>:<div className="bulk-import-history-empty">Aún no hay importaciones registradas para este módulo.</div>}
        </div>

        <footer className="modal-actions">
          <button className="button secondary" type="button" onClick={()=>setOpen(false)}>Cancelar</button>
          <button className="button secondary" type="button" disabled={!file||busy} onClick={()=>run("validate")}>{busy?"Analizando…":"Analizar archivo"}</button>
          <button className="button" type="button" disabled={!file||busy||!result?.valid||commitBlockedByDuplicates} onClick={()=>run("commit")}><UiIcon name="upload" size={15}/> Confirmar importación</button>
        </footer>
      </section>
    </div>}
  </>;
}
