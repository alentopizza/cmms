import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { query } from "@/lib/db";
import { ContextUserCreateModal, SiteCreateModal } from "@/components/ContextCreateModals";
import { ORGANIZATION_DOCUMENT_CATEGORIES } from "@/lib/organization-documents";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Organization = {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  tax_id: string | null;
  tax_id_type: string | null;
  timezone: string;
  legal_address: string | null;
  legal_city: string | null;
  legal_country: string | null;
  phone: string | null;
  admin_email: string | null;
  billing_email: string | null;
  website: string | null;
  primary_contact_name: string | null;
  primary_contact_title: string | null;
  primary_contact_phone: string | null;
  primary_contact_email: string | null;
  internal_notes: string | null;
  active: boolean;
  updated_at: string;
  asset_count: string;
  work_order_count: string;
  user_count: string;
  technician_count: string;
  inventory_count: string;
  sublocation_count: string;
  has_logo: boolean;
  has_cover: boolean;
  max_sites: number;
  max_sublocations: number;
  max_assets: number;
  max_inventory_items: number;
  max_technicians: number;
  plan_name: string | null;
  plan_code: string | null;
  subscription_status: string | null;
};

type OrganizationDocument = {
  id: string;
  category: keyof typeof ORGANIZATION_DOCUMENT_CATEGORIES;
  requirement_level: "required" | "optional" | "not_applicable";
  display_name: string;
  reference: string | null;
  issue_date: string | null;
  expires_at: string | null;
  notes: string | null;
  file_name: string | null;
  file_mime_type: string | null;
  file_size_bytes: string | null;
  created_at: string;
  updated_at: string;
  uploaded_by_name: string | null;
};

type ServiceSupplier = { id: string; name: string };

type Site = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  country: string;
  active: boolean;
  asset_count: string;
  work_order_count: string;
};

