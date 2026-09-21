import type { PoolClient } from "pg";
import { query } from "@/lib/db";

export type SetupState = {
  sites: number;
  sublocations: number;
  suppliers: number;
  serviceSuppliers: number;
  technicians: number;
  externalCollaborators: number;
  crews: number;
  assets: number;
  inventoryItems: number;
};

export async function getSetupState(organizationId: string, client?: PoolClient): Promise<SetupState> {
  const sql = `SELECT
      (SELECT count(*)::int FROM sites WHERE organization_id=$1 AND active=true) sites,
      (SELECT count(*)::int FROM locations WHERE organization_id=$1 AND active=true) sublocations,
      (SELECT count(*)::int FROM suppliers WHERE organization_id=$1 AND active=true) suppliers,
      (SELECT count(*)::int FROM suppliers WHERE organization_id=$1 AND active=true AND supplier_type IN ('services','both')) "serviceSuppliers",
      (SELECT count(*)::int FROM organization_members om JOIN users u ON u.id=om.user_id WHERE om.organization_id=$1 AND om.role='technician' AND u.active=true) technicians,
      (SELECT count(*)::int FROM organization_members om JOIN users u ON u.id=om.user_id WHERE om.organization_id=$1 AND om.role='external' AND u.active=true) "externalCollaborators",
      (SELECT count(*)::int FROM crews WHERE organization_id=$1 AND active=true) crews,
      (SELECT count(*)::int FROM assets WHERE organization_id=$1 AND status<>'retired') assets,
      (SELECT count(*)::int FROM inventory_items WHERE organization_id=$1 AND active=true) "inventoryItems"`;
  const result = client
    ? await client.query<SetupState>(sql,[organizationId])
    : await query<SetupState>(sql,[organizationId]);
  return result.rows[0];
}

export type SetupGate = {
  ready: boolean;
  title: string;
  message: string;
  href?: string;
  action?: string;
};

export function gateFor(state: SetupState, target: "supplier" | "workforce" | "provider" | "external" | "asset" | "inventory" | "crew" | "activity"): SetupGate {
  if (state.sites < 1) return {
    ready:false,
    title:"Primero crea una ubicación principal",
    message:"La empresa necesita al menos una sede activa antes de continuar con su estructura operativa.",
    href:"/dashboard/locations",
    action:"Ir a ubicaciones",
  };
  if (state.sublocations < 1) return {
    ready:false,
    title:"Crea al menos una sububicación",
    message:"Define un área, piso, zona o espacio interno. A partir de esta estructura podrás vincular proveedores, personal y recursos.",
    href:"/dashboard/locations",
    action:"Crear sububicación",
  };

  if (target === "supplier") return { ready:true,title:"Estructura lista",message:"Ya puedes registrar proveedores." };

  if (target === "provider" && state.serviceSuppliers < 1) return {
    ready:false,
    title:"Registra un proveedor de servicios",
    message:"Las cuentas con rol Proveedor de servicios deben vincularse a un proveedor activo de tipo Servicios o Materiales + servicios.",
    href:"/dashboard/suppliers",
    action:"Crear proveedor de servicios",
  };

  if (target === "workforce") return { ready:true,title:"Estructura lista",message:"Ya puedes crear técnicos o colaboradores externos." };

  if ((target === "asset" || target === "inventory") && state.suppliers < 1) return {
    ready:false,
    title:"Primero registra un proveedor",
    message:"Los activos y artículos deben quedar relacionados con un proveedor desde su creación.",
    href:"/dashboard/suppliers",
    action:"Ir a proveedores",
  };

  if (target === "crew" && state.technicians + state.externalCollaborators < 1) return {
    ready:false,
    title:"Primero crea personal ejecutor",
    message:"Una cuadrilla necesita al menos un técnico interno o colaborador externo activo.",
    href:"/dashboard/users",
    action:"Crear personal",
  };

  if (target === "activity" && state.assets < 1) return {
    ready:false,
    title:"Primero registra un activo",
    message:"Las actividades de mantenimiento se crean dentro de una orden vinculada a un activo.",
    href:"/dashboard/assets",
    action:"Registrar activo",
  };
  if (target === "activity" && state.technicians + state.externalCollaborators + state.crews < 1) return {
    ready:false,
    title:"Define quién ejecutará el trabajo",
    message:"Crea un técnico, colaborador externo o cuadrilla antes de programar actividades.",
    href:"/dashboard/users",
    action:"Crear personal",
  };

  return { ready:true,title:"Proceso habilitado",message:"Se cumplen los pasos previos requeridos." };
}
