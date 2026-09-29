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
            </details>
          </div>
        </div>
      </header>

      <div className="work-order-grid-facts">
        <div><span className="work-order-grid-fact-icon"><UiIcon name="company" size={17}/></span><div><small>Empresa</small><strong>{company}</strong></div></div>
        <div><span className="work-order-grid-fact-icon"><UiIcon name="location" size={17}/></span><div><small>Ubicación</small><strong>{site||"No asignado"}</strong></div></div>
        <div><span className="work-order-grid-fact-icon"><UiIcon name="asset" size={17}/></span><div><small>Activo / Equipo</small><strong>{asset||"No asignado"}</strong></div></div>
        <div><span className="work-order-grid-fact-icon"><UiIcon name="maintenance" size={17}/></span><div><small>Tipo de trabajo</small><strong>{type||"No especificado"}</strong></div></div>
      </div>

      <div className="work-order-grid-description">
        <span className="work-order-grid-description-marker" aria-hidden="true"/>
        <span className="work-order-grid-description-icon" aria-hidden="true"><UiIcon name="work-order" size={16}/></span>
        <div><small>Descripción</small><p>{description||"No especificado"}</p></div>
      </div>

      <div className="work-order-grid-dates">
        <div><span className="work-order-grid-meta-icon"><UiIcon name="calendar" size={17}/></span><div><small>Fecha creación</small><strong>{createdAt||"Sin fecha"}</strong></div></div>
        <div className={dueAt==="Sin fecha"?"is-empty":""}><span className="work-order-grid-meta-icon"><UiIcon name="clock" size={17}/></span><div><small>Fecha requerida</small><strong>{dueAt||"Sin fecha"}</strong></div></div>
        <div><span className="work-order-grid-meta-icon"><UiIcon name="user" size={17}/></span><div><small>Asignado a</small><strong>{assignedTo||"Sin asignar"}</strong></div></div>
      </div>

      <footer className={"work-order-grid-actions"+(actions?" has-owner-actions":"")}>
        <Link className="work-order-grid-action-primary" href={"/dashboard/work-orders/"+id}><UiIcon name="eye" size={16}/><span>Ver actividades</span></Link>
        {actions}
      </footer>
    </BusinessCardShell>;
  }

  return <BusinessCardShell domain="work-order" className="work-order-mobile-card" recordProps={recordProps}>
    <Link href={"/dashboard/work-orders/"+id} className="work-order-mobile-main ds-business-mobile-main">
      <div className="work-order-mobile-icon ds-business-icon" aria-hidden="true"><UiIcon name="work-order" size={20}/></div>
      <div className="work-order-mobile-copy"><span>OT #{number}</span><strong>{title}</strong><small>{asset}</small></div>
      <span className="work-order-mobile-chevron" aria-hidden="true"><UiIcon name="chevron-right" size={15}/></span>
    </Link>
    <BusinessMetaGrid className="work-order-mobile-meta" items={[
      {label:"Empresa",value:company},
      {label:"Prioridad",value:<PriorityBadge priority={priority}/>},
    ]}/>
    <div className="work-order-mobile-footer ds-business-actions">
      <WorkOrderStatusBadge status={status}/>
      <Link className="text-button" href={"/dashboard/work-orders/"+id}>Ver actividades →</Link>
      {actions}
    </div>
  </BusinessCardShell>;
}

export function SupplierCard({
  name,subtitle,location,specialty,type,status,logoSrc,fallback,contact,phone,email,metrics,onOpen,actions,recordProps,
}:{
  name:string;subtitle:string;location?:string|null;specialty?:string|null;type:string;status:"active"|"inactive";logoSrc?:string|null;fallback:string;
  contact?:string|null;phone?:string|null;email?:string|null;
  metrics:Array<{label:string;value:ReactNode;icon?:UiIconName}>;onOpen:()=>void;actions?:ReactNode;recordProps?:RecordProps;
}){
  const hasContact=Boolean(contact||phone||email);
  return <BusinessCardShell domain="supplier" className={"supplier-directory-card-v3 "+(status==="active"?"":"inactive")} recordProps={recordProps}>
    <button type="button" className="supplier-card-open-v3 ds-business-open" onClick={onOpen} aria-label={"Abrir ficha de "+name}>
      <span className="supplier-card-topbar-v3">
        <Badge variant={status==="active"?"success":"neutral"}>{status==="active"?"Activo":"Inactivo"}</Badge>
        <span className="supplier-card-type-v3" title={type}><UiIcon name="supplier" size={15}/><span>{type}</span></span>
      </span>

      <span className="supplier-card-identity-v3">
        <span className="supplier-card-logo-v3 ds-business-logo">{logoSrc?<img src={logoSrc} alt="" loading="lazy" decoding="async" />:<b>{fallback}</b>}</span>
        <span className="supplier-card-copy-v3 ds-business-copy">
          <strong>{name}</strong>
          {subtitle&&<span>{subtitle}</span>}
          {(location||specialty)&&<span className="supplier-card-detail-list-v3">
            {location&&<span title={location}><UiIcon name="location" size={15}/><b>{location}</b></span>}
            {specialty&&<span title={specialty}><UiIcon name="maintenance" size={15}/><b>{specialty}</b></span>}
          </span>}
          {hasContact&&<span className="supplier-card-contact-group-v3">
            {contact&&<span title={contact}><UiIcon name="user" size={15}/><b>{contact}</b></span>}
            {phone&&<span title={phone}><UiIcon name="phone" size={15}/><b>{phone}</b></span>}
            {email&&<span title={email}><UiIcon name="mail" size={15}/><b>{email}</b></span>}
          </span>}
        </span>
      </span>

      <span className="supplier-card-metrics-v3">
        {metrics.map(item=><span key={item.label}>
          <span className="supplier-card-metric-icon-v3" aria-hidden="true"><UiIcon name={item.icon||"activity"} size={20}/></span>
          <span><strong>{item.value}</strong><small>{item.label}</small></span>
        </span>)}
      </span>
    </button>
    {actions&&<div className="supplier-card-actions-v3 ds-business-actions">{actions}</div>}
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
      <div className={"company-card-cover ds-business-banner"+(coverSrc?"":" company-card-cover-fallback")}>{coverSrc&&<img src={coverSrc} alt="" loading="lazy" decoding="async" />}<span className="ds-company-status"><Badge variant={active?"success":"neutral"}>{active?"Activa":"Inactiva"}</Badge></span></div>
      <div className="company-card-logo ds-business-logo">{logoSrc?<img src={logoSrc} alt={"Logo de "+name} loading="lazy" decoding="async"/>:<span>{fallback}</span>}</div>
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
      <div className={"site-visual-cover ds-business-banner"+(coverSrc?"":" fallback")}>
        {coverSrc&&<img src={coverSrc} alt="" loading="lazy" decoding="async" />}
        <div className="site-company-logo ds-business-logo">{logoSrc?<img src={logoSrc} alt={"Logo de "+organization} loading="lazy" decoding="async"/>:<span>{fallback}</span>}</div>
        <span className="ds-location-status"><Badge variant={active?"success":"neutral"}>{active?"Activa":"Inactiva"}</Badge></span>
      </div>
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
      <div className={"sublocation-visual-photo ds-business-banner"+(imageSrc?"":" fallback")}>{imageSrc&&<img src={imageSrc} alt="" loading="lazy" decoding="async" />}</div>
      <div className="sublocation-mini-logo ds-business-logo">{organizationLogoSrc?<img src={organizationLogoSrc} alt="" loading="lazy" decoding="async" />:<span>{fallback}</span>}</div>
      <strong>{name}</strong><small>{type} · {assetCount} activos</small>
    </button>
  </BusinessCardShell>;
}

