#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/rollback-migration.sh – Revert the most recent Supabase migration
# ─────────────────────────────────────────────────────────────────────────────
# Usage:
#   ./scripts/rollback-migration.sh                        # revert most recent migration
#   ./scripts/rollback-migration.sh --dry-run              # preview rollback SQL only
#   ./scripts/rollback-migration.sh --steps 2              # revert 2 most recent migrations
#   ./scripts/rollback-migration.sh --target 20261017000000 # revert specific version/name
#   ./scripts/rollback-migration.sh --migrations-dir <dir> # custom migrations directory
#   ./scripts/rollback-migration.sh --state-file <file>    # temporary test DB state file
#   ./scripts/rollback-migration.sh --schema <schema>      # target PostgreSQL schema
#   ./scripts/rollback-migration.sh --yes                  # skip confirmation in production
#   ./scripts/rollback-migration.sh --json                 # machine-readable JSON output
#   ./scripts/rollback-migration.sh --help
#
# Exit codes:
#   0 – rollback completed (or dry-run validated)
#   1 – rollback failed or migration/rollback file invalid
#   2 – invalid CLI usage or unconfirmed production rollback
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATION_RUNNER="$REPO_ROOT/app/backend/run-migration-supabase.js"

MIGRATIONS_DIR="${SUPABASE_MIGRATIONS_DIR:-$REPO_ROOT/app/backend/supabase/migrations}"
STATE_FILE="${MIGRATION_STATE_FILE:-}"
SCHEMA="${MIGRATION_TEST_SCHEMA:-public}"
STEPS=1
TARGET=""
DRY_RUN=false
CONFIRMED="${CONFIRM_ROLLBACK:-0}"
JSON_OUT=false

usage() {
  sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      ;;
    --steps)
      shift
      if [ $# -eq 0 ] || ! [[ "${1:-}" =~ ^[1-9][0-9]*$ ]]; then
        echo "Error: --steps requires a positive integer" >&2
        exit 2
      fi
      STEPS="$1"
      ;;
    --steps=*)
      STEPS="${1#*=}"
      if ! [[ "$STEPS" =~ ^[1-9][0-9]*$ ]]; then
        echo "Error: --steps requires a positive integer" >&2
        exit 2
      fi
      ;;
    --target)
      shift
      if [ $# -eq 0 ] || [ -z "${1:-}" ]; then
        echo "Error: --target requires a migration version or filename" >&2
        exit 2
      fi
      TARGET="$1"
      ;;
    --target=*)
      TARGET="${1#*=}"
      if [ -z "$TARGET" ]; then
        echo "Error: --target requires a migration version or filename" >&2
        exit 2
      fi
      ;;
    --migrations-dir)
      shift
      if [ $# -eq 0 ] || [ -z "${1:-}" ]; then
        echo "Error: --migrations-dir requires a directory path" >&2
        exit 2
      fi
      MIGRATIONS_DIR="$1"
      ;;
    --migrations-dir=*)
      MIGRATIONS_DIR="${1#*=}"
      ;;
    --state-file)
      shift
      if [ $# -eq 0 ] || [ -z "${1:-}" ]; then
        echo "Error: --state-file requires a file path" >&2
        exit 2
      fi
      STATE_FILE="$1"
      ;;
    --state-file=*)
      STATE_FILE="${1#*=}"
      ;;
    --schema)
      shift
      if [ $# -eq 0 ] || [ -z "${1:-}" ]; then
        echo "Error: --schema requires a schema name" >&2
        exit 2
      fi
      SCHEMA="$1"
      ;;
    --schema=*)
      SCHEMA="${1#*=}"
      ;;
    --yes|--confirm|-y)
      CONFIRMED="1"
      ;;
    --json)
      JSON_OUT=true
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
  shift
done

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "Error: Migrations directory not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

if [ ! -d "$MIGRATIONS_DIR/rollback" ]; then
  echo "Error: Rollback directory not found: $MIGRATIONS_DIR/rollback" >&2
  exit 1
fi

# Production safety guard: refuse destructive rollback against production/mainnet
# unless explicitly confirmed with --yes / --confirm or CONFIRM_ROLLBACK=1.
if [ "$DRY_RUN" = false ]; then
  if [ "${ENVIRONMENT_NAME:-}" = "production" ] || [ "${STELLAR_NETWORK:-}" = "mainnet" ] || [ "${NETWORK:-}" = "mainnet" ]; then
    if [ "$CONFIRMED" != "1" ] && [ "$CONFIRMED" != "true" ]; then
      echo "Error: Refusing unconfirmed rollback in production/mainnet environment." >&2
      echo "Re-run with --yes (or set CONFIRM_ROLLBACK=1) after verifying the target migration with --dry-run." >&2
      exit 2
    fi
  fi
fi

ARGS=(
  "--rollback"
  "--migrations-dir" "$MIGRATIONS_DIR"
  "--schema" "$SCHEMA"
  "--steps" "$STEPS"
)

if [ -n "$TARGET" ]; then
  ARGS+=("--target" "$TARGET")
fi

if [ -n "$STATE_FILE" ]; then
  ARGS+=("--state-file" "$STATE_FILE")
fi

if [ "$DRY_RUN" = true ]; then
  ARGS+=("--dry-run")
fi

if [ "$JSON_OUT" = true ]; then
  ARGS+=("--json")
fi

node "$MIGRATION_RUNNER" "${ARGS[@]}"
