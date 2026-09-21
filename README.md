# Desweb CMMS

Sistema multiempresa de gestión de mantenimiento para activos, sedes y equipos.

## Documentación del proyecto

Para entender el estado actual y continuar el desarrollo sin empezar de cero:

- `AGENTS.md` — instrucciones y contexto para IAs y colaboradores.
- `docs/PROJECT_CONTEXT.md` — visión del producto y estado actual.
- `docs/ARCHITECTURE.md` — arquitectura, estructura y modelo de datos.
- `docs/DECISIONS.md` — decisiones técnicas y de producto.
- `docs/BRANDING.md` — identidad oficial Desweb, logo y paleta.
- `docs/DESIGN_SYSTEM.md` — reglas visuales y componentes de interfaz.
- `docs/ROADMAP.md` — prioridades de desarrollo.
- `docs/CHANGELOG.md` — historial de cambios relevantes.
- `docs/COMMERCIAL_MODEL.md` — planes, suscripciones, ventas y entitlements.
- `docs/INSTALLATION.md` — instalación descargable/self-hosted con Docker Compose.
- `docs/IP_AND_DISTRIBUTION.md` — estrategia de propiedad intelectual y distribución.

## Branding

Paleta oficial:

- `#293644`
- `#FCFCFC`
- `#BAE3E0`
- `#79CAC4`
- `#38B2A9`

Logo de aplicación:

`public/brand/desweb-logo-dark.webp`

## Primera versión

Incluye:

- Empresas y sedes.
- Activos/equipos con criticidad y estado.
- Órdenes de trabajo.
- Base para mantenimiento preventivo por calendario o medidor.
- Inventario y repuestos.
- Proveedores.
- Usuarios, membresías y roles en el modelo de datos.
- Adjuntos y bitácora de auditoría.
- Dashboard operativo.
- Autenticación administrativa inicial.
- Migraciones automáticas de PostgreSQL.
- Health check en `/api/health`.
- Dockerfile preparado para despliegue.

## Variables de entorno

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
APP_ADMIN_EMAIL=admin@desweb.cloud
APP_ADMIN_PASSWORD=una-contrasena-segura
AUTH_SECRET=una-cadena-aleatoria-larga
NEXT_PUBLIC_APP_NAME=Desweb CMMS
NEXT_PUBLIC_APP_URL=https://cmms.desweb.cloud
TEST_CHECKOUT_ENABLED=false
```

## Accesos públicos

- `/` — landing y planes.
- `/login` — acceso a la plataforma.
- `/downloads` — información de la edición self-hosted/descargable.
- `/dashboard` — aplicación autenticada.

## Instalación descargable / self-hosted

El repositorio incluye `compose.yaml` y `scripts/install.sh` para instalar la misma plataforma web con Docker Compose y PostgreSQL persistente.

Durante beta, el workflow de GitHub Actions **Package self-hosted** genera paquetes ZIP/TAR versionados para distribución privada.

Consulta `docs/INSTALLATION.md` antes de usar esta modalidad en producción.

## Easypanel

1. Crear un servicio PostgreSQL persistente.
2. Crear una App desde el repositorio `alentopizza/cmms`, rama `main`.
3. Usar el Dockerfile del repositorio.
4. Configurar las variables de entorno indicadas arriba.
5. Exponer el puerto interno `3000`.
6. Asignar el dominio `cmms.desweb.cloud`.
7. Configurar el health check con `/api/health`.

Al iniciar el contenedor se ejecutan automáticamente las migraciones pendientes y luego se inicia la aplicación.

## Desarrollo local

```bash
npm install
npm run dev
```

Para ejecutar las migraciones:

```bash
npm run migrate
```

## Seguridad y acceso

`APP_ADMIN_EMAIL` y `APP_ADMIN_PASSWORD` mantienen un acceso bootstrap de emergencia/Superadministrador. Los usuarios normales ya se almacenan en PostgreSQL, usan contraseñas derivadas con scrypt y sesiones firmadas con `AUTH_SECRET`.

No publiques secretos ni habilites el checkout simulado en una instalación comercial sin intención explícita.

## Licenciamiento

El proyecto todavía no declara una licencia open source. La distribución descargable se está preparando como una modalidad comercial/self-hosted; no debe asumirse permiso de redistribución por la sola disponibilidad del código.
