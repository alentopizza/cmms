/**
 * User-facing manual source of truth.
 *
 * Keep this content synchronized with product behavior. The authenticated
 * manual filters/prioritizes sections by the current role; the public manual
 * presents the general platform scope without exposing tenant data.
 */

// ── Manual contracts ────────────────────────────────────────────────────────

export type ManualRole =
  | "platform_owner"
  | "superadmin"
  | "admin"
  | "manager"
  | "technician"
  | "requester"
  | "viewer"
  | "provider"
  | "external"
  | "all";

export type ManualArticle = {
  id:string;
  title:string;
  summary:string;
  icon:string;
  module:string;
  roles:ManualRole[];
  steps:string[];
  notes?:string[];
  href?:string;
  keywords:string[];
};

export type ManualChange = {
  date:string;
  title:string;
  summary:string;
  roles:ManualRole[];
};

// ── Role catalogue ──────────────────────────────────────────────────────────

export const MANUAL_ROLES:Array<{id:ManualRole;label:string;summary:string}> = [
  {id:"all",label:"Toda la plataforma",summary:"Visión general de módulos, flujos y alcance del CMMS."},
  {id:"platform_owner",label:"Propietario Desweb",summary:"Gobierno total de plataforma, empresas, roles y operaciones excepcionales."},
  {id:"superadmin",label:"Superadministrador",summary:"Administración SaaS, onboarding, soporte y operación multiempresa."},
  {id:"admin",label:"Administrador de empresa",summary:"Configuración del tenant, usuarios, sedes, recursos y supervisión."},
  {id:"manager",label:"Manager / Supervisor",summary:"Coordinación operativa, asistencia, cuadrillas, OT y seguimiento."},
  {id:"technician",label:"Técnico",summary:"Presencia en sitio, órdenes, activos y ejecución de actividades."},
  {id:"requester",label:"Solicitante",summary:"Creación y seguimiento de solicitudes dentro de su alcance."},
  {id:"viewer",label:"Consulta",summary:"Lectura de información autorizada sin acciones operativas."},
  {id:"provider",label:"Proveedor",summary:"Trabajo asignado a proveedor y servicios dentro del alcance contratado."},
  {id:"external",label:"Colaborador externo",summary:"Trabajo de campo asignado directamente o mediante cuadrilla."},
];

export const MANUAL_LAST_REVIEW = "2026-09-22";

// ── User-facing articles ────────────────────────────────────────────────────

