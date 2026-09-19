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
```

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

## Seguridad inicial

La primera versión usa correo y contraseña administrativos definidos en `APP_ADMIN_EMAIL` y `APP_ADMIN_PASSWORD`. El modelo de datos ya contempla usuarios y roles; la autenticación individual por usuario será una de las siguientes iteraciones.
