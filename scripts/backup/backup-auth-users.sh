#!/usr/bin/env bash
# ============================================================================
# CareLink — export the Auth user list (identities, not passwords).
#
# pg_dump of the `public` schema does not touch Supabase's internal `auth`
# schema, and restoring auth.users by raw SQL is fragile (GoTrue owns that
# schema's structure and versioning). This instead exports the account list
# via the Admin API — id, email, phone, role metadata, created_at — which is
# enough to know exactly who needs to be re-invited/re-created after a full
# rebuild. Passwords are never retrievable (Supabase hashes them and does not
# expose hashes even to admins) — after a rebuild, users reset their password
# via the normal "forgot password" flow.
#
# Usage:
#   1. cp scripts/backup/.env.backup.example scripts/backup/.env.backup
#      and fill in SUPABASE_SERVICE_ROLE_KEY.
#   2. ./scripts/backup/backup-auth-users.sh
#
# Output: backups/<timestamp>/auth-users.json  (git-ignored).
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

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ] || [ -z "${SUPABASE_URL:-}" ]; then
  echo "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from $ENV_FILE." >&2
  exit 1
fi

STAMP="$(date +%Y-%m-%d_%H%M%S)"
OUT_DIR="../../backups/$STAMP"
mkdir -p "$OUT_DIR"
OUT_FILE="$OUT_DIR/auth-users.json"

echo "==> Fetching users from Auth admin API"
echo "[]" > "$OUT_FILE.tmp"
page=1
total=0
while true; do
  RESP=$(curl -sf \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    "$SUPABASE_URL/auth/v1/admin/users?page=$page&per_page=1000")
  COUNT=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('users', [])))")
  if [ "$COUNT" = "0" ]; then break; fi
  python3 -c "
import json
existing = json.load(open('$OUT_FILE.tmp'))
page = json.load(open('/dev/stdin'))['users']
existing.extend(page)
json.dump(existing, open('$OUT_FILE.tmp', 'w'), indent=2)
" <<< "$RESP"
  total=$((total + COUNT))
  page=$((page + 1))
done
mv "$OUT_FILE.tmp" "$OUT_FILE"

echo "==> Done: $OUT_FILE ($total users)"
echo "    Contains emails/phones — confidential, keep off this machine."
