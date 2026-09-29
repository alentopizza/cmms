import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import { Badge, type BadgeVariant } from "@/components/ui-kit/Badge";
import { PriorityBadge, WorkOrderStatusBadge } from "@/components/maintenance-ui/OperationStatus";
import { ProgressBar } from "@/components/ui-kit/TimelineProgress";

export type BusinessDomain="asset"|"inventory"|"maintenance"|"work-order"|"supplier"|"company"|"location"|"user"|"crew";

type RecordProps=HTMLAttributes<HTMLElement>&{[key:`data-${string}`]:string|number|boolean|undefined};

export function BusinessCardShell({
  domain,
  className="",
  recordProps={},
  children,
}:{
  domain:BusinessDomain;
  className?:string;
  recordProps?:RecordProps;
  children:ReactNode;
}){
  return <article {...recordProps} className={["ds-business-card","ds-business-"+domain,className].filter(Boolean).join(" ")}>
    {children}
  </article>;
}

export function BusinessMetaGrid({items,className=""}:{items:Array<{label:string;value:ReactNode}>;className?:string}){
  return <div className={["ds-business-meta-grid",className].filter(Boolean).join(" ")}>
    {items.map(item=><span key={item.label}><small>{item.label}</small><strong>{item.value}</strong></span>)}
  </div>;
}

export function BusinessMetricStrip({items,className=""}:{items:Array<{label:string;value:ReactNode}>;className?:string}){
  return <span className={["ds-business-metric-strip",className].filter(Boolean).join(" ")}>
    {items.map(item=><span key={item.label}><strong>{item.value}</strong><small>{item.label}</small></span>)}
  </span>;
}

export function BusinessProfileStat({label,value,hint,icon="activity"}:{label:string;value:ReactNode;hint?:string;icon?:UiIconName}){
  return <div className="entity-profile-stat ds-business-profile-stat">
    <span className="entity-profile-stat-icon" aria-hidden="true"><UiIcon name={icon} size={17}/></span>
    <div><small>{label}</small><strong>{value}</strong>{hint&&<em>{hint}</em>}</div>
    <span className="entity-profile-stat-arrow" aria-hidden="true"><UiIcon name="chevron-right" size={14}/></span>
  </div>;
}

export function AssetCard({
  name,code,category,site,location,supplier,criticality,manufacturerModel,status,statusTone="neutral",imageSrc,actions,recordProps,
}:{
  name:string;code:string;category:string;site:string;location?:string|null;supplier:string;criticality:string;manufacturerModel:string;
  status:string;statusTone?:BadgeVariant;imageSrc?:string|null;actions?:ReactNode;recordProps?:RecordProps;
}){
  return <BusinessCardShell domain="asset" className="asset-modern-card" recordProps={recordProps}>
    <div className={"asset-modern-visual ds-business-visual"+(imageSrc?" has-image":"")}>
      {imageSrc?<img src={imageSrc} alt="" loading="lazy" decoding="async" />:<UiIcon name="asset" size={48}/>}
      <Badge variant={statusTone} className="ds-business-status">{status}</Badge>
    </div>
    <div className="asset-modern-copy ds-business-copy">
      <div className="asset-modern-code ds-business-eyebrow">Código: {code}</div>
      <h3>{name}</h3>
      <p>{category}</p>
      <span className="ds-business-location-line"><UiIcon name="location" size={13}/>{site}{location?" · "+location:""}</span>
      <BusinessMetaGrid className="asset-modern-specs" items={[
        {label:"Proveedor",value:supplier},
        {label:"Criticidad",value:criticality},
        {label:"Fabricante / modelo",value:manufacturerModel},
      ]}/>
    </div>
    {actions&&<div className="asset-modern-actions ds-business-actions">{actions}</div>}
  </BusinessCardShell>;
}