export const MANUAL_ARTICLES:ManualArticle[] = [
  {
    id:"navigation",
    title:"Navegación y acceso",
    summary:"Cómo moverte por el panel en escritorio y celular.",
    icon:"▦",
    module:"Plataforma",
    roles:["all","platform_owner","superadmin","admin","manager","technician","requester","viewer","provider","external"],
    href:"/dashboard",
    steps:[
      "En escritorio utiliza el menú lateral; puede contraerse y el orden de módulos se guarda por usuario.",
      "En celular, Técnicos y Colaboradores externos tienen navegación inferior con Dashboard, Órdenes, Asistencia y Activos.",
      "El botón Más abre módulos secundarios y acciones de cuenta; no repite los accesos principales.",
      "Mi configuración está disponible para todos los roles y permite cambiar la apariencia personal. La Configuración de empresa/plataforma aparece solo cuando tu rol tiene permiso administrativo.",
    ],
    notes:["Los módulos que no aparecen no deben interpretarse como un error: la navegación respeta los permisos de tu rol."],
    keywords:["menu","móvil","navegación","cerrar sesión","más"],
  },
  {
    id:"company-setup",
    title:"Empresa y estructura física",
    summary:"Orden correcto para preparar una empresa, sede y sububicaciones.",
    icon:"◫",
    module:"Administración",
    roles:["all","platform_owner","superadmin","admin","manager"],
    href:"/dashboard/companies",
    steps:[
      "Crea o abre la empresa y completa su identidad legal y visual.",
      "Configura la sede principal con dirección, ciudad, país y geocerca validada en el mapa.",
      "Crea sedes adicionales cuando corresponda y después sus sububicaciones.",
      "Usa la ficha de empresa para acceder rápidamente a ubicaciones, activos, usuarios y documentación.",
    ],
    notes:["La dirección administrativa de la empresa y la dirección operativa de una sede son conceptos distintos."],
    keywords:["empresa","ubicación","sede","sububicación","mapa"],
  },
  {
    id:"geofence",
    title:"Mapa y geocerca",
    summary:"Cómo validar la ubicación física y definir el radio permitido.",
    icon:"⌖",
    module:"Ubicaciones",
    roles:["all","platform_owner","superadmin","admin","manager"],
    href:"/dashboard/locations",
    steps:[
      "Escribe la dirección de la sede y selecciona Validar.",
      "Elige la coincidencia correcta o usa la ubicación actual si estás físicamente en el sitio.",
      "Ajusta el punto sobre el mapa si es necesario.",
      "Define el radio permitido entre 20 y 5000 metros.",
      "Guarda. Estas coordenadas son las mismas que usa Asistencia para verificar presencia.",
    ],
    notes:["El círculo mostrado en pantalla es una ayuda visual; el servidor vuelve a calcular la distancia al registrar asistencia."],
    keywords:["gps","geocerca","radio","dirección","mapa"],
  },
  {
    id:"users",
    title:"Usuarios, foto y alcance",
    summary:"Creación de usuarios, foto obligatoria y acceso por sedes.",
    icon:"◎",
    module:"Usuarios",
    roles:["all","platform_owner","superadmin","admin","manager"],
    href:"/dashboard/users",
    steps:[
      "Crea el usuario con nombre, correo, rol y foto de perfil obligatoria.",
      "Asigna acceso a todas las sedes o limita el usuario a sedes concretas.",
      "La tarjeta de usuario muestra el estado biométrico: Verificada, Pendiente, Reenrolar o Revocada.",
      "La foto de perfil sirve para identificación humana; no es la referencia biométrica facial.",
    ],
    notes:["Un Administrador de empresa puede administrar usuarios ordinarios de su propia organización dentro de su permiso."],
    keywords:["usuarios","foto","rol","sedes","permisos"],
  },
  {
    id:"biometric-enrollment",
    title:"Enrolamiento facial supervisado",
    summary:"Cómo establecer la identidad biométrica inicial de forma presencial.",
    icon:"◎",
    module:"Asistencia",
    roles:["all","platform_owner","superadmin","admin","manager","technician","provider","external"],
    href:"/dashboard/attendance",
    steps:[
      "El usuario debe existir y tener foto de perfil.",
      "Un Administrador o Manager selecciona al usuario y la sede de enrolamiento.",
      "La persona debe estar físicamente presente; el supervisor confirma visualmente su identidad.",
      "La persona acepta el tratamiento de su plantilla facial.",
      "Se activa la cámara y se capturan muestras en vivo con prueba de vida/anti-spoof.",
      "El sistema guarda una plantilla numérica cifrada y registra quién supervisó el proceso.",
    ],
    notes:[
      "No se utiliza una foto subida como plantilla biométrica.",
      "El autoenrolamiento está deshabilitado y una plantilla legada requiere reenrolamiento supervisado.",
    ],
    keywords:["facial","biometría","enrolamiento","cámara","rostro"],
  },
  {
    id:"field-presence",
    title:"Iniciar actividades y presencia en sitio",
    summary:"Cómo abrir una jornada aunque todavía no tengas actividades asignadas.",
    icon:"◌",
    module:"Asistencia",
    roles:["all","admin","manager","technician","provider","external"],
    href:"/dashboard/attendance",
    steps:[
      "Abre Asistencia desde el celular.",
      "El sistema obtiene una ubicación GPS precisa y valida la geocerca de la sede.",
      "Si la ubicación es válida, activa la cámara y verifica tu rostro contra la plantilla supervisada.",
      "Selecciona Iniciar actividades. Quedarás En sitio y disponible.",
      "No necesitas tener una OT o actividad asignada en ese momento; las actividades posteriores pueden relacionarse con la jornada abierta.",
      "Al finalizar tu presencia pulsa Marcar salida / Finalizar jornada y repite las validaciones requeridas.",
    ],
    notes:["La geolocalización se captura en eventos explícitos de entrada/salida; no se rastrea continuamente en segundo plano."],
    keywords:["asistencia","jornada","presencia","iniciar actividades","gps"],
  },
  {
    id:"attendance-contingency",
    title:"Contingencia de asistencia",
    summary:"Qué hacer cuando una falla técnica impide la validación normal.",
    icon:"!",
    module:"Asistencia",
    roles:["all","admin","manager","technician","provider","external"],
    href:"/dashboard/attendance",
    steps:[
      "Intenta primero el flujo normal de GPS + geocerca + rostro.",
      "Si una falla de cámara, GPS, precisión, geocerca, conectividad o dispositivo lo impide, abre Contingencia de validación.",
      "Selecciona sede, motivo y describe qué ocurrió. El sistema adjunta la evidencia técnica disponible.",
      "Un Administrador o Manager revisa y aprueba o rechaza la solicitud.",
      "Una aprobación dura 30 minutos por defecto y solo puede utilizarse una vez.",
      "El registro queda marcado permanentemente como contingencia y aparece separado en reportes.",
    ],
    notes:[
      "La contingencia no reemplaza el enrolamiento facial inicial.",
      "Una contingencia aprobada es una excepción auditada, no una validación biométrica normal.",
    ],
    keywords:["contingencia","falla","gps","cámara","aprobación"],
  },
  {
    id:"assets-mobile",
    title:"Consultar activos",
    summary:"Búsqueda, filtros y vista optimizada en celular.",
    icon:"◇",
    module:"Activos",
    roles:["all","admin","manager","technician","viewer","provider","external"],
    href:"/dashboard/assets",
    steps:[
      "Busca por código, activo, empresa, ubicación o proveedor.",
      "Usa el filtro de estado cuando necesites reducir el listado.",
      "En celular cada activo aparece como una tarjeta compacta con ubicación, proveedor, estado y criticidad.",
      "Toca la tarjeta para abrir la ficha completa del activo.",
    ],
    keywords:["activos","equipos","móvil","criticidad","proveedor"],
  },
  {
    id:"work-orders",
    title:"Órdenes de trabajo",
    summary:"Consulta y ejecución de trabajo dentro del alcance autorizado.",
    icon:"✓",
    module:"Órdenes",
    roles:["all","admin","manager","technician","provider","external","requester","viewer"],
    href:"/dashboard/work-orders",
    steps:[
      "Abre Órdenes para ver únicamente las OT autorizadas para tu rol y alcance.",
      "Usa búsqueda y filtros para localizar la orden.",
      "En celular las OT se muestran como tarjetas con número, activo, empresa, prioridad y estado.",
      "Abre una OT para consultar sus actividades y acciones disponibles según tu rol.",
    ],
    keywords:["orden","ot","actividad","prioridad","trabajo"],
  },
  {
    id:"settings",
    title:"Mi configuración y configuración administrativa",
    summary:"Apariencia personal para todos y ajustes de empresa/plataforma según permisos.",
    icon:"⚙",
    module:"Configuración",
    roles:["all","platform_owner","superadmin","admin","manager","technician","requester","viewer","provider","external"],
    href:"/dashboard/settings",
    steps:[
      "Abre Mi configuración desde el menú de cuenta o desde Más en móvil para cambiar tu apariencia personal.",
      "El tema Claro es el valor inicial. Oscuro y Sistema quedan como opciones voluntarias.",
      "Si tu rol tiene permisos administrativos, también verás Configuración de empresa/plataforma.",
      "Los cambios globales de identidad visual deben realizarse desde Personalización, no desde pantallas individuales.",
    ],
    keywords:["configuración","personalización","branding","tema"],
  },
];

