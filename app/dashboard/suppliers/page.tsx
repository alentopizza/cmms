import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can, isPlatformOwner } from "@/lib/permissions";
import { query } from "@/lib/db";
import { gateFor, getSetupState } from "@/lib/setup-sequence";
import OwnerRecordActions from "@/components/OwnerRecordActions";
import ModuleHeader from "@/components/ModuleHeader";
import CreateRecordModal from "@/components/CreateRecordModal";

type Supplier = {
  id:string;
  organization_id:string;
  organization_name:string;
  name:string;
  tax_id:string|null;
  supplier_type:"materials"|"services"|"both";
  service_category:string|null;
  contact_name:string|null;
  email:string|null;
  phone:string|null;
  active:boolean;
};

type Organization = { id:string; name:string };

function typeLabel(type:Supplier["supplier_type"]) {
  if (type==="services") return "Servicios";
  if (type==="both") return "Materiales + servicios";
  return "Materiales / suministros";
}

export default async function SuppliersPage({searchParams}:{searchParams:Promise<{created?:string;error?:string}>}) {
  const session=await getSession();
  if(!session) redirect("/login");
  if(!can(session,"suppliers.manage")) redirect("/dashboard");
  const params=await searchParams;
  const superadmin=session.platformRole!=="user";
  const owner=isPlatformOwner(session);

  const [suppliers,organizations]=await Promise.all([
    superadmin
      ? query<Supplier>(
          `SELECT s.id,s.organization_id,o.name organization_name,s.name,s.tax_id,s.supplier_type,
                  s.service_category,s.contact_name,s.email,s.phone,s.active
           FROM suppliers s JOIN organizations o ON o.id=s.organization_id
           ORDER BY o.name,s.active DESC,s.name`)
      : query<Supplier>(
          `SELECT s.id,s.organization_id,o.name organization_name,s.name,s.tax_id,s.supplier_type,
                  s.service_category,s.contact_name,s.email,s.phone,s.active
           FROM suppliers s JOIN organizations o ON o.id=s.organization_id
           WHERE s.organization_id=$1 ORDER BY s.active DESC,s.name`,
          [session.organizationId]),
    superadmin
      ? query<Organization>("SELECT id,name FROM organizations WHERE active=true ORDER BY name")
      : query<Organization>("SELECT id,name FROM organizations WHERE id=$1",[session.organizationId]),
  ]);

  const selectedOrgId = superadmin ? (organizations.rows[0]?.id || null) : session.organizationId;
  const gate = selectedOrgId ? gateFor(await getSetupState(selectedOrgId),"supplier") : null;

  const error = params.error==="sequence"
    ? "Primero crea una ubicación principal y al menos una sububicación para la empresa."
    : params.error==="required"
      ? "Completa el nombre y tipo de proveedor."
      : params.error
        ? "No fue posible crear el proveedor."
        : "";

  return <>
    <ModuleHeader
      eyebrow="Abastecimiento y terceros"
      title="Proveedores"
      description="Registra quién suministra materiales, activos o servicios antes de crear recursos que dependan de esa relación."
      count={suppliers.rowCount || 0}
      countLabel="proveedores"
      searchPlaceholder="Buscar proveedor, NIT, servicio o contacto"
      action={<CreateRecordModal title="Crear proveedor" eyebrow="Nuevo proveedor" description="Registra la relación comercial y los datos de contacto del proveedor." triggerLabel="Agregar" icon="▣">
        <form className="form-grid unified-popup-form" method="post" action="/api/suppliers">
          {superadmin ? <div className="field"><label>Empresa *</label><select name="organization_id" required><option value="">Selecciona una empresa</option>{organizations.rows.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}</select></div>
            : <input type="hidden" name="organization_id" value={session.organizationId || ""}/>}
          <div className="field"><label>Tipo *</label><select name="supplier_type" defaultValue="materials"><option value="materials">Materiales / suministros</option><option value="services">Servicios tercerizados</option><option value="both">Materiales + servicios</option></select></div>
          <div className="field"><label>Nombre / razón social *</label><input name="name" required placeholder="Ej. Servicios Técnicos Andinos S.A.S." /></div>
          <div className="field"><label>NIT / identificación</label><input name="tax_id" placeholder="Ej. 900123456-7" /></div>
          <div className="field"><label>Categoría de servicio</label><input name="service_category" placeholder="Ej. Refrigeración, electricidad u obra civil" /></div>
          <div className="field"><label>Persona de contacto</label><input name="contact_name" placeholder="Ej. Carlos Pérez" /></div>
          <div className="field"><label>Correo</label><input name="email" type="email" placeholder="servicios@empresa.com" /></div>
          <div className="field"><label>Teléfono</label><input name="phone" placeholder="+57 300 000 0000" /></div>
          <div className="field form-span-2"><label>Notas</label><textarea name="notes" rows={3} placeholder="Ej. Cobertura nacional, atención 24/7 y contacto de emergencias." /></div>
          <div className="form-span-2 form-actions"><button className="button" type="submit">Crear proveedor</button></div>
        </form>
      </CreateRecordModal>}
    />

    {params.created && <div className="notice success section">Proveedor creado correctamente.</div>}
    {error && <div className="notice error section">{error}</div>}

    <section className="card section setup-flow-card">
      <div className="setup-flow-head">
        <div><span className="eyebrow">Orden de configuración</span><h2>Este módulo se habilita después de la estructura física</h2></div>
        <span className={`setup-flow-state ${gate?.ready ? "ready" : "blocked"}`}>{gate?.ready ? "Habilitado" : "Paso pendiente"}</span>
      </div>
      <div className="setup-flow-steps">
        <span className="done"><b>1</b> Empresa</span>
        <span className={gate?.ready ? "done" : ""}><b>2</b> Ubicación</span>
        <span className={gate?.ready ? "done" : ""}><b>3</b> Sububicación</span>
        <span className={gate?.ready ? "active" : ""}><b>4</b> Proveedores</span>
      </div>
      {!gate?.ready && gate?.href && <a className="button secondary" href={gate.href}>{gate.action}</a>}
    </section>

    <section className="section">
      <div className="section-heading"><div><span className="eyebrow">Directorio</span><h2>Proveedores registrados</h2></div></div>
      {suppliers.rowCount ? <div className="supplier-grid">
        {suppliers.rows.map(s=><article className="card supplier-card" key={s.id} data-module-record data-status={s.active?"active":"inactive"} data-search={[s.name,s.organization_name,s.tax_id,s.service_category,s.contact_name,s.email,s.phone].filter(Boolean).join(" ")}>
          <div className="supplier-card-head">
            <div className="supplier-icon">{s.supplier_type==="services" ? "⚙" : s.supplier_type==="both" ? "◆" : "▤"}</div>
            <div><strong>{s.name}</strong><span>{s.organization_name}</span></div>
            <span className={`status-badge ${s.active ? "status-active" : "status-inactive"}`}><i />{s.active ? "Activo" : "Inactivo"}</span>
          </div>
          <div className="supplier-meta">
            <div><span>Tipo</span><strong>{typeLabel(s.supplier_type)}</strong></div>
            <div><span>NIT</span><strong>{s.tax_id || "Sin registrar"}</strong></div>
            <div><span>Servicio</span><strong>{s.service_category || "No aplica"}</strong></div>
            <div><span>Contacto</span><strong>{s.contact_name || s.email || s.phone || "Sin registrar"}</strong></div>
          </div>
          {owner&&<OwnerRecordActions table="suppliers" id={s.id} label={s.name} fields={[
            {name:"name",label:"Nombre",value:s.name},
            {name:"tax_id",label:"Identificación",value:s.tax_id||""},
            {name:"supplier_type",label:"Tipo",value:s.supplier_type,type:"select",options:[
              {value:"materials",label:"Materiales"},{value:"services",label:"Servicios"},{value:"both",label:"Materiales + servicios"}
            ]},
            {name:"service_category",label:"Categoría",value:s.service_category||""},
            {name:"contact_name",label:"Contacto",value:s.contact_name||""},
            {name:"email",label:"Correo",value:s.email||""},
            {name:"phone",label:"Teléfono",value:s.phone||""},
            {name:"active",label:"Estado",value:s.active,type:"checkbox"},
          ]}/>}
        </article>)}
      </div> : <div className="card empty-state"><strong>Aún no hay proveedores.</strong><span>Registra el primero antes de crear activos o artículos de inventario.</span></div>}
    </section>
  </>;
}