export function InventoryCard({
  name,sku,category,presentation,quantity,unit,min,max,supplier,warehouse,unitValue,status,statusTone="neutral",active=true,imageSrc,actions,recordProps,variant="compact",
}:{
  name:string;sku:string;category:string;presentation:string;quantity:number;unit:string;min:number;max:number;supplier:string;warehouse:string;unitValue:string;
  status:string;statusTone?:BadgeVariant;active?:boolean;imageSrc?:string|null;actions?:ReactNode;recordProps?:RecordProps;variant?:"compact"|"catalog";
}){
  const progressMax=Math.max(max,min,quantity,1);
  const stockPercent=min>0?Math.max(0,Math.min(100,Math.round(quantity/min*100))):null;

  if(variant==="catalog"){
    return <BusinessCardShell domain="inventory" className={"inventory-catalog-card-v2"+(active?"":" inactive")} recordProps={recordProps}>
      <header className="inventory-catalog-head">
        <span className={"inventory-catalog-visual"+(imageSrc?" has-image":"")}>
          {imageSrc?<img src={imageSrc} alt={"Imagen de "+name} loading="lazy" decoding="async"/>:<UiIcon name="inventory" size={34}/>}
        </span>
        <div className="inventory-catalog-identity">
          <div className="inventory-catalog-tags">
            <span className="inventory-catalog-sku">{sku}</span>
            <Badge variant="info">{category}</Badge>
            {!active&&<Badge variant="neutral">Inactivo</Badge>}
          </div>
          <h3>{name}</h3>
          <p>{presentation||unit}</p>
          <div className="inventory-catalog-context">
            <span><UiIcon name="location" size={14}/>{warehouse||"Sin bodega"}</span>
            <span><UiIcon name="supplier" size={14}/>{supplier||"Sin proveedor"}</span>
          </div>
        </div>
        <div className="inventory-catalog-status"><Badge variant={statusTone}>{status}</Badge></div>
      </header>

      <div className="inventory-catalog-metrics">
        <div><strong>{quantity}</strong><small>Existencia actual · {unit}</small></div>
        <div><strong>{min}</strong><small>Stock mínimo · {unit}</small></div>
        <div><strong>{unitValue}</strong><small>Valor unitario</small></div>
      </div>

      <div className={"inventory-catalog-stock inventory-catalog-stock-"+statusTone}>
        {stockPercent!==null?<><div className="inventory-catalog-stock-track" aria-label={"Cobertura frente al stock mínimo "+stockPercent+"%"}><span style={{width:stockPercent+"%"}}/></div><strong>{stockPercent}%</strong></>:<div className="inventory-catalog-stock-track is-unavailable" aria-label="Porcentaje de stock no disponible"/>}
      </div>

      {actions&&<footer className="inventory-catalog-actions">{actions}</footer>}
    </BusinessCardShell>;
  }

  return <BusinessCardShell domain="inventory" className={"inventory-product-card"+(active?"":" inactive")} recordProps={recordProps}>
    <div className="inventory-product-card-head ds-business-head">
      <span className={"inventory-product-visual ds-business-thumbnail"+(imageSrc?" has-image":"")}>{imageSrc?<img src={imageSrc} alt="" loading="lazy" decoding="async" />:<UiIcon name="inventory" size={32}/>}</span>
      <div>
        <div className="inventory-product-state-row"><Badge variant={statusTone}>{status}</Badge>{!active&&<Badge variant="neutral">Inactivo</Badge>}</div>
        <small>SKU: {sku}</small><h3>{name}</h3><p>{category} · {presentation}</p>
      </div>
    </div>
    <div className="inventory-product-stock ds-business-stock">
      <div><strong>{quantity}</strong><span>{unit}</span></div>
      <ProgressBar value={quantity} max={progressMax} showValue={false} compact caption={"Mín: "+min+" · Máx: "+max} tone={statusTone==="danger"?"danger":statusTone==="warning"?"warning":"success"}/>
    </div>
    <BusinessMetaGrid className="inventory-product-meta" items={[
      {label:"Proveedor",value:supplier},
      {label:"Bodega",value:warehouse},
      {label:"Valor unitario",value:unitValue},
    ]}/>
    {actions&&<div className="inventory-product-actions ds-business-actions">{actions}</div>}
  </BusinessCardShell>;
}

