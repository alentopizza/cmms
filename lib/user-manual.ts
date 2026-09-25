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

export const MANUAL_LAST_REVIEW = "2026-09-24";

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
    id:"role-dashboard",
    title:"Dashboard por rol y comparación de KPIs",
    summary:"Cómo leer indicadores, tendencias y comparaciones sin salir de tu alcance autorizado.",
    icon:"▥",
    module:"Dashboard",
    roles:["all","platform_owner","superadmin","admin","manager","technician","requester","viewer","provider","external"],
    href:"/dashboard",
    steps:[
      "El Dashboard cambia según tu rol: plataforma muestra crecimiento/adopción; administración y supervisión muestran mantenimiento y continuidad; campo muestra ejecución/asistencia; solicitantes ven el seguimiento de sus propias solicitudes.",
      "Selecciona el periodo con el calendario. Las tarjetas KPI comparan ese rango con el periodo anterior equivalente de forma predeterminada.",
      "En Comparar con puedes cambiar a Mismo periodo año anterior cuando necesites una referencia interanual.",
      "En roles de empresa/campo puedes filtrar por Sede y Prioridad además del Estado. Las sedes disponibles ya están limitadas por tu alcance de acceso.",
      "La gráfica de tendencia resume los últimos seis meses con datos reales del CMMS; los bloques secundarios muestran distribuciones útiles según el rol.",
      "Los porcentajes verdes/rojos de las tarjetas indican mejora o deterioro según la naturaleza del KPI; en indicadores neutrales solo describen la variación.",
      "Exportar mantiene los mismos filtros y permisos en Excel, CSV y PDF.",
    ],
    notes:[
      "Los filtros nunca amplían permisos. Si no tienes acceso a una empresa, sede o registro, el Dashboard y sus exportes tampoco lo incluyen.",
      "Los indicadores de Técnicos y Colaboradores son evidencia operativa descriptiva; no son rankings automáticos ni decisiones laborales.",
    ],
    keywords:["dashboard","kpi","comparación","mes","tendencia","filtros","sede","prioridad","exportar"],
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
      "Selecciona el país antes de la ciudad. La lista de ciudades, el tipo de identificación fiscal, el indicativo telefónico y las zonas horarias se ajustan al país elegido.",
      "El checkout de prueba aplica la misma regla País → Ciudad y toma como punto de partida el País/Idioma configurado en la plataforma.",
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
      "Al cambiar el país del formulario, las sugerencias de Google Places también cambian de región para evitar direcciones de otro país.",
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
      "Selecciona el país de la persona y, si registras su documento, escoge el tipo disponible para ese país; el tipo de documento no se escribe manualmente.",
      "El indicativo del teléfono se toma automáticamente del país seleccionado y permanece separado del campo. Escribe o edita únicamente el número nacional restante.",
      "Asigna acceso a todas las sedes o limita el usuario a sedes concretas.",
      "En el directorio puedes filtrar por Empresa, Rol, Sede y Proveedor cuando exista más de una opción útil. Si solo hay una empresa/sede posible, ese filtro se oculta automáticamente.",
      "La tarjeta compacta de usuario muestra foto, estado, rol, empresa, alcance de sedes y los indicadores operativos principales; usa cuatro columnas en escritorio normal y cinco solo cuando el ancho mantiene la legibilidad.",
      "Los estados de biometría y seguimiento Reacción no se muestran como etiquetas ambiguas en el directorio; consúltalos dentro de la ficha del usuario, donde tienen contexto.",
      "Si el usuario tiene teléfono registrado, la tarjeta ofrece acceso directo a WhatsApp. Desactivar/reactivar usa una acción de estado distinta de la eliminación definitiva.",
      "Selecciona la tarjeta para cambiar a su perfil en la misma pantalla; no se abre un popup. La miga Usuarios devuelve al directorio.",
      "La foto, rol, alcance y estadísticas quedan visibles a la izquierda y las pestañas de Información, Documentos, Contacto de emergencia, Estadísticas, Actividad, Asistencia y Hoja de vida cambian el contenido del panel derecho.",
      "En Documentos puedes cargar cédula/documento de identidad, hoja de vida, ARL, EPS, pensión, cesantías, caja de compensación, parafiscales/PILA, certificación bancaria, contratos y certificaciones con categorías estandarizadas.",
      "En Contacto de emergencia registra nombre, relación, teléfono, correo opcional y observaciones de una referencia personal o familiar.",
      "La pestaña Estadísticas reúne OT activas, actividades pendientes/completadas, horas de campo, progreso de asistencia de los últimos siete días, tiempo registrado hoy, turno actual y próximos compromisos.",
      "Las estadísticas detalladas se cargan al abrir la ficha; si esa consulta falla, el directorio de Usuarios sigue disponible y la pestaña conserva los indicadores básicos.",
      "La agenda y la lista de pendientes se alimentan de actividades de órdenes de trabajo asignadas al usuario; al seleccionar una actividad puedes abrir su OT.",
      "En Técnicos, los indicadores de OT, actividades y horas de campo son descriptivos; no constituyen una clasificación laboral automática.",
      "Desde el perfil autorizado puedes exportar la Hoja de vida en PDF, Excel o Word compatible.",
      "La foto de perfil sirve para identificación humana; no es la referencia biométrica facial.",
    ],
    notes:["Un Administrador de empresa puede administrar usuarios ordinarios de su propia organización dentro de su permiso."],
    keywords:["usuarios","foto","rol","sedes","permisos"],
  },
  {
    id:"crews",
    title:"Cuadrillas, integrantes y líder",
    summary:"Cómo conformar equipos mixtos de Técnicos y Supervisores y elegir visualmente a su líder.",
    icon:"◉",
    module:"Cuadrillas",
    roles:["all","platform_owner","superadmin","admin","manager"],
    href:"/dashboard/crews",
    steps:[
      "Selecciona la Empresa y la Sede. El sistema solo ofrece personal activo y con acceso a esa sede.",
      "Una cuadrilla puede combinar Técnicos, Supervisores/Managers y Colaboradores externos autorizados.",
      "Elige el líder visualmente por su foto y nombre. El liderazgo no depende del rol: cualquiera de los integrantes elegibles puede ser líder.",
      "Al seleccionar al líder, el sistema lo incluye automáticamente como integrante de la cuadrilla.",
      "La tarjeta de cuadrilla destaca la foto y datos de contacto del líder, muestra integrantes y resume actividades activas/completadas del equipo.",
      "Cuando existe teléfono o correo puedes contactar al líder y a los integrantes desde las acciones disponibles.",
    ],
    notes:["Los indicadores de actividades de una cuadrilla describen trabajo asignado; no son una calificación automática de sus integrantes."],
    keywords:["cuadrilla","líder","supervisor","técnico","integrantes","equipo"],
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
    id:"inventory-kardex",
    title:"Inventario, bodegas y Kardex",
    summary:"Carga, importa, mueve y exporta existencias con trazabilidad por proveedor y bodega.",
    icon:"▤",
    module:"Inventario",
    roles:["all","platform_owner","superadmin","admin","manager","viewer"],
    href:"/dashboard/inventory",
    steps:[
      "El módulo muestra valor total, productos en stock, stock bajo y sin stock, además de tarjetas por artículo y los últimos movimientos de Kardex. La barra interna permite ir a Productos, Categorías, Almacenes, Entradas, Salidas, Ajustes, Transferencias y Kardex.",
      "Usa Nuevo producto para crear un artículo con proveedor, sede, sububicación, categoría, bodega, mínimos, máximos, costo y existencia inicial. La existencia inicial se registra como una Entrada de Kardex.",
      "Usa Importar para descargar PLANTILLA_INVENTARIO_KARDEX_DESWEB.xlsx. Es la única plantilla maestra y siempre conserva las hojas INSTRUCCIONES, INVENTARIO, KARDEX, PROVEEDORES, BODEGAS y CATALOGOS, tanto desde Inventario como desde un Proveedor.",
      "Puedes descargar la plantilla vacía o con datos actuales. Con datos actuales se precargan maestros de inventario, pero STOCK_INICIAL queda en cero y KARDEX vacío para no duplicar el histórico.",
      "Al cargar un Excel usa Analizar archivo. El sistema valida estructura, proveedores, SKU, sedes, sububicaciones, bodegas, cantidades, costos, Kardex, duplicados y stock antes de guardar; cada error puede mostrar hoja, fila, campo, valor, problema y solución sugerida.",
      "Desde Inventario la importación es Global: cada producto resuelve su proveedor por PROVEEDOR_ID, luego NIT_PROVEEDOR, luego CODIGO_PROVEEDOR y finalmente nombre exacto. El resumen agrupa productos y movimientos por proveedor.",
      "Desde la ficha de un Proveedor la importación comienza como Contextual: puedes dejar el proveedor vacío para heredarlo del contexto. Si el archivo contiene otros proveedores, elige Solo este proveedor para omitirlos o Importar todo para convertir el procesamiento a Global.",
      "Cuando existen SKU ya registrados, elige Actualizar para modificar únicamente datos maestros u Omitir para conservarlos sin cambios. Comparar mantiene la confirmación bloqueada hasta que tomes una decisión. Ninguna opción reescribe Kardex histórico.",
      "Cada importación confirmada recibe un folio IMP-AÑO-###### y el historial conserva archivo, usuario, origen Global/Proveedor, alcance, filas importadas, omitidas, avisos y errores.",
      "Las filas TIPO=SERVICIO se contabilizan como servicios omitidos y nunca crean existencia ni Kardex físico. El Kardex hereda el proveedor del SKU cuando el archivo no lo repite; si informa otro proveedor, la validación lo bloquea.",
      "En Kardex puedes registrar Entrada, Salida, Ajuste positivo, Ajuste negativo, Devolución y Traslado. Los traslados requieren bodega origen y destino diferentes; lote, vencimiento y centro de costo quedan disponibles para trazabilidad.",
      "Abre Ver detalles en un producto para editar su ficha, reemplazar su imagen, consultar existencias por bodega y revisar todo su historial de movimientos.",
      "Los artículos desactivados siguen visibles mediante el filtro Registro y pueden reactivarse desde su ficha sin perder Kardex ni relaciones.",
      "Usa Exportar para descargar la base de Inventario en Excel, CSV o PDF; Kardex también tiene exportación independiente y respeta el tipo de movimiento seleccionado.",
    ],
    notes:[
      "El sistema impide movimientos que dejen existencias negativas.",
      "Una requisición no modifica stock. El saldo cambia únicamente mediante movimientos de Inventario/Kardex.",
      "El SKU identifica el artículo dentro de la empresa y debe mantenerse estable en importaciones sucesivas.",
      "Una bodega usada por Inventario/Kardex debe existir o estar definida en la hoja BODEGAS del mismo archivo; no se crea silenciosamente desde una fila de producto.",
      "MOVIMIENTO_ID permite identificar movimientos provenientes de otro sistema y no puede repetirse dentro de la empresa.",
    ],
    keywords:["inventario","kardex","bodega","stock","importar","excel","csv","movimientos","repuestos"],
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
      "Cada activo aparece como una tarjeta visual con código, ubicación, proveedor, estado, criticidad y fabricante/modelo; el diseño se adapta a celular.",
      "Usa Importar para descargar una plantilla Excel contextual, validar la carga y crear o actualizar activos por Código.",
      "Usa Exportar para descargar la base de Activos en Excel, CSV o PDF.",
      "Toca la tarjeta para abrir la ficha completa del activo. Desde allí puedes editar sede, sububicación, proveedor, categoría, estado, criticidad, identificación técnica, fechas, costo, notas e imagen sin perder rutinas ni historial."
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
    id:"suppliers",
    title:"Proveedores",
    summary:"Ficha comercial y operativa del proveedor, con servicios, suministros, documentos y requisiciones.",
    icon:"▣",
    module:"Proveedores",
    roles:["all","platform_owner","superadmin","admin","manager"],
    href:"/dashboard/suppliers",
    steps:[
      "Crea el proveedor con logo, identidad fiscal, país/ciudad, dirección y contacto. El logo identifica sus tarjetas y su ficha.",
      "Selecciona uno o varios Tipos de proveedor y una o varias Categorías / especialidades desde los catálogos estándar. No se escriben libremente para evitar variaciones en reportes, bases de datos e importaciones.",
      "El directorio permite filtrar por Empresa, Tipo/capacidad, Especialidad y País cuando exista más de una opción útil; los filtros se ocultan si no pueden reducir el listado.",
      "El directorio usa una tarjeta comercial compacta distinta a la de Usuarios: logo cuadrado redondeado superpuesto al banner, tipo, ubicación/categoría, contacto, actividades, suministros y requisiciones. Usa cuatro columnas en escritorio normal y cinco solo en pantallas suficientemente amplias.",
      "La eliminación definitiva del proveedor usa la ventana de seguridad propia de Desweb; si existe historial operativo, el sistema bloquea el borrado para preservar trazabilidad.",
      "Abre una tarjeta para cambiar la misma pantalla a la ficha del proveedor; el detalle no utiliza un popup.",
      "Si es proveedor de Servicios o Mixto, consulta Actividades para ver las actividades de OT asignadas directamente a ese proveedor.",
      "Si es proveedor de Materiales/Suministros o Mixto, Inventarios / suministros es operativo: puedes crear, importar, editar, desactivar, reactivar y abrir el Kardex de sus artículos sin salir de la ficha. Los suministros inactivos conservan su historial y no aparecen para nuevas requisiciones hasta reactivarlos.",
      "Cuando creas un suministro desde la ficha del proveedor, la empresa se toma automáticamente del proveedor abierto; Platform Owner/Superadministrador no necesita seleccionar previamente una empresa global. Al guardar, permaneces en la pestaña Inventarios / suministros.",
      "En Documentos puedes cargar, descargar, archivar y restaurar documentación comercial, tributaria, contractual, certificaciones, catálogos y cotizaciones.",
      "En Información financiera se muestra primero un resumen de solo lectura con el número de cuenta enmascarado. Usa Editar para modificar banco, cuenta, titular, moneda, plazo, correo y observaciones; después de guardar vuelve automáticamente al resumen.",
      "Desde Requisiciones selecciona los insumos del proveedor, define cantidades y genera una requisición independiente; el historial permite abrir y exportar cada requisición.",
      "Cuando una requisición tenga recepciones, la ficha permite registrar devoluciones físicas al proveedor desde la propia requisición. El historial de Requisiciones del proveedor muestra cuántas devoluciones existen y la cantidad total devuelta.",
      "El historial de Requisiciones también muestra el estado de sus documentos de compra. En Estadísticas puedes ver cuántos documentos comerciales están activos, pendientes de revisión o en disputa.",
      "En Estadísticas, el bloque Desempeño comercial usa los últimos 12 meses de recepciones físicas para mostrar tiempo a primera recepción, cumplimiento de cantidad, entregas completas dentro de fecha y variación ponderada entre costo real y estimado. Cada indicador muestra el tamaño de su muestra.",
      "La evolución mensual y la tabla Base reciente del indicador permiten abrir las requisiciones que originan los KPIs; estos datos son evidencia descriptiva y no una calificación automática del proveedor.",
      "Usa el único botón Exportar de la cabecera para descargar la ficha del proveedor en PDF, Excel o Word compatible; cuando existe historial de recepción, la ficha incluye también los KPIs comerciales y su muestra.",
    ],
    notes:[
      "Eliminar un proveedor con historial de inventario, actividades o requisiciones está bloqueado para conservar trazabilidad. Desactívalo cuando deba conservarse el historial.",
      "Actividades sigue siendo una proyección de Órdenes; Inventarios / suministros y Requisiciones sí permiten operar directamente dentro de la ficha del proveedor.",
      "Lead time se calcula desde Enviada —o creación cuando no existe fecha de envío— hasta la primera recepción. El cumplimiento de fecha solo considera requisiciones totalmente recibidas que tengan Fecha requerida.",
    ],
    keywords:["proveedor","servicios","suministros","documentos","logo","ficha","exportar"],
  },
  {
    id:"requisitions",
    title:"Requisiciones por proveedor",
    summary:"Solicita insumos desde un proveedor o desde Inventario, manteniendo una requisición separada por proveedor.",
    icon:"▧",
    module:"Requisiciones",
    roles:["all","platform_owner","superadmin","admin","manager","requester","viewer"],
    href:"/dashboard/requisitions",
    steps:[
      "Puedes iniciar una requisición desde la ficha del proveedor o desde Inventario.",
      "Desde Proveedores solo se muestran insumos relacionados con ese proveedor.",
      "Desde Inventario puedes seleccionar insumos de varios proveedores y escribir la cantidad requerida para cada uno.",
      "Si la selección incluye varios proveedores, el sistema divide automáticamente la solicitud y crea una requisición independiente por proveedor.",
      "Consulta cada requisición para revisar proveedor, solicitante, destino, cantidades, costos estimados, fecha requerida y observaciones.",
      "Mientras siga abierta puedes editar cantidades y costos estimados; también puedes retirar ítems que todavía no tengan recepción registrada.",
      "Si la empresa tiene una política de aprobación, la requisición muestra Aprobación pendiente y bloquea la recepción hasta que un Administrador o Manager autorizado tome la decisión según la política configurada.",
      "Aprobar o rechazar se realiza desde el bloque Aprobación y auditoría. El rechazo exige una observación; cada decisión registra usuario, fecha y trazabilidad.",
      "Si una requisición creada por debajo del umbral aumenta después en cantidad o costo hasta alcanzar la regla configurada, entra automáticamente a aprobación. Si ya había sido aprobada o rechazada, cambiar cantidad, costo estimado o fecha requerida reabre la aprobación. Las recepciones ya registradas se conservan, pero el saldo pendiente queda bloqueado hasta una nueva decisión.",
      "En Recepción física registra únicamente lo entregado, selecciona la bodega y opcionalmente documento, lote, vencimiento y centro de costo. Cada entrega genera una Entrada de Kardex vinculada a la requisición.",
      "Las entregas parciales actualizan automáticamente el estado a Parcialmente atendida; cuando todos los ítems alcanzan la cantidad solicitada, la requisición pasa a Atendida.",
      "El historial de recepciones muestra fecha, artículo, cantidad, bodega, documento, costo, lote y usuario. El Kardex también enlaza de vuelta a la requisición de origen.",
      "En Devolución a proveedor selecciona la recepción origen, el motivo, la resolución esperada, la cantidad y la bodega desde la cual saldrá físicamente el material. El sistema impide devolver más de lo recibido en esa entrada o más stock del disponible.",
      "Cada devolución genera una salida de Kardex identificada como Devolución a proveedor y conserva DEV, requisición y recepción origen. La recepción original no se borra ni se reduce; la devolución queda como evento independiente.",
      "En Conciliación documental, Administradores y Managers pueden registrar Orden de compra, Remisión/entrega, Factura, Nota crédito u Otro documento con archivo y líneas por SKU.",
      "La Orden de compra se compara con cantidades solicitadas y costos estimados; la Remisión se compara con las recepciones vinculadas; la Factura compara cantidad y valor contra recepciones; la Nota crédito compara cantidad y valor contra DEV vinculados.",
      "Un documento puede aparecer como Coincide, Con diferencia, Pendiente de evidencia, Informativo o Anulado. Este resultado es automático y no modifica Inventario.",
      "Cuando una recepción o DEV aún no existe al cargar el documento, puedes agregarla después. Al vincular nueva evidencia la revisión vuelve a Pendiente para evitar conservar una decisión desactualizada.",
      "Un revisor puede Verificar solo cuando el documento coincide; Aceptar excepción solo cuando existe una diferencia y registra la justificación; también puede marcar En disputa o Anular el documento con motivo.",
      "El archivo y las líneas del documento no se editan. Si la evidencia cargada era incorrecta, anúlala y registra un documento nuevo para conservar el historial de auditoría.",
      "La resolución esperada puede ser Reposición, Nota crédito u Otra resolución. Cuando exista una Nota crédito, un Administrador o Manager puede registrarla en Conciliación documental y vincularla al DEV correspondiente.",
      "Los estados Aprobada y Rechazada son decisiones auditadas y no se asignan manualmente desde el selector general de estado.",
      "Exporta la requisición en PDF, Excel o Word compatible; además de cantidades, aprobación y DEV, los usuarios autorizados para conciliación obtienen el estado de documentos comerciales y sus diferencias."
    ],
    notes:[
      "Crear o aprobar una requisición no aumenta existencias. Solo la acción Registrar recepción genera la Entrada de Kardex y aumenta el stock.",
      "Registrar una devolución al proveedor sí disminuye existencias mediante un movimiento supplier_return. No uses el movimiento genérico Devolución del Kardex para este caso: ese movimiento devuelve material hacia Inventario y aumenta stock.",
      "Orden de compra, Remisión, Factura y Nota crédito son evidencia comercial: ninguna crea entradas o salidas de Kardex por sí misma.",
      "La conciliación documental está reservada a Administradores, Managers y operadores de plataforma con alcance sobre todas las sedes de la requisición.",
      "La política de aprobación se toma como una fotografía al crear cada requisición; cambiar Configuración no altera retroactivamente requisiciones existentes.",
      "La autoaprobación del solicitante está bloqueada salvo que la empresa la habilite explícitamente y el usuario tenga un rol aprobador.",
      "Un artículo de Inventario solo puede vincularse a un proveedor activo de Materiales/Suministros o Mixto.",
    ],
    keywords:["requisición","compras","proveedor","inventario","insumos","cantidades","abastecimiento"],
  },
  {
    id:"reports",
    title:"Centro de reportes y exportaciones",
    summary:"Consolida el reporte ejecutivo del Dashboard y las exportaciones oficiales de Activos, Inventario y Kardex sin duplicar datos.",
    icon:"R",
    module:"Reportes",
    roles:["all","platform_owner","superadmin","admin","manager","technician","requester","viewer","provider","external"],
    href:"/dashboard/reports",
    steps:[
      "Abre Reportes desde el menú lateral o desde Más en la navegación móvil de campo.",
      "En Reporte ejecutivo selecciona periodo, estado, sede y prioridad según las opciones disponibles para tu rol.",
      "Usa Exportar para generar Excel, CSV o PDF. El archivo conserva los mismos filtros visibles y el alcance autorizado por empresa, sede y rol.",
      "Las exportaciones de Activos, Inventario y Kardex reutilizan los endpoints oficiales de cada módulo; no crean una copia paralela de la información.",
      "Las hojas de vida de empresas, ubicaciones, usuarios y proveedores continúan exportándose desde cada perfil individual.",
      "Las requisiciones continúan exportándose desde su detalle para conservar cantidades, aprobación, recepciones, devoluciones y conciliación documental."
    ],
    notes:[
      "Reportes nunca amplía permisos: solo reúne accesos a información que tu sesión ya puede consultar.",
      "PDF y Excel respetan la identidad visual permitida por la configuración global o la marca blanca de la empresa."
    ],
    keywords:["reportes","exportar","excel","csv","pdf","dashboard","kardex","activos","inventario"],
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
      "En Idioma y región selecciona el idioma preferido y el país predeterminado. El país se usa como punto de partida para nuevos formularios, pero cada registro puede elegir otro país soportado.",
      "La preferencia de idioma ya se guarda como base de internacionalización; las pantallas que todavía no tengan diccionario de traducción continúan mostrándose en español.",
      "En Configuración de empresa, la sección Aprobación de requisiciones permite desactivar la aprobación obligatoria, exigirla para todas las requisiciones o activarla desde un monto estimado; también define si aprueba solo Administrador o Administrador/Manager y si se permite autoaprobación.",
      "Los cambios globales de identidad visual deben realizarse desde Personalización, no desde pantallas individuales.",
    ],
    keywords:["configuración","personalización","branding","tema"],
  },
];

