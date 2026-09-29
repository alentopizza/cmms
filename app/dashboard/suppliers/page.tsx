import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { organizationScopeFor } from "@/lib/organization-scope";
import { query } from "@/lib/db";
import { getCreationGateForScope } from "@/lib/setup-sequence";
import ModuleHeader from "@/components/ModuleHeader";
import CreateRecordModal from "@/components/CreateRecordModal";
import CreationPrerequisiteState from "@/components/CreationPrerequisiteState";
import PhoneField from "@/components/PhoneField";
import FileDropzone from "@/components/FileDropzone";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import { CountryCityFields, TaxIdentificationTypeSelect } from "@/components/InternationalFields";
import SupplierDirectory, { type SupplierDirectoryItem } from "@/components/SupplierDirectory";
import { Alert } from "@/components/ui-kit/Feedback";

type Organization={id:string;name:string;country:string};
type CatalogOption={code:string;label:string};

export default async function SuppliersPage({searchParams}:{searchParams:Promise<{
  created?:string;updated?:string;deleted?:string;error?:string;supplier?:string;tab?:string;saved?:string;requisition_created?:string;
  inventory_created?:string;inventory_error?:string;
}>}){
  const session=await getSession();
  if(!session)redirect("/login");
  if(!can(session,"suppliers.manage"))redirect("/dashboard");
  const params=await searchParams;
  const platform=session.platformRole!=="user";
  const organizationScope=organizationScopeFor(session);
  const supplierScopeParams:unknown[]=[organizationScope.unrestricted,organizationScope.organizationIds];

  const supplierSql=`SELECT s.id,s.organization_id,o.name organization_name,COALESCE(o.default_country,o.legal_country) organization_country,
      s.code,s.name,s.legal_name,s.tax_id,s.tax_id_type,s.country_code,s.city,s.supplier_type,s.service_category,
      s.contact_name,s.email,s.phone,s.active,(s.logo_data IS NOT NULL) has_logo,
      COALESCE(capabilities.codes,ARRAY[]::text[]) capability_codes,
      COALESCE(capabilities.labels,ARRAY[]::text[]) capability_labels,
      COALESCE(specialties.codes,ARRAY[]::text[]) specialty_codes,
      COALESCE(specialties.labels,ARRAY[]::text[]) specialty_labels,
      COALESCE(activity_stats.activity_count,0)::int activity_count,
      COALESCE(activity_stats.active_activity_count,0)::int active_activity_count,
      CASE WHEN s.active AND s.supplier_type IN ('materials','both') THEN COALESCE(item_stats.item_count,0)::int ELSE 0 END item_count,
      CASE WHEN s.active AND s.supplier_type IN ('materials','both') THEN COALESCE(item_stats.active_item_count,0)::int ELSE 0 END active_item_count,
      COALESCE(req_stats.requisition_count,0)::int requisition_count,
      COALESCE(req_stats.directory_requisition_count,0)::int directory_requisition_count,
      COALESCE(req_stats.open_requisition_count,0)::int open_requisition_count,
      COALESCE(document_stats.document_count,0)::int document_count,
      COALESCE(document_stats.active_document_count,0)::int active_document_count
    FROM suppliers s
    JOIN organizations o ON o.id=s.organization_id
    LEFT JOIN LATERAL (
      SELECT array_agg(sc.capability_code ORDER BY cc.sort_order,cc.label) codes,
             array_agg(cc.label ORDER BY cc.sort_order,cc.label) labels
      FROM supplier_capabilities sc
      JOIN supplier_capability_catalog cc ON cc.code=sc.capability_code
      WHERE sc.supplier_id=s.id
    ) capabilities ON true
    LEFT JOIN LATERAL (
      SELECT array_agg(ss.specialty_code ORDER BY cs.sort_order,cs.label) codes,
             array_agg(cs.label ORDER BY cs.sort_order,cs.label) labels
      FROM supplier_specialties ss
      JOIN supplier_specialty_catalog cs ON cs.code=ss.specialty_code
      WHERE ss.supplier_id=s.id
    ) specialties ON true
    LEFT JOIN (
      SELECT wt.service_supplier_id supplier_id,
             count(*)::int activity_count,
             count(*) FILTER (WHERE wt.status IN ('pending','in_progress'))::int active_activity_count
      FROM work_order_tasks wt
      JOIN work_orders work_order ON work_order.id=wt.work_order_id
      WHERE wt.service_supplier_id IS NOT NULL
        AND ($1::boolean OR work_order.organization_id=ANY($2::uuid[]))
      GROUP BY wt.service_supplier_id
    ) activity_stats ON activity_stats.supplier_id=s.id
    LEFT JOIN (
      SELECT i.supplier_id,
             count(*)::int item_count,
             count(*) FILTER (WHERE i.active<>false)::int active_item_count
      FROM inventory_items i
      WHERE i.supplier_id IS NOT NULL
        AND ($1::boolean OR i.organization_id=ANY($2::uuid[]))
      GROUP BY i.supplier_id
    ) item_stats ON item_stats.supplier_id=s.id
    LEFT JOIN (
      SELECT r.supplier_id,
             count(*)::int requisition_count,
             count(*) FILTER (WHERE r.status NOT IN ('closed','cancelled'))::int directory_requisition_count,
             count(*) FILTER (WHERE r.status NOT IN ('closed','cancelled','fulfilled'))::int open_requisition_count
      FROM supplier_requisitions r
      WHERE ($1::boolean OR r.organization_id=ANY($2::uuid[]))
      GROUP BY r.supplier_id
    ) req_stats ON req_stats.supplier_id=s.id
    LEFT JOIN (
      SELECT d.supplier_id,
             count(*)::int document_count,
             count(*) FILTER (WHERE d.archived_at IS NULL)::int active_document_count
      FROM supplier_documents d
      WHERE ($1::boolean OR d.organization_id=ANY($2::uuid[]))
      GROUP BY d.supplier_id
    ) document_stats ON document_stats.supplier_id=s.id
    WHERE ($1::boolean OR s.organization_id=ANY($2::uuid[]))`;

  const [suppliers,organizations,capabilityCatalog,specialtyCatalog,creationGate]=await Promise.all([
    query<SupplierDirectoryItem>(
      supplierSql+" ORDER BY o.name,s.active DESC,s.name",
      platform?supplierScopeParams:[false,[session.organizationId]],
    ),
    platform
      ? query<Organization>("SELECT id,name,COALESCE(default_country,legal_country,'CO') country FROM organizations WHERE active=true AND ($1::boolean OR id=ANY($2::uuid[])) ORDER BY name",supplierScopeParams)
      : query<Organization>("SELECT id,name,COALESCE(default_country,legal_country,'CO') country FROM organizations WHERE id=$1",[session.organizationId]),
    query<CatalogOption>("SELECT code,label FROM supplier_capability_catalog WHERE active=true ORDER BY sort_order,label"),
    query<CatalogOption>("SELECT code,label FROM supplier_specialty_catalog WHERE active=true ORDER BY sort_order,label"),
    getCreationGateForScope("supplier",session.organizationId,platform),
  ]);

  const defaultCountry=organizations.rows[0]?.country||"CO";
  const error=params.error==="sequence"?creationGate.message
    : params.error==="history"?"Este proveedor tiene inventario, actividades o requisiciones asociadas. Desactívalo para conservar la trazabilidad."
    : params.error==="required"?"Completa los datos obligatorios y adjunta el logo del proveedor."
    : params.error?"No fue posible completar la acción del proveedor.":"";
  const inventoryError=params.inventory_error==="required"?"Completa los datos obligatorios del suministro."
    : params.inventory_error==="relation"?"La sede, sububicación o proveedor no pertenece a la empresa asociada al proveedor."
    : params.inventory_error==="sequence"?"Completa la configuración requerida de Inventario para esta empresa antes de crear suministros."
    : params.inventory_error==="limit"?"La empresa alcanzó el límite de artículos de inventario de su plan."
    : params.inventory_error==="sku"?"Ya existe un artículo con ese SKU en la empresa."
    : params.inventory_error?params.inventory_error:"";

  return <div className="phase8-suppliers">
    <ModuleHeader
      eyebrow="Abastecimiento y terceros"
      title="Proveedores"
      description="Directorio comercial conectado con servicios, suministros, documentos y requisiciones independientes por proveedor."
      count={suppliers.rowCount||0}
      countLabel="proveedores"
      searchPlaceholder="Buscar proveedor, identificación, servicio, ciudad o contacto"
      filters={[{value:"all",label:"Todos"},{value:"active",label:"Activos"},{value:"inactive",label:"Inactivos"}]}
      facets={[
        {key:"organization",label:"Empresa",allLabel:"Todas las empresas"},
        {key:"capability",label:"Tipo",allLabel:"Todos los tipos"},
        {key:"specialty",label:"Especialidad",allLabel:"Todas las especialidades"},
        {key:"country",label:"País",allLabel:"Todos los países"},
      ]}
      action={creationGate.ready?<CreateRecordModal title="Crear proveedor" eyebrow="Nuevo proveedor" description="Registra su identidad, logo, alcance comercial y contacto." triggerLabel="Agregar" iconName="supplier">
        <form className="form-grid unified-popup-form" method="post" action="/api/suppliers" encType="multipart/form-data">
          {platform?<div className="field"><label>Empresa *</label><select name="organization_id" required><option value="">Selecciona una empresa</option>{organizations.rows.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}</select></div>
            :<input type="hidden" name="organization_id" value={session.organizationId||""}/>}
          <MultiSelectDropdown name="capability_codes" label="Tipo de proveedor" options={capabilityCatalog.rows.map(option=>({value:option.code,label:option.label}))} defaultValues={["materials"]} required help="Puedes seleccionar varias capacidades. Se almacenan con códigos normalizados para filtros, exportación e importación."/>
          <div className="field"><label>Nombre comercial *</label><input name="name" required placeholder="Ej. Servicios Técnicos Andinos"/></div>
          <div className="field"><label>Razón social *</label><input name="legal_name" required placeholder="Ej. Servicios Técnicos Andinos S.A.S."/></div>
          <CountryCityFields countryId="supplier-country" countryName="country_code" cityId="supplier-city" cityName="city" defaultCountry={defaultCountry} defaultCity="" required/>
          <TaxIdentificationTypeSelect id="supplier-tax-type" name="tax_id_type" countryInputId="supplier-country" countryCode={defaultCountry}/>
          <div className="field"><label>Número de identificación</label><input name="tax_id" placeholder="Número fiscal / tributario"/></div>
          <div className="field form-span-2"><label>Dirección *</label><input name="address" required placeholder="Dirección comercial o administrativa"/></div>
          <MultiSelectDropdown name="specialty_codes" label="Categoría / especialidad" options={specialtyCatalog.rows.map(option=>({value:option.code,label:option.label}))} help="Selecciona una o varias especialidades del catálogo estándar."/>
          <div className="field"><label>Sitio web</label><input type="url" name="website" placeholder="https://..."/></div>
          <div className="field"><label>Contacto principal</label><input name="contact_name" placeholder="Nombre del contacto"/></div>
          <div className="field"><label>Cargo</label><input name="contact_title" placeholder="Ej. Ejecutivo comercial"/></div>
          <div className="field"><label>Correo</label><input name="email" type="email" placeholder="proveedor@empresa.com"/></div>
          <PhoneField name="phone" label="Teléfono / WhatsApp" countryCode={defaultCountry} countryInputId="supplier-country"/>
          <div className="field form-span-2"><label>Notas</label><textarea name="notes" rows={3} placeholder="Cobertura, tiempos de entrega, emergencias u observaciones."/></div>
          <div className="form-span-2"><FileDropzone name="logo" label="Logo del proveedor" description="Se utilizará en tarjetas y en la ficha del proveedor." accept="image/png,image/jpeg,image/webp" maxSizeMb={5} required kind="image"/></div>
          <div className="form-span-2 form-actions"><button className="button" type="submit">Crear proveedor</button></div>
        </form>
      </CreateRecordModal>:undefined}
    />

    {(params.created||params.inventory_created||params.requisition_created||params.updated||params.deleted||params.saved)&&<div className="section phase8-feedback-stack">
      {params.created&&<Alert variant="success" title="Proveedor creado">Proveedor creado correctamente.</Alert>}
      {params.inventory_created&&<Alert variant="success" title="Suministro creado">Suministro creado correctamente y asociado al proveedor.</Alert>}
      {params.requisition_created&&<Alert variant="success" title="Requisición creada">{params.requisition_created} requisición{params.requisition_created==="1"?"":"es"} creada{params.requisition_created==="1"?"":"s"} para el proveedor.</Alert>}
      {params.updated&&<Alert variant="success" title="Proveedor actualizado">Proveedor actualizado correctamente.</Alert>}
      {params.deleted&&<Alert variant="success" title="Proveedor eliminado">Proveedor eliminado correctamente.</Alert>}
      {params.saved&&<Alert variant="success" title="Documento actualizado">Documento del proveedor actualizado correctamente.</Alert>}
    </div>}
    {error&&<div className="section"><Alert variant="danger" title="No fue posible completar la acción">{error}</Alert></div>}
    {inventoryError&&<div className="section"><Alert variant="danger" title="Revisa el suministro">{inventoryError}</Alert></div>}

    {!creationGate.ready&&<CreationPrerequisiteState
      icon="supplier" eyebrow="Jerarquía de creación" title={creationGate.title} message={creationGate.message}
      href={creationGate.href||"/dashboard/locations"} action={creationGate.action||"Continuar"}
    />}

    <SupplierDirectory
      suppliers={suppliers.rows}
      capabilityOptions={capabilityCatalog.rows.map(option=>({value:option.code,label:option.label}))}
      specialtyOptions={specialtyCatalog.rows.map(option=>({value:option.code,label:option.label}))}
      canInventoryWrite={can(session,"inventory.write")}
      initialSelectedId={params.supplier||""}
      initialTab={params.tab||"general"}
    />
  </div>;
}