export function MaintenanceCard({
  name,asset,company,frequency,nextDue,active,actions,recordProps,variant="compact",site,
}:{
  name:string;asset:string;company:string;frequency:string;nextDue:string;active:boolean;actions?:ReactNode;recordProps?:RecordProps;
  variant?:"compact"|"dashboard";site?:string;
}){
  if(variant==="dashboard"){
    return <BusinessCardShell domain="maintenance" className="maintenance-grid-card-v2" recordProps={recordProps}>
      <header className="maintenance-grid-card-head">
        <div className="maintenance-grid-card-identity">
          <span className="maintenance-grid-card-icon" aria-hidden="true"><UiIcon name="maintenance" size={20}/></span>
          <div className="maintenance-grid-card-heading">
            <div className="maintenance-grid-card-title-row">
              <strong>{name}</strong>
              <Badge variant={active?"success":"neutral"}>{active?"Activa":"Inactiva"}</Badge>
            </div>
            <p>{asset||"No asignado"}</p>
          </div>
        </div>
        <div className="maintenance-grid-card-due">
          <span>Próxima ejecución</span>
          <strong>{nextDue||"Sin programar"}</strong>
        </div>
      </header>

      <div className="maintenance-grid-facts">
        <div><span className="maintenance-grid-fact-icon"><UiIcon name="company" size={17}/></span><div><small>Empresa</small><strong>{company||"No especificado"}</strong></div></div>
        <div><span className="maintenance-grid-fact-icon"><UiIcon name="location" size={17}/></span><div><small>Ubicación</small><strong>{site||"No asignado"}</strong></div></div>
        <div><span className="maintenance-grid-fact-icon"><UiIcon name="asset" size={17}/></span><div><small>Activo / Equipo</small><strong>{asset||"No asignado"}</strong></div></div>
        <div><span className="maintenance-grid-fact-icon"><UiIcon name="clock" size={17}/></span><div><small>Frecuencia</small><strong>{frequency||"No especificado"}</strong></div></div>
      </div>

      <div className="maintenance-grid-schedule">
        <span className="maintenance-grid-schedule-marker" aria-hidden="true"/>
        <span className="maintenance-grid-schedule-icon" aria-hidden="true"><UiIcon name="calendar" size={16}/></span>
        <div><small>Programación</small><p>Próxima ejecución: <strong>{nextDue||"Sin programar"}</strong></p></div>
      </div>

      {actions&&<footer className="maintenance-grid-actions">{actions}</footer>}
    </BusinessCardShell>;
  }

  return <BusinessCardShell domain="maintenance" className="maintenance-mobile-card" recordProps={recordProps}>
    <div className="maintenance-mobile-main ds-business-mobile-main">
      <div className="maintenance-mobile-icon ds-business-icon" aria-hidden="true"><UiIcon name="maintenance" size={20}/></div>
      <div className="maintenance-mobile-copy"><span>{active?"Rutina activa":"Rutina inactiva"}</span><strong>{name}</strong><small>{asset}</small></div>
      <Badge variant={active?"success":"neutral"}>{active?"Activa":"Inactiva"}</Badge>
    </div>
    <BusinessMetaGrid className="maintenance-mobile-meta" items={[
      {label:"Empresa",value:company},
      {label:"Frecuencia",value:frequency},
      {label:"Próximo vencimiento",value:nextDue},
    ]}/>
    {actions&&<div className="maintenance-mobile-footer ds-business-actions">{actions}</div>}
  </BusinessCardShell>;
}

export function WorkOrderCard({
  id,number,title,asset,company,priority,status,actions,recordProps,
  variant="compact",site,type,description,createdAt,dueAt,assignedTo,
}:{
  id:string;number:string;title:string;asset:string;company:string;priority:string;status:string;actions?:ReactNode;recordProps?:RecordProps;
  variant?:"compact"|"dashboard";site?:string;type?:string;description?:string;createdAt?:string;dueAt?:string;assignedTo?:string;
}){
  if(variant==="dashboard"){
    return <BusinessCardShell domain="work-order" className="work-order-grid-card-v2" recordProps={recordProps}>
      <header className="work-order-grid-card-head">
        <div className="work-order-grid-card-identity">
          <span className="work-order-grid-card-icon" aria-hidden="true"><UiIcon name="work-order" size={20}/></span>
          <div className="work-order-grid-card-heading">
            <div className="work-order-grid-card-number"><strong>OT #{number}</strong><WorkOrderStatusBadge status={status}/></div>
            <p>{title}</p>
          </div>
        </div>
        <div className="work-order-grid-card-priority">
          <span>Prioridad</span>
          <div>
            <PriorityBadge priority={priority}/>
            <details className="work-order-grid-more">
              <summary title="Más opciones" aria-label={"Más opciones de OT #"+number}><UiIcon name="more" size={18}/></summary>
              <div><Link href={"/dashboard/work-orders/"+id}><UiIcon name="eye" size={14}/>Abrir detalle</Link></div>