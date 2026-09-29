"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import FileDropzone from "@/components/FileDropzone";
import PhoneField from "@/components/PhoneField";
import ConfirmDialog from "@/components/ConfirmDialog";
import ModuleHeader from "@/components/ModuleHeader";
import { UserCard } from "@/components/business-ui";
import { Alert, EmptyState, Spinner } from "@/components/ui-kit/Feedback";
import { CollectionView } from "@/components/ui-kit/DataControls";
import { StaticDataTable } from "@/components/ui-kit/StaticTable";
import { EntityIdentityCell, ListQuickActions } from "@/components/ui-kit/CollectionIdentity";
import { Badge } from "@/components/ui-kit/Badge";
import { StatTiles } from "@/components/ui-kit/Metrics";
import { Button } from "@/components/ui-kit/Button";
import EntityProfileWorkspace from "@/components/EntityProfileWorkspace";
import ProfileExportMenu from "@/components/ProfileExportMenu";
import UiIcon from "@/components/UiIcon";
import { CountrySelect, PersonalDocumentTypeSelect } from "@/components/InternationalFields";
import type { UserStatisticsActivity, UserStatisticsDay } from "@/components/UserStatisticsDashboard";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  PLATFORM_OWNER_DESCRIPTION,
  SUPERADMIN_DESCRIPTION,
  type OrganizationRole,
} from "@/lib/permissions";

const UserStatisticsDashboard=dynamic(()=>import("@/components/UserStatisticsDashboard"),{
  loading:()=> <Spinner label="Cargando estadísticas"/>,
});
const UserAttendanceAuditCenter=dynamic(()=>import("@/components/UserAttendanceAuditCenter"),{
  loading:()=> <Spinner label="Cargando auditoría de asistencia"/>,
});

// ── User directory contracts and role/scope presentation ───────────────────

export type ManagedUser = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  country_code: string | null;
  identity_document_type: string | null;
  identity_document_number: string | null;
  preferred_locale: string | null;
  active: boolean;
  platform_role: "platform_owner" | "superadmin" | "user";
  organization_id: string | null;
  organization_name: string | null;
  role: OrganizationRole | null;
  last_login_at: string | null;
  has_activity: boolean;
  access_all_sites: boolean | null;
  site_ids: string[] | null;
  site_names: string[] | null;
  external_supplier_id: string | null;
  external_supplier_name: string | null;
  platform_organization_ids: string[];
  platform_organization_names: string[];
  platform_created_organization_ids: string[];
  has_avatar: boolean;
  biometric_status: "verified" | "legacy" | "revoked" | "missing";
  assigned_work_orders: number;
  pending_activities: number;
  completed_activities_30d: number;
  attendance_hours_30d: number;
  open_shift: boolean;
  tracking_live: boolean;
};

export type ManagedUserDocument={
  id:string;
  organization_id:string;
  user_id:string;
  category:string;
  display_name:string;
  reference:string|null;
  issue_date:string|null;
  expires_at:string|null;
  file_name:string|null;
  file_mime_type:string|null;
  archived_at:string|null;
  created_at:string;
};

export type ManagedEmergencyContact={
  user_id:string;
  organization_id:string;
  full_name:string;
  relationship_code:string;
  phone:string;
  email:string|null;
  notes:string|null;
};

type UserStatisticsSnapshot = {
  attendance_hours_today: number;
  attendance_daily_7d: UserStatisticsDay[];
  completed_activities_7d: number;
  overdue_activities: number;
  open_shift_started_at: string | null;
  upcoming_activities: UserStatisticsActivity[];
};

type Organization = { id: string; name: string; country: string };
type Site = { id: string; organization_id: string; name: string; organization_name: string };
type ServiceSupplier = { id: string; organization_id: string; name: string };

type Draft = {
  full_name: string;
  email: string;
  phone: string;
  country_code: string;
  identity_document_type: string;
  identity_document_number: string;
  password: string;
  organization_id: string;
  role: string;
  access_all_sites: boolean;
  site_ids: string[];
  external_supplier_id: string;
  platform_organization_ids: string[];
};

type FieldErrors = Partial<Record<"full_name" | "email" | "password" | "avatar" | "country_code" | "identity_document_type" | "identity_document_number" | "organization_id" | "platform_organization_ids" | "role" | "site_ids" | "external_supplier_id" | "general", string>>;

const EMPTY_DRAFT: Draft = {
  full_name: "",
  email: "",
  phone: "",
  country_code: "CO",
  identity_document_type: "",
  identity_document_number: "",
  password: "",
  organization_id: "",
  role: "viewer",
  access_all_sites: true,
  site_ids: [],
  external_supplier_id: "",
  platform_organization_ids: [],
};

function roleKey(user: ManagedUser) {
  return user.platform_role !== "user" ? user.platform_role : user.role || "viewer";
}

function roleName(role: string) {
  if (role === "platform_owner") return "Propietario Desweb";
  if (role === "superadmin") return "Superadministrador";
  return ROLE_LABELS[role as OrganizationRole] || role;
}

