#!/usr/bin/env sh
set -eu

VERSION="${CMMS_PACKAGE_VERSION:-$(node -p "require('./package.json').version")-beta}"
NAME="desweb-cmms-${VERSION}"
STAGE=".package-runtime/${NAME}"
OUT_DIR="public/downloads"

rm -rf ".package-runtime"
mkdir -p "${STAGE}/runtime/.next" "${STAGE}/scripts" "${STAGE}/db" "${OUT_DIR}"

cp -R .next/standalone/. "${STAGE}/runtime/"
cp -R .next/static "${STAGE}/runtime/.next/static"

if [ -d public ]; then
  mkdir -p "${STAGE}/runtime/public"
  cp -R public/. "${STAGE}/runtime/public/"
  rm -rf "${STAGE}/runtime/public/downloads"
fi

cp scripts/migrate.mjs "${STAGE}/scripts/migrate.mjs"
cp -R db/. "${STAGE}/db/"

cat > "${STAGE}/Dockerfile" <<'EOF'
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --chown=nextjs:nodejs runtime ./
COPY --chown=nextjs:nodejs scripts ./scripts
COPY --chown=nextjs:nodejs db ./db
USER nextjs
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
EOF

cat > "${STAGE}/compose.yaml" <<'EOF'
services:
  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-cmms}
      POSTGRES_USER: ${POSTGRES_USER:-cmms}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Define POSTGRES_PASSWORD in .env}
    volumes:
      - cmms_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-cmms} -d ${POSTGRES_DB:-cmms}"]
      interval: 10s
      timeout: 5s
      retries: 10

  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-cmms}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-cmms}
      APP_ADMIN_EMAIL: ${APP_ADMIN_EMAIL:?Define APP_ADMIN_EMAIL in .env}
      APP_ADMIN_PASSWORD: ${APP_ADMIN_PASSWORD:?Define APP_ADMIN_PASSWORD in .env}
      AUTH_SECRET: ${AUTH_SECRET:?Define AUTH_SECRET in .env}
      BIOMETRIC_ENCRYPTION_KEY: ${BIOMETRIC_ENCRYPTION_KEY:?Define BIOMETRIC_ENCRYPTION_KEY in .env}
      NEXT_PUBLIC_APP_NAME: ${NEXT_PUBLIC_APP_NAME:-Desweb CMMS}
      NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL:-http://localhost:3000}
      TEST_CHECKOUT_ENABLED: ${TEST_CHECKOUT_ENABLED:-false}
      DB_CONNECT_RETRIES: ${DB_CONNECT_RETRIES:-30}
      DB_CONNECT_RETRY_MS: ${DB_CONNECT_RETRY_MS:-2000}
    ports:
      - "${APP_PORT:-3000}:3000"
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/api/health >/dev/null || exit 1"]
      interval: 15s
      timeout: 5s
      retries: 10
      start_period: 30s

volumes:
  cmms_postgres_data:
EOF

cat > "${STAGE}/.env.example" <<'EOF'
POSTGRES_DB=cmms
POSTGRES_USER=cmms
POSTGRES_PASSWORD=change-this-database-password

APP_ADMIN_EMAIL=admin@empresa.com
APP_ADMIN_PASSWORD=change-this-bootstrap-password
AUTH_SECRET=change-this-long-random-secret
BIOMETRIC_ENCRYPTION_KEY=change-this-separate-biometric-encryption-key

NEXT_PUBLIC_APP_NAME=Desweb CMMS
NEXT_PUBLIC_APP_URL=http://localhost:3000

TEST_CHECKOUT_ENABLED=false
APP_PORT=3000
DB_CONNECT_RETRIES=30
DB_CONNECT_RETRY_MS=2000
EOF

cat > "${STAGE}/install.sh" <<'EOF'
#!/usr/bin/env sh
set -eu

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker no está instalado. Instala Docker Engine o Docker Desktop."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 no está disponible."
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Se creó .env desde .env.example."
  echo "Edita .env y reemplaza todos los valores 'change-this-*'. Luego ejecuta ./install.sh de nuevo."
  exit 0
fi

if grep -q 'change-this-' .env; then
  echo "El archivo .env todavía contiene credenciales de ejemplo."
  echo "Reemplázalas antes de instalar."
  exit 1
fi

docker compose up -d --build

echo ""
echo "Desweb CMMS se está iniciando."
echo "Estado: docker compose ps"
echo "Logs:   docker compose logs -f app"
EOF
chmod +x "${STAGE}/install.sh"

cat > "${STAGE}/README-INSTALLACION.md" <<EOF
# Desweb CMMS — Instalación propia

Versión: ${VERSION}

## Requisitos

- Linux x64 recomendado para esta beta
- Docker Engine 24+ o Docker Desktop
- Docker Compose v2
- 2 GB RAM mínimo para pruebas
- disco persistente para PostgreSQL

## Instalación

1. Copia .env.example a .env.
2. Cambia todas las credenciales de ejemplo.
3. Define NEXT_PUBLIC_APP_URL con la URL final del servidor.
4. Ejecuta:

```bash
chmod +x install.sh
./install.sh
```

La aplicación quedará disponible en el puerto configurado por APP_PORT (3000 por defecto).

## Seguridad

No expongas PostgreSQL a Internet.
Usa HTTPS mediante un proxy reverso en producción.
Realiza backup antes de cada actualización.
Si habilitas biometría, usa HTTPS y una clave BIOMETRIC_ENCRYPTION_KEY independiente de AUTH_SECRET.

Consulta la documentación completa del proyecto para procedimientos de backup, restauración y actualización.
EOF

cat > "${STAGE}/VERSION" <<EOF
DESWEB_CMMS_VERSION=${VERSION}
BUILD_SOURCE=production-runtime
EOF

tar -C ".package-runtime" -czf "${OUT_DIR}/${NAME}.tar.gz" "${NAME}"
cp "${OUT_DIR}/${NAME}.tar.gz" "${OUT_DIR}/desweb-cmms-latest.tar.gz"

echo "Paquete generado: ${OUT_DIR}/${NAME}.tar.gz"
