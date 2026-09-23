import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, isPlatformOwner } from "@/lib/permissions";
import { query } from "@/lib/db";
import OwnerRecordActions from "@/components/OwnerRecordActions";
import ModuleHeader from "@/components/ModuleHeader";
import CreateRecordModal from "@/components/CreateRecordModal";
import PhoneField from "@/components/PhoneField";
import { CountrySelect } from "@/components/InternationalFields";
import { countryName } from "@/lib/international-catalog";
import { getCustomizationSummary } from "@/lib/customization";

type Lead = {
  id:string;
  full_name:string;
  company_name:string;
  email:string;
  phone:string|null;
  country_code:string|null;
  interest:string;
  message:string|null;
  status:"new"|"contacted"|"qualified"|"closed"|"discarded";
  created_at:string;
};

const INTEREST_LABELS:Record<string,string>={
  demo:"Demostración",
  trial:"Prueba 15 días",
  basic:"Plan Básico",
  medium:"Plan Medio",
  pro:"Plan Pro / marca blanca",
  self_hosted:"Self-hosted",
  other:"Otro",
};

export default async function LeadsPage({searchParams}:{searchParams:Promise<{created?:string;error?:string}>}) {
  const session=await getSession();
  if(!session) redirect("/login");
  if(!can(session,"leads.manage")) redirect("/dashboard");
  const owner=isPlatformOwner(session);
  const feedback=await searchParams;

  const customization=await getCustomizationSummary();

  const leads=await query<Lead>(
    `SELECT id,full_name,company_name,email,phone,country_code,interest,message,status,created_at::text
     FROM sales_leads
     ORDER BY created_at DESC
     LIMIT 300`
  );

  const totals=await query<{status:string;count:string}>(
    `SELECT status,count(*)::text count
     FROM sales_leads GROUP BY status`
  );
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
          <div className="field form-span-2"><label>Interés *</label><select name="interest" defaultValue="demo"><option value="demo">Demostración</option><option value="trial">Prueba 15 días</option><option value="basic">Plan Básico</option><option value="medium">Plan Medio</option><option value="pro">Plan Pro / marca blanca</option><option value="self_hosted">Self-hosted</option><option value="other">Otro</option></select></div>
          <div className="field form-span-2"><label>Notas iniciales</label><textarea name="message" rows={4} placeholder="Ej. Busca controlar mantenimiento de 3 sedes y aproximadamente 120 activos." /></div>
          <div className="form-span-2 form-actions"><button className="button" type="submit">Crear lead</button></div>
        </form>
      </CreateRecordModal>}
    />
    {feedback.created && <div className="notice success section">Lead creado correctamente.</div>}
    {feedback.error && <div className="notice error section">Completa los campos obligatorios para crear el lead.</div>}

    <section className="grid section metric-grid leads-metrics">
      <div className="card metric-card"><div className="metric-icon">N</div><div><span className="muted">Nuevos</span><div className="metric">{byStatus.new || "0"}</div></div></div>
      <div className="card metric-card"><div className="metric-icon">C</div><div><span className="muted">Contactados</span><div className="metric">{byStatus.contacted || "0"}</div></div></div>
      <div className="card metric-card"><div className="metric-icon">Q</div><div><span className="muted">Calificados</span><div className="metric">{byStatus.qualified || "0"}</div></div></div>
      <div className="card metric-card"><div className="metric-icon">✓</div><div><span className="muted">Cerrados</span><div className="metric">{byStatus.closed || "0"}</div></div></div>
    </section>

    <section className="section leads-directory">
      {leads.rowCount===0 ? <div className="card empty-state"><span className="eyebrow">Sin oportunidades</span><h2>Aún no hay leads registrados</h2><p>Cuando alguien solicite contacto desde la landing aparecerá aquí.</p></div> :
        leads.rows.map(lead=><article className="card lead-card" key={lead.id} data-module-record data-status={lead.status} data-search={[lead.full_name,lead.company_name,lead.email,lead.phone,INTEREST_LABELS[lead.interest],lead.message,lead.status].filter(Boolean).join(" ")}>
          <div className="lead-card-head">
            <div><strong>{lead.full_name}</strong><span>{lead.company_name}</span></div>
            <span className={`lead-status lead-status-${lead.status}`}>{lead.status}</span>
          </div>
          <div className="lead-card-info">
            <div><span>Interés</span><strong>{INTEREST_LABELS[lead.interest] || lead.interest}</strong></div>
            <div><span>Correo</span><a href={`mailto:${lead.email}`}>{lead.email}</a></div>
            <div><span>País</span><strong>{countryName(lead.country_code)||"Sin registrar"}</strong></div>
            <div><span>Teléfono</span><strong>{lead.phone || "No registrado"}</strong></div>
            <div><span>Fecha</span><strong>{new Date(lead.created_at).toLocaleString("es-CO")}</strong></div>
          </div>
          {lead.message && <p className="lead-message">{lead.message}</p>}
          <form className="lead-status-form" method="post" action={`/api/leads/${lead.id}/status`}>
            <label>Seguimiento
              <select name="status" defaultValue={lead.status}>
                <option value="new">Nuevo</option>
                <option value="contacted">Contactado</option>
                <option value="qualified">Calificado</option>
                <option value="closed">Cerrado</option>
                <option value="discarded">Descartado</option>
              </select>
            </label>
            <button className="button secondary" type="submit">Actualizar</button>
          </form>
          {owner && <OwnerRecordActions
            table="sales_leads"
            id={lead.id}
            label={lead.full_name}
            fields={[
              {name:"full_name",label:"Nombre",value:lead.full_name},
              {name:"company_name",label:"Empresa",value:lead.company_name},
              {name:"email",label:"Correo",value:lead.email},
              {name:"phone",label:"Teléfono",value:lead.phone||""},
              {name:"message",label:"Mensaje",value:lead.message||"",type:"textarea"},
              {name:"status",label:"Estado",value:lead.status,type:"select",options:[
                {value:"new",label:"Nuevo"},{value:"contacted",label:"Contactado"},{value:"qualified",label:"Calificado"},{value:"closed",label:"Cerrado"},{value:"discarded",label:"Descartado"}
              ]},
            ]}
          />}
        </article>)}
    </section>
  </>;
}
