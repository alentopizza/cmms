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

export const MANUAL_LAST_REVIEW = "2026-09-23";

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
      "En escritorio, tu foto/nombre y las acciones Mi configuración, Manual/Ayuda, Configuración autorizada y Cerrar sesión están en el extremo superior derecho; ya no ocupan un panel permanente al pie del menú lateral.",
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
      "Selecciona la tarjeta de empresa para cambiar el módulo a su perfil en la misma pantalla. Las migas de pan permiten volver al directorio sin cerrar un popup.",
      "En la ficha de empresa usa las pestañas Información general, Estadísticas, Ubicaciones, Documentos, Técnicos y Hoja de vida; el contenido cambia en el panel derecho.",
      "Usa las acciones rápidas para acceder a ubicaciones, activos, usuarios y la ficha empresarial completa, o exporta la Hoja de vida en PDF, Excel o Word compatible.",
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
      "Puedes definir la ubicación de tres maneras: escribe y selecciona una sugerencia de Google Places, pulsa Usar mi GPS si estás físicamente en el sitio, o arrastra el marcador con el logo directamente sobre el mapa.",
      "Elige la coincidencia correcta o usa Usar mi GPS si estás físicamente en el sitio.",
      "Ajusta el punto sobre el mapa si es necesario. El logo de la empresa identifica visualmente el centro de la geocerca.",
      "Define el radio permitido entre 20 y 5000 metros. En edición se muestra un solo mapa interactivo; el resumen inferior evita duplicar la misma información.",
      "Guarda. Estas coordenadas son las mismas que usa Asistencia para verificar presencia.",
      "Al seleccionar la tarjeta de una sede el módulo cambia a su perfil en la misma pantalla; no se abre un popup. Las migas de pan permiten volver al directorio o, en una sububicación, regresar a la sede padre.",
      "La identidad y estadísticas permanecen a la izquierda, mientras Información, Estadísticas, Sububicaciones, Servicios y Hoja de vida cambian dentro del panel derecho.",
      "La ficha general también muestra Zona/Localidad, cargo del responsable y notas adicionales cuando estén registradas.",
      "Al editar o crear una ubicación puedes definir el punto por dirección, GPS, marcador del mapa o escribiendo Latitud y Longitud manualmente. Usa las coordenadas para sedes remotas o lugares sin nomenclatura confiable.",
      "La pestaña Técnicos es informativa: muestra técnicos asignados mediante actividades de órdenes de trabajo, ya sea directamente o por una cuadrilla. La asignación se realiza desde Actividades, no desde la ficha de ubicación.",
      "Desde el perfil puedes exportar la Hoja de vida de la sede en PDF, Excel o Word compatible.",
    ],
    notes:["Google Places aporta el autocompletado de dirección y Google Maps el contexto visual; el GPS real proviene del dispositivo. El servidor vuelve a calcular la distancia al registrar asistencia."],
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
      "Selecciona la tarjeta para cambiar a su perfil en la misma pantalla; no se abre un popup. La miga Usuarios devuelve al directorio.",
      "La foto, rol, alcance y estadísticas quedan visibles a la izquierda y las pestañas de Información, Estadísticas, Actividad, Asistencia y Hoja de vida cambian el contenido del panel derecho.",
      "En Técnicos, los indicadores de OT, actividades y horas de campo son descriptivos; no constituyen una clasificación laboral automática.",
      "Desde el perfil autorizado puedes exportar la Hoja de vida en PDF, Excel o Word compatible.",
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
      "Un Administrador o Manager selecciona al usuario y la sede de enrolamiento; puede ser la sede principal o cualquier otra sede autorizada.",
      "El supervisor pulsa Verificar presencia en la sede. El GPS debe estar dentro de la geocerca antes de habilitar la cámara.",
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
    notes:["Asistencia sigue validando entrada/salida de forma explícita. Si el usuario es Técnico, el módulo Reacción mantiene además seguimiento GPS operativo mientras la sesión del panel permanezca conectada."],

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
    id:"reaction-tracking",
    title:"Reacción y seguimiento operativo",
    summary:"Cómo funciona la ubicación obligatoria del técnico y el mapa de supervisión.",
    icon:"⌖",
    module:"Reacción",
    roles:["all","platform_owner","superadmin","admin","manager","technician"],
    href:"/dashboard/reaction",
    steps:[
      "Para un Técnico, entrar al panel requiere conceder permiso de ubicación al navegador.",
      "Al obtener el primer GPS válido, el sistema lo considera conectado e inicia una sesión de seguimiento operativo.",
      "Mientras la app permanezca conectada se envían posiciones periódicas; el mapa de Reacción muestra su foto y el trayecto reciente.",
      "Administradores y Managers pueden ver las sedes con logo de empresa y los técnicos conectados de su organización.",
      "Cerrar sesión detiene y cierra la sesión de seguimiento.",
    ],
    notes:[
      "El seguimiento de Reacción es independiente de marcar entrada/salida en Asistencia.",
      "Reacción mantiene Empresas y Sedes visibles y permite filtrar por Empresa, Sede, Técnico y Horario desde una sola barra.",
      "Puedes buscar técnicos, empresas y sedes por nombre y por información relacionada como correo, teléfono, dirección, ciudad o identificación disponible. El botón Borrar filtros restablece el mapa y el panel a su vista operativa inicial.",
      "El selector Empresa limita el mapa y las sedes disponibles. Al hacer clic en una empresa, sede o técnico se abre su ficha encima de Reacción sin abandonar la pantalla.",
      "Las fichas de empresa, sede y técnico muestran todas sus actividades pendientes. El panel derecho mantiene aparte su filtro por fecha.",
      "Al hacer clic en una tarjeta pendiente se abre el detalle de la actividad con OT, prioridad, ubicación, fecha compromiso y técnico/cuadrilla/proveedor asignado; abrir la OT completa es una acción explícita.",
      "El panel de alertas inicia en Hoy y retrasadas y permite filtrar por hoy, retrasadas, mañana, esta semana o una fecha específica.",
      "En los campos de fotos y documentos puedes arrastrar y soltar el archivo o usar Seleccionar archivo; el sistema muestra formatos y tamaño máximo permitidos antes de guardar.",
      "Cuando veas Código interno en una sede o sububicación, es una referencia opcional como MAIN o BOG-01 para identificarla en OT, reportes e integraciones.",
      "Los horarios se configuran de forma independiente en la empresa y en cada sede; verde indica abierto y rojo cerrado.",
      "En una web/PWA, el sistema operativo puede suspender el GPS con la pantalla bloqueada o la app en segundo plano. Para funcionamiento idéntico a una app de transporte se requerirá una fase móvil nativa.",
    ],
    keywords:["reacción","gps","seguimiento","trayecto","técnico","contingencia"],
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
