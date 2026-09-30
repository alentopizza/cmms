import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, isPlatformOwner } from "@/lib/permissions";
import { query } from "@/lib/db";
import OwnerRecordActions from "@/components/OwnerRecordActions";
import LeadPreviewAction from "@/components/LeadPreviewAction";
import ModuleHeader from "@/components/ModuleHeader";
import CreateRecordModal from "@/components/CreateRecordModal";
import PhoneField from "@/components/PhoneField";
import { CountrySelect } from "@/components/InternationalFields";
import { countryName } from "@/lib/international-catalog";
import { getCustomizationSummary } from "@/lib/customization";
import { CollectionView } from "@/components/ui-kit/DataControls";
import { StaticDataTable } from "@/components/ui-kit/StaticTable";
import { EntityIdentityCell, ListQuickActions } from "@/components/ui-kit/CollectionIdentity";
import { Avatar } from "@/components/ui-kit/Avatar";
import UiIcon from "@/components/UiIcon";
import ConfigurableCatalogSelect from "@/components/ConfigurableCatalogSelect";
import { listCatalogOptions } from "@/lib/configurable-catalogs";

type Lead = {
  id:string;
  full_name:string;
  company_name:string;
  email:string;
  phone:string|null;
  country_code:string|null;
  interest:string;
  message:string|null;
  source:string;
  status:"new"|"contacted"|"qualified"|"closed"|"discarded";
  followup_type:string|null;
  created_at:string;
  updated_at:string;
};

function initials(value:string){
  return value.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase()||"L";
}

const SOURCE_LABELS:Record<string,string>={landing:"Landing",manual:"Manual"};
const INTEREST_LABELS:Record<string,string>={
  demo:"Demostración",
  trial:"Prueba 15 días",
  basic:"Plan Básico",
  medium:"Plan Medio",
  pro:"Plan Pro / marca blanca",
  self_hosted:"Self-hosted",
  other:"Otro",
};

const STATUS_LABELS:Record<Lead["status"],string>={
  new:"Nuevo",
  contacted:"Contactado",
  qualified:"Calificado",
  closed:"Cerrado",
  discarded:"Descartado",
};

function formatLeadDate(value:string){
  return new Intl.DateTimeFormat("es-CO",{
    day:"2-digit",
    month:"2-digit",
    year:"numeric",
    hour:"numeric",
    minute:"2-digit",
  }).format(new Date(value));
}