// ── Recent product changes shown in the manual ──────────────────────────────

export const MANUAL_CHANGES:ManualChange[] = [
  {
    date:"2026-09-22",
    title:"Contingencia de asistencia",
    summary:"Ya existe un flujo auditado de solicitud, aprobación temporal y registro excepcional para fallas técnicas.",
    roles:["all","admin","manager","technician","provider","external"],
  },
  {
    date:"2026-09-22",
    title:"Navegación móvil optimizada",
    summary:"Activos y Órdenes usan tarjetas móviles; Más concentra módulos secundarios, Configuración y salida.",
    roles:["all","technician","external"],
  },
  {
    date:"2026-09-21",
    title:"Enrolamiento facial supervisado",
    summary:"La identidad biométrica inicial requiere presencia física y supervisión de Administrador/Manager.",
    roles:["all","admin","manager","technician","provider","external"],
  },
  {
    date:"2026-09-21",
    title:"Mapa y geocerca",
    summary:"Sedes y empresa incorporan validación de dirección, coordenadas y radio para asistencia.",
    roles:["all","admin","manager"],
  },
];

export function articlesForRole(role:ManualRole){
  if(role==="all") return MANUAL_ARTICLES;
  return MANUAL_ARTICLES.filter(article=>article.roles.includes(role));
}

export function changesForRole(role:ManualRole){
  if(role==="all") return MANUAL_CHANGES;
  return MANUAL_CHANGES.filter(change=>change.roles.includes(role));
}

export function manualRoleFromSession(platformRole:string,role:string|null):ManualRole{
  if(platformRole==="platform_owner") return "platform_owner";
  if(platformRole==="superadmin") return "superadmin";
  if(role==="admin"||role==="manager"||role==="technician"||role==="requester"||role==="viewer"||role==="provider"||role==="external") return role;
  return "all";
}
