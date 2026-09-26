"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import FileDropzone from "@/components/FileDropzone";
import UiIcon from "@/components/UiIcon";
import { BRAND_SCHEMES, brandCssVariables, brandSchemeByKey, normalizeBrandHex, type BrandSchemeKey } from "@/lib/brand-theme";
import { Badge, Button, Modal } from "@/components/ui-kit";

type Tab="colors"|"logo"|"appearance"|"preview";
type InterfaceStyle="light"|"dark"|"system";
type Density="compact"|"normal"|"comfortable";

type BrandInitial={
  appName:string;
  primaryColor:string;
  secondaryColor:string;
  accentColor:string;
  schemeKey:BrandSchemeKey;
  autoPalette:boolean;
  interfaceStyle:InterfaceStyle;
  interfaceDensity:Density;
  hasBrandLogo:boolean;
  hasCompanyLogo:boolean;
};

const tabs:Array<{id:Tab;label:string;icon:"preferences"|"company"|"system"|"eye"}>=[
  {id:"colors",label:"Esquema de color",icon:"preferences"},
  {id:"logo",label:"Logo e identidad",icon:"company"},
  {id:"appearance",label:"Apariencia",icon:"system"},
  {id:"preview",label:"Vista previa",icon:"eye"},
];

function validColor(value:string,fallback:string){
  return /^#[0-9a-f]{6}$/i.test(value)?value:fallback;
}

