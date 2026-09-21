# Installation and distribution

This document is the source of truth for installing **Desweb CMMS** outside the primary Easypanel deployment.

## Supported distribution model

The application is a web platform, not a desktop executable. The first portable distribution format is a **self-hosted Docker Compose package** containing:

- the Next.js application image built from this repository;
- PostgreSQL 17;
- a persistent PostgreSQL volume;
- automatic schema migrations on application startup;
- health checks for PostgreSQL and the application.

This model can run on Linux servers, Docker Desktop on Windows/macOS for evaluation, VPS providers, on-premise servers and compatible container platforms.

## Requirements

- Docker Engine 24+ or current Docker Desktop;
- Docker Compose v2;
- at least 2 GB RAM for a small evaluation environment;
- persistent disk space for PostgreSQL;
- a reverse proxy with HTTPS for production installations.

## Quick installation

Clone or download the repository, then:

```bash
cp .env.example .env
```

Edit `.env` and replace every example secret. Then:

```bash
docker compose up -d --build
```

Or use:

```bash
chmod +x scripts/install.sh
./scripts/install.sh
```

The installer creates `.env` on the first run if it does not exist and refuses to start while insecure example values remain.

Default local address:

```text
http://localhost:3000
```

## Required environment variables

```env
POSTGRES_DB=cmms
POSTGRES_USER=cmms
POSTGRES_PASSWORD=use-a-strong-database-password

APP_ADMIN_EMAIL=admin@example.com
APP_ADMIN_PASSWORD=use-a-strong-bootstrap-password
AUTH_SECRET=use-a-long-random-secret
BIOMETRIC_ENCRYPTION_KEY=use-a-separate-long-random-secret

NEXT_PUBLIC_APP_NAME=Desweb CMMS
NEXT_PUBLIC_APP_URL=http://localhost:3000

TEST_CHECKOUT_ENABLED=false
APP_PORT=3000
```

Generate a suitable authentication secret with, for example:

```bash
openssl rand -hex 32
```

For public production deployments, set `NEXT_PUBLIC_APP_URL` to the final HTTPS origin.

## Start, stop and logs

```bash
docker compose up -d
docker compose ps
docker compose logs -f app
docker compose down
```

Do **not** use `docker compose down -v` unless permanent database deletion is intended.

## Backup

The critical persistent asset is PostgreSQL. A simple logical backup can be created with:

```bash
docker compose exec -T postgres pg_dump -U cmms -d cmms > cmms-backup.sql
```

Restore into an empty compatible database with:

```bash
cat cmms-backup.sql | docker compose exec -T postgres psql -U cmms -d cmms
```

Production backup procedures should additionally include encryption, retention and off-host copies.

## Updates

The application runs immutable numbered SQL migrations on startup. To update a source-based installation:

```bash
git pull
docker compose up -d --build
```

The container applies only migrations not yet recorded in `schema_migrations`.

Always back up PostgreSQL before a production upgrade.

## Installation package roadmap

The target commercial distribution model is:

1. hosted SaaS at Desweb;
2. self-hosted Docker Compose package;
3. versioned GitHub/release archive for licensed customers;
4. optional prebuilt container image;
5. later, an installation wizard and license/activation mechanism if commercial requirements justify it.

The repository does not currently declare an open-source license. Do not assume redistribution rights or add a public software license without an explicit product-owner decision.


## Public downloads page

The application exposes a public installation-information page at:

`/downloads`

During beta, this page does **not** serve anonymous commercial binaries. It explains how authorized/internal users obtain a package from the private GitHub Actions workflow.

## Versioned package workflow

Workflow:

`.github/workflows/package-self-hosted.yml`

Manual process:

1. Open GitHub → Actions.
2. Select **Package self-hosted**.
3. Run the workflow.
4. Enter a version such as `0.1.0-beta`.
5. Download the generated Actions artifact.

The artifact contains both:

- `desweb-cmms-VERSION.zip`
- `desweb-cmms-VERSION.tar.gz`

Each package includes a `VERSION` file with the requested version and source commit.

The package intentionally excludes Git history, CI definitions, local secrets, `node_modules`, build output and other development-only files.

Before public/commercial distribution, replace private Actions artifacts with controlled commercial releases or authenticated downloads tied to the agreed license model.


## Direct public beta download

The public **Instalación propia** page exposes a direct beta package at:

`/downloads/desweb-cmms-latest.tar.gz`

The package is generated automatically after the production Next.js build by:

`scripts/package-runtime.sh`

It contains:

- the compiled Next.js standalone runtime;
- static/public assets required by the application;
- SQL migrations;
- migration runner;
- a Dockerfile for the packaged runtime;
- Docker Compose with PostgreSQL 17;
- `.env.example`;
- `install.sh`;
- `README-INSTALLACION.md`;
- a `VERSION` file.

The package intentionally does not require the customer to clone the private GitHub repository or run `npm install`.

Current beta recommendation: Linux x64 or a compatible Docker host.

This direct download is a **technical beta distribution**. Before broad commercial distribution, add license enforcement, signed/versioned releases, checksum/signature publication and a formal update channel.


## Biometric attendance requirements

If the **Asistencia** module is enabled:

- production must use HTTPS because browsers restrict camera and precise geolocation on insecure origins;
- define `BIOMETRIC_ENCRYPTION_KEY` separately from `AUTH_SECRET`;
- biometric face templates are encrypted at rest with AES-256-GCM;
- source photographs are not persisted by the application;
- the browser face-analysis models are packaged locally under `public/biometric-models`, so self-hosted installations do not depend on a third-party model CDN at runtime;
- configure latitude, longitude and geofence radius for each site before making geolocation mandatory;
- establish an organization-specific privacy notice, legal basis/consent process and retention policy before production use.

Generate the biometric encryption key independently, for example:

```bash
openssl rand -hex 32
```

Changing `BIOMETRIC_ENCRYPTION_KEY` after users have enrolled will make existing encrypted templates unreadable. Plan key rotation with explicit biometric re-enrollment.
