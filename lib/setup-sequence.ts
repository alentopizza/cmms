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


export type CreationHierarchyContext = {
  organizations: number;
  sites: number;
  sublocations: number;
  suppliers: number;
  workforce: number;
  assets: number;
};

export type CreationHierarchyTarget =
  | "sublocation"
  | "supplier"
  | "workforce"
  | "crew"
  | "asset"
  | "inventory"
  | "work_order"
  | "routine";

export function creationPrerequisiteFor(
  context: CreationHierarchyContext,
  target: CreationHierarchyTarget,
): SetupGate {
  if (context.organizations < 1) {
    return {
      ready:false,
      title:"Primero debes crear una empresa",
      message:"No puedes continuar con este registro porque todavía no existe una empresa activa. La empresa es el primer nivel de la jerarquía y define dónde quedarán asociados los demás datos.",
      href:"/dashboard/companies?create=1",
      action:"Crear empresa",
    };
  }

  if (context.sites < 1) {
    return {
      ready:false,
      title:"Primero debes crear una ubicación principal",
      message: target === "sublocation"
        ? "No puedes crear una sububicación todavía. Ya existe una empresa, pero primero debes registrar al menos una ubicación principal o sede."
        : "La empresa ya existe, pero falta una ubicación principal. Crea una sede antes de continuar con los siguientes registros.",
      href:"/dashboard/locations?create=site",
      action:"Crear ubicación",
    };
  }

  if (target === "sublocation") {
    return { ready:true,title:"Ubicación disponible",message:"Ya puedes crear una sububicación." };
  }

  if (context.sublocations < 1) {
    return {
      ready:false,
      title:"Primero debes crear una sububicación",
      message:"La empresa y su ubicación principal ya existen. Ahora crea al menos un área, piso, habitación o zona interna para continuar con la jerarquía operativa.",
      href:"/dashboard/locations?create=sub",
      action:"Crear sububicación",
    };
  }

  if (target === "supplier" || target === "workforce") {
    return { ready:true,title:"Estructura física completa",message:"Ya puedes continuar con este registro." };
  }

  if ((target === "asset" || target === "inventory" || target === "work_order" || target === "routine") && context.suppliers < 1) {
    return {
      ready:false,
      title:"Primero debes registrar un proveedor",
      message:"La estructura física está completa, pero todavía no existe un proveedor activo. Registra uno antes de crear activos, inventario o registros que dependan de ellos.",
      href:"/dashboard/suppliers",
      action:"Crear proveedor",
    };
  }

  if (target === "asset" || target === "inventory") {
    return { ready:true,title:"Requisitos completos",message:"Ya puedes crear el registro." };
  }

  if (target === "crew" && context.workforce < 1) {
    return {
      ready:false,
      title:"Primero debes crear personal ejecutor",
      message:"No puedes crear una cuadrilla sin integrantes. Registra al menos un técnico interno o colaborador externo antes de conformar el equipo.",
      href:"/dashboard/users",
      action:"Crear personal",
    };
  }

  if (target === "crew") {
    return { ready:true,title:"Personal disponible",message:"Ya puedes crear una cuadrilla." };
  }

  if ((target === "work_order" || target === "routine") && context.assets < 1) {
    return {
      ready:false,
      title:"Primero debes registrar un activo",
      message: target === "routine"
        ? "No puedes crear una rutina sin un activo. Completa primero el registro del equipo al que se asociará el mantenimiento preventivo."
        : "No puedes crear una orden de trabajo sin un activo. Registra primero el equipo que recibirá la intervención.",
      href:"/dashboard/assets",
      action:"Crear activo",
    };
  }

  return { ready:true,title:"Jerarquía completa",message:"Se cumplen todos los requisitos previos para continuar." };
}


export async function getCreationHierarchyContext(organizationId?: string | null): Promise<CreationHierarchyContext> {
  const params = organizationId ? [organizationId] : [];
  const orgFilter = organizationId ? "AND o.id=$1" : "";
  const entityFilter = organizationId ? "AND organization_id=$1" : "";
  const memberFilter = organizationId ? "AND om.organization_id=$1" : "";

  const result = await query<CreationHierarchyContext>(
    `SELECT
      (SELECT count(*)::int FROM organizations o WHERE o.active=true ${orgFilter}) organizations,
      (SELECT count(*)::int FROM sites WHERE active=true ${entityFilter}) sites,
      (SELECT count(*)::int FROM locations WHERE active=true ${entityFilter}) sublocations,
      (SELECT count(*)::int FROM suppliers WHERE active=true ${entityFilter}) suppliers,
      (
        SELECT count(*)::int
        FROM organization_members om
        JOIN users u ON u.id=om.user_id
        WHERE u.active=true
          AND om.role IN ('technician','external')
          ${memberFilter}
      ) workforce,
      (SELECT count(*)::int FROM assets WHERE status<>'retired' ${entityFilter}) assets`,
    params,
  );

  return result.rows[0];
}


export type OrganizationCreationHierarchy = CreationHierarchyContext & {
  organizationId: string;
  organizationName: string;
};

export async function getOrganizationCreationHierarchies(): Promise<OrganizationCreationHierarchy[]> {
  const result = await query<OrganizationCreationHierarchy>(
    `SELECT
      o.id::text "organizationId",
      o.name "organizationName",
      1::int organizations,
      (SELECT count(*)::int FROM sites s WHERE s.organization_id=o.id AND s.active=true) sites,
      (SELECT count(*)::int FROM locations l WHERE l.organization_id=o.id AND l.active=true) sublocations,
      (SELECT count(*)::int FROM suppliers sp WHERE sp.organization_id=o.id AND sp.active=true) suppliers,
      (
        SELECT count(*)::int
        FROM organization_members om
        JOIN users u ON u.id=om.user_id
        WHERE om.organization_id=o.id
          AND u.active=true
          AND om.role IN ('technician','external')
      ) workforce,
      (SELECT count(*)::int FROM assets a WHERE a.organization_id=o.id AND a.status<>'retired') assets
    FROM organizations o
    WHERE o.active=true
    ORDER BY o.name`,
  );
  return result.rows;
}

function prerequisiteDepth(gate: SetupGate): number {
  if (gate.ready) return 99;
  if (gate.href?.startsWith("/dashboard/companies")) return 0;
  if (gate.href?.includes("create=site")) return 1;
  if (gate.href?.includes("create=sub")) return 2;
  if (gate.href?.startsWith("/dashboard/suppliers")) return 3;
  if (gate.href?.startsWith("/dashboard/users")) return 4;
  if (gate.href?.startsWith("/dashboard/assets")) return 5;
  return 0;
}

export function creationPrerequisiteAcrossOrganizations(
  contexts: OrganizationCreationHierarchy[],
  target: CreationHierarchyTarget,
): SetupGate {
  if (contexts.length < 1) {
    return creationPrerequisiteFor({
      organizations:0,sites:0,sublocations:0,suppliers:0,workforce:0,assets:0,
    }, target);
  }

  const gates = contexts.map(context => ({
    context,
    gate: creationPrerequisiteFor(context,target),
  }));

  if (gates.some(item => item.gate.ready)) {
    return {
      ready:true,
      title:"Jerarquía disponible",
      message:"Existe al menos una empresa que cumple los requisitos previos para crear este registro.",
    };
  }

  const closest = [...gates].sort((a,b) => prerequisiteDepth(b.gate)-prerequisiteDepth(a.gate))[0];
  return {
    ...closest.gate,
    message:`Ninguna empresa activa está lista para este registro. ${closest.context.organizationName}: ${closest.gate.message}`,
  };
}