export default function BrandPersonalization({
  organizationName,
  logoSrc,
  previewData,
  initial,
}:{
  organizationName:string;
  logoSrc:string;
  previewData:{city:string|null;siteCount:number;active:boolean};
  initial:BrandInitial;
}){
  const [active,setActive]=useState<Tab>("colors");
  const [schemeKey,setSchemeKey]=useState<BrandSchemeKey>(initial.schemeKey);
  const [primary,setPrimary]=useState(initial.primaryColor);
  const [secondary,setSecondary]=useState(initial.secondaryColor);
  const [accent,setAccent]=useState(initial.accentColor);
  const [autoPalette,setAutoPalette]=useState(initial.autoPalette);
  const [interfaceStyle,setInterfaceStyle]=useState<InterfaceStyle>(initial.interfaceStyle);
  const [density,setDensity]=useState<Density>(initial.interfaceDensity);
  const [logoFile,setLogoFile]=useState<File|null>(null);
  const [fileVersion,setFileVersion]=useState(0);
  const [resetOpen,setResetOpen]=useState(false);
  const logoObjectUrlRef=useRef<string|null>(null);
  const [logoPreview,setLogoPreview]=useState(logoSrc);

  useEffect(()=>()=>{if(logoObjectUrlRef.current)URL.revokeObjectURL(logoObjectUrlRef.current);},[]);

  const previewVars=useMemo(()=>brandCssVariables({
    primary:validColor(primary,initial.primaryColor),
    secondary:validColor(secondary,initial.secondaryColor),
    accent:validColor(accent,initial.accentColor),
  },autoPalette) as CSSProperties,[primary,secondary,accent,autoPalette,initial]);

  function selectScheme(key:BrandSchemeKey){
    const scheme=brandSchemeByKey(key);
    setSchemeKey(key);
    if(key!=="custom"){
      setPrimary(scheme.primary);
      setSecondary(scheme.secondary);
      setAccent(scheme.accent);
      setAutoPalette(true);
    }
  }

  function onLogoChange(file:File|null){
    setLogoFile(file);
    if(logoObjectUrlRef.current){URL.revokeObjectURL(logoObjectUrlRef.current);logoObjectUrlRef.current=null;}
    if(file){
      const next=URL.createObjectURL(file);
      logoObjectUrlRef.current=next;
      setLogoPreview(next);
    }else setLogoPreview(logoSrc);
  }

  function selectTab(next:Tab){
    setActive(next);
    window.requestAnimationFrame(()=>document.getElementById("brand-tab-"+next)?.focus());
  }

  function onTabKeyDown(event:KeyboardEvent<HTMLButtonElement>,current:Tab){
    const index=tabs.findIndex(tab=>tab.id===current);
    let next:Tab|null=null;
    if(event.key==="ArrowRight")next=tabs[(index+1)%tabs.length].id;
    if(event.key==="ArrowLeft")next=tabs[(index-1+tabs.length)%tabs.length].id;
    if(event.key==="Home")next=tabs[0].id;
    if(event.key==="End")next=tabs[tabs.length-1].id;
    if(next){event.preventDefault();selectTab(next);}
  }

  function cancelChanges(){
    setSchemeKey(initial.schemeKey);
    setPrimary(initial.primaryColor);
    setSecondary(initial.secondaryColor);
    setAccent(initial.accentColor);
    setAutoPalette(initial.autoPalette);
    setInterfaceStyle(initial.interfaceStyle);
    setDensity(initial.interfaceDensity);
    setLogoFile(null);
    if(logoObjectUrlRef.current){URL.revokeObjectURL(logoObjectUrlRef.current);logoObjectUrlRef.current=null;}
    setLogoPreview(logoSrc);
    setFileVersion(value=>value+1);
  }

  const previewClass=`brand-preview-shell brand-preview-${interfaceStyle} density-${density}`;

  return <div className="brand-personalization-workspace">
    <nav className="brand-tabs" aria-label="Secciones de personalización" role="tablist">
      {tabs.map(tab=><button
        key={tab.id}
        id={"brand-tab-"+tab.id}
        type="button"
        role="tab"
        aria-selected={active===tab.id}
        aria-controls={"brand-panel-"+tab.id}
        tabIndex={active===tab.id?0:-1}
        className={active===tab.id?"active":""}
        onClick={()=>setActive(tab.id)}
        onKeyDown={event=>onTabKeyDown(event,tab.id)}
      >
        <UiIcon name={tab.icon} size={16}/><span>{tab.label}</span>
      </button>)}
    </nav>

    <form className="brand-editor" method="post" action="/api/organization-branding" encType="multipart/form-data">
      <input type="hidden" name="return_to" value="brand"/>
      <input type="hidden" name="branding_form" value="advanced"/>
      <input type="hidden" name="app_name" value={initial.appName}/>
      <input type="hidden" name="scheme_key" value={schemeKey}/>
      <input type="hidden" name="primary_color" value={normalizeBrandHex(primary,initial.primaryColor)}/>
      <input type="hidden" name="secondary_color" value={normalizeBrandHex(secondary,initial.secondaryColor)}/>
      <input type="hidden" name="accent_color" value={normalizeBrandHex(accent,initial.accentColor)}/>
      <input type="hidden" name="auto_palette" value={autoPalette?"on":"off"}/>
      <input type="hidden" name="interface_style" value={interfaceStyle}/>
      <input type="hidden" name="interface_density" value={density}/>

      {active==="colors"&&<section id="brand-panel-colors" className="brand-tab-panel brand-color-layout" role="tabpanel" aria-labelledby="brand-tab-colors">
        <article className="brand-section-card">
          <div className="brand-section-heading"><span>1</span><div><h2>Selecciona un esquema predefinido</h2><p>Elige un esquema de color o crea uno personalizado con los colores de tu marca.</p></div></div>
          <div className="brand-scheme-grid">
            {BRAND_SCHEMES.map(scheme=><button key={scheme.key} type="button" className={"brand-scheme-card"+(schemeKey===scheme.key?" active":"")} onClick={()=>selectScheme(scheme.key)} aria-pressed={schemeKey===scheme.key}>
              <span className="brand-scheme-swatches" aria-hidden="true"><i style={{background:scheme.primary}}/><i style={{background:scheme.secondary}}/><i style={{background:scheme.accent}}/><i style={{background:brandCssVariables(scheme)["--brand-background"]}}/></span>
              <span><strong>{scheme.label}</strong><small>{scheme.description}</small></span>
              {schemeKey===scheme.key&&<UiIcon name="check" size={17}/>}
            </button>)}
          </div>
        </article>

        <article className="brand-section-card">
          <div className="brand-section-heading"><span>2</span><div><h2>Ajusta los colores de tu marca</h2><p>Personaliza los colores principales. Los demás tonos se generan automáticamente.</p></div></div>
          <div className="brand-color-fields">
            {[
              ["Color principal",primary,setPrimary,initial.primaryColor],
              ["Color secundario",secondary,setSecondary,initial.secondaryColor],
              ["Color de acento",accent,setAccent,initial.accentColor],
            ].map(([label,value,setter,fallback])=><label className="brand-color-field" key={String(label)}>
              <span>{String(label)}</span>
              <div><input type="color" value={validColor(String(value),String(fallback))} onChange={event=>{setSchemeKey("custom");(setter as (value:string)=>void)(event.target.value.toUpperCase());}}/><input aria-label={String(label)+" HEX"} value={String(value)} onChange={event=>{setSchemeKey("custom");(setter as (value:string)=>void)(event.target.value.toUpperCase());}} onBlur={()=>{(setter as (value:string)=>void)(normalizeBrandHex(String(value),String(fallback)));}} maxLength={7}/></div>
            </label>)}
          </div>
          <label className="brand-auto-palette">
            <input type="checkbox" checked={autoPalette} onChange={event=>setAutoPalette(event.target.checked)}/>
            <span className="brand-auto-track" aria-hidden="true"><i/></span>
            <span><strong>Generar paleta automáticamente</strong><small>{autoPalette?"El sistema creará tonos complementarios para una experiencia visual completa.":"Se aplicarán tus tres colores directos y los tonos estructurales conservarán la base segura de Desweb CMMS."}</small></span>
          </label>
          <div className="brand-semantic-note"><UiIcon name="info" size={17}/><span>Los estados de éxito, advertencia, error e información mantienen sus colores semánticos para conservar comprensión y accesibilidad.</span></div>
        </article>
      </section>}

      {active==="logo"&&<section id="brand-panel-logo" className="brand-tab-panel brand-logo-layout" role="tabpanel" aria-labelledby="brand-tab-logo">
        <article className="brand-section-card">
          <div className="brand-section-heading"><span><UiIcon name="company" size={18}/></span><div><h2>Logo de la empresa</h2><p>Usa la identidad gráfica de {organizationName} sin crear un segundo almacén de archivos.</p></div></div>
          <div className="brand-logo-preview"><img src={logoPreview} alt={"Logo actual de "+organizationName}/></div>
          <FileDropzone
            key={fileVersion}
            name="logo"
            label="Cambiar logo"
            description="PNG, JPG o WebP · máximo 2 MB. El logo se mantiene sin deformación."
            accept="image/png,image/jpeg,image/webp"
            maxSizeMb={2}
            kind="image"
            compact
            existingFileName={initial.hasBrandLogo?"Logo de marca actual":initial.hasCompanyLogo?"Logo existente de la empresa":null}
            existingPreviewUrl={logoSrc}
            onFileChange={onLogoChange}
          />
          {!initial.hasBrandLogo&&initial.hasCompanyLogo&&<div className="brand-semantic-note"><UiIcon name="info" size={17}/><span>Se reutiliza el logo existente de la empresa. Al guardar la identidad se usará como fallback sin duplicar el archivo.</span></div>}
          {initial.hasBrandLogo&&<Button type="submit" name="intent" value="remove_logo" variant="danger" iconLeft="trash">Eliminar logo de marca</Button>}
        </article>

        <article className="brand-section-card">
          <div className="brand-section-heading"><span><UiIcon name="preferences" size={18}/></span><div><h2>Colores de la marca</h2><p>Resumen de los colores que se aplicarán a navegación, acciones y elementos activos.</p></div></div>
          <div className="brand-color-summary">
            {[["Color principal",primary],["Color secundario",secondary],["Color de acento",accent]].map(([label,value])=><div key={label}><i style={{background:validColor(value,initial.primaryColor)}}/><span><small>{label}</small><strong>{normalizeBrandHex(value,initial.primaryColor)}</strong></span></div>)}
          </div>
          <label className="brand-auto-palette compact">
            <input type="checkbox" checked={autoPalette} onChange={event=>setAutoPalette(event.target.checked)}/>
            <span className="brand-auto-track" aria-hidden="true"><i/></span>
            <span><strong>Generar paleta automáticamente</strong><small>Deriva estados visuales de marca sin tocar colores semánticos.</small></span>
          </label>
        </article>
      </section>}

      {active==="appearance"&&<section id="brand-panel-appearance" className="brand-tab-panel" role="tabpanel" aria-labelledby="brand-tab-appearance">
        <article className="brand-section-card">
          <div className="brand-section-heading"><span><UiIcon name="system" size={18}/></span><div><h2>Estilo de interfaz</h2><p>Define la apariencia predeterminada de la experiencia de marca. La preferencia personal del usuario puede seguir usando el sistema de tema existente.</p></div></div>
          <div className="brand-appearance-grid">
            {([
              ["light","Clara","Optimizada para la oficina.","sun"],
              ["dark","Oscura","Ideal para entornos con baja luz.","moon"],
              ["system","Automática","Según la configuración del sistema.","system"],
            ] as const).map(([value,label,description,icon])=><button key={value} type="button" className={interfaceStyle===value?"active":""} onClick={()=>setInterfaceStyle(value)} aria-pressed={interfaceStyle===value}>
              <span className={"brand-appearance-mock "+value}><UiIcon name={icon} size={20}/><i/><i/></span>
              <strong>{label}</strong><small>{description}</small>
              {interfaceStyle===value&&<UiIcon name="check" size={16}/>}
            </button>)}
          </div>
        </article>

        <article className="brand-section-card">
          <div className="brand-section-heading"><span><UiIcon name="reorder" size={18}/></span><div><h2>Densidad de interfaz</h2><p>Selecciona cuánta información se muestra sin alterar la estructura funcional del CMMS.</p></div></div>
          <div className="brand-density-grid">
            {([
              ["compact","Compacta","Más contenido en pantalla."],
              ["normal","Normal","Equilibrio visual."],
              ["comfortable","Cómoda","Mayor espacio entre elementos."],
            ] as const).map(([value,label,description])=><button key={value} type="button" className={density===value?"active":""} onClick={()=>setDensity(value)} aria-pressed={density===value}>
              <span className={"brand-density-icon "+value}><i/><i/><i/></span><span><strong>{label}</strong><small>{description}</small></span>{density===value&&<UiIcon name="check" size={16}/>}
            </button>)}
          </div>
        </article>
      </section>}

      {active==="preview"&&<section id="brand-panel-preview" className="brand-tab-panel" role="tabpanel" aria-labelledby="brand-tab-preview">
        <article className="brand-section-card brand-preview-card">
          <div className="brand-section-heading"><span><UiIcon name="eye" size={18}/></span><div><h2>Vista previa en tiempo real</h2><p>Así se verá CMMS con la identidad visual seleccionada. Los cambios todavía no están guardados.</p></div></div>
          <div className={previewClass} style={previewVars}>
            <aside>
              <img src={logoPreview} alt=""/>
              {["Dashboard","Empresas","Ubicaciones","Proveedores","Usuarios","Cuadrillas"].map((item,index)=><span key={item} className={index===1?"active":""}><UiIcon name={index===1?"company":index===2?"location":index===4?"user":"dashboard"} size={15}/>{item}</span>)}
            </aside>
            <main>
              <header><div><UiIcon name="company" size={18}/><span><small>MÓDULO DE EJEMPLO</small><strong>Empresas</strong></span></div><Button size="sm" iconLeft="plus">Agregar</Button></header>
              <section><h3>Empresas</h3><p>Gestiona las empresas del sistema.</p>
                <div className="brand-preview-toolbar">
                  <div className="brand-preview-tabs" aria-label="Tabs de ejemplo">
                    <button type="button" className="active">Resumen</button>
                    <button type="button">Empresas</button>
                    <button type="button">Actividad</button>
                  </div>
                  <div className="brand-preview-filter">
                    <UiIcon name="search" size={13}/>
                    <span>Buscar...</span>
                    <button type="button" aria-label="Filtro de ejemplo"><UiIcon name="filter" size={13}/></button>
                  </div>
                </div>
                <div className="brand-preview-kpis">
                  <article><small>Sedes registradas</small><strong>{previewData.siteCount}</strong></article>
                  <article><small>Estado de empresa</small><strong>{previewData.active?"Activa":"Inactiva"}</strong></article>
                  <article><small>Ciudad principal</small><strong>{previewData.city||"Sin ciudad"}</strong></article>
                </div>
                <div className="brand-preview-table"><div className="head"><span>EMPRESA</span><span>CIUDAD</span><span>ESTADO</span><span>ACCIONES</span></div><div><strong>{organizationName}</strong><span>{previewData.city||"Sin ciudad"}</span><Badge variant={previewData.active?"success":"neutral"}>{previewData.active?"Activa":"Inactiva"}</Badge><button type="button" aria-label="Vista de ejemplo"><UiIcon name="eye" size={14}/></button></div></div>
              </section>
            </main>
          </div>
        </article>
      </section>}

      <footer className="brand-savebar">
        <button type="button" className="brand-restore-trigger" onClick={()=>setResetOpen(true)}><UiIcon name="reset" size={15}/> Restaurar predeterminado</button>
        <div><Button type="button" variant="secondary" onClick={cancelChanges}>Cancelar</Button><Button type="submit" name="intent" value="save" iconLeft="check">Guardar identidad visual</Button></div>
      </footer>
    </form>

    <Modal open={resetOpen} onClose={()=>setResetOpen(false)} title="¿Restaurar la identidad visual predeterminada de Desweb CMMS?" description="Se eliminará la personalización guardada de esta empresa y volverá a utilizarse la identidad base." size="sm" role="alertdialog" footer={<>
      <Button variant="secondary" onClick={()=>setResetOpen(false)}>Cancelar</Button>
      <form method="post" action="/api/organization-branding"><input type="hidden" name="return_to" value="brand"/><input type="hidden" name="intent" value="reset"/><Button type="submit" variant="danger" iconLeft="reset">Restaurar</Button></form>
    </>}>
      <div className="brand-reset-icon"><UiIcon name="reset" size={28}/></div>
    </Modal>
  </div>;
}