function Feedback({ saved, created, error }: { saved?: string; created?: string; error?: string }) {
  if (error === "slug") return <div className="notice error">El identificador ya está siendo usado por otra empresa.</div>;
  if (error === "site-code") return <div className="notice error">Ese código de sede ya existe dentro de esta empresa.</div>;
  if (error === "site-limit") return <div className="notice error">La empresa alcanzó el límite de ubicaciones asignado.</div>;
  if (error === "image-type") return <div className="notice error">Las imágenes deben ser PNG, JPG o WebP.</div>;
  if (error === "image-size") return <div className="notice error">Una de las imágenes supera el tamaño permitido.</div>;
  if (error === "image-required") return <div className="notice error">Selecciona al menos una imagen para actualizar.</div>;
  if (error === "document-type") return <div className="notice error">El documento debe ser PDF, PNG, JPG o WebP.</div>;
  if (error === "document-size") return <div className="notice error">El documento supera el máximo permitido de 10 MB.</div>;
  if (error === "document-not-applicable") return <div className="notice error">Un documento marcado como “No aplica” no debe tener archivo adjunto.</div>;
  if (error === "document-fields") return <div className="notice error">Revisa la categoría, el nombre y el nivel de requisito del documento.</div>;
  if (error) return <div className="notice error">Revisa los campos obligatorios e inténtalo nuevamente.</div>;
  if (created === "company") return <div className="notice success">La empresa y su sede principal fueron creadas correctamente.</div>;
  if (created === "site") return <div className="notice success">La nueva sede fue creada correctamente.</div>;
  if (saved === "company") return <div className="notice success">La ficha empresarial fue actualizada.</div>;
  if (saved === "assets") return <div className="notice success">El logo y la portada fueron actualizados.</div>;
  if (saved === "status") return <div className="notice success">El estado de la empresa fue actualizado.</div>;
  if (saved === "site-status") return <div className="notice success">El estado de la sede fue actualizado.</div>;
  if (saved === "site") return <div className="notice success">La información de la sede fue actualizada.</div>;
  if (saved === "limits") return <div className="notice success">Los límites de recursos fueron actualizados.</div>;
  if (saved === "document") return <div className="notice success">El documento empresarial fue guardado.</div>;
  if (saved === "document-archived") return <div className="notice success">El documento fue archivado y dejó de formar parte de la ficha vigente.</div>;
  return null;
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

function documentState(document: OrganizationDocument) {
  if (document.requirement_level === "not_applicable") return { key: "na", label: "No aplica" };
  if (!document.file_name) return { key: document.requirement_level === "required" ? "pending" : "optional", label: document.requirement_level === "required" ? "Pendiente" : "Sin archivo" };
  if (!document.expires_at) return { key: "current", label: "Vigente" };
  const today = new Date();
  const expiry = new Date(document.expires_at + "T23:59:59");
  if (expiry.getTime() < today.getTime()) return { key: "expired", label: "Vencido" };
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  if (days <= 30) return { key: "expiring", label: "Próximo a vencer" };
  return { key: "current", label: "Vigente" };
}

function formatDate(value: string | null) {
  return value ? new Date(value + (value.length === 10 ? "T12:00:00" : "")).toLocaleDateString("es-CO") : "Sin fecha";
}

function bytesLabel(value: string | null) {
  if (!value) return "";
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return "";
  return bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + " MB" : Math.max(1, Math.round(bytes / 1024)) + " KB";
}

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; created?: string; error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!can(session, "companies.manage")) redirect("/dashboard");

  const [{ id }, feedback] = await Promise.all([params, searchParams]);
  if (!UUID_PATTERN.test(id)) notFound();

  const [organizationResult, sitesResult, serviceSuppliersResult, documentsResult] = await Promise.all([
    query<Organization>(
      `SELECT o.id,o.name,o.slug,o.legal_name,o.tax_id,o.tax_id_type,o.timezone,o.active,o.updated_at::text,
        o.legal_address,o.legal_city,o.legal_country,o.phone,o.admin_email,o.billing_email,o.website,
        o.primary_contact_name,o.primary_contact_title,o.primary_contact_phone,o.primary_contact_email,o.internal_notes,
        (o.logo_data IS NOT NULL) has_logo,
        (o.cover_data IS NOT NULL) has_cover,
        (SELECT count(*)::text FROM assets a WHERE a.organization_id=o.id) asset_count,
        (SELECT count(*)::text FROM work_orders w WHERE w.organization_id=o.id) work_order_count,
        (SELECT count(*)::text FROM organization_members om WHERE om.organization_id=o.id) user_count,
        (SELECT count(*)::text FROM organization_members om WHERE om.organization_id=o.id AND om.role='technician') technician_count,
        (SELECT count(*)::text FROM inventory_items ii WHERE ii.organization_id=o.id) inventory_count,
        (SELECT count(*)::text FROM locations l WHERE l.organization_id=o.id) sublocation_count,
        COALESCE(ol.max_sites,5)::int max_sites,
        COALESCE(ol.max_sublocations,100)::int max_sublocations,
        COALESCE(ol.max_assets,500)::int max_assets,
        COALESCE(ol.max_inventory_items,1000)::int max_inventory_items,
        COALESCE(ol.max_technicians,50)::int max_technicians,
        bp.name plan_name,bp.code plan_code,os.status subscription_status
       FROM organizations o
       LEFT JOIN organization_limits ol ON ol.organization_id=o.id
       LEFT JOIN organization_subscriptions os ON os.organization_id=o.id
       LEFT JOIN billing_plans bp ON bp.id=os.plan_id
       WHERE o.id=$1`,
      [id],
    ),
    query<Site>(
      `SELECT s.id,s.name,s.code,s.address,s.city,s.country,s.active,
        count(DISTINCT a.id)::text asset_count,
        count(DISTINCT w.id)::text work_order_count
       FROM sites s
       LEFT JOIN assets a ON a.site_id=s.id
       LEFT JOIN work_orders w ON w.site_id=s.id
       WHERE s.organization_id=$1
       GROUP BY s.id
       ORDER BY s.active DESC,s.created_at ASC`,
      [id],
    ),
    query<ServiceSupplier>(
      `SELECT id,name FROM suppliers
       WHERE organization_id=$1 AND active=true AND supplier_type IN ('services','both')
       ORDER BY name`,
      [id],
    ),
    query<OrganizationDocument>(
      `SELECT d.id,d.category,d.requirement_level,d.display_name,d.reference,
              d.issue_date::text,d.expires_at::text,d.notes,d.file_name,d.file_mime_type,
              d.file_size_bytes::text,d.created_at::text,d.updated_at::text,u.name uploaded_by_name
       FROM organization_documents d
       LEFT JOIN users u ON u.id=d.uploaded_by
       WHERE d.organization_id=$1 AND d.archived_at IS NULL
       ORDER BY CASE d.requirement_level WHEN 'required' THEN 0 WHEN 'optional' THEN 1 ELSE 2 END,
                d.expires_at NULLS LAST,d.created_at DESC`,
      [id],
    ),
  ]);

  if (!organizationResult.rowCount) notFound();
  const organization = organizationResult.rows[0];
  const sites = sitesResult.rows;
  const documents = documentsResult.rows;
  const activeSites = sites.filter(site => site.active).length;
  const canManageResources = can(session, "company_resources.manage");

  const coreProfileValues = [
    organization.name,
    organization.legal_name,
    organization.tax_id,
    organization.tax_id_type,
    organization.legal_address,
    organization.legal_city,
    organization.legal_country,
    organization.phone,
    organization.admin_email,
    organization.primary_contact_name,
    organization.primary_contact_email,
    organization.has_logo ? "logo" : "",
    organization.has_cover ? "cover" : "",
  ];
  const requiredDocuments = documents.filter(document => document.requirement_level === "required");
  const completedRequiredDocuments = requiredDocuments.filter(document => document.file_name && documentState(document).key !== "expired").length;
  const completedProfile = coreProfileValues.filter(Boolean).length + completedRequiredDocuments;
  const profileTotal = coreProfileValues.length + requiredDocuments.length;
  const completion = Math.round((completedProfile / Math.max(1, profileTotal)) * 100);
  const pendingDocuments = documents.filter(document => {
    const state = documentState(document).key;
    return document.requirement_level === "required" && (state === "pending" || state === "expired");
  }).length;
  const expiringDocuments = documents.filter(document => documentState(document).key === "expiring").length;

  return <>
    <div className="company-profile-shell">
      <header className="company-profile-hero">
        <div className={`company-profile-cover ${organization.has_cover ? "" : "company-card-cover-fallback"}`}>
          {organization.has_cover && <img src={`/api/organizations/${organization.id}/assets/cover`} alt={`Portada de ${organization.name}`} />}
          <div className="company-profile-cover-shade" />
        </div>
        <div className="company-profile-hero-content">
          <Link className="company-profile-back" href="/dashboard/companies">← Directorio de empresas</Link>
          <div className="company-profile-identity">
            <div className="company-profile-logo">
              {organization.has_logo ? <img src={`/api/organizations/${organization.id}/assets/logo`} alt={`Logo de ${organization.name}`} /> : <span>{initials(organization.name)}</span>}
            </div>
            <div>
              <div className="company-profile-badges">
                <span className={`status-badge ${organization.active ? "status-active" : "status-inactive"}`}><span aria-hidden="true" />{organization.active ? "Empresa activa" : "Empresa inactiva"}</span>
                <span className="company-plan-pill">{organization.plan_name || "Sin plan"}</span>
              </div>
              <h1>{organization.name}</h1>
              <p>{organization.legal_name || "Razón social pendiente"} · {organization.tax_id_type || "Identificación"} {organization.tax_id || "sin registrar"}</p>
            </div>
          </div>
          <div className="company-profile-completion">
            <div>
              <span>Perfil empresarial</span>
              <strong>{completion}%</strong>
            </div>
            <div className="company-profile-progress"><span style={{ width: completion + "%" }} /></div>
            <small>{pendingDocuments ? pendingDocuments + " documento(s) requerido(s) pendientes" : "Documentación requerida al día"}{expiringDocuments ? " · " + expiringDocuments + " próximo(s) a vencer" : ""}</small>
          </div>
        </div>
      </header>

      <nav className="company-profile-tabs" aria-label="Secciones de la empresa">
        <a href="#summary">Resumen</a>
        <a href="#information">Información</a>
        <a href="#documents">Documentos</a>
        <a href="#locations">Sedes</a>
        <a href="#resources">Recursos</a>
      </nav>
    </div>

    <div className="section">
      <Feedback saved={feedback.saved} created={feedback.created} error={feedback.error} />
      {feedback.created === "user" && <div className="notice success">Usuario creado y vinculado a {organization.name}.</div>}
    </div>

    <section id="summary" className="company-profile-summary section">
      <div className="company-profile-stat"><span>Plan</span><strong>{organization.plan_name || "Sin plan"}</strong><small>{organization.subscription_status || "Sin suscripción"}</small></div>
      <div className="company-profile-stat"><span>Sedes</span><strong>{activeSites}</strong><small>{sites.length} registradas</small></div>
      <div className="company-profile-stat"><span>Usuarios</span><strong>{organization.user_count}</strong><small>{organization.technician_count} técnicos</small></div>
      <div className="company-profile-stat"><span>Activos</span><strong>{organization.asset_count}</strong><small>{organization.work_order_count} OT históricas</small></div>
      <div className="company-profile-stat"><span>Documentos</span><strong>{documents.length}</strong><small>{pendingDocuments} pendientes</small></div>
    </section>

    <section className="contextual-action-bar section">
      <div>
        <span className="eyebrow">Acciones de {organization.name}</span>
        <strong>Continuar configuración</strong>
        <small>Crea recursos relacionados sin volver a seleccionar la empresa.</small>
      </div>
      <div className="contextual-action-buttons">
        <SiteCreateModal organizations={[]} fixedOrganizationId={organization.id} fixedOrganizationName={organization.name} returnTo={"/dashboard/companies/" + organization.id} />
        <ContextUserCreateModal organizationId={organization.id} organizationName={organization.name} serviceSuppliers={serviceSuppliersResult.rows} returnTo={"/dashboard/companies/" + organization.id} />
      </div>
    </section>

    <section id="information" className="company-profile-two-column section">
      <article className="card company-profile-card">
        <div className="section-heading">
          <div><span className="eyebrow">Ficha empresarial</span><h2>Información legal y administrativa</h2></div>
          <small>La dirección empresarial es independiente de las sedes operativas.</small>
        </div>
        <form className="form-grid company-profile-form" method="post" action={`/api/organizations/${organization.id}`}>
          <input type="hidden" name="intent" value="update" />
          <input type="hidden" name="profile_v2" value="1" />
          <div className="field"><label>Nombre comercial</label><input name="name" defaultValue={organization.name} required /></div>
          <div className="field"><label>Razón social</label><input name="legal_name" defaultValue={organization.legal_name || ""} /></div>
          <div className="field"><label>Tipo de identificación</label><input name="tax_id_type" defaultValue={organization.tax_id_type || ""} placeholder="NIT, RFC, RUC..." /></div>
          <div className="field"><label>Identificación fiscal</label><input name="tax_id" defaultValue={organization.tax_id || ""} /></div>
          <div className="field form-span-2"><label>Dirección administrativa / fiscal</label><input name="legal_address" defaultValue={organization.legal_address || ""} /></div>
          <div className="field"><label>Ciudad administrativa</label><input name="legal_city" defaultValue={organization.legal_city || ""} /></div>
          <div className="field"><label>País</label><input name="legal_country" maxLength={2} defaultValue={organization.legal_country || "CO"} placeholder="CO" /></div>
          <div className="field"><label>Teléfono principal</label><input name="phone" defaultValue={organization.phone || ""} /></div>
          <div className="field"><label>Sitio web</label><input name="website" type="url" defaultValue={organization.website || ""} placeholder="https://..." /></div>
          <div className="field"><label>Correo administrativo</label><input name="admin_email" type="email" defaultValue={organization.admin_email || ""} /></div>
          <div className="field"><label>Correo de facturación</label><input name="billing_email" type="email" defaultValue={organization.billing_email || ""} /></div>

          <div className="form-divider form-span-2"><span>Contacto principal</span></div>
          <div className="field"><label>Nombre</label><input name="primary_contact_name" defaultValue={organization.primary_contact_name || ""} /></div>
          <div className="field"><label>Cargo</label><input name="primary_contact_title" defaultValue={organization.primary_contact_title || ""} /></div>
          <div className="field"><label>Teléfono</label><input name="primary_contact_phone" defaultValue={organization.primary_contact_phone || ""} /></div>
          <div className="field"><label>Correo</label><input name="primary_contact_email" type="email" defaultValue={organization.primary_contact_email || ""} /></div>

          <div className="field"><label>Identificador interno</label><input name="slug" defaultValue={organization.slug} required /></div>
          <div className="field"><label>Zona horaria</label>
            <select name="timezone" defaultValue={organization.timezone}>
              <option value="America/Bogota">Colombia · America/Bogota</option>
              <option value="America/Lima">Perú · America/Lima</option>
              <option value="America/Mexico_City">México · America/Mexico_City</option>
              <option value="America/New_York">Estados Unidos · America/New_York</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
          <div className="field form-span-2"><label>Notas internas</label><textarea name="internal_notes" rows={4} defaultValue={organization.internal_notes || ""} placeholder="Información interna relevante para administración, soporte o relación comercial." /></div>
          <div className="form-span-2 form-actions"><button className="button" type="submit">Guardar ficha empresarial</button></div>
        </form>
      </article>

      <aside className="company-profile-side-stack">
        <article className="card company-profile-card company-visual-identity-card">
          <div className="section-heading"><div><span className="eyebrow">Identidad visual</span><h2>Logo y portada</h2></div></div>
          <div className="company-profile-visual-preview">
            <div>{organization.has_logo ? <img src={`/api/organizations/${organization.id}/assets/logo`} alt="" /> : <span>{initials(organization.name)}</span>}</div>
            <div>{organization.has_cover ? <img src={`/api/organizations/${organization.id}/assets/cover`} alt="" /> : <span>Portada pendiente</span>}</div>
          </div>
          <form className="company-profile-assets-form" method="post" action={`/api/organizations/${organization.id}`} encType="multipart/form-data">
            <input type="hidden" name="intent" value="assets" />
            <div className="field"><label>Reemplazar logo</label><input type="file" name="logo" accept="image/png,image/jpeg,image/webp" /><small>Máx. 2 MB · 800×800 px recomendado.</small></div>
            <div className="field"><label>Reemplazar portada</label><input type="file" name="cover" accept="image/png,image/jpeg,image/webp" /><small>Máx. 5 MB · 1600×700 px recomendado.</small></div>
            <button className="button secondary" type="submit">Actualizar identidad</button>
          </form>
        </article>

        <article className="card company-profile-card company-state-card">
          <div>
            <span className="eyebrow">Estado</span>
            <h2>{organization.active ? "Empresa habilitada" : "Empresa deshabilitada"}</h2>
            <p className="muted">{organization.active ? "La organización puede operar normalmente." : "La información se conserva, pero la empresa permanece inactiva."}</p>
          </div>
          <form method="post" action={`/api/organizations/${organization.id}`}>
            <input type="hidden" name="intent" value="toggle" />
            <button className={`button ${organization.active ? "danger-secondary" : ""}`} type="submit">{organization.active ? "Desactivar empresa" : "Activar empresa"}</button>
          </form>
        </article>
      </aside>
    </section>

    <section id="documents" className="card section company-documents-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Expediente empresarial</span>
          <h2>Documentos y cumplimiento</h2>
          <p className="muted">Define qué documentos son requeridos, opcionales o no aplican. Las vigencias generan alertas visuales.</p>
        </div>
        <div className="company-document-summary">
          <span><strong>{documents.length}</strong> vigentes en ficha</span>
          <span><strong>{pendingDocuments}</strong> pendientes</span>
          <span><strong>{expiringDocuments}</strong> por vencer</span>
        </div>
      </div>

      <details className="company-document-create">
        <summary>＋ Agregar documento o requisito</summary>
        <form className="form-grid company-document-form" method="post" action={`/api/organizations/${organization.id}/documents`} encType="multipart/form-data">
          <div className="field"><label>Categoría</label>
            <select name="category" defaultValue="tax">
              {Object.entries(ORGANIZATION_DOCUMENT_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="field"><label>Nivel</label>
            <select name="requirement_level" defaultValue="optional">
              <option value="required">Requerido</option>
              <option value="optional">Opcional</option>
              <option value="not_applicable">No aplica</option>
            </select>
          </div>
          <div className="field form-span-2"><label>Nombre del documento</label><input name="display_name" placeholder="Ej. RUT actualizado 2026" /></div>
          <div className="field"><label>Número / referencia</label><input name="reference" /></div>
          <div className="field"><label>Archivo</label><input name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" /><small>PDF, PNG, JPG o WebP · máximo 10 MB.</small></div>
          <div className="field"><label>Fecha de emisión</label><input name="issue_date" type="date" /></div>
          <div className="field"><label>Fecha de vencimiento</label><input name="expires_at" type="date" /></div>
          <div className="field form-span-2"><label>Observaciones</label><textarea name="notes" rows={3} /></div>
          <div className="form-span-2 form-actions"><button className="button" type="submit">Guardar documento</button></div>
        </form>
      </details>

      {documents.length === 0 ? <div className="company-documents-empty"><strong>No hay documentos configurados.</strong><span>Crea el primer requisito para empezar a controlar el expediente de esta empresa.</span></div> :
      <div className="company-document-list">
        {documents.map(document => {
          const state = documentState(document);
          return <article className="company-document-card" key={document.id}>
            <div className="company-document-icon" aria-hidden="true">▤</div>
            <div className="company-document-main">
              <div className="company-document-title-row">
                <div>
                  <span>{ORGANIZATION_DOCUMENT_CATEGORIES[document.category]}</span>
                  <h3>{document.display_name}</h3>
                </div>
                <span className={`company-document-state document-state-${state.key}`}>{state.label}</span>
              </div>
              <div className="company-document-meta">
                <span>{document.requirement_level === "required" ? "Requerido" : document.requirement_level === "optional" ? "Opcional" : "No aplica"}</span>
                {document.reference && <span>Ref. {document.reference}</span>}
                {document.issue_date && <span>Emitido {formatDate(document.issue_date)}</span>}
                {document.expires_at && <span>Vence {formatDate(document.expires_at)}</span>}
                {document.file_name && <span>{document.file_name} · {bytesLabel(document.file_size_bytes)}</span>}
              </div>
              {document.notes && <p>{document.notes}</p>}
              <small>Actualizado {formatDate(document.updated_at)}{document.uploaded_by_name ? " · por " + document.uploaded_by_name : ""}</small>
            </div>
            <div className="company-document-actions">
              {document.file_name && <a className="button secondary" href={`/api/organizations/${organization.id}/documents/${document.id}`}>Descargar</a>}
              <details>
                <summary className="text-button">Editar</summary>
                <form className="company-document-edit-form" method="post" action={`/api/organizations/${organization.id}/documents/${document.id}`} encType="multipart/form-data">
                  <div className="field"><label>Categoría</label><select name="category" defaultValue={document.category}>{Object.entries(ORGANIZATION_DOCUMENT_CATEGORIES).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                  <div className="field"><label>Nivel</label><select name="requirement_level" defaultValue={document.requirement_level}><option value="required">Requerido</option><option value="optional">Opcional</option><option value="not_applicable">No aplica</option></select></div>
                  <div className="field"><label>Nombre</label><input name="display_name" defaultValue={document.display_name} required /></div>
                  <div className="field"><label>Referencia</label><input name="reference" defaultValue={document.reference || ""} /></div>
                  <div className="field"><label>Emisión</label><input name="issue_date" type="date" defaultValue={document.issue_date || ""} /></div>
                  <div className="field"><label>Vencimiento</label><input name="expires_at" type="date" defaultValue={document.expires_at || ""} /></div>
                  <div className="field"><label>Reemplazar archivo</label><input name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" /></div>
                  <div className="field"><label>Observaciones</label><textarea name="notes" rows={2} defaultValue={document.notes || ""} /></div>
                  <button className="button secondary" type="submit">Guardar cambios</button>
                </form>
              </details>
              <form method="post" action={`/api/organizations/${organization.id}/documents/${document.id}`}>
                <input type="hidden" name="intent" value="archive" />
                <button className="text-button text-danger" type="submit">Archivar</button>
              </form>
            </div>
          </article>;
        })}
      </div>}
    </section>

    {canManageResources && <section id="resources" className="card section company-profile-card">
      <div className="section-heading"><div><span className="eyebrow">Control del plan</span><h2>Recursos asignados</h2></div><small>Capacidad contractual administrada por Superadministrador.</small></div>
      <form className="resource-limit-grid" method="post" action={`/api/organizations/${organization.id}`}>
        <input type="hidden" name="intent" value="limits" />
        <div className="field"><label>Ubicaciones principales</label><input name="max_sites" type="number" min="1" defaultValue={organization.max_sites} /></div>
        <div className="field"><label>Sububicaciones</label><input name="max_sublocations" type="number" min="0" defaultValue={organization.max_sublocations} /></div>
        <div className="field"><label>Activos</label><input name="max_assets" type="number" min="0" defaultValue={organization.max_assets} /></div>
        <div className="field"><label>Inventario</label><input name="max_inventory_items" type="number" min="0" defaultValue={organization.max_inventory_items} /></div>
        <div className="field"><label>Técnicos</label><input name="max_technicians" type="number" min="0" defaultValue={organization.max_technicians} /></div>
        <div className="field resource-save"><label>&nbsp;</label><button className="button" type="submit">Actualizar cupos</button></div>
      </form>
    </section>}

    <section id="locations" className="section">
      <div className="section-heading sites-heading">
        <div><span className="eyebrow">Operación física</span><h2>Sedes ({sites.length})</h2><p className="muted">Estas ubicaciones son independientes de la dirección administrativa o fiscal de la empresa.</p></div>
      </div>
      {sites.length === 0 ? <div className="card empty-state"><strong>Aún no hay sedes registradas.</strong><span>Crea la primera ubicación principal para comenzar la estructura operativa.</span></div> :
      <div className="site-grid">
        {sites.map(site => <article className="card site-card" key={site.id}>
          <div className="site-card-header">
            <div>
              <span className={`status-badge ${site.active ? "status-active" : "status-inactive"}`}><span aria-hidden="true" />{site.active ? "Activa" : "Inactiva"}</span>
              <h3>{site.name}</h3>
              <p>{site.city || "Ciudad sin registrar"} · {site.country}</p>
            </div>
            <div className="site-stats"><strong>{site.asset_count}</strong><span>activos</span><strong>{site.work_order_count}</strong><span>OT</span></div>
          </div>
          <Link className="button secondary site-location-link" href={`/dashboard/locations/${site.id}`}>Ver sububicaciones</Link>
          <form className="form-grid site-edit-form" method="post" action={`/api/sites/${site.id}`}>
            <input type="hidden" name="organization_id" value={organization.id} />
            <input type="hidden" name="intent" value="update" />
            <div className="field"><label>Nombre</label><input name="name" defaultValue={site.name} required /></div>
            <div className="field"><label>Código</label><input name="code" defaultValue={site.code || ""} /></div>
            <div className="field form-span-2"><label>Dirección</label><input name="address" defaultValue={site.address || ""} /></div>
            <div className="field"><label>Ciudad</label><input name="city" defaultValue={site.city || ""} /></div>
            <div className="field"><label>País</label><input name="country" defaultValue={site.country} maxLength={2} /></div>
            <div className="form-span-2 form-actions"><button className="button secondary" type="submit">Guardar sede</button></div>
          </form>
          <form className="site-status-form" method="post" action={`/api/sites/${site.id}`}>
            <input type="hidden" name="organization_id" value={organization.id} />
            <input type="hidden" name="intent" value="toggle" />
            <button className={`text-button ${site.active ? "text-danger" : ""}`} type="submit">{site.active ? "Desactivar sede" : "Activar sede"}</button>
          </form>
        </article>)}
      </div>}
    </section>
  </>;
}
