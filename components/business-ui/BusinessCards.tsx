import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import UiIcon, { type UiIconName } from "@/components/UiIcon";
import { Badge, type BadgeVariant } from "@/components/ui-kit/Badge";
import { ProgressBar } from "@/components/ui-kit/TimelineProgress";

export type BusinessDomain="asset"|"inventory"|"maintenance"|"work-order"|"supplier"|"company"|"location"|"user";

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
      {imageSrc?<img src={imageSrc} alt="" />:<UiIcon name="asset" size={48}/>}
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
  name,sku,category,presentation,quantity,unit,min,max,supplier,warehouse,unitValue,status,statusTone="neutral",active=true,imageSrc,actions,recordProps,
}:{
  name:string;sku:string;category:string;presentation:string;quantity:number;unit:string;min:number;max:number;supplier:string;warehouse:string;unitValue:string;
  status:string;statusTone?:BadgeVariant;active?:boolean;imageSrc?:string|null;actions?:ReactNode;recordProps?:RecordProps;
}){
  const progressMax=Math.max(max,min,quantity,1);
  return <BusinessCardShell domain="inventory" className={"inventory-product-card"+(active?"":" inactive")} recordProps={recordProps}>
    <div className="inventory-product-card-head ds-business-head">
      <span className={"inventory-product-visual ds-business-thumbnail"+(imageSrc?" has-image":"")}>{imageSrc?<img src={imageSrc} alt="" />:<UiIcon name="inventory" size={32}/>}</span>
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
  name,asset,company,frequency,nextDue,active,actions,recordProps,
}:{
  name:string;asset:string;company:string;frequency:string;nextDue:string;active:boolean;actions?:ReactNode;recordProps?:RecordProps;
}){
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

function workOrderTone(status:string):BadgeVariant{
  if(status==="completed")return "success";
  if(status==="cancelled")return "neutral";
  if(status==="paused")return "warning";
  if(status==="in_progress"||status==="assigned")return "info";
  return "brand";
}

export function WorkOrderCard({
  id,number,title,asset,company,priority,status,actions,recordProps,
}:{
  id:string;number:string;title:string;asset:string;company:string;priority:string;status:string;actions?:ReactNode;recordProps?:RecordProps;
}){
  return <BusinessCardShell domain="work-order" className="work-order-mobile-card" recordProps={recordProps}>
    <Link href={"/dashboard/work-orders/"+id} className="work-order-mobile-main ds-business-mobile-main">
      <div className="work-order-mobile-icon ds-business-icon" aria-hidden="true"><UiIcon name="work-order" size={20}/></div>
      <div className="work-order-mobile-copy"><span>OT #{number}</span><strong>{title}</strong><small>{asset}</small></div>
      <span className="work-order-mobile-chevron" aria-hidden="true"><UiIcon name="chevron-right" size={15}/></span>
    </Link>
    <BusinessMetaGrid className="work-order-mobile-meta" items={[
      {label:"Empresa",value:company},
      {label:"Prioridad",value:priority},
    ]}/>
    <div className="work-order-mobile-footer ds-business-actions">
      <Badge variant={workOrderTone(status)}>{status.replaceAll("_"," ")}</Badge>
      <Link className="text-button" href={"/dashboard/work-orders/"+id}>Ver actividades →</Link>
      {actions}
    </div>
  </BusinessCardShell>;
}

export function SupplierCard({
  name,subtitle,location,specialty,type,status,logoSrc,fallback,contact,phone,metrics,onOpen,actions,recordProps,
}:{
  name:string;subtitle:string;location:string;specialty:string;type:string;status:"active"|"inactive";logoSrc?:string|null;fallback:string;
  contact:string;phone:string;metrics:Array<{label:string;value:ReactNode}>;onOpen:()=>void;actions?:ReactNode;recordProps?:RecordProps;
}){
  return <BusinessCardShell domain="supplier" className={"supplier-directory-card-v2 "+(status==="active"?"":"inactive")} recordProps={recordProps}>
    <button type="button" className="supplier-card-open ds-business-open" onClick={onOpen} aria-label={"Abrir ficha de "+name}>
      <span className="supplier-card-banner ds-business-banner" aria-hidden="true"><Badge variant={status==="active"?"success":"neutral"}>{status==="active"?"Activo":"Inactivo"}</Badge></span>
      <span className="supplier-card-logo-row"><span className="supplier-card-logo ds-business-logo">{logoSrc?<img src={logoSrc} alt="" />:<b>{fallback}</b>}</span><span className="supplier-card-type">{type}</span></span>
      <span className="supplier-card-copy-v2 ds-business-copy"><strong>{name}</strong><span>{subtitle}</span><small>{location}</small><em>{specialty}</em></span>
      <span className="supplier-card-contact-v2"><span><UiIcon name="user" size={12}/><b>{contact}</b></span><span><UiIcon name="phone" size={12}/><b>{phone}</b></span></span>
      <BusinessMetricStrip className="supplier-card-metrics-v2" items={metrics}/>
    </button>
    {actions&&<div className="supplier-card-actions-v2 ds-business-actions">{actions}</div>}
  </BusinessCardShell>;
}

export function CompanyCard({
  name,plan,location,active,coverSrc,logoSrc,fallback,profileCompletion,pendingDocuments,resources,onOpen,recordProps,
}:{
  name:string;plan:string;location:string;active:boolean;coverSrc?:string|null;logoSrc?:string|null;fallback:string;
  profileCompletion:number;pendingDocuments:number;
  resources:Array<{label:string;current:number;max:number;href:string;icon:UiIconName}>;
  onOpen:()=>void;recordProps?:RecordProps;
}){
  return <BusinessCardShell domain="company" className="company-visual-card company-visual-card-v2 company-compact-card" recordProps={recordProps}>
    <button className="company-card-button company-card-main-action ds-business-open" type="button" onClick={onOpen} aria-label={"Ver detalle de "+name}>
      <div className={"company-card-cover ds-business-banner"+(coverSrc?"":" company-card-cover-fallback")}>{coverSrc&&<img src={coverSrc} alt="" />}<span className="ds-company-status"><Badge variant={active?"success":"neutral"}>{active?"Activa":"Inactiva"}</Badge></span></div>
      <div className="company-card-logo ds-business-logo">{logoSrc?<img src={logoSrc} alt={"Logo de "+name}/>:<span>{fallback}</span>}</div>
      <div className="company-card-content company-card-content-compact ds-business-copy">
        <div className="company-card-heading-row company-card-heading-centered"><h3>{name}</h3><Badge variant="brand">{plan}</Badge></div>
        <small className="company-card-location-compact">{location}</small>
      </div>
    </button>
    <nav className="company-resource-actions ds-company-resources" aria-label={"Recursos de "+name}>
      {resources.map(resource=><Link
        key={resource.label}
        href={resource.href}
        className="company-resource-action"
        title={resource.label}
        aria-label={resource.label+": "+resource.current+" usados de "+resource.max+" asignados. Abrir módulo."}
      >
        <span className="company-resource-action-icon"><UiIcon name={resource.icon} size={17}/></span>
        <strong>{resource.current}/{resource.max}</strong>
      </Link>)}
    </nav>
    <div className="company-card-footer-meta company-card-footer-compact ds-company-completion">
      <ProgressBar value={profileCompletion} label="Perfil" compact/>
      <small>{pendingDocuments} {pendingDocuments===1?"documento pendiente":"documentos pendientes"}</small>
    </div>
  </BusinessCardShell>;
}

export function LocationCard({
  name,organization,location,address,active,coverSrc,logoSrc,fallback,onOpen,resources,recordProps,
}:{
  name:string;organization:string;location:string;address:string;active:boolean;coverSrc?:string|null;logoSrc?:string|null;fallback:string;
  onOpen:()=>void;resources?:ReactNode;recordProps?:RecordProps;
}){
  return <BusinessCardShell domain="location" className="site-visual-card site-compact-card" recordProps={recordProps}>
    <button className="site-visual-card-button site-card-main-action ds-business-open" type="button" onClick={onOpen}>
      <div className={"site-visual-cover ds-business-banner"+(coverSrc?"":" fallback")}>{coverSrc&&<img src={coverSrc} alt="" />}<span className="ds-location-status"><Badge variant={active?"success":"neutral"}>{active?"Activa":"Inactiva"}</Badge></span></div>
      <div className="site-company-logo ds-business-logo">{logoSrc?<img src={logoSrc} alt={"Logo de "+organization}/>:<span>{fallback}</span>}</div>
      <div className="site-visual-content site-visual-content-compact ds-business-copy"><h3>{name}</h3><p><span>{organization}</span><span>{location}</span><span>{address}</span></p></div>
    </button>
    {resources}
  </BusinessCardShell>;
}

export function SubLocationCard({
  name,type,assetCount,imageSrc,organizationLogoSrc,fallback,onOpen,recordProps,
}:{
  name:string;type:string;assetCount:number;imageSrc?:string|null;organizationLogoSrc?:string|null;fallback:string;
  onOpen:()=>void;recordProps?:RecordProps;
}){
  return <BusinessCardShell domain="location" className="sublocation-visual-card ds-sublocation-card" recordProps={recordProps}>
    <button type="button" className="ds-business-open" onClick={onOpen} aria-label={"Abrir sububicación "+name}>
      <div className={"sublocation-visual-photo ds-business-banner"+(imageSrc?"":" fallback")}>{imageSrc&&<img src={imageSrc} alt="" />}</div>
      <div className="sublocation-mini-logo ds-business-logo">{organizationLogoSrc?<img src={organizationLogoSrc} alt="" />:<span>{fallback}</span>}</div>
      <strong>{name}</strong><small>{type} · {assetCount} activos</small>
    </button>
  </BusinessCardShell>;
}

export function UserCard({className="",children,recordProps}:{className?:string;children:ReactNode;recordProps?:RecordProps}){
  return <BusinessCardShell domain="user" className={className} recordProps={recordProps}>{children}</BusinessCardShell>;
}
