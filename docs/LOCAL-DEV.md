# Local development with Docker Compose

One command brings up the full QuickEx stack: backend, frontend, Postgres
(Supabase image), Supabase Auth (GoTrue) and Redis.

## Prerequisites

- Docker Engine 24+ with the Compose v2 plugin (`docker compose version`)

## Start

```bash
docker compose up            # or: ./scripts/local-dev/bootstrap.sh --docker
```

| Service         | URL                                  |
|-----------------|--------------------------------------|
| Backend health  | http://localhost:4000/health         |
| Frontend        | http://localhost:3000                |
| Postgres        | `postgresql://postgres:postgres@localhost:54322/postgres` |
| Supabase Auth   | http://localhost:9999                |
| Redis           | `redis://localhost:6379`             |

The first start installs `node_modules` inside named volumes, so it takes a few
minutes; later starts are fast. `scripts/local-dev/seed.sql` is applied when the
database volume is first created.

## Hot reload

The repository is bind-mounted into the `backend` and `frontend` containers.
`nest start --watch` and `next dev` pick up edits immediately (file polling is
enabled so this works on macOS/Windows too).

## Overrides

```bash
cp docker-compose.override.yml.example docker-compose.override.yml
```

The override file is git-ignored and merged automatically.

## Stop and clean up

```bash
docker compose down          # stop, keep data
docker compose down -v       # stop and delete all data (DB, Redis, node_modules)
```

## Without Docker

`./scripts/local-dev/bootstrap.sh` (no flag) still drives the Supabase CLI
workflow described in `scripts/local-dev/README.md`.
