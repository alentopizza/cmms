import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { getCreationGateForScope } from "@/lib/setup-sequence";
import ModuleHeader from "@/components/ModuleHeader";
import CreateRecordModal from "@/components/CreateRecordModal";
import CreationPrerequisiteState from "@/components/CreationPrerequisiteState";
import PhoneField from "@/components/PhoneField";
import FileDropzone from "@/components/FileDropzone";
import { CountryCityFields, TaxIdentificationTypeSelect } from "@/components/InternationalFields";
import SupplierDirectory, {
  type SupplierActivity,
  type SupplierDirectoryItem,
  type SupplierDocument,
  type SupplierRequisition,
} from "@/components/SupplierDirectory";
import type { RequisitionSelectableItem } from "@/components/RequisitionBuilder";

type Organization={id:string;name:string;country:string};

export default async function SuppliersPage({searchParams}:{searchParams:Promise<{
  created?:string;updated?:string;deleted?:string;error?:string;supplier?:string;tab?:string;saved?:string;requisition_created?:string;
}>}){
  const session=await getSession();
  if(!session)redirect("/login");
  if(!can(session,"suppliers.manage"))redirect("/dashboard");
  const params=await searchParams;
  const platform=session.platformRole!=="user";

  const supplierSql=`SELECT s.id,s.organization_id,o.name organization_name,s.name,s.legal_name,s.tax_id,s.tax_id_type,s.country_code,
      s.city,s.address,s.website,s.supplier_type,s.service_category,s.contact_name,s.contact_title,s.email,s.phone,s.notes,s.active,
      (s.logo_data IS NOT NULL) has_logo
    FROM suppliers s JOIN organizations o ON o.id=s.organization_id`;
  const activitySql=`SELECT wt.id,wt.service_supplier_id supplier_id,w.id work_order_id,w.number::text order_number,w.title order_title,
      wt.description,wt.status,wt.due_date::text,s.name site_name,l.name location_name
    FROM work_order_tasks wt
    JOIN work_orders w ON w.id=wt.work_order_id
    JOIN sites s ON s.id=w.site_id
    LEFT JOIN assets a ON a.id=w.asset_id
    LEFT JOIN locations l ON l.id=COALESCE(w.location_id,a.location_id)
    WHERE wt.service_supplier_id IS NOT NULL`;
  const itemSql=`SELECT i.id,i.supplier_id,p.name supplier_name,i.sku,i.name,i.unit,i.unit_cost::text,i.quantity::text,i.min_quantity::text,
      s.name site_name,l.name location_name
    FROM inventory_items i
    JOIN suppliers p ON p.id=i.supplier_id
    LEFT JOIN sites s ON s.id=i.site_id
    LEFT JOIN locations l ON l.id=i.location_id
    WHERE i.active=true AND p.active=true AND p.supplier_type IN ('materials','both')`;
  const requisitionSql=`SELECT r.id,r.supplier_id,r.number::text,r.status,r.created_at::text,r.needed_by::text,
      count(ri.id)::int item_count,COALESCE(sum(ri.quantity_requested*ri.unit_cost_estimated),0)::text total_estimated
    FROM supplier_requisitions r LEFT JOIN supplier_requisition_items ri ON ri.requisition_id=r.id`;
  const documentSql=`SELECT id,supplier_id,category,display_name,reference,expires_at::text,file_name,file_mime_type,archived_at::text,created_at::text
    FROM supplier_documents`;

  const [suppliers,organizations,activities,items,requisitions,documents]=await Promise.all([
    platform
      ? query<SupplierDirectoryItem>(supplierSql+" ORDER BY o.name,s.active DESC,s.name")
      : query<SupplierDirectoryItem>(supplierSql+" WHERE s.organization_id=$1 ORDER BY s.active DESC,s.name",[session.organizationId]),
    platform
      ? query<Organization>("SELECT id,name,COALESCE(default_country,legal_country,'CO') country FROM organizations WHERE active=true ORDER BY name")
      : query<Organization>("SELECT id,name,COALESCE(default_country,legal_country,'CO') country FROM organizations WHERE id=$1",[session.organizationId]),
    platform
      ? query<SupplierActivity>(activitySql+" ORDER BY w.requested_at DESC,wt.sort_order LIMIT 600")
      : query<SupplierActivity>(activitySql+" AND w.organization_id=$1 ORDER BY w.requested_at DESC,wt.sort_order LIMIT 600",[session.organizationId]),
    platform
      ? query<RequisitionSelectableItem>(itemSql+" ORDER BY p.name,i.name LIMIT 800")
      : query<RequisitionSelectableItem>(itemSql+" AND i.organization_id=$1 ORDER BY p.name,i.name LIMIT 800",[session.organizationId]),
    platform
      ? query<SupplierRequisition>(requisitionSql+" GROUP BY r.id ORDER BY r.created_at DESC LIMIT 600")
      : query<SupplierRequisition>(requisitionSql+" WHERE r.organization_id=$1 GROUP BY r.id ORDER BY r.created_at DESC LIMIT 600",[session.organizationId]),
    platform
      ? query<SupplierDocument>(documentSql+" ORDER BY created_at DESC LIMIT 800")
      : query<SupplierDocument>(documentSql+" WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 800",[session.organizationId]),
  ]);

  const creationGate=await getCreationGateForScope("supplier",session.organizationId,platform);
  const defaultCountry=organizations.rows[0]?.country||"CO";
  const error=params.error==="sequence"?creationGate.message
    : params.error==="history"?"Este proveedor tiene inventario, actividades o requisiciones asociadas. Desactívalo para conservar la trazabilidad."
    : params.error==="required"?"Completa los datos obligatorios y adjunta el logo del proveedor."
    : params.error?"No fue posible completar la acción del proveedor.":"";

  return <>
    <ModuleHeader
      eyebrow="Abastecimiento y terceros"
      title="Proveedores"
      description="Directorio comercial conectado con servicios, suministros, documentos y requisiciones independientes por proveedor."
      count={suppliers.rowCount||0}
      countLabel="proveedores"
      searchPlaceholder="Buscar proveedor, identificación, servicio, ciudad o contacto"
      filters={[{value:"all",label:"Todos"},{value:"active",label:"Activos"},{value:"inactive",label:"Inactivos"}]}
      action={creationGate.ready?<CreateRecordModal title="Crear proveedor" eyebrow="Nuevo proveedor" description="Registra su identidad, logo, alcance comercial y contacto." triggerLabel="Agregar" icon="▣">
        <form className="form-grid unified-popup-form" method="post" action="/api/suppliers" encType="multipart/form-data">
          {platform?<div className="field"><label>Empresa *</label><select name="organization_id" required><option value="">Selecciona una empresa</option>{organizations.rows.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}</select></div>
            :<input type="hidden" name="organization_id" value={session.organizationId||""}/>}
          <div className="field"><label>Tipo *</label><select name="supplier_type" defaultValue="materials"><option value="materials">Materiales / suministros</option><option value="services">Servicios</option><option value="both">Materiales + servicios</option></select></div>
          <div className="field"><label>Nombre comercial *</label><input name="name" required placeholder="Ej. Servicios Técnicos Andinos"/></div>
          <div className="field"><label>Razón social *</label><input name="legal_name" required placeholder="Ej. Servicios Técnicos Andinos S.A.S."/></div>
          <CountryCityFields countryId="supplier-country" countryName="country_code" cityId="supplier-city" cityName="city" defaultCountry={defaultCountry} defaultCity="" required/>
          <TaxIdentificationTypeSelect id="supplier-tax-type" name="tax_id_type" countryInputId="supplier-country" countryCode={defaultCountry}/>
          <div className="field"><label>Número de identificación</label><input name="tax_id" placeholder="Número fiscal / tributario"/></div>
          <div className="field form-span-2"><label>Dirección *</label><input name="address" required placeholder="Dirección comercial o administrativa"/></div>
          <div className="field"><label>Categoría / especialidad</label><input name="service_category" placeholder="Refrigeración, ferretería, obra civil..."/></div>
          <div className="field"><label>Sitio web</label><input type="url" name="website" placeholder="https://..."/></div>
          <div className="field"><label>Contacto principal</label><input name="contact_name" placeholder="Nombre del contacto"/></div>
          <div className="field"><label>Cargo</label><input name="contact_title" placeholder="Ej. Ejecutivo comercial"/></div>
          <div className="field"><label>Correo</label><input name="email" type="email" placeholder="proveedor@empresa.com"/></div>
          <PhoneField name="phone" label="Teléfono / WhatsApp" countryCode={defaultCountry} countryInputId="supplier-country"/>
          <div className="field form-span-2"><label>Notas</label><textarea name="notes" rows={3} placeholder="Cobertura, tiempos de entrega, emergencias u observaciones."/></div>
          <div className="form-span-2"><FileDropzone name="logo" label="Logo del proveedor" description="Se utilizará en tarjetas, ficha y Hoja de vida." accept="image/png,image/jpeg,image/webp" maxSizeMb={5} required kind="image"/></div>
          <div className="form-span-2 form-actions"><button className="button" type="submit">Crear proveedor</button></div>
        </form>
      </CreateRecordModal>:undefined}
    />

    {params.created&&<div className="notice success section">Proveedor creado correctamente.</div>}
    {params.requisition_created&&<div className="notice success section">{params.requisition_created} requisición{params.requisition_created==="1"?"":"es"} creada{params.requisition_created==="1"?"":"s"} para el proveedor.</div>}
    {params.updated&&<div className="notice success section">Proveedor actualizado correctamente.</div>}
    {params.deleted&&<div className="notice success section">Proveedor eliminado correctamente.</div>}
    {params.saved&&<div className="notice success section">Documento del proveedor actualizado correctamente.</div>}
    {error&&<div className="notice error section">{error}</div>}

    {!creationGate.ready&&<CreationPrerequisiteState
      icon="▣" eyebrow="Jerarquía de creación" title={creationGate.title} message={creationGate.message}
      href={creationGate.href||"/dashboard/locations"} action={creationGate.action||"Continuar"}
    />}

    <SupplierDirectory
      suppliers={suppliers.rows}
      activities={activities.rows}
      items={items.rows}
      requisitions={requisitions.rows}
      documents={documents.rows}
      initialSelectedId={params.supplier||""}
      initialTab={params.tab||"general"}
    />
  </>;
}