function roleDescription(role: string) {
  if (role === "platform_owner") return PLATFORM_OWNER_DESCRIPTION;
  if (role === "superadmin") return SUPERADMIN_DESCRIPTION;
  return ROLE_DESCRIPTIONS[role as OrganizationRole] || "";
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

function biometricStatusLabel(status: ManagedUser["biometric_status"]) {
  if (status === "verified") return "Verificada";
  if (status === "legacy") return "Reenrolar";
  if (status === "revoked") return "Revocada";
  return "Pendiente";
}

function siteAccessLabel(user: ManagedUser) {
  if (user.platform_role === "platform_owner") return "Todas las empresas";
  if (user.platform_role === "superadmin") {
    const names=user.platform_organization_names||[];
    if(!names.length)return "Sin empresas asignadas";
    if(names.length<=2)return names.join(", ");
    return `${names.slice(0,2).join(", ")} +${names.length-2}`;
  }
  if (user.access_all_sites !== false) return "Todas las sedes";
  const siteNames = user.site_names || [];
  if (!siteNames.length) return "Sin sedes asignadas";
  if (siteNames.length <= 2) return siteNames.join(", ");
  return `${siteNames.slice(0, 2).join(", ")} +${siteNames.length - 2}`;
}

function attendanceAdminHref(user:ManagedUser){
  const params=new URLSearchParams();
  if(user.organization_id)params.set("organization_id",user.organization_id);
  params.set("user_id",user.id);
  params.set("view","setup");
  params.set("step","3");
  return `/dashboard/attendance?${params.toString()}#biometric`;
}

function attendanceAuditEligible(user:ManagedUser){
  return user.platform_role==="user"
    && Boolean(user.role&&["admin","manager","technician","provider","external"].includes(user.role));
}

const USER_DOCUMENT_CATEGORIES=[
  {value:"identity",label:"Documento de identidad / cédula"},
  {value:"resume",label:"Hoja de vida"},
  {value:"occupational_risk",label:"ARL / riesgos laborales"},
  {value:"health_eps",label:"EPS / salud"},
  {value:"pension",label:"Pensión"},
  {value:"severance",label:"Cesantías"},
  {value:"compensation_fund",label:"Caja de compensación"},
  {value:"payroll_contribution",label:"Parafiscales / PILA"},
  {value:"bank_certificate",label:"Certificación / cuenta bancaria"},
  {value:"contract",label:"Contrato"},
  {value:"certification",label:"Certificación"},
  {value:"other",label:"Otro"},
];
const EMERGENCY_RELATIONSHIPS=[
  {value:"parent",label:"Padre / madre"},
  {value:"spouse_partner",label:"Pareja / cónyuge"},
  {value:"child",label:"Hijo / hija"},
  {value:"sibling",label:"Hermano / hermana"},
  {value:"relative",label:"Otro familiar"},
  {value:"friend",label:"Amigo / persona de confianza"},
  {value:"other",label:"Otro"},
];
function userDocumentLabel(code:string){
  return USER_DOCUMENT_CATEGORIES.find(item=>item.value===code)?.label||code;
}
function emergencyRelationshipLabel(code:string){
  return EMERGENCY_RELATIONSHIPS.find(item=>item.value===code)?.label||code;
}
function UserDocuments({user,documents}:{user:ManagedUser;documents:ManagedUserDocument[]}){
  const active=documents.filter(document=>!document.archived_at);
  const archived=documents.filter(document=>Boolean(document.archived_at));
  return <div className="entity-section-stack">
    <form className="entity-panel form-grid" method="post" action={"/api/users/"+user.id+"/documents"} encType="multipart/form-data">
      <h3 className="form-span-2"><span className="entity-section-icon"><UiIcon name="file"/></span>Agregar documento al expediente</h3>
      <div className="field"><label>Tipo *</label><select name="category" defaultValue="identity">{USER_DOCUMENT_CATEGORIES.map(option=><option value={option.value} key={option.value}>{option.label}</option>)}</select></div>
      <div className="field"><label>Nombre *</label><input name="display_name" required placeholder="Ej. Cédula vigente"/></div>
      <div className="field"><label>Referencia</label><input name="reference" placeholder="Número, entidad o referencia"/></div>
      <div className="field"><label>Fecha de emisión</label><input name="issue_date" type="date"/></div>
      <div className="field"><label>Fecha de vencimiento</label><input name="expires_at" type="date"/></div>
      <div className="field form-span-2"><label>Notas</label><input name="notes" placeholder="Observaciones del documento"/></div>
      <div className="form-span-2"><FileDropzone name="file" label="Archivo" accept=".pdf,image/png,image/jpeg,image/webp" maxSizeMb={10} required kind="document"/></div>
      <div className="form-span-2 form-actions"><button className="button" type="submit">Guardar documento</button></div>
    </form>
    <div className="entity-panel">
      <h3>Documentos vigentes</h3>
      {active.length?<div className="supplier-document-list">{active.map(document=><article key={document.id} className="supplier-document-row">
        <div><strong>{document.display_name}</strong><span>{userDocumentLabel(document.category)}{document.expires_at?" · vence "+new Date(document.expires_at+"T12:00:00").toLocaleDateString("es-CO"):""}</span></div>
        <div className="supplier-document-actions">
          {document.file_name&&<a href={"/api/users/"+user.id+"/documents/"+document.id}><UiIcon name="download" size={15}/> Descargar</a>}
          <form method="post" action={"/api/users/"+user.id+"/documents/"+document.id}><input type="hidden" name="intent" value="archive"/><button type="submit">Archivar</button></form>
        </div>
      </article>)}</div>:<div className="location-detail-empty">No hay documentos vigentes en el expediente.</div>}
    </div>
    {archived.length>0&&<div className="entity-panel"><h3>Documentos archivados</h3><div className="supplier-document-list">{archived.map(document=><article key={document.id} className="supplier-document-row archived">
      <div><strong>{document.display_name}</strong><span>{userDocumentLabel(document.category)}</span></div>
      <div className="supplier-document-actions"><form method="post" action={"/api/users/"+user.id+"/documents/"+document.id}><input type="hidden" name="intent" value="restore"/><button type="submit">Restaurar</button></form></div>
    </article>)}</div></div>}
  </div>;
}

// ── User CRUD state, validation and tenant-safe actions ─────────────────────

export default function UserManagement({
  users,
  organizations,
  sites,
  isPlatformOperator,
  isPlatformOwner,
  fixedOrganizationId,
  currentUserId,
  serviceSuppliers,
}: {
  users: ManagedUser[];
  organizations: Organization[];
  sites: Site[];
  isPlatformOperator: boolean;
  isPlatformOwner: boolean;
  fixedOrganizationId: string | null;
  currentUserId: string | null;
  serviceSuppliers: ServiceSupplier[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [selectedUserId,setSelectedUserId]=useState<string|null>(searchParams.get("user"));
  const [preferredTab,setPreferredTab]=useState(searchParams.get("tab")||"general");
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "delete" | "status"; user: ManagedUser } | null>(null);
  const [actionError, setActionError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [avatarFile,setAvatarFile]=useState<File|null>(null);
  const [statisticsByUser,setStatisticsByUser]=useState<Record<string,UserStatisticsSnapshot>>({});
  const [statisticsLoadingUser,setStatisticsLoadingUser]=useState<string|null>(null);
  const [statisticsError,setStatisticsError]=useState("");
  const [documentsByUser,setDocumentsByUser]=useState<Record<string,ManagedUserDocument[]>>({});
  const [emergencyByUser,setEmergencyByUser]=useState<Record<string,ManagedEmergencyContact|null>>({});
  const [detailLoadingUser,setDetailLoadingUser]=useState<string|null>(null);
  const [detailError,setDetailError]=useState("");

  useEffect(() => {
    if (!mode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) closeModal();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("modal-open");
    };
  }, [mode, saving]);

  const visibleSites = useMemo(() => {
    if (!draft.organization_id) return [];
    return sites.filter(site => site.organization_id === draft.organization_id);
  }, [draft.organization_id, sites]);

  const visibleServiceSuppliers = useMemo(() => {
    if (!draft.organization_id) return [];
    return serviceSuppliers.filter(supplier => supplier.organization_id === draft.organization_id);
  }, [draft.organization_id, serviceSuppliers]);
  const selectedOrganizationCountry = useMemo(() => {
    return organizations.find(org => org.id === draft.organization_id)?.country || "CO";
  }, [organizations, draft.organization_id]);
  const selectedUser=useMemo(()=>users.find(user=>user.id===selectedUserId)||null,[users,selectedUserId]);
  const selectedStatistics=selectedUserId?statisticsByUser[selectedUserId]||null:null;
  const selectedDocuments=selectedUserId?documentsByUser[selectedUserId]||[]:[];
  const selectedEmergencyContact=selectedUserId?(emergencyByUser[selectedUserId]??null):null;

  useEffect(()=>{
    const requestedUser=searchParams.get("user");
    if(requestedUser&&users.some(user=>user.id===requestedUser))setSelectedUserId(requestedUser);
    const requestedTab=searchParams.get("tab");
    if(requestedTab)setPreferredTab(requestedTab);
  },[searchParams,users]);

  useEffect(()=>{
    if(!selectedUserId||!["documents","emergency"].includes(preferredTab))return;
    const user=users.find(item=>item.id===selectedUserId)||null;
    const loadingDocuments=preferredTab==="documents";
    const alreadyLoaded=loadingDocuments
      ?Object.prototype.hasOwnProperty.call(documentsByUser,selectedUserId)
      :Object.prototype.hasOwnProperty.call(emergencyByUser,selectedUserId);
    if(alreadyLoaded)return;
    if(!user?.organization_id){
      if(loadingDocuments)setDocumentsByUser(previous=>({...previous,[selectedUserId]:[]}));
      else setEmergencyByUser(previous=>({...previous,[selectedUserId]:null}));
      return;
    }
    let cancelled=false;
    setDetailLoadingUser(selectedUserId);
    setDetailError("");
    const endpoint=loadingDocuments?"documents":"emergency-contact";
    fetch("/api/users/"+selectedUserId+"/"+endpoint,{headers:{Accept:"application/json"}})
      .then(async response=>{
        const payload=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(payload?.message||(loadingDocuments?"No fue posible cargar los documentos.":"No fue posible cargar el contacto de emergencia."));
        if(cancelled)return;
        if(loadingDocuments){
          setDocumentsByUser(previous=>({...previous,[selectedUserId]:Array.isArray(payload?.documents)?payload.documents:[]}));
        }else{
          setEmergencyByUser(previous=>({...previous,[selectedUserId]:payload?.contact||null}));
        }
      })
      .catch(error=>{if(!cancelled)setDetailError(error instanceof Error?error.message:"No fue posible cargar el expediente.");})
      .finally(()=>{if(!cancelled)setDetailLoadingUser(current=>current===selectedUserId?null:current);});
    return()=>{cancelled=true;};
  },[selectedUserId,preferredTab,users,documentsByUser,emergencyByUser]);

  useEffect(()=>{
    if(!selectedUserId||preferredTab!=="statistics"||statisticsByUser[selectedUserId])return;
    let cancelled=false;
    setStatisticsLoadingUser(selectedUserId);
    setStatisticsError("");
    fetch("/api/users/"+selectedUserId+"/statistics",{headers:{Accept:"application/json"}})
      .then(async response=>{
        const payload=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(payload?.message||"No fue posible cargar las estadísticas.");
        if(cancelled)return;
        setStatisticsByUser(previous=>({...previous,[selectedUserId]:payload as UserStatisticsSnapshot}));
      })
      .catch(error=>{if(!cancelled)setStatisticsError(error instanceof Error?error.message:"No fue posible cargar las estadísticas.");})
      .finally(()=>{if(!cancelled)setStatisticsLoadingUser(current=>current===selectedUserId?null:current);});
    return()=>{cancelled=true;};
  },[selectedUserId,preferredTab,statisticsByUser]);

  useEffect(()=>{
    if(searchParams.get("create")!=="1") return;
    const requestedOrg=searchParams.get("organization_id")||fixedOrganizationId||"";
    const requestedSite=searchParams.get("site_id")||"";
    const requestedRole=searchParams.get("role")||"technician";
    const safeOrg=organizations.some(org=>org.id===requestedOrg)?requestedOrg:(fixedOrganizationId||"");
    setMode("create");
    setEditingUser(null);
    setDraft({
      ...EMPTY_DRAFT,
      organization_id:safeOrg,
      role:requestedRole,
      access_all_sites:!requestedSite,
      site_ids:requestedSite?[requestedSite]:[],
    });
    setErrors({});setActionError("");setSaveSuccess("");setAvatarFile(null);
    router.replace("/dashboard/users");
  },[searchParams,organizations,fixedOrganizationId,router]);

  function updateDraft<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field as keyof FieldErrors]: undefined, general: undefined }));
  }

  function changeOrganization(organizationId: string) {
    const organizationCountry=organizations.find(org=>org.id===organizationId)?.country || "CO";
    setDraft(previous => ({
      ...previous,
      organization_id: organizationId,
      country_code: organizationCountry,
      identity_document_type: "",
      access_all_sites: true,
      site_ids: [],
      external_supplier_id: "",
    }));
    setErrors(previous => ({ ...previous, organization_id: undefined, site_ids: undefined, general: undefined }));
  }

  function toggleSite(siteId: string) {
    setDraft(previous => ({
      ...previous,
      site_ids: previous.site_ids.includes(siteId)
        ? previous.site_ids.filter(id => id !== siteId)
        : [...previous.site_ids, siteId],
    }));
    setErrors(previous => ({ ...previous, site_ids: undefined, general: undefined }));
  }

  function openCreate() {
    setMode("create");
    setEditingUser(null);
    setDraft({
      ...EMPTY_DRAFT,
      organization_id: fixedOrganizationId || "",
      country_code: organizations.find(org=>org.id===(fixedOrganizationId||""))?.country || "CO",
      role: "viewer",
    });
    setErrors({});
    setActionError("");
    setSaveSuccess("");
    setAvatarFile(null);
  }

  function openEdit(user: ManagedUser) {
    setSelectedUserId(null);
    if (user.platform_role === "platform_owner") return;
    if (!isPlatformOperator && user.platform_role !== "user") return;
    if (user.platform_role === "superadmin" && !isPlatformOwner) return;
    setMode("edit");
    setEditingUser(user);
    setDraft({
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || "",
      country_code: user.country_code || organizations.find(org=>org.id===user.organization_id)?.country || "CO",
      identity_document_type: user.identity_document_type || "",
      identity_document_number: user.identity_document_number || "",
      password: "",
      organization_id: user.organization_id || "",
      role: user.platform_role !== "user" ? user.platform_role : user.role || "viewer",
      access_all_sites: user.platform_role !== "user" ? true : user.access_all_sites !== false,
      site_ids: user.platform_role !== "user" ? [] : (user.site_ids || []),
      external_supplier_id: user.platform_role !== "user" ? "" : (user.external_supplier_id || ""),
      platform_organization_ids: user.platform_role === "superadmin" ? (user.platform_organization_ids || []) : [],
    });
    setErrors({});
    setActionError("");
    setSaveSuccess("");
    setAvatarFile(null);
  }

  function closeModal() {
    if (saving) return;
    setMode(null);
    setEditingUser(null);
    setDraft(EMPTY_DRAFT);
    setErrors({});
    setAvatarFile(null);
  }

  // ── Client validation mirrors server requirements for fast feedback ───────

  function validate() {
    const next: FieldErrors = {};
    if (!draft.full_name.trim()) next.full_name = "Ingresa el nombre completo.";
    if (!draft.email.trim()) next.email = "Ingresa el correo electrónico.";
    else if (!/^\S+@\S+\.\S+$/.test(draft.email)) next.email = "Ingresa un correo válido.";
    if (mode === "create" && draft.password.length < 8) next.password = "Usa una contraseña de al menos 8 caracteres.";
    if (mode === "edit" && draft.password && draft.password.length < 8) next.password = "La nueva contraseña debe tener al menos 8 caracteres.";
    if (mode === "create" && !avatarFile) next.avatar = "Adjunta una foto de perfil para crear la cuenta.";
    if (!draft.country_code) next.country_code = "Selecciona el país de la persona.";
    if (draft.identity_document_number.trim() && !draft.identity_document_type) next.identity_document_type = "Selecciona el tipo de documento.";
    if (draft.identity_document_type && !draft.identity_document_number.trim()) next.identity_document_number = "Ingresa el número de documento.";

    if (draft.role !== "superadmin") {
      if (!draft.organization_id) next.organization_id = "Selecciona la empresa a la que pertenecerá.";
      if (!draft.role) next.role = "Selecciona un rol.";
      if (!draft.access_all_sites && draft.site_ids.length === 0) next.site_ids = "Selecciona al menos una sede o habilita el acceso a todas.";
      if (draft.site_ids.some(id => !visibleSites.some(site => site.id === id))) next.site_ids = "Una de las sedes seleccionadas no pertenece a la empresa indicada.";
      if (draft.role === "provider" && !draft.external_supplier_id) next.external_supplier_id = "Selecciona el proveedor de servicios al que representa.";
      if ((draft.role === "provider" || draft.role === "external") && draft.external_supplier_id && !visibleServiceSuppliers.some(supplier => supplier.id === draft.external_supplier_id)) {
        next.external_supplier_id = "El proveedor debe pertenecer a la empresa y prestar servicios.";
      }
    }
    if (draft.role === "superadmin") {
      if (!isPlatformOwner) next.role = "Solo el Propietario Desweb puede crear o asignar Superadministradores.";
      if (draft.platform_organization_ids.some(id=>!organizations.some(org=>org.id===id))) {
        next.platform_organization_ids="Una de las empresas asignadas no está disponible.";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ── Mutations: server remains authoritative for RBAC and tenant scope ─────

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setErrors({});
    setSaveSuccess("");
    try {
      const url = mode === "edit" && editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const body = new FormData();
      body.set("full_name", draft.full_name);
      body.set("email", draft.email);
      body.set("phone", draft.phone);
      body.set("country_code", draft.country_code);
      body.set("identity_document_type", draft.identity_document_type);
      body.set("identity_document_number", draft.identity_document_number);
      body.set("password", draft.password);
      body.set("organization_id", draft.organization_id);
      body.set("role", draft.role);
      body.set("access_all_sites", draft.access_all_sites ? "true" : "false");
      body.set("external_supplier_id", draft.external_supplier_id);
      if(avatarFile) body.set("avatar",avatarFile);
      if (!draft.access_all_sites) draft.site_ids.forEach(siteId => body.append("site_ids", siteId));
      if (draft.role === "superadmin") draft.platform_organization_ids.forEach(organizationId=>body.append("platform_organization_ids",organizationId));
      if (mode === "edit") body.set("intent", "update");

      const response = await fetch(url, {
        method: "POST",
        body,
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (payload?.fields) setErrors(payload.fields);
        else setErrors({ general: payload?.message || "No fue posible guardar el usuario." });
        return;
      }

      setSaveSuccess(payload?.message || (mode === "edit" ? "Usuario actualizado correctamente." : "Usuario creado correctamente."));
      setMode(null);
      setEditingUser(null);
      setDraft(EMPTY_DRAFT);
      setErrors({});
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  async function runConfirmedAction() {
    if (!confirm) return;
    const { user, kind } = confirm;
    setConfirm(null);
    setActionError("");

    const body = new FormData();
    body.set("intent", kind === "delete" ? "delete" : user.active ? "deactivate" : "activate");

    const response = await fetch(`/api/users/${user.id}`, {
      method: "POST",
      body,
      headers: { Accept: "application/json" },
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setActionError(payload?.message || "No fue posible completar la acción.");
      return;
    }
    router.refresh();
  }

  const modalTitle = mode === "edit" ? "Editar usuario" : "Crear usuario";
  const selectedDescription = roleDescription(draft.role);

  return <div className="phase8-users">
    <ModuleHeader
      eyebrow="Control de acceso"
      title="Usuarios y roles"
      description="Administra cuentas, roles y alcance operativo sin perder la trazabilidad de las acciones realizadas."
      count={users.length}
      countLabel="cuentas"
      searchPlaceholder="Buscar nombre, correo, empresa, sede o rol"
      facets={[
        {key:"organization",label:"Empresa",allLabel:"Todas las empresas"},
        {key:"role",label:"Rol",allLabel:"Todos los roles"},
        {key:"site",label:"Sede",allLabel:"Todas las sedes"},
        {key:"supplier",label:"Proveedor",allLabel:"Todos los proveedores"},
      ]}
      action={<Button className="module-add-button" iconLeft={organizations.length?"user-plus":"company"} onClick={organizations.length ? openCreate : ()=>router.push("/dashboard/companies?create=1")}>{organizations.length ? "Agregar" : "Crear empresa"}</Button>}
    />

    {actionError && <div className="section"><Alert variant="danger" title="No fue posible completar la acción">{actionError}</Alert></div>}
    {saveSuccess && <div className="section"><Alert variant="success" title="Cambios guardados">{saveSuccess}</Alert></div>}

    {!selectedUser && (users.length === 0 ? <section className="section"><EmptyState
      icon="file"
      title={organizations.length ? "Aún no tienes usuarios creados" : "Primero debes crear una empresa"}
      description={organizations.length ? "Crea la primera cuenta. El usuario pertenecerá a una empresa; las sedes solo definen posteriormente su alcance de acceso." : "No puedes crear usuarios de empresa todavía. Primero registra la empresa a la que pertenecerán."}
      action={<Button iconLeft={organizations.length?"user-plus":"company"} onClick={organizations.length ? openCreate : ()=>router.push("/dashboard/companies?create=1")}>{organizations.length ? "Crear usuario" : "Crear empresa"}</Button>}
    /></section> : <section className="section">
      <div className="section-heading user-directory-heading">
        <div><span className="eyebrow">Directorio de acceso</span><h2>Usuarios registrados ({users.length})</h2></div>
        <small>Los accesos se limitan por empresa, rol y sedes autorizadas.</small>
      </div>

      <CollectionView storageKey="users" label="Vista de usuarios" grid={<div className="user-role-grid user-compact-profile-grid" data-collection-grid>
        {users.map(user => <UserCard
          key={user.id}
          className={"user-directory-profile-card "+(user.active ? "" : "user-role-card-inactive")}
          recordProps={{
            "data-module-record":true,
            "data-status":user.active ? "active" : "inactive",
            "data-search":[user.full_name,user.email,user.organization_name,roleName(roleKey(user)),...(user.site_names||[]),user.external_supplier_name].filter(Boolean).join(" "),
            "data-filter-organization":user.organization_id||"",
            "data-filter-organization-label":user.organization_name||"",
            "data-filter-role":roleKey(user),
            "data-filter-role-label":roleName(roleKey(user)),
            "data-filter-site":(user.site_ids||[]).join("|"),
            "data-filter-site-label":(user.site_names||[]).join("|"),
            "data-filter-supplier":user.external_supplier_id||"",
            "data-filter-supplier-label":user.external_supplier_name||"",
          }}
        >
          <button className="user-card-profile-trigger" type="button" onClick={()=>{setSelectedUserId(user.id);setPreferredTab("general");}} aria-label={"Ver perfil de "+user.full_name}>
            <span className="user-card-cover" aria-hidden="true">
              <Badge variant={user.active?"success":"neutral"} className="user-card-status">{user.active?"Activo":"Inactivo"}</Badge>
            </span>
            <span className="user-card-avatar-row">
              <span className="user-card-avatar" aria-hidden="true">{user.has_avatar ? <img src={"/api/users/"+user.id+"/avatar"} alt="" loading="lazy" decoding="async" /> : initials(user.full_name)}</span>
            </span>
            <span className="user-card-identity">
              <strong>{user.full_name}</strong>
              <span>{roleName(roleKey(user))}</span>
              <small>{user.organization_name || "Acceso global"}</small>
              <em title={user.email}>{user.email}</em>
            </span>
            <span className="user-card-badges">
              <span><UiIcon name="location" size={12}/>{siteAccessLabel(user)}</span>
            </span>
            <span className="user-card-metrics">
              <span><strong>{user.assigned_work_orders}</strong><small>OT activas</small></span>
              <span><strong>{user.pending_activities}</strong><small>Pendientes</small></span>
              <span><strong>{user.completed_activities_30d}</strong><small>Completadas</small></span>
            </span>
          </button>

          <div className="user-card-compact-actions">
            <button className="user-card-primary-action" type="button" onClick={()=>{setSelectedUserId(user.id);setPreferredTab("general");}}><UiIcon name="user" size={14}/> Ver perfil</button>
            {user.platform_role !== "platform_owner" && (isPlatformOperator ? (isPlatformOwner || user.platform_role !== "superadmin") : user.platform_role === "user") && <>
              <button className="user-card-icon-action" type="button" onClick={() => openEdit(user)} title="Editar usuario"><UiIcon name="edit" size={14}/></button>
              {user.phone&&<a className="user-card-icon-action whatsapp" href={"https://wa.me/"+user.phone.replace(/\D/g,"")} target="_blank" rel="noreferrer" title="Abrir WhatsApp"><UiIcon name="whatsapp" size={14}/></a>}
              {user.id !== currentUserId && <button className={"user-card-icon-action status-toggle "+(user.active?"deactivate":"activate")} type="button" onClick={() => setConfirm({ kind: "status", user })} title={user.active?"Desactivar usuario":"Reactivar usuario"}><UiIcon name={user.active?"power":"check"} size={14}/></button>}
              {isPlatformOwner && user.id !== currentUserId && <button className="user-card-icon-action danger" type="button" onClick={() => setConfirm({ kind: "delete", user })} title="Eliminar usuario"><UiIcon name="trash" size={14}/></button>}
            </>}
          </div>
        </UserCard>)}
      </div>} list={<StaticDataTable
        className="user-directory-list"
        caption="Listado de usuarios"
        columns={[
          {key:"user",label:"Usuario",width:"30%"},
          {key:"status",label:"Estado"},
          {key:"company",label:"Empresa"},
          {key:"scope",label:"Alcance"},
          {key:"orders",label:"OT activas",align:"end"},
          {key:"pending",label:"Pendientes",align:"end"},
          {key:"completed",label:"Completadas",align:"end"},
          {key:"actions",label:"Acciones",align:"end"},
        ]}
        rows={users.map(user=>({
          id:user.id,
          recordProps:{
            "data-module-record":true,
            "data-status":user.active?"active":"inactive",
            "data-search":[user.full_name,user.email,user.organization_name,roleName(roleKey(user)),...(user.site_names||[]),user.external_supplier_name].filter(Boolean).join(" "),
            "data-filter-organization":user.organization_id||"",
            "data-filter-organization-label":user.organization_name||"",
            "data-filter-role":roleKey(user),
            "data-filter-role-label":roleName(roleKey(user)),
            "data-filter-site":(user.site_ids||[]).join("|"),
            "data-filter-site-label":(user.site_names||[]).join("|"),
            "data-filter-supplier":user.external_supplier_id||"",
            "data-filter-supplier-label":user.external_supplier_name||"",
          },
          cells:{
            user:<EntityIdentityCell
              imageSrc={user.has_avatar?"/api/users/"+user.id+"/avatar":null}
              imageAlt={user.has_avatar?"Foto de "+user.full_name:""}
              fallback={initials(user.full_name)}
              icon="user"
              variant="avatar"
              title={user.full_name}
              subtitle={roleName(roleKey(user))}
              meta={user.email}
            />,
            status:<Badge variant={user.active?"success":"neutral"}>{user.active?"Activo":"Inactivo"}</Badge>,
            company:user.organization_name||"Acceso global",
            scope:siteAccessLabel(user),
            orders:user.assigned_work_orders,
            pending:user.pending_activities,
            completed:user.completed_activities_30d,
            actions:<ListQuickActions>
              <button className="ds-list-action primary" type="button" onClick={()=>{setSelectedUserId(user.id);setPreferredTab("general");}} title="Ver perfil" data-tooltip="Ver perfil" aria-label={"Ver perfil de "+user.full_name}><UiIcon name="eye" size={15}/></button>
              {user.platform_role!=="platform_owner"&&(isPlatformOperator?(isPlatformOwner||user.platform_role!=="superadmin"):user.platform_role==="user")&&<>
                <button className="ds-list-action" type="button" onClick={()=>openEdit(user)} title="Editar usuario" data-tooltip="Editar usuario"><UiIcon name="edit" size={15}/></button>
                {user.phone&&<a className="ds-list-action whatsapp" href={"https://wa.me/"+user.phone.replace(/\D/g,"")} target="_blank" rel="noreferrer" title="Abrir WhatsApp" data-tooltip="Abrir WhatsApp"><UiIcon name="whatsapp" size={15}/></a>}
                {user.id!==currentUserId&&<button className="ds-list-action" type="button" onClick={()=>setConfirm({kind:"status",user})} title={user.active?"Desactivar usuario":"Reactivar usuario"} data-tooltip={user.active?"Desactivar usuario":"Reactivar usuario"}><UiIcon name={user.active?"power":"check"} size={15}/></button>}
                {isPlatformOwner&&user.id!==currentUserId&&<button className="ds-list-action danger" type="button" onClick={()=>setConfirm({kind:"delete",user})} title="Eliminar usuario" data-tooltip="Eliminar usuario"><UiIcon name="trash" size={15}/></button>}
              </>}
            </ListQuickActions>,
          },
        }))}
      />}/>
    </section>)}

    {selectedUser&&<section className="section entity-page-detail">
        <EntityProfileWorkspace
          eyebrow="Control de acceso"
          headingLabel={selectedUser.role==="technician"?"Técnico":"Usuario"}
          headingIcon="user"
          breadcrumbs={[
            {label:"Inicio",href:"/dashboard"},
            {label:"Usuarios",onClick:()=>{setSelectedUserId(null);setPreferredTab("general");}},
            {label:selectedUser.full_name},
          ]}
          title={selectedUser.full_name}
          subtitle={selectedUser.organization_name||"Desweb CMMS"}
          meta={[roleName(roleKey(selectedUser)),siteAccessLabel(selectedUser)]}
          imageSrc={selectedUser.has_avatar?"/api/users/"+selectedUser.id+"/avatar":null}
          fallback={initials(selectedUser.full_name)}
          status={<Badge variant={selectedUser.active?"success":"neutral"}>{selectedUser.active?"Activo":"Inactivo"}</Badge>}
          stats={[
            {label:"OT asignadas",value:selectedUser.assigned_work_orders,icon:"work-order"},
            {label:"Actividades pendientes",value:selectedUser.pending_activities,icon:"activity"},
            {label:"Completadas · 30 días",value:selectedUser.completed_activities_30d,icon:"check"},
            {label:"Horas campo · 30 días",value:selectedUser.attendance_hours_30d,icon:"clock"},
          ]}
          toolbarActions={<>
            {selectedUser.platform_role!=="platform_owner"&&(isPlatformOperator?(isPlatformOwner||selectedUser.platform_role!=="superadmin"):selectedUser.platform_role==="user")&&<button className="button secondary entity-action-button" type="button" onClick={()=>openEdit(selectedUser)}><UiIcon name="edit"/><span>Editar</span></button>}
            {selectedUser.role==="technician"&&<Link className="button secondary entity-action-button entity-action-wide" href="/dashboard/reaction"><UiIcon name="map"/><span>Ver en Reacción</span></Link>}
            {selectedUser.phone&&<a className="button secondary entity-action-button" href={"https://wa.me/"+selectedUser.phone.replace(/\D/g,"")} target="_blank" rel="noreferrer"><UiIcon name="whatsapp"/><span>WhatsApp</span></a>}
            <ProfileExportMenu entity="user" id={selectedUser.id}/>
          </>}
          quickActions={<>
            {selectedUser.phone&&<a href={"tel:"+selectedUser.phone.replace(/[^+\d]/g,"")}><UiIcon name="phone"/> Llamar</a>}
            {selectedUser.phone&&<a href={"https://wa.me/"+selectedUser.phone.replace(/\D/g,"")} target="_blank" rel="noreferrer"><UiIcon name="whatsapp"/> WhatsApp</a>}
            {selectedUser.role==="technician"&&<Link href="/dashboard/reaction"><UiIcon name="map"/> Reacción</Link>}
            <ProfileExportMenu entity="user" id={selectedUser.id} label="Hoja de vida"/>
          </>}
          initialTab={preferredTab}
          onTabChange={setPreferredTab}
          tabs={[
            {id:"general",label:"Información general",content:<div className="entity-section-stack">
              <div className="entity-panel"><h3>Datos del usuario</h3><div className="entity-info-grid">
                <div className="entity-info-field"><span>Nombre completo</span><strong>{selectedUser.full_name}</strong></div>
                <div className="entity-info-field"><span>Rol</span><strong>{roleName(roleKey(selectedUser))}</strong></div>
                <div className="entity-info-field"><span>Correo</span><strong>{selectedUser.email}</strong></div>
                <div className="entity-info-field"><span>Teléfono / WhatsApp</span><strong>{selectedUser.phone||"Sin registrar"}</strong></div>
                <div className="entity-info-field"><span>País</span><strong>{selectedUser.country_code||"Sin registrar"}</strong></div>
                <div className="entity-info-field"><span>Tipo de documento</span><strong>{selectedUser.identity_document_type||"Sin registrar"}</strong></div>
                <div className="entity-info-field"><span>Número de documento</span><strong>{selectedUser.identity_document_number||"Sin registrar"}</strong></div>
                <div className="entity-info-field"><span>{selectedUser.platform_role==="superadmin"?"Empresas autorizadas":"Empresa"}</span><strong>{selectedUser.platform_role==="superadmin"?siteAccessLabel(selectedUser):(selectedUser.organization_name||"Sin empresa operativa")}</strong></div>
                <div className="entity-info-field"><span>Alcance</span><strong>{siteAccessLabel(selectedUser)}</strong></div>
                <div className="entity-info-field"><span>Último acceso</span><strong>{selectedUser.last_login_at?new Date(selectedUser.last_login_at).toLocaleString("es-CO"):"Aún no ingresa"}</strong></div>
                <div className="entity-info-field"><span>Biometría</span><strong>{biometricStatusLabel(selectedUser.biometric_status)}</strong></div>
              </div></div>
            </div>},
            {id:"documents",label:"Documentos",content:detailLoadingUser===selectedUser.id
              ?<div className="entity-panel"><Spinner label="Cargando documentos…"/></div>
              :detailError?<div className="entity-panel"><Alert variant="danger" title="No fue posible cargar el expediente">{detailError}</Alert></div>
              :<UserDocuments user={selectedUser} documents={selectedDocuments}/>},
            {id:"emergency",label:"Contacto de emergencia",content:detailLoadingUser===selectedUser.id
              ?<div className="entity-panel"><Spinner label="Cargando contacto de emergencia…"/></div>
              :detailError?<div className="entity-panel"><Alert variant="danger" title="No fue posible cargar el expediente">{detailError}</Alert></div>
              :<div className="entity-section-stack">
              <div className="entity-panel"><h3>Referencia personal / contacto de emergencia</h3><div className="entity-info-grid">
                <div className="entity-info-field"><span>Nombre</span><strong>{selectedEmergencyContact?.full_name||"Sin registrar"}</strong></div>
                <div className="entity-info-field"><span>Relación</span><strong>{selectedEmergencyContact?emergencyRelationshipLabel(selectedEmergencyContact.relationship_code):"Sin registrar"}</strong></div>
                <div className="entity-info-field"><span>Teléfono</span><strong>{selectedEmergencyContact?.phone||"Sin registrar"}</strong></div>
                <div className="entity-info-field"><span>Correo</span><strong>{selectedEmergencyContact?.email||"Sin registrar"}</strong></div>
              </div></div>
              <form className="entity-panel form-grid" method="post" action={"/api/users/"+selectedUser.id+"/emergency-contact"}>
                <div className="field"><label>Nombre completo *</label><input name="full_name" required defaultValue={selectedEmergencyContact?.full_name||""}/></div>
                <div className="field"><label>Relación *</label><select name="relationship_code" required defaultValue={selectedEmergencyContact?.relationship_code||"relative"}>{EMERGENCY_RELATIONSHIPS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
                <PhoneField name="phone" label="Teléfono de emergencia" countryCode={selectedUser.country_code||"CO"} defaultValue={selectedEmergencyContact?.phone||""}/>
                <div className="field"><label>Correo</label><input type="email" name="email" defaultValue={selectedEmergencyContact?.email||""}/></div>
                <div className="field form-span-2"><label>Notas</label><textarea name="notes" rows={3} defaultValue={selectedEmergencyContact?.notes||""} placeholder="Indicaciones relevantes para una emergencia."/></div>
                <div className="form-span-2 form-actions"><button className="button" type="submit">Guardar contacto de emergencia</button></div>
              </form>
            </div>},
            {id:"statistics",label:"Estadísticas",content:statisticsError&&!selectedStatistics
              ?<div className="entity-panel user-statistics-fallback"><Alert variant="danger" title="No fue posible cargar el detalle">{statisticsError}</Alert><StatTiles className="entity-stat-grid" items={[
                {label:"OT asignadas activas",value:String(selectedUser.assigned_work_orders),hint:"órdenes no cerradas"},
                {label:"Actividades pendientes",value:String(selectedUser.pending_activities),hint:"pendientes o en progreso",tone:selectedUser.pending_activities?"warning":"success"},
                {label:"Completadas · 30 días",value:String(selectedUser.completed_activities_30d),hint:"eventos de ejecución"},
                {label:"Horas campo · 30 días",value:String(selectedUser.attendance_hours_30d),hint:"turnos de asistencia"},
              ]}/></div>
              :!selectedStatistics||statisticsLoadingUser===selectedUser.id
                ?<div className="user-statistics-loading"><Spinner label="Cargando estadísticas operativas…"/><small>Asistencia, actividades y próximos compromisos.</small></div>
                :<UserStatisticsDashboard data={{
                  id:selectedUser.id,
                  name:selectedUser.full_name,
                  role:roleName(roleKey(selectedUser)),
                  company:selectedUser.organization_name||"Desweb CMMS",
                  photoUrl:selectedUser.has_avatar?"/api/users/"+selectedUser.id+"/avatar":null,
                  active:selectedUser.active,
                  biometricLabel:biometricStatusLabel(selectedUser.biometric_status),
                  trackingLive:selectedUser.tracking_live,
                  openShift:selectedUser.open_shift,
                  openShiftStartedAt:selectedStatistics.open_shift_started_at,
                  assignedWorkOrders:selectedUser.assigned_work_orders,
                  pendingActivities:selectedUser.pending_activities,
                  completedActivities30d:selectedUser.completed_activities_30d,
                  completedActivities7d:selectedStatistics.completed_activities_7d,
                  attendanceHours30d:selectedUser.attendance_hours_30d,
                  attendanceTodayHours:selectedStatistics.attendance_hours_today,
                  attendanceDaily7d:Array.isArray(selectedStatistics.attendance_daily_7d)?selectedStatistics.attendance_daily_7d:[],
                  activityCompletionRate30d:(selectedUser.completed_activities_30d+selectedUser.pending_activities)>0
                    ?Math.round((selectedUser.completed_activities_30d/(selectedUser.completed_activities_30d+selectedUser.pending_activities))*100)
                    :0,
                  overdueActivities:selectedStatistics.overdue_activities,
                  upcomingActivities:Array.isArray(selectedStatistics.upcoming_activities)?selectedStatistics.upcoming_activities:[],
                }}/>},
            {id:"operation",label:"Actividad",content:<div className="entity-panel-grid">
              <div className="entity-panel"><h3>Trabajo asignado</h3><div className="entity-info-grid">
                <div className="entity-info-field"><span>Órdenes activas</span><strong>{selectedUser.assigned_work_orders}</strong></div>
                <div className="entity-info-field"><span>Actividades pendientes</span><strong>{selectedUser.pending_activities}</strong></div>
                <div className="entity-info-field"><span>Completadas 30 días</span><strong>{selectedUser.completed_activities_30d}</strong></div>
                <div className="entity-info-field"><span>Reacción</span><strong>{selectedUser.tracking_live?"Conectado en vivo":"Sin conexión en vivo"}</strong></div>
              </div></div>
              <div className="entity-panel"><h3>Accesos</h3><p className="entity-panel-copy">{roleDescription(roleKey(selectedUser))}</p></div>
            </div>},
            {id:"attendance",label:"Asistencia",content:<div className="entity-section-stack user-attendance-admin">
              <div className="entity-panel-grid">
                <div className="entity-panel"><h3>Estado de campo</h3><div className="entity-info-grid">
                  <div className="entity-info-field"><span>Turno actual</span><strong>{selectedUser.open_shift?"Abierto":"Sin turno abierto"}</strong></div>
                  <div className="entity-info-field"><span>Horas 30 días</span><strong>{selectedUser.attendance_hours_30d}</strong></div>
                  <div className="entity-info-field"><span>Biometría</span><strong>{biometricStatusLabel(selectedUser.biometric_status)}</strong></div>
                  <div className="entity-info-field"><span>Seguimiento Reacción</span><strong>{selectedUser.tracking_live?"En línea":"Sin conexión"}</strong></div>
                </div></div>
                <div className="entity-panel"><h3>Alcance operativo</h3><div className="entity-info-grid">
                  <div className="entity-info-field"><span>Empresa</span><strong>{selectedUser.organization_name||"Sin empresa operativa"}</strong></div>
                  <div className="entity-info-field"><span>Sedes autorizadas</span><strong>{siteAccessLabel(selectedUser)}</strong></div>
                  <div className="entity-info-field"><span>Rol</span><strong>{roleName(roleKey(selectedUser))}</strong></div>
                  <div className="entity-info-field"><span>Estado de cuenta</span><strong>{selectedUser.active?"Activo":"Inactivo"}</strong></div>
                </div></div>
              </div>
              <div className="entity-panel user-attendance-admin-panel">
                <div className="user-attendance-admin-heading">
                  <span className="user-attendance-admin-icon" aria-hidden="true"><UiIcon name="attendance" size={20}/></span>
                  <div>
                    <span className="eyebrow">Administración contextual</span>
                    <h3>Control de asistencia y biometría</h3>
                    <p className="entity-panel-copy">El expediente individual consolida jornada programada, biometría, marcaciones, contingencias y trazabilidad. En Asistencia puedes revisar cobertura biométrica, aprobar solicitudes iniciales una sola vez y gestionar revocaciones o recuperación.</p>
                  </div>
                  <Badge variant={selectedUser.biometric_status==="verified"?"success":selectedUser.biometric_status==="revoked"?"danger":selectedUser.biometric_status==="legacy"?"warning":"neutral"} icon="attendance">{biometricStatusLabel(selectedUser.biometric_status)}</Badge>
                </div>
                {selectedUser.organization_id
                  ?<div className="user-attendance-admin-actions">
                    <Link className="button" href={attendanceAdminHref(selectedUser)}><UiIcon name={selectedUser.biometric_status==="verified"?"attendance":"user"} size={15}/>{selectedUser.biometric_status==="verified"?"Administrar biometría":"Gestionar enrolamiento"}</Link>
                    <Link className="button secondary" href={`/dashboard/attendance?organization_id=${selectedUser.organization_id}&user_id=${selectedUser.id}&view=operation#attendance-audit`}><UiIcon name="clock" size={15}/>Abrir en Asistencia</Link>
                  </div>
                  :<Alert variant="warning" title="Usuario sin empresa operativa">Asistencia requiere una empresa para aplicar política, sedes y biometría.</Alert>}
              </div>
              {selectedUser.organization_id&&attendanceAuditEligible(selectedUser)&&<UserAttendanceAuditCenter
                key={selectedUser.id}
                organizationId={selectedUser.organization_id}
                people={[{id:selectedUser.id,full_name:selectedUser.full_name,role:roleName(roleKey(selectedUser))}]}
                initialUserId={selectedUser.id}
                lockedUserId={selectedUser.id}
              />}
            </div>},
            {id:"life",label:"Hoja de vida",content:<div className="entity-section-stack"><div className="entity-panel"><h3>Hoja de vida del técnico</h3><p className="entity-panel-copy">Consolida identidad, rol, alcance, indicadores de ejecución, asistencia y estado operativo con los permisos actuales.</p></div><ProfileExportMenu entity="user" id={selectedUser.id} label="Exportar hoja de vida"/></div>},
          ]}
        />
    </section>}

    {mode && <div className="modal-backdrop user-modal-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !saving) closeModal();
    }}>
      <section className="company-modal user-form-modal unified-create-modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
        <header className="modal-header">
          <div>
            <span className="eyebrow">{mode === "edit" ? "Administración de acceso" : "Nueva cuenta"}</span>
            <h2 id="user-modal-title">{modalTitle}</h2>
            <p>{mode === "edit" ? "Actualiza identidad, empresa, permisos de sedes y credenciales." : "El usuario quedará vinculado a una empresa. Las sedes no son requisito para crear la cuenta."}</p>
          </div>
          <button className="modal-close" type="button" aria-label="Cerrar" onClick={closeModal}><UiIcon name="x" size={16}/></button>
        </header>

        <form className="company-modal-form user-modal-form" onSubmit={submit} noValidate>
          {errors.general && <Alert variant="danger" title="Revisa el formulario">{errors.general}</Alert>}

          <div className="form-grid">
            <div className={`form-span-2 user-photo-field ${errors.avatar ? "field-error" : ""}`}>
              <FileDropzone
                label={mode === "create" ? "Foto de perfil" : "Actualizar foto de perfil"}
                description="La foto identifica visualmente al usuario. La biometría facial se enrola por cámara con prueba de vida."
                accept="image/png,image/jpeg,image/webp"
                maxSizeMb={5}
                required={mode === "create"}
                kind="image"
                existingFileName={editingUser?.has_avatar ? "Foto de perfil actual" : null}
                onFileChange={file=>{setAvatarFile(file);setErrors(previous=>({...previous,avatar:undefined,general:undefined}));}}
              />
              {errors.avatar && <small className="field-error-message">{errors.avatar}</small>}
            </div>
            <div className={`field ${errors.full_name ? "field-error" : ""}`}>
              <label htmlFor="managed-user-name">Nombre completo *</label>
              <input id="managed-user-name" placeholder="Ej. Laura Gómez" value={draft.full_name} onChange={event => updateDraft("full_name", event.target.value)} autoFocus />
              {errors.full_name && <small className="field-error-message">{errors.full_name}</small>}
            </div>
            <div className={`field ${errors.email ? "field-error" : ""}`}>
              <label htmlFor="managed-user-email">Correo *</label>
              <input id="managed-user-email" type="email" placeholder="laura@empresa.com" value={draft.email} onChange={event => updateDraft("email", event.target.value)} />
              {errors.email && <small className="field-error-message">{errors.email}</small>}
            </div>
            <CountrySelect
              id="managed-user-country"
              name="country_code"
              label="País *"
              value={draft.country_code}
              onChange={value=>{updateDraft("country_code",value);updateDraft("identity_document_type","");}}
              required
            />
            <PersonalDocumentTypeSelect
              id="managed-user-document-type"
              countryCode={draft.country_code}
              value={draft.identity_document_type}
              onChange={value=>updateDraft("identity_document_type",value)}
              required={Boolean(draft.identity_document_number)}
            />
            <div className={`field ${errors.identity_document_number ? "field-error" : ""}`}>
              <label htmlFor="managed-user-document-number">Número de documento</label>
              <input id="managed-user-document-number" value={draft.identity_document_number} onChange={event=>updateDraft("identity_document_number",event.target.value)} placeholder="Número del documento seleccionado" />
              {errors.identity_document_number&&<small className="field-error-message">{errors.identity_document_number}</small>}
            </div>
            <PhoneField
              id="managed-user-phone"
              label="Teléfono / WhatsApp"
              countryCode={draft.country_code||selectedOrganizationCountry}
              value={draft.phone}
              onValueChange={value => updateDraft("phone", value)}
            />
            <div className={`field ${errors.password ? "field-error" : ""}`}>
              <label htmlFor="managed-user-password">{mode === "create" ? "Contraseña temporal *" : "Nueva contraseña (opcional)"}</label>
              <input id="managed-user-password" type="password" placeholder="Mínimo 8 caracteres" value={draft.password} onChange={event => updateDraft("password", event.target.value)} autoComplete="new-password" />
              <small>{mode === "edit" ? "Déjala vacía para conservar la contraseña actual." : "Mínimo 8 caracteres."}</small>
              {errors.password && <small className="field-error-message">{errors.password}</small>}
            </div>

            {isPlatformOperator && draft.role !== "superadmin" ? <div className={`field ${errors.organization_id ? "field-error" : ""}`}>
              <label htmlFor="managed-user-org">Empresa *</label>
              <select id="managed-user-org" value={draft.organization_id} onChange={event => changeOrganization(event.target.value)}>
                <option value="">Selecciona una empresa</option>
                {organizations.map(org => <option value={org.id} key={org.id}>{org.name}</option>)}
              </select>
              {errors.organization_id && <small className="field-error-message">{errors.organization_id}</small>}
            </div> : !isPlatformOperator ? <input type="hidden" value={fixedOrganizationId || ""} /> : null}

            <div className={`field ${errors.role ? "field-error" : ""}`}>
              <label htmlFor="managed-user-role">Rol *</label>
              <select id="managed-user-role" value={draft.role} onChange={event => {
                const nextRole = event.target.value;
                if (nextRole === "superadmin") {
                  setDraft(previous => ({ ...previous, role: nextRole, organization_id: "", access_all_sites: true, site_ids: [], external_supplier_id: "", platform_organization_ids: previous.platform_organization_ids || [] }));
                } else {
                  setDraft(previous => ({ ...previous, role: nextRole, platform_organization_ids: [], external_supplier_id: nextRole === "external" || nextRole === "provider" ? previous.external_supplier_id : "" }));
                  setErrors(previous => ({ ...previous, role: undefined, external_supplier_id: undefined, general: undefined }));
                }
              }}>
                {isPlatformOwner && <option value="superadmin">Superadministrador</option>}
                {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {errors.role && <small className="field-error-message">{errors.role}</small>}
            </div>

            {draft.role==="superadmin"&&isPlatformOwner&&<div className={`field form-span-2 site-access-field ${errors.platform_organization_ids?"field-error":""}`}>
              <label>Empresas autorizadas <span className="muted">(opcional)</span></label>
              <div className="site-access-empty">El Superadministrador no obtiene acceso global. Las empresas que cree se añadirán automáticamente a su cartera; aquí puedes asignarle empresas adicionales.</div>
              <div className="site-checkbox-grid">
                {organizations.map(organization=>{
                  const checked=draft.platform_organization_ids.includes(organization.id);
                  const createdBySuperadmin=Boolean(
                    editingUser?.platform_role==="superadmin"
                    && editingUser.platform_created_organization_ids?.includes(organization.id)
                  );
                  return <label className={`site-checkbox-card ${checked?"active":""}`} key={organization.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={createdBySuperadmin}
                      onChange={()=>updateDraft("platform_organization_ids",checked
                        ?draft.platform_organization_ids.filter(id=>id!==organization.id)
                        :[...draft.platform_organization_ids,organization.id])}
                    />
                    <span className="site-checkbox-mark">{checked?<UiIcon name="check" size={12}/>:null}</span>
                    <span>
                      <strong>{organization.name}</strong>
                      <small>{createdBySuperadmin?"Creada por este Superadministrador":checked?"Asignada por Propietario Desweb":"Sin acceso"}</small>
                    </span>
                  </label>;
                })}
              </div>
              {errors.platform_organization_ids&&<small className="field-error-message">{errors.platform_organization_ids}</small>}
            </div>}

            {(draft.role === "provider" || draft.role === "external") && <div className={`field ${errors.external_supplier_id ? "field-error" : ""}`}>
              <label htmlFor="managed-user-supplier">Proveedor de servicios {draft.role === "provider" ? "*" : "(opcional)"}</label>
              <select id="managed-user-supplier" value={draft.external_supplier_id} onChange={event => updateDraft("external_supplier_id", event.target.value)}>
                <option value="">Selecciona proveedor</option>
                {visibleServiceSuppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
              {visibleServiceSuppliers.length === 0 && <small>Primero registra un proveedor de tipo Servicios o Materiales + servicios.</small>}
              {draft.role === "external" && visibleServiceSuppliers.length > 0 && <small>Déjalo vacío si la persona externa no pertenece a un proveedor contratado.</small>}
              {errors.external_supplier_id && <small className="field-error-message">{errors.external_supplier_id}</small>}
            </div>}

            {mode === "edit" && draft.role !== "superadmin" && <div className={`field form-span-2 site-access-field ${errors.site_ids ? "field-error" : ""}`}>
              <label>Alcance de acceso a sedes <span className="muted">(opcional)</span></label>
              {!draft.organization_id ? <div className="site-access-empty">Selecciona primero la empresa. El usuario pertenece a la empresa; este bloque solo restringe qué sedes podrá operar.</div> : visibleSites.length === 0 ? <div className="site-access-empty">La empresa todavía no tiene sedes. Puedes crear el usuario igualmente con alcance general de empresa.</div> : <>
                <div className="site-access-mode">
                  <button
                    type="button"
                    className={draft.access_all_sites ? "active" : ""}
                    onClick={() => {
                      updateDraft("access_all_sites", true);
                      setDraft(previous => ({ ...previous, access_all_sites: true, site_ids: [] }));
                    }}
                  >
                    <span className="site-access-mode-icon"><UiIcon name="check" size={15}/></span>
                    <span><strong>Todas las sedes</strong><small>Acceso actual y a nuevas sedes que se creen.</small></span>
                  </button>
                  <button
                    type="button"
                    className={!draft.access_all_sites ? "active" : ""}
                    onClick={() => updateDraft("access_all_sites", false)}
                  >
                    <span className="site-access-mode-icon"><UiIcon name="location" size={15}/></span>
                    <span><strong>Sedes específicas</strong><small>Selecciona individualmente dónde puede operar.</small></span>
                  </button>
                </div>

                {!draft.access_all_sites && <div className="site-checkbox-grid">
                  {visibleSites.map(site => {
                    const checked = draft.site_ids.includes(site.id);
                    return <label className={`site-checkbox-card ${checked ? "active" : ""}`} key={site.id}>
                      <input type="checkbox" checked={checked} onChange={() => toggleSite(site.id)} />
                      <span className="site-checkbox-mark">{checked ? <UiIcon name="check" size={12}/> : null}</span>
                      <span><strong>{site.name}</strong><small>{site.organization_name}</small></span>
                    </label>;
                  })}
                </div>}
              </>}
              {errors.site_ids && <small className="field-error-message">{errors.site_ids}</small>}
            </div>}
          </div>

          <aside className="role-permission-note">
            <div className="role-permission-icon" aria-hidden="true"><UiIcon name="info" size={16}/></div>
            <div><strong>{roleName(draft.role)}</strong><p>{selectedDescription}</p></div>
          </aside>

          <footer className="modal-actions user-modal-actions">
            <button className="button secondary" type="button" disabled={saving} onClick={closeModal}>Cancelar</button>
            <button className="button" type="submit" disabled={saving}>{saving ? "Guardando…" : mode === "edit" ? "Guardar cambios" : "Crear usuario"}</button>
          </footer>
        </form>
      </section>
    </div>}

    <ConfirmDialog
      open={confirm?.kind === "status"}
      title={confirm?.user.active ? "Desactivar usuario" : "Reactivar usuario"}
      message={confirm?.user.active
        ? "El usuario dejará de poder iniciar sesión, pero su historial y movimientos permanecerán intactos."
        : "El usuario recuperará el acceso según el rol y alcance que tenga asignados."}
      confirmLabel={confirm?.user.active ? "Desactivar" : "Reactivar"}
      variant={confirm?.user.active ? "danger" : "default"}
      onCancel={() => setConfirm(null)}
      onConfirm={runConfirmedAction}
    />

    <ConfirmDialog
      open={confirm?.kind === "delete"}
      title="Eliminar usuario"
      message={confirm?.user.has_activity
        ? isPlatformOwner
          ? "Este usuario tiene movimientos registrados. Como Propietario Desweb puedes eliminar universalmente la cuenta y las dependencias que impidan su borrado. Esta acción es irreversible."
          : "Este usuario tiene movimientos registrados. Por trazabilidad no puede eliminarse; debes desactivarlo para conservar el historial."
        : "Esta acción eliminará definitivamente la cuenta y su membresía."}
      confirmLabel={confirm?.user.has_activity && !isPlatformOwner ? "Entendido" : "Eliminar definitivamente"}
      variant="danger"
      onCancel={() => setConfirm(null)}
      onConfirm={() => {
        if (confirm?.user.has_activity && !isPlatformOwner) {
          setConfirm(null);
          return;
        }
        void runConfirmedAction();
      }}
    />
  </div>;
}
