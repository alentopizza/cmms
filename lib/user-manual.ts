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

export const MANUAL_LAST_REVIEW = "2026-09-26";

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
    id:"account-brand-personalization",
    title:"Mi configuración y Personalización de marca",
    summary:"Diferencia las preferencias personales, la configuración general y la identidad visual PRO de la empresa.",
    icon:"◉",
    module:"Administración",
    roles:["all","platform_owner","superadmin","admin","manager","technician","requester","viewer","provider","external"],
    href:"/dashboard/preferences",
    steps:[
      "Abre el menú de usuario desde tu avatar en el extremo superior derecho. Allí permanecen Mi configuración, Manual / Ayuda, Configuración cuando tu rol la permite y Cerrar sesión.",
      "Mi configuración reúne Perfil, Preferencias, Apariencia, Seguridad e Integraciones. Los usuarios con registro de cuenta pueden actualizar nombre, correo, teléfono, foto y contraseña sin cambiar su rol, empresa ni alcance de sedes.",
      "La apariencia personal reutiliza el tema Claro, Oscuro o Sistema del CMMS. No crea un segundo mecanismo de tema.",
      "Cerrar sesión solicita confirmación y, al confirmar, utiliza el cierre de sesión normal que también finaliza una sesión activa de seguimiento Reacción cuando corresponda.",
      "Administradores de empresa ven Personalización de marca con indicador PRO. Si el plan no la habilita, la pantalla informa que requiere Plan Pro y enlaza a las opciones de plan existentes.",
      "En Plan Pro, Personalización de marca permite elegir un esquema, ajustar color principal/secundario/acento, reutilizar el logo de empresa, definir apariencia/densidad y revisar una vista previa antes de guardar.",
      "Cancelar descarta los cambios de marca no guardados. Restaurar predeterminado pide confirmación antes de retirar la identidad personalizada.",
    ],
    notes:[
      "La identidad visual se guarda por empresa. No modifica otras empresas ni la personalización global de la instalación.",
      "Los colores de éxito, advertencia, error e información permanecen semánticos y no se sustituyen por colores de marca.",
      "La cuenta bootstrap Propietario Desweb no tiene un usuario normal de base de datos; sus credenciales se mantienen en la configuración segura del entorno.",
    ],
    keywords:["configuración","perfil","apariencia","seguridad","personalización","marca","pro","tema","logo","cerrar sesión"],
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
      "En los directorios principales puedes alternar entre Vista cuadrícula y Vista listado con el selector del encabezado. El cambio conserva la búsqueda, filtros y datos ya cargados; en Ubicaciones la vista listado mantiene una miniatura compacta de la fotografía propia de la sede y resume empresa, ciudad, recursos, estado y acceso a la ficha.",
      "En Vista listado la primera columna conserva la identidad del registro con logo, avatar, foto o icono existente y las acciones rápidas aparecen al final según los permisos y funciones reales de cada módulo.",
      "Selecciona la tarjeta de empresa para cambiar el módulo a su perfil en la misma pantalla. Las migas de pan permiten volver al directorio sin cerrar un popup.",
      "En la ficha de empresa usa las pestañas Información general, Estadísticas, Ubicaciones, Documentos, Técnicos y Hoja de vida. En Documentos el perfil libera todo el ancho: selecciona una fila para previsualizarla a la izquierda, usa Ver para abrir el visor ampliado, Descargar para bajar el archivo directamente y Más acciones para gestionarlo. En escritorio el listado tiene prioridad de espacio y en móvil aparece antes de la previsualización.",
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
      "En la pestaña Asistencia puedes abrir el expediente individual con Resumen, Jornada, Marcaciones, Desplazamientos, Biometría, Contingencias y Trazabilidad; la jornada se administra por vigencias y el enrolamiento biométrico sigue usando el flujo supervisado del módulo Asistencia.",
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
      "La vista principal muestra tarjetas compactas sin fotografía grande: nombre, sede, líder, descripción, integrantes y actividades reales del equipo.",
      "Usa el buscador y los filtros de sede/estado para acotar la colección. Puedes alternar entre Vista cuadrícula y Vista listado sin cambiar la fuente de datos.",
      "Cuando existe teléfono o correo puedes contactar al líder desde WhatsApp, llamada o correo. Si faltan esos datos, la acción correspondiente simplemente no aparece.",
    ],
    notes:["Los indicadores de actividades de una cuadrilla describen trabajo asignado; no son una calificación automática de sus integrantes."],
    keywords:["cuadrilla","líder","supervisor","técnico","integrantes","equipo"],
  },
  {
    id:"attendance-configuration-workspace",
    title:"Configurar Asistencia en cinco pasos",
    summary:"Organiza la configuración de Asistencia por responsabilidad sin duplicar política, sedes, biometría ni operación diaria.",
    icon:"▥",
    module:"Asistencia",
    roles:["all","platform_owner","superadmin","admin","manager"],
    href:"/dashboard/attendance?view=setup&step=1",
    steps:[
      "Abre Asistencia. Si eres Propietario Desweb o Superadministrador, selecciona primero la empresa que vas a administrar.",
      "Usa el stepper superior para moverte entre Configuración, Sedes, Enrolamiento, Política y Resumen. Los pasos utilizan la misma página y puedes volver directamente a cualquiera.",
      "En Configuración revisa empresa, estado, parámetros y roles reales. Esta vista es informativa: los valores se modifican únicamente en Política para evitar dos formularios de configuración.",
      "En Sedes revisa qué ubicaciones visibles tienen geocerca. Configurar coordenadas y radio sigue realizándose desde la ficha existente de cada sede.",
      "En Enrolamiento revisa cobertura biométrica, solicitudes móviles pendientes y aprobaciones únicas. El enrolamiento asistido anterior queda disponible como recuperación excepcional.",
      "En Política edita estado, biometría, geolocalización, precisión GPS, umbrales, roles y el texto biométrico que leerá el empleado. Cambiar ese texto publica una nueva versión para futuras aceptaciones.",
      "En Resumen revisa estado general, sedes, enrolamiento, política y contingencias pendientes. No se crea una segunda acción de guardado: la configuración ya fue persistida por sus mecanismos existentes.",
      "Usa Operación y reportes para abrir presencia diaria, expediente individual, contingencias y reporte programado vs. real sin recorrer nuevamente la configuración.",
    ],
    notes:[
      "El panel lateral y el stepper muestran el mismo estado de progreso; el panel lateral no mantiene una navegación independiente.",
      "La configuración no modifica automáticamente datos de sedes, biometría o jornadas; cada componente conserva su autoridad y validaciones servidor.",
      "En móvil el stepper puede desplazarse horizontalmente y el panel de progreso pasa debajo del contenido principal.",
    ],
    keywords:["asistencia","configuración","stepper","sedes","geocercas","enrolamiento","política","resumen"],
  },
  {
    id:"biometric-enrollment",
    title:"Enrolamiento biométrico móvil y aprobación única",
    summary:"Cómo activar la identidad facial una sola vez y dejar las marcaciones diarias automáticas.",
    icon:"◎",
    module:"Asistencia",
    roles:["all","platform_owner","superadmin","admin","manager","technician","provider","external"],
    href:"/dashboard/attendance?view=operation",
    steps:[
      "La primera vez, el empleado abre Asistencia desde su propio celular. Si todavía no tiene una biometría aprobada, verá el flujo de Primera activación biométrica.",
      "Pulsa Leer política, revisa el texto y la versión vigente y confirma que lo leyó.",
      "Acepta expresamente el tratamiento de la plantilla facial y autoriza el uso de cámara y ubicación precisa durante el enrolamiento.",
      "Selecciona la sede donde está físicamente y pulsa Verificar sede. El servidor vuelve a validar precisión GPS, alcance y geocerca.",
      "Pulsa Activar cámara y enviar. El sistema solicita dos gestos aleatorios, incluido un parpadeo, y además aplica prueba de vida/anti-suplantación antes de generar la plantilla.",
      "La solicitud queda Pendiente de aprobación única. Esto todavía no habilita marcaciones biométricas.",
      "Un Administrador o Manager abre Configuración → Enrolamiento. La bandeja muestra solo los casos pendientes y permite comparar la foto de perfil con la captura temporal en vivo.",
      "Al aprobar, la plantilla cifrada queda verificada y la evidencia biométrica temporal de la solicitud se elimina. Al rechazar, también se elimina y el empleado puede repetir el proceso.",
      "Desde ese momento las entradas y salidas se validan automáticamente con la cuenta autenticada, GPS/geocerca, rostro 1:1 y liveness/anti-spoof. No requieren aprobación humana diaria.",
    ],
    notes:[
      "La foto de perfil ayuda al administrador a confirmar visualmente la identidad, pero nunca se convierte en la plantilla biométrica.",
      "La vista previa del enrolamiento es cifrada y temporal: solo existe mientras la solicitud está pendiente, expira como máximo a las 72 horas y no forma parte del expediente permanente.",
      "El texto biométrico es versionado. El expediente conserva qué versión aceptó la persona y cuándo dio consentimiento.",
      "Los gestos son una capa adicional de prueba de vida. La aceptación final sigue requiriendo las validaciones servidor de empresa, rol, sede, geocerca y umbrales biométricos.",
      "El enrolamiento asistido por un administrador permanece disponible únicamente para recuperación, soporte o casos excepcionales.",
    ],
    keywords:["facial","biometría","enrolamiento","cámara","rostro","consentimiento","aprobación","prueba de vida","gestos"],
  },
  {
    id:"individual-attendance-schedule",
    title:"Jornada individual y horario programado",
    summary:"Cómo asignar sede base, días y horas de trabajo por persona sin alterar el horario de la empresa.",
    icon:"◷",
    module:"Asistencia",
    roles:["all","platform_owner","superadmin","admin","manager","technician","provider","external"],
    href:"/dashboard/attendance?view=operation#attendance-audit",
    steps:[
      "Un Administrador, Manager, Propietario Desweb o Superadministrador abre Asistencia y selecciona la persona. En la ficha de Usuario también puede administrar la misma jornada desde la pestaña Asistencia.",
      "Selecciona la sede base y la fecha desde la cual entra en vigencia el horario. La fecha final es opcional.",
      "Puedes empezar copiando el horario de la Empresa, copiando el horario de la sede base o usando un horario personalizado.",
      "Activa únicamente los días laborables y define hora de inicio y fin de cada día; no es necesario que todos los días tengan el mismo horario.",
      "Guardar crea una vigencia independiente. Si ya existe una jornada vigente, programa el cambio desde una fecha futura; la vigencia anterior se cierra antes del nuevo inicio.",
      "Las vigencias que ya comenzaron permanecen como historial y no se reescriben retroactivamente.",
      "El usuario de campo ve en Asistencia el horario esperado para hoy y la sede base se propone primero cuando todavía no hay una jornada abierta.",
    ],
    notes:[
      "Copiar Empresa o Sede crea una instantánea. Cambiar después el horario de la Empresa/Sede no modifica silenciosamente la jornada individual guardada.",
      "El horario programado no bloquea un marcaje real fuera de la ventana esperada. La entrada/salida se conserva como evidencia para comparación posterior.",
      "La sede base de jornada no reemplaza el alcance de sedes del usuario ni la asignación de actividades.",
    ],
    keywords:["jornada","horario","turno","vigencia","sede base","asistencia","programado"],
  },
  {
    id:"attendance-audit-dossier",
    title:"Expediente individual de asistencia",
    summary:"Cómo revisar jornada programada, marcaciones, desplazamientos, biometría, contingencias y trazabilidad de una persona.",
    icon:"▤",
    module:"Asistencia",
    roles:["all","platform_owner","superadmin","admin","manager"],
    href:"/dashboard/attendance?view=operation#attendance-audit",
    steps:[
      "Abre Asistencia y, si eres Propietario Desweb o Superadministrador, selecciona primero la empresa. Después elige la persona que deseas revisar.",
      "En Resumen consulta jornadas, horas reales, actividades finalizadas, contingencias, estado biométrico, jornada vigente y presencia actual.",
      "En Jornada administra la misma línea de tiempo de horarios individuales: no existe un editor paralelo.",
      "En Marcaciones revisa cada entrada/salida con sede de origen/final, duración, modo estándar o contingencia, precisión/distancia GPS, actividades finalizadas y cantidad de desplazamientos.",
      "En Desplazamientos revisa cada tramo entre sedes, duración, actividad destino, evidencia GPS de salida/llegada y muestras de ruta correlacionadas con Reacción.",
      "En Biometría revisa estado actual, solicitudes móviles, versión de política aceptada, consentimiento, sede/GPS, aprobación o rechazo, reenrolamientos y revocaciones. Gestiona nuevas solicitudes desde Configuración → Enrolamiento.",
      "En Contingencias revisa motivo, estado, notas y tiempos de aprobación/uso de las excepciones registradas.",
      "En Trazabilidad consulta una secuencia cronológica que combina marcaciones, salidas/llegadas de desplazamientos, eventos biométricos, contingencias y cambios administrativos de jornada.",
      "Puedes cambiar el periodo entre 30 días, 90 días, 12 meses o todo el historial visible.",
    ],
    notes:[
      "El expediente es una vista de auditoría sobre registros existentes; no crea un segundo historial de asistencia.",
      "Si tu cuenta está limitada a determinadas sedes, solo verás personas y evidencia dentro de ese alcance.",
      "El expediente no muestra la plantilla facial cifrada, la captura temporal después de la decisión ni scores crudos de similitud/liveness.",
      "La información es descriptiva para revisión humana; no constituye una calificación automática del trabajador.",
    ],
    keywords:["expediente","auditoría","asistencia","marcaciones","desplazamientos","biometría","contingencia","trazabilidad","jornada"],
  },
  {
    id:"attendance-operational-report",
    title:"Reporte operativo de asistencia",
    summary:"Cómo comparar jornada programada y presencia real con evidencia multi-sede, actividades, contingencias y Reacción.",
    icon:"▥",
    module:"Asistencia",
    roles:["all","platform_owner","superadmin","admin","manager"],
    href:"/dashboard/attendance?view=operation#attendance-report",
    steps:[
      "Abre Asistencia y desplázate a Reporte operativo. Propietario Desweb y Superadministrador deben seleccionar primero la empresa que desean revisar.",
      "Define Desde y Hasta. El reporte permite hasta 366 días por consulta y usa los días locales de la empresa.",
      "Opcionalmente filtra por una persona o por una sede relacionada. Los filtros solo reducen información ya autorizada; nunca amplían permisos.",
      "Revisa Horas programadas y Horas reales. La Diferencia se calcula únicamente sobre días con jornada individual programada.",
      "Consulta Tiempo en sede y Desplazamiento para separar permanencia física y trayectos multi-sede dentro de la misma jornada.",
      "En Resumen por persona revisa jornadas, jornadas multi-sede, actividades y contingencias sin ordenar ni puntuar trabajadores.",
      "En Detalle diario revisa programación, horas reales, origen → sede final, sedes visitadas, desplazamientos, actividades y evidencia adicional.",
      "Los días programados sin marcación y los días con asistencia no programada se muestran como evidencia que requiere contexto humano; el sistema no decide la causa.",
      "Usa Exportar para generar Excel, CSV o PDF. Los tres formatos conservan exactamente la empresa, periodo, persona/sede y alcance aplicados al reporte.",
    ],
    notes:[
      "El reporte no conoce por sí solo vacaciones, incapacidades, permisos, pausas contractuales u otras causas externas al CMMS.",
      "Si tu cuenta está limitada a ciertas sedes, una jornada multi-sede que cruce una sede fuera de tu alcance no se muestra parcialmente.",
      "Una jornada todavía abierta usa el tiempo transcurrido hasta el momento de generar el reporte y permanece identificada como abierta.",
      "Las métricas son descriptivas para revisión humana y no constituyen ranking, sanción ni decisión laboral automatizada.",
    ],
    keywords:["asistencia","reporte","programado","real","horas","desplazamiento","sede","excel","csv","pdf"],
  },
  {
    id:"attendance-multi-site-displacement",
    title:"Desplazarse entre sedes sin cerrar la jornada",
    summary:"Cómo salir de una sede, viajar a otra ubicación autorizada y continuar la misma jornada.",
    icon:"↝",
    module:"Asistencia",
    roles:["all","admin","manager","technician","provider","external"],
    href:"/dashboard/attendance?view=operation",
    steps:[
      "Inicia la jornada normalmente en la sede de origen. Debes tener una jornada abierta antes de registrar un desplazamiento.",
      "En Desplazamientos selecciona una sede de destino diferente y, si corresponde, una actividad que tengas asignada en esa sede.",
      "Pulsa Iniciar desplazamiento mientras todavía estás en la sede de origen. Si la empresa exige ubicación, el sistema valida GPS y geocerca antes de registrar la salida.",
      "La jornada continúa abierta con estado En tránsito. No puedes marcar salida final ni iniciar otro traslado hasta registrar la llegada.",
      "Si Reacción está conectado, el trayecto GPS puede quedar correlacionado con este desplazamiento; Asistencia sigue siendo quien registra oficialmente salida y llegada.",
      "Al llegar a la sede destino pulsa Registrar llegada. Cuando GPS es obligatorio, debes estar dentro de la geocerca configurada de esa sede.",
      "Después de la llegada, la sede destino pasa a ser la ubicación actual de la jornada. Las actividades realizadas allí pueden vincularse a la misma jornada.",
      "Puedes repetir el proceso hacia otra sede autorizada o finalizar la jornada desde la sede donde te encuentras.",
    ],
    notes:[
      "La jornada no se divide en varias asistencias: conserva una sede de origen, los tramos intermedios y una sede final.",
      "Una sede sin geocerca no puede ser destino cuando la política de asistencia exige geolocalización.",
      "Seleccionar una actividad destino es opcional, pero el servidor solo acepta actividades realmente asignadas y pertenecientes a esa sede.",
      "Una contingencia de salida pendiente o aprobada de la sede anterior se cancela al iniciar un desplazamiento. El flujo excepcional actual cubre entrada/salida, no salida/llegada de un traslado.",
    ],
    keywords:["desplazamiento","viaje","sede","ruta","llegada","salida","jornada","reacción"],
  },
  {
    id:"field-presence",
    title:"Iniciar actividades y presencia en sitio",
    summary:"Cómo abrir una jornada aunque todavía no tengas actividades asignadas.",
    icon:"◌",
    module:"Asistencia",
    roles:["all","admin","manager","technician","provider","external"],
    href:"/dashboard/attendance?view=operation",
    steps:[
      "Abre Asistencia desde el celular. Si tienes jornada individual, verás primero el horario esperado de hoy y la sede base configurada.",
      "El sistema obtiene una ubicación GPS precisa y valida la geocerca de la sede.",
      "Si la ubicación es válida, activa la cámara y verifica tu rostro contra la plantilla supervisada.",
      "Selecciona Iniciar actividades. Quedarás En sitio y disponible.",
      "No necesitas tener una OT o actividad asignada en ese momento; las actividades posteriores pueden relacionarse con la jornada abierta.",
      "Si debes atender otra sede, usa Desplazamientos: registra salida del origen y llegada al destino sin cerrar la jornada.",
      "Al finalizar tu presencia pulsa Marcar salida / Finalizar jornada desde la sede actual y repite las validaciones requeridas.",
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
    href:"/dashboard/attendance?view=operation",
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
      "El seguimiento de Reacción es independiente de marcar entrada/salida en Asistencia. Cuando existe un desplazamiento de Asistencia activo, Reacción puede mostrar la sede destino y correlacionar el trayecto sin convertirse en la autoridad de salida/llegada.",
      "Reacción mantiene el mapa como área principal de trabajo, con Empresa, Sede, Técnico y Horario en una barra compacta flotante; el panel derecho concentra las actividades pendientes y en móvil aparece debajo del mapa.",
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
      "La búsqueda y los filtros recorren todo tu catálogo autorizado, aunque el activo esté en otra página; cada página muestra hasta 24 activos sin ampliar tu alcance.",
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
      "La búsqueda y los filtros recorren todas las OT autorizadas, aunque el registro esté en otra página; la paginación muestra 24 órdenes por página sin ampliar tu alcance.",
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
    summary:"Consolida el reporte ejecutivo del Dashboard, el reporte operativo de Asistencia y las exportaciones oficiales sin duplicar datos.",
    icon:"R",
    module:"Reportes",
    roles:["all","platform_owner","superadmin","admin","manager","technician","requester","viewer","provider","external"],
    href:"/dashboard/reports",
    steps:[
      "Abre Reportes desde el menú lateral o desde Más en la navegación móvil de campo.",
      "En Reporte ejecutivo selecciona periodo, estado, sede y prioridad según las opciones disponibles para tu rol.",
      "Usa Exportar para generar Excel, CSV o PDF. El archivo conserva los mismos filtros visibles y el alcance autorizado por empresa, sede y rol.",
      "En Asistencia abre el reporte programado vs. real para revisar horas, sede/desplazamiento, jornadas multi-sede, actividades, contingencias y evidencia Reacción; desde allí exporta XLSX, CSV o PDF con los mismos filtros.",
      "Las exportaciones de Activos, Inventario y Kardex reutilizan los endpoints oficiales de cada módulo; no crean una copia paralela de la información.",
      "Las hojas de vida de empresas, ubicaciones, usuarios y proveedores continúan exportándose desde cada perfil individual.",
      "Las requisiciones continúan exportándose desde su detalle para conservar cantidades, aprobación, recepciones, devoluciones y conciliación documental."
    ],
    notes:[
      "Reportes nunca amplía permisos: solo reúne accesos a información que tu sesión ya puede consultar.",
      "PDF y Excel respetan la identidad visual permitida por la configuración global o la marca blanca de la empresa."
    ],
    keywords:["reportes","exportar","excel","csv","pdf","dashboard","asistencia","kardex","activos","inventario"],
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
    date:"2026-09-26",
    title:"Activos con búsqueda completa y catálogo independiente de la página",
    summary:"Activos ahora busca, filtra y pagina en el servidor sobre todo el alcance autorizado. Cada página muestra hasta 24 equipos, mientras KPI, marcas, modelos, categorías y calidad continúan representando el catálogo completo; creación, edición, importación, exportación, mantenimiento, historial y documentos conservan sus flujos.",
    roles:["all","platform_owner","superadmin","admin","manager","technician","viewer","provider","external"],
  },
  {
    date:"2026-09-26",
    title:"Órdenes con búsqueda y paginación sobre todo el alcance autorizado",
    summary:"Órdenes de Trabajo ahora busca y filtra en el servidor sobre todo el conjunto permitido para plataforma, solicitantes, proveedores, externos e internos. La navegación usa páginas de 24 registros y conserva Cuadrícula/Listado, creación, actividades y permisos.",
    roles:["all","platform_owner","superadmin","admin","manager","technician","requester","viewer","provider","external"],
  },
  {
    date:"2026-09-26",
    title:"Rutinas con búsqueda y paginación sobre todo el catálogo",
    summary:"Rutinas ahora busca y filtra en el servidor sobre todas las rutinas autorizadas, no solo sobre las visibles en la primera página. La navegación usa páginas de 24 registros y conserva el selector Cuadrícula/Listado sin cambiar creación, edición ni permisos.",
    roles:["all","platform_owner","superadmin","admin","manager","technician","requester","viewer","provider","external"],
  },
  {
    date:"2026-09-25",
    title:"Vista cuadrícula / listado en directorios",
    summary:"Empresas, Ubicaciones, Proveedores, Usuarios, Cuadrillas, Activos, Órdenes, Rutinas, Inventario y Leads comparten el selector visual. El listado conserva logo, avatar, foto o icono de cada entidad y muestra acciones rápidas aplicables sin volver a consultar la colección ni perder búsqueda/filtros.",
    roles:["all","platform_owner","superadmin","admin","manager","technician","provider","external","requester"],
  },
  {
    date:"2026-09-25",
    title:"Nuevo directorio visual de Cuadrillas",
    summary:"Cuadrillas usa tarjetas compactas 3/2/1, métricas reales, búsqueda/filtros y selector cuadrícula/listado sin cambiar la lógica de creación ni los datos existentes.",
    roles:["all","platform_owner","superadmin","admin","manager"],
  },
  {
    date:"2026-09-25",
    title:"Documentos: previsualización y visor completo",
    summary:"Documentos separa selección rápida, gestión y visualización completa: clic en fila previsualiza, Ver abre un modal amplio, Descargar baja el archivo directamente y Más acciones conserva la gestión existente. Compartir fue retirado.",
    roles:["all","platform_owner","superadmin","admin","manager"],
  },
  {
    date:"2026-09-25",
    title:"Enrolamiento biométrico móvil con aprobación única",
    summary:"El empleado lee la política, acepta tratamiento, valida geocerca y completa prueba de vida desde su celular; el administrador aprueba identidad una sola vez y las marcaciones posteriores quedan automáticas.",
    roles:["all","platform_owner","superadmin","admin","manager","technician","provider","external"],
  },
  {
    date:"2026-09-25",
    title:"Asistencia reorganizada en cinco pasos",
    summary:"La administración de Asistencia separa Configuración, Sedes, Enrolamiento, Política y Resumen con stepper y progreso sincronizados; Operación, contingencias, expediente y reportes quedan en una vista secundaria sin duplicar lógica.",
    roles:["all","platform_owner","superadmin","admin","manager"],
  },
  {
    date:"2026-09-25",
    title:"Reporte operativo de Asistencia programado vs. real",
    summary:"Asistencia incorpora filtros por periodo/persona/sede, separa horas programadas, reales, en sede y desplazamiento, y exporta XLSX/CSV/PDF desde el mismo dataset autorizado.",
    roles:["all","platform_owner","superadmin","admin","manager"],
  },
  {
    date:"2026-09-25",
    title:"Desplazamientos multi-sede dentro de una jornada",
    summary:"Asistencia permite salir de una sede, viajar y registrar llegada en otra sin cerrar la jornada; conserva origen, destino, GPS, actividad opcional y correlación con Reacción.",
    roles:["all","platform_owner","superadmin","admin","manager","technician","provider","external"],
  },
  {
    date:"2026-09-25",
    title:"Expediente individual de Asistencia",
    summary:"Usuarios y Asistencia incorporan una vista consolidada por persona con jornada, marcaciones, ciclo biométrico, contingencias y trazabilidad, respetando empresa y alcance de sedes.",
    roles:["all","platform_owner","superadmin","admin","manager"],
  },
  {
    date:"2026-09-25",
    title:"Jornadas individuales por vigencia",
    summary:"Asistencia permite programar por persona sede base, días y horas variables con vigencia e historial; Empresa/Sede sirven como plantillas copiadas y el horario esperado no bloquea marcajes reales.",
    roles:["all","platform_owner","superadmin","admin","manager","technician","provider","external"],
  },
  {
    date:"2026-09-25",
    title:"Administración contextual de Asistencia y biometría",
    summary:"Propietario Desweb y Superadministrador pueden seleccionar la empresa en Asistencia para gestionar política, geocercas, contingencias, reportes y enrolamiento biométrico; la ficha de Usuario abre la gestión de la persona dentro del contexto correcto.",
    roles:["all","platform_owner","superadmin","admin","manager"],
  },
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
