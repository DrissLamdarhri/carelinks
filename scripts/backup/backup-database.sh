#!/usr/bin/env bash
# ============================================================================
# CareLink — full database backup (schema + data).
#
# Run this from YOUR machine (needs Docker Desktop, or a local `pg_dump`
# client, and the DB password — never enter secrets in a chat/AI session).
#
# Usage:
#   1. cp scripts/backup/.env.backup.example scripts/backup/.env.backup
#      and fill in SUPABASE_DB_PASSWORD (see the example file for where to
#      find it in the dashboard).
#   2. ./scripts/backup/backup-database.sh
#
# Output: backups/<timestamp>/database.sql  (git-ignored — never commit this;
# it contains real patient CIN numbers, phone numbers, and pro bank RIBs).
#
# NB: this dumps the `public` schema (all app tables — bookings, payments,
# professionals, patients, messages, etc.) plus `storage.objects` metadata.
# It does NOT dump `auth.users` (Supabase manages that schema's internal
# structure itself and a raw restore into it is fragile/version-coupled) —
# use backup-auth-users.sh for that instead.
# ============================================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

ENV_FILE=".env.backup"
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE — copy .env.backup.example to .env.backup and fill it in first." >&2
  exit 1
fi
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

if [ -z "${SUPABASE_DB_PASSWORD:-}" ]; then
  echo "SUPABASE_DB_PASSWORD is empty in $ENV_FILE." >&2
  exit 1
fi

PROJECT_REF="wjhzrovmktekfcjohhrw"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
OUT_DIR="../../backups/$STAMP"
mkdir -p "$OUT_DIR"

DB_URL="postgresql://postgres.${PROJECT_REF}:${SUPABASE_DB_PASSWORD}@aws-1-us-east-1.pooler.supabase.com:5432/postgres"

echo "==> Backing up database to $OUT_DIR/database.sql"

if command -v supabase >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  # Preferred path: the Supabase CLI's dump matches the server's pg_dump
  # version exactly (via Docker), avoiding version-mismatch corruption.
  echo "    using: supabase db dump (Docker)"
  (cd ../.. && supabase db dump --db-url "$DB_URL" -f "backups/$STAMP/database.sql")
elif command -v pg_dump >/dev/null 2>&1; then
  echo "    using: local pg_dump (no Docker found — ensure your pg_dump"
  echo "    version is >= the server's Postgres version, currently 17.x,"
  echo "    or the dump may silently omit newer syntax)"
  pg_dump "$DB_URL" --no-owner --no-privileges -f "$OUT_DIR/database.sql"
else
  echo "Neither the Supabase CLI + Docker, nor a local pg_dump, was found." >&2
  echo "Install Docker Desktop (recommended) or the PostgreSQL client tools." >&2
  exit 1
fi

gzip -f "$OUT_DIR/database.sql"
SIZE=$(du -h "$OUT_DIR/database.sql.gz" | cut -f1)
echo "==> Done: $OUT_DIR/database.sql.gz ($SIZE)"
echo "    Move this off this machine (encrypted drive / password manager's"
echo "    file storage / a private, access-controlled cloud folder)."
echo "    It contains real patient CIN numbers, phone numbers and pro RIBs —"
echo "    never email it, never put it in a shared/public drive."