export function CrewCard({
  name,organization,site,active,leaderName,leaderRole,leaderPhotoSrc,fallback,description,metrics,members=[],leaderActions,menuActions,actions,recordProps,
}:{
  name:string;organization:string;site?:string|null;active:boolean;leaderName:string;leaderRole:string;leaderPhotoSrc?:string|null;fallback:string;
  description?:string|null;
  metrics:Array<{label:string;value:ReactNode;icon?:UiIconName}>;
  members?:Array<{id:string;name:string;role:string;photoSrc?:string|null;fallback:string}>;
  leaderActions?:ReactNode;menuActions?:ReactNode;actions?:ReactNode;recordProps?:RecordProps;
}){
  const visibleMembers=members.slice(0,3);
  const hiddenMembers=Math.max(0,members.length-visibleMembers.length);
  return <BusinessCardShell domain="crew" className={"crew-directory-card-v2 "+(active?"":"inactive")} recordProps={recordProps}>
    <header className="crew-directory-head-v2">
      <span className="crew-directory-icon-v2" aria-hidden="true"><UiIcon name="crew" size={19}/></span>
      <span className="crew-directory-title-v2">
        <strong>{name}</strong>
        {site&&<small><UiIcon name="location" size={13}/>{site}</small>}
      </span>
      <Badge variant={active?"success":"danger"}>{active?"Activa":"Inactiva"}</Badge>
      {menuActions&&<div className="crew-directory-menu-v2">{menuActions}</div>}
    </header>

    <div className="crew-directory-leader-v2">
      <span className="crew-directory-leader-avatar-v2">
        {leaderPhotoSrc?<img src={leaderPhotoSrc} alt={"Foto de "+leaderName} loading="lazy" decoding="async"/>:<b>{fallback}</b>}
      </span>
      <span className="crew-directory-leader-copy-v2">
        <strong><UiIcon name="user" size={13}/>{leaderName}</strong>
        <small>{leaderRole}</small>
      </span>
    </div>

    <div className="crew-directory-description-v2" title={description||undefined}>
      {description||<span aria-hidden="true">&nbsp;</span>}
    </div>

    <div className="crew-directory-metrics-v2">
      {metrics.map(item=><div key={item.label}>
        <span aria-hidden="true">{item.icon&&<UiIcon name={item.icon} size={16}/>}</span>
        <strong>{item.value}</strong>
        <small>{item.label}</small>
      </div>)}
    </div>

    <footer className="crew-directory-footer-v2">
      <div className="crew-directory-members-v2" aria-label={members.length+" integrantes"}>
        {visibleMembers.map(member=><span
          className="crew-directory-member-avatar-v2"
          key={member.id}
          title={member.name+" · "+member.role}
          data-tooltip={member.name+" · "+member.role}
        >{member.photoSrc?<img src={member.photoSrc} alt="" loading="lazy" decoding="async"/>:<b>{member.fallback}</b>}</span>)}
        {hiddenMembers>0&&<span className="crew-directory-member-more-v2" title={hiddenMembers+" integrantes adicionales"}>+{hiddenMembers}</span>}
      </div>
      {(leaderActions||actions)&&<div className="crew-directory-actions-v2 ds-business-actions">{leaderActions}{actions}</div>}
    </footer>
    <small className="crew-directory-org-v2">{organization}</small>
  </BusinessCardShell>;
}

export function UserCard({className="",children,recordProps}:{className?:string;children:ReactNode;recordProps?:RecordProps}){
  return <BusinessCardShell domain="user" className={className} recordProps={recordProps}>{children}</BusinessCardShell>;
}