export default async function LeadsPage({searchParams}:{searchParams:Promise<{created?:string;error?:string}>}) {
  const session=await getSession();
  if(!session) redirect("/login");
  if(!can(session,"leads.manage")) redirect("/dashboard");
  const owner=isPlatformOwner(session);
  const feedback=await searchParams;

  const customization=await getCustomizationSummary();

  const leads=await query<Lead>(
    `SELECT id,full_name,company_name,email,phone,country_code,interest,message,source,status,followup_type,created_at::text,updated_at::text
     FROM sales_leads
     ORDER BY created_at DESC
     LIMIT 300`
  );

  const totals=await query<{status:string;count:string}>(
    `SELECT status,count(*)::text count
     FROM sales_leads GROUP BY status`
  );
  const [leadSourceOptions,leadInterestOptions,leadStatusOptions,leadFollowupOptions]=await Promise.all([
    listCatalogOptions("lead_sources",null),
    listCatalogOptions("lead_interests",null),
    listCatalogOptions("lead_statuses",null),
    listCatalogOptions("lead_followups",null),
  ]);
  const byStatus=Object.fromEntries(totals.rows.map(row=>[row.status,row.count]));

  return <>
    <ModuleHeader
      eyebrow="Comercial"
      title="Leads"
      description="Solicitudes registradas desde la landing o creadas manualmente para seguimiento comercial."
      count={leads.rowCount || 0}
      countLabel="leads"
      searchPlaceholder="Buscar persona, empresa, correo o interés"
      filters={[
        {value:"all",label:"Todos"},
        {value:"new",label:"Nuevos"},
        {value:"contacted",label:"Contactados"},
        {value:"qualified",label:"Calificados"},
        {value:"closed",label:"Cerrados"},
        {value:"discarded",label:"Descartados"},
      ]}
      action={<CreateRecordModal title="Crear lead" eyebrow="Nuevo prospecto" description="Registra manualmente una oportunidad comercial para darle seguimiento desde el CMMS." triggerLabel="Agregar" icon="✦">
        <form className="form-grid unified-popup-form" method="post" action="/api/leads">
          <div className="field"><label>Nombre completo *</label><input name="full_name" required placeholder="Ej. Andrea Martínez" /></div>
          <div className="field"><label>Empresa *</label><input name="company_name" required placeholder="Ej. Alimentos Andinos S.A.S." /></div>
          <div className="field"><label>Correo *</label><input name="email" type="email" required placeholder="andrea@empresa.com" /></div>
          <CountrySelect id="manual-lead-country" name="country_code" label="País *" defaultValue={customization.defaultCountry} required />
          <PhoneField name="phone" label="Teléfono" countryCode={customization.defaultCountry} countryInputId="manual-lead-country" />
          <ConfigurableCatalogSelect name="source" label="Origen" catalog="lead_sources" defaultValue="manual" required allowManage />
          <ConfigurableCatalogSelect name="interest" label="Interés" catalog="lead_interests" defaultValue="demo" required allowManage />
          <ConfigurableCatalogSelect name="status" label="Estado" catalog="lead_statuses" defaultValue="new" required allowManage />
          <ConfigurableCatalogSelect name="followup_type" label="Seguimiento" catalog="lead_followups" placeholder="Selecciona seguimiento inicial" allowManage />
          <div className="field form-span-2"><label>Notas iniciales</label><textarea name="message" rows={4} placeholder="Ej. Busca controlar mantenimiento de 3 sedes y aproximadamente 120 activos." /></div>
          <div className="form-span-2 form-actions"><button className="button" type="submit">Crear lead</button></div>
        </form>
      </CreateRecordModal>}
    />
    {feedback.created && <div className="notice success section">Lead creado correctamente.</div>}
    {feedback.error && <div className="notice error section">Completa los campos obligatorios para crear el lead.</div>}

    <section className="section metric-grid leads-metrics" aria-label="Resumen de Leads">
      <div className="card metric-card lead-metric-card"><div className="metric-icon"><UiIcon name="crew" size={22}/></div><div><span className="muted">Nuevos</span><div className="metric">{byStatus.new || "0"}</div></div></div>
      <div className="card metric-card lead-metric-card"><div className="metric-icon"><UiIcon name="phone" size={21}/></div><div><span className="muted">Contactados</span><div className="metric">{byStatus.contacted || "0"}</div></div></div>
      <div className="card metric-card lead-metric-card"><div className="metric-icon"><UiIcon name="lead" size={22}/></div><div><span className="muted">Calificados</span><div className="metric">{byStatus.qualified || "0"}</div></div></div>
      <div className="card metric-card lead-metric-card"><div className="metric-icon"><UiIcon name="check" size={22}/></div><div><span className="muted">Cerrados</span><div className="metric">{byStatus.closed || "0"}</div></div></div>
    </section>

    <section className="section leads-directory card leads-list-panel">
      <div className="leads-list-head">
        <h2>Listado de Leads</h2>
        <div className="leads-list-secondary" aria-label="Orden y resultados del listado">
          <span>Ordenar por</span>
          <strong>Más recientes</strong>
          <small>Mostrando {leads.rowCount || 0} de {leads.rowCount || 0} leads</small>
        </div>
      </div>

      <div className="leads-list-body">
      {leads.rowCount===0 ? <div className="empty-state lead-empty-state"><span className="eyebrow">Sin oportunidades</span><h2>Aún no hay leads registrados</h2><p>Cuando alguien solicite contacto desde la landing aparecerá aquí.</p></div> :
        <CollectionView storageKey="leads" label="Vista de leads" grid={<div className="leads-directory-grid" data-collection-grid>{leads.rows.map(lead=>{
          const country=countryName(lead.country_code)||"Sin registrar";
          const interest=INTEREST_LABELS[lead.interest]||lead.interest;
          const statusLabel=STATUS_LABELS[lead.status];
          const createdAt=formatLeadDate(lead.created_at);
          const updatedAt=formatLeadDate(lead.updated_at);
          const editFields=[
            {name:"full_name",label:"Nombre",value:lead.full_name},
            {name:"company_name",label:"Empresa",value:lead.company_name},
            {name:"email",label:"Correo",value:lead.email},
            {name:"phone",label:"Teléfono",value:lead.phone||""},
            {name:"message",label:"Mensaje",value:lead.message||"",type:"textarea" as const},
            {name:"source",label:"Origen",value:lead.source,type:"select" as const,options:leadSourceOptions.map(option=>({value:option.code,label:option.label}))},
            {name:"interest",label:"Interés",value:lead.interest,type:"select" as const,options:leadInterestOptions.map(option=>({value:option.code,label:option.label}))},
            {name:"status",label:"Estado",value:lead.status,type:"select" as const,options:leadStatusOptions.map(option=>({value:option.code,label:option.label}))},
            {name:"followup_type",label:"Seguimiento",value:lead.followup_type||"",type:"select" as const,options:[{value:"",label:"Sin definir"},...leadFollowupOptions.map(option=>({value:option.code,label:option.label}))]},
          ];
          const drawerFollowup=<form className="lead-status-form lead-detail-status-form" method="post" action={"/api/leads/"+lead.id+"/status"}>
            <label><span>Seguimiento</span><select name="status" defaultValue={lead.status}>{leadStatusOptions.map(option=><option key={option.code} value={option.code}>{option.label}</option>)}</select></label>
            <button className="ds-button ds-button-secondary ds-button-sm" type="submit"><UiIcon name="check" size={14}/><span>Actualizar</span></button>
          </form>;
          const drawerActions=owner?<OwnerRecordActions table="sales_leads" id={lead.id} label={lead.full_name} fields={editFields} compact className="lead-detail-owner-actions" editOverlay={false} afterSaveReopenKey={"lead:"+lead.id}/>:undefined;
          const preview=<LeadPreviewAction name={lead.full_name} company={lead.company_name} email={lead.email} phone={lead.phone} country={country} interest={interest} message={lead.message} status={lead.status} statusLabel={statusLabel} createdAt={createdAt} updatedAt={updatedAt} sourceLabel={SOURCE_LABELS[lead.source]||lead.source} manageActions={drawerActions} followupControls={drawerFollowup} reopenKey={"lead:"+lead.id}/>;
          return <article className="card lead-card" key={lead.id} data-module-record data-status={lead.status} data-search={[lead.full_name,lead.company_name,lead.email,lead.phone,interest,SOURCE_LABELS[lead.source]||lead.source,lead.message,statusLabel].filter(Boolean).join(" ")}>
            <header className="lead-card-head">
              <div className="lead-card-identity">
                <Avatar initials={initials(lead.full_name)} size="lg"/>
                <div className="lead-card-title"><strong>{lead.full_name}</strong><span><UiIcon name="location" size={12}/>{country}</span></div>
              </div>
              <span className={"lead-status lead-status-"+lead.status}>{statusLabel}</span>
            </header>

            <div className="lead-crm-info-grid">
              <div className="lead-crm-field"><span className="lead-crm-icon"><UiIcon name="company" size={16}/></span><div><span>Empresa</span><strong>{lead.company_name}</strong></div></div>
              <div className="lead-crm-field"><span className="lead-crm-icon"><UiIcon name="lead" size={16}/></span><div><span>Interés</span><strong>{interest}</strong></div></div>
              <div className="lead-crm-field"><span className="lead-crm-icon"><UiIcon name="mail" size={16}/></span><div><span>Correo</span><a href={"mailto:"+lead.email}>{lead.email}</a></div></div>
              <div className="lead-crm-field"><span className="lead-crm-icon"><UiIcon name="phone" size={16}/></span><div><span>Teléfono</span><strong>{lead.phone || "No registrado"}</strong></div></div>
            </div>

            {lead.message&&<div className="lead-message"><UiIcon name="file" size={15}/><p>{lead.message}</p></div>}

            <footer className="lead-card-footer">
              <div className="lead-created-at"><UiIcon name="calendar" size={16}/><time dateTime={lead.created_at}>{createdAt}</time></div>
              <form className="lead-status-form" method="post" action={"/api/leads/"+lead.id+"/status"}>
                <label><span className="ds-visually-hidden">Seguimiento de {lead.full_name}</span>
                  <select name="status" defaultValue={lead.status} aria-label={"Seguimiento de "+lead.full_name}>{leadStatusOptions.map(option=><option key={option.code} value={option.code}>{option.label}</option>)}</select>
                </label>
                <button className="ds-list-action primary" type="submit" title="Actualizar seguimiento" data-tooltip="Actualizar seguimiento" aria-label={"Actualizar seguimiento de "+lead.full_name}><UiIcon name="check" size={15}/></button>
              </form>
              <div className="lead-card-actions">{preview}{owner&&<OwnerRecordActions table="sales_leads" id={lead.id} label={lead.full_name} fields={editFields} compact/>}</div>
            </footer>
          </article>;
        })}</div>} list={<StaticDataTable
          className="lead-directory-list"
          caption="Listado de leads"
          columns={[
            {key:"lead",label:"Lead",width:"22%"},
            {key:"status",label:"Estado"},
            {key:"company",label:"Empresa"},
            {key:"interest",label:"Interés"},
            {key:"email",label:"Correo"},
            {key:"phone",label:"Teléfono"},
            {key:"date",label:"Fecha"},
            {key:"followup",label:"Seguimiento"},
            {key:"actions",label:"Acciones",align:"end"},
          ]}
          rows={leads.rows.map(lead=>{
            const country=countryName(lead.country_code)||"Sin registrar";
            const interest=INTEREST_LABELS[lead.interest]||lead.interest;
            const statusLabel=STATUS_LABELS[lead.status];
            const createdAt=formatLeadDate(lead.created_at);
            const updatedAt=formatLeadDate(lead.updated_at);
            const editFields=[
              {name:"full_name",label:"Nombre",value:lead.full_name},
              {name:"company_name",label:"Empresa",value:lead.company_name},
              {name:"email",label:"Correo",value:lead.email},
              {name:"phone",label:"Teléfono",value:lead.phone||""},
              {name:"message",label:"Mensaje",value:lead.message||"",type:"textarea" as const},
              {name:"source",label:"Origen",value:lead.source,type:"select" as const,options:leadSourceOptions.map(option=>({value:option.code,label:option.label}))},
              {name:"interest",label:"Interés",value:lead.interest,type:"select" as const,options:leadInterestOptions.map(option=>({value:option.code,label:option.label}))},
              {name:"status",label:"Estado",value:lead.status,type:"select" as const,options:leadStatusOptions.map(option=>({value:option.code,label:option.label}))},
              {name:"followup_type",label:"Seguimiento",value:lead.followup_type||"",type:"select" as const,options:[{value:"",label:"Sin definir"},...leadFollowupOptions.map(option=>({value:option.code,label:option.label}))]},
            ];
            const drawerFollowup=<form className="lead-status-form lead-detail-status-form" method="post" action={"/api/leads/"+lead.id+"/status"}>
              <label><span>Seguimiento</span><select name="status" defaultValue={lead.status}>{leadStatusOptions.map(option=><option key={option.code} value={option.code}>{option.label}</option>)}</select></label>
              <button className="ds-button ds-button-secondary ds-button-sm" type="submit"><UiIcon name="check" size={14}/><span>Actualizar</span></button>
            </form>;
            const drawerActions=owner?<OwnerRecordActions table="sales_leads" id={lead.id} label={lead.full_name} fields={editFields} compact className="lead-detail-owner-actions" editOverlay={false} afterSaveReopenKey={"lead:"+lead.id}/>:undefined;
            const preview=<LeadPreviewAction name={lead.full_name} company={lead.company_name} email={lead.email} phone={lead.phone} country={country} interest={interest} message={lead.message} status={lead.status} statusLabel={statusLabel} createdAt={createdAt} updatedAt={updatedAt} sourceLabel={SOURCE_LABELS[lead.source]||lead.source} manageActions={drawerActions} followupControls={drawerFollowup} reopenKey={"lead:"+lead.id}/>;
            return {
              id:lead.id,
              recordProps:{"data-module-record":true,"data-status":lead.status,"data-search":[lead.full_name,lead.company_name,lead.email,lead.phone,interest,SOURCE_LABELS[lead.source]||lead.source,lead.message,statusLabel].filter(Boolean).join(" ")},
              cells:{
                lead:<EntityIdentityCell fallback={initials(lead.full_name)} icon="lead" variant="avatar" title={lead.full_name} subtitle={country}/>,
                status:<span className={"lead-status lead-status-"+lead.status}>{statusLabel}</span>,
                company:lead.company_name,
                interest,
                email:<a className="lead-table-email" href={"mailto:"+lead.email}>{lead.email}</a>,
                phone:lead.phone||"—",
                date:createdAt,
                followup:<form className="lead-status-form lead-status-form-compact" method="post" action={"/api/leads/"+lead.id+"/status"}>
                  <label><span className="ds-visually-hidden">Estado de seguimiento</span><select name="status" defaultValue={lead.status}>{leadStatusOptions.map(option=><option key={option.code} value={option.code}>{option.label}</option>)}</select></label>
                  <button className="ds-list-action" type="submit" title="Actualizar estado" data-tooltip="Actualizar estado" aria-label={"Actualizar estado de "+lead.full_name}><UiIcon name="check" size={15}/></button>
                </form>,
                actions:<ListQuickActions>{preview}{owner&&<OwnerRecordActions table="sales_leads" id={lead.id} label={lead.full_name} fields={editFields} compact/>}</ListQuickActions>,
              },
            };
          })}
        />}/>}
      </div>
    </section>
  </>;
}