// ── Recent product changes shown in the manual ──────────────────────────────

export const MANUAL_CHANGES:ManualChange[] = [
  {
    date:"2026-09-24",
    title:"Centro de reportes y cierre visual V2",
    summary:"Reportes centraliza exportaciones existentes y Configuración/Personalización adoptan la gramática final del Design System V2 sin cambiar permisos ni fuentes de datos.",
    roles:["all","platform_owner","superadmin","admin","manager","technician","requester","viewer","provider","external"],
  },
  {
    date:"2026-09-24",
    title:"Alta de suministros desde proveedor corregida",
    summary:"Crear un suministro desde la ficha del proveedor usa automáticamente la empresa asociada al proveedor y regresa a Inventarios / suministros con feedback específico.",
    roles:["all","platform_owner","superadmin","admin","manager"],
  },
  {
    date:"2026-09-24",
    title:"Plantilla maestra única de Inventario y Kardex",
    summary:"Inventario y Proveedores usan el mismo Excel maestro. La importación puede operar Global o Contextual, distribuye productos por proveedor, hereda proveedor en Kardex, permite decidir sobre SKU existentes y registra trazabilidad IMP sin guardar parcialmente.",
    roles:["all","platform_owner","superadmin","admin","manager"],
  },
  {
    date:"2026-09-24",
    title:"Conciliación documental de compras",
    summary:"Las requisiciones concilian Orden de compra, Remisión, Factura y Nota crédito contra cantidades solicitadas, recepciones y DEV. La evidencia queda inmutable, admite revisión auditada y nunca modifica Kardex automáticamente.",
    roles:["all","platform_owner","superadmin","admin","manager"],
  },
  {
    date:"2026-09-24",
    title:"Devoluciones a proveedor vinculadas a recepción",
    summary:"Las requisiciones permiten devolver cantidades recibidas al proveedor con motivo, resolución esperada, documento y bodega; cada DEV genera una salida de Kardex enlazada a la requisición y a la recepción origen sin borrar el histórico recibido.",
    roles:["all","platform_owner","superadmin","admin","manager"],
  },
  {
    date:"2026-09-24",
    title:"KPIs comerciales de proveedores",
    summary:"Estadísticas de Proveedor ahora calcula lead time, cumplimiento de cantidad, entregas completas dentro de fecha y variación ponderada de costo a partir de recepciones físicas de los últimos 12 meses, con tendencia y trazabilidad a las requisiciones origen.",
    roles:["all","platform_owner","superadmin","admin","manager"],
  },
  {
    date:"2026-09-24",
    title:"Aprobación y auditoría de requisiciones",
    summary:"Configuración de empresa permite definir aprobación obligatoria o por monto. Las requisiciones pendientes bloquean la recepción, registran aprobaciones/rechazos y reabren la autorización si cambian cantidad, costo o fecha requerida.",
    roles:["all","platform_owner","superadmin","admin","manager","requester"],
  },
  {
    date:"2026-09-24",
    title:"Historial de importaciones y recuperación de suministros",
    summary:"El importador muestra su historial reciente; la ficha del proveedor permite imágenes de suministros y reactivar artículos inactivos sin perder Kardex.",
    roles:["all","platform_owner","superadmin","admin","manager"],
  },
  {
    date:"2026-09-24",
    title:"Recepción de requisiciones contra Kardex",
    summary:"Las requisiciones ahora permiten registrar entregas parciales o totales directamente contra una bodega; cada recepción actualiza Kardex, cantidades recibidas, progreso y estado de la requisición con trazabilidad de documento/lote.",
    roles:["all","platform_owner","superadmin","admin","manager"],
  },
  {
    date:"2026-09-24",
    title:"Inventario operativo y activos editables",
    summary:"Inventario añade navegación interna para categorías, almacenes y Kardex, exportación independiente de movimientos, recuperación de artículos inactivos y metadatos de lote/vencimiento; Activos incorpora alta y edición técnica completa con imagen.",
    roles:["all","platform_owner","superadmin","admin","manager","viewer"],
  },
  {
    date:"2026-09-24",
    title:"Inventario, Kardex e importación masiva",
    summary:"Inventario y Activos incorporan plantillas Excel contextualizadas, validación previa, importación masiva y exportes; Proveedores permite operar suministros y Requisiciones permite editar cantidades/costos antes del cierre.",
    roles:["all","platform_owner","superadmin","admin","manager","viewer"],
  },
  {
    date:"2026-09-24",
    title:"Ficha de proveedor sin duplicados",
    summary:"Información financiera ahora alterna entre resumen y edición; la pestaña Hoja de vida fue retirada y el único exportador queda en la cabecera de la ficha.",
    roles:["all","platform_owner","superadmin","admin","manager"],
  },
  {
    date:"2026-09-24",
    title:"Cuadrillas visuales y edición correcta de teléfonos",
    summary:"Cuadrillas ahora combina Técnicos y Supervisores, permite elegir visualmente al líder y destaca su foto/contactos; el campo Teléfono mantiene el indicativo separado al editar.",
    roles:["all","platform_owner","superadmin","admin","manager"],
  },
  {
    date:"2026-09-24",
    title:"Filtros inteligentes y expedientes estructurados",
    summary:"Los directorios principales muestran filtros de Empresa, Sede y otros criterios solo cuando son útiles; Proveedores usa tipos/especialidades multi-selección estandarizados, Usuarios incorpora documentos y contacto de emergencia, y Proveedores añade información financiera para pagos.",
    roles:["all","platform_owner","superadmin","admin","manager"],
  },
  {
    date:"2026-09-24",
    title:"Dashboards por rol con comparación de KPIs",
    summary:"El Dashboard ahora muestra KPIs y tendencias según el rol, compara periodos, incorpora filtros de Sede/Prioridad donde aplican y conserva esos filtros en Excel, CSV y PDF.",
    roles:["all","platform_owner","superadmin","admin","manager","technician","requester","viewer","provider","external"],
  },
  {
    date:"2026-09-24",
    title:"Directorios compactos de Usuarios y Proveedores",
    summary:"Usuarios usa tarjetas tipo credencial y Proveedores tarjetas comerciales; ambos directorios aprovechan hasta cinco columnas y las estadísticas detalladas de Usuario ahora cargan bajo demanda para no bloquear el módulo.",
    roles:["all","platform_owner","superadmin","admin","manager"],
  },
  {
    date:"2026-09-24",
    title:"Nuevo dashboard de estadísticas de usuario",
    summary:"La ficha de Usuario/Técnico incorpora un dashboard operativo con asistencia semanal, tiempo de campo, cumplimiento y agenda de actividades usando datos reales del CMMS.",
    roles:["all","platform_owner","superadmin","admin","manager"],
  },
  {
    date:"2026-09-23",
    title:"Proveedores y requisiciones por proveedor",
    summary:"Proveedores adopta ficha visual con logo, actividades, suministros y documentos; las requisiciones pueden nacer desde Proveedor o Inventario y siempre se separan por proveedor.",
    roles:["all","platform_owner","superadmin","admin","manager","requester","viewer"],
  },
  {
    date:"2026-09-23",
    title:"País, ciudad, documentos e idioma relacionados",
    summary:"Empresa, Ubicaciones y Usuarios usan catálogos relacionados; el país define ciudades, tipos de identificación e indicativo telefónico, y Configuración guarda Idioma/Región.",
    roles:["all","platform_owner","superadmin","admin","manager"],
  },
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
