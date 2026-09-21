#!/usr/bin/env sh
set -eu

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker no está instalado. Instala Docker Engine o Docker Desktop antes de continuar."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 no está disponible."
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Se creó .env desde .env.example."
  echo "Edita .env y reemplaza las contraseñas/secretos antes de ejecutar nuevamente este instalador."
  exit 0
fi

if grep -Eq 'change-this|replace-with|change-me' .env; then
  echo "El archivo .env todavía contiene valores de ejemplo inseguros."
  echo "Reemplázalos antes de instalar."
  exit 1
fi

docker compose up -d --build

echo ""
echo "Desweb CMMS se está iniciando."
echo "Revisa el estado con: docker compose ps"
echo "Logs: docker compose logs -f app"
