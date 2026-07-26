#!/usr/bin/env bash
# ============================================================================
# CareLink — full backup: database + storage files + auth user list.
#
# Run this from YOUR machine (not inside an AI/chat session — it needs your
# Supabase secrets, which must never be pasted into a chat).
#
#   1. cp scripts/backup/.env.backup.example scripts/backup/.env.backup
#      and fill in the three values (see the example file for where to find
#      each one in the Supabase dashboard).
#   2. ./scripts/backup/run-full-backup.sh
#
# Produces ONE encrypted archive: backups/carelink-backup-<timestamp>.tar.gz.gpg
# (falls back to an unencrypted .tar.gz with a loud warning if `gpg` isn't
# installed). Move that single file off this machine when it's done — it is
# the entire recovery kit: schema, every row of data, every uploaded file,
# and the user list.
# ============================================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

if [ ! -f ".env.backup" ]; then
  echo "Missing scripts/backup/.env.backup — copy .env.backup.example and fill it in first." >&2
  exit 1
fi

STAMP="$(date +%Y-%m-%d_%H%M%S)"

echo "############################################"
echo "# CareLink full backup — $STAMP"
echo "############################################"

echo -e "\n[1/3] Database (schema + data)"
./backup-database.sh

echo -e "\n[2/3] Storage buckets (avatars, pro-documents, patient-ids, yoga-images)"
node ./backup-storage.mjs

echo -e "\n[3/3] Auth users list"
./backup-auth-users.sh

# The three scripts above each create their own backups/<their-own-stamp>/
# folder (timestamps a few seconds apart). Fold everything from this run into
# one directory before packaging so the archive is a single self-contained unit.
BACKUP_ROOT="../../backups"
COMBINED="$BACKUP_ROOT/$STAMP"
mkdir -p "$COMBINED"
for d in "$BACKUP_ROOT"/2*/; do
  [ "$d" = "$COMBINED/" ] && continue
  # Only fold in directories created in the last 5 minutes (this run).
  if [ -n "$(find "$d" -maxdepth 0 -mmin -5)" ]; then
    cp -r "$d"* "$COMBINED/" 2>/dev/null || true
    rm -rf "$d"
  fi
done

ARCHIVE="$BACKUP_ROOT/carelink-backup-$STAMP.tar.gz"
tar -czf "$ARCHIVE" -C "$BACKUP_ROOT" "$STAMP"
rm -rf "$COMBINED"

if command -v gpg >/dev/null 2>&1; then
  echo -e "\n==> Encrypting archive (you'll be asked to set a passphrase)"
  gpg --symmetric --cipher-algo AES256 -o "$ARCHIVE.gpg" "$ARCHIVE"
  rm -f "$ARCHIVE"
  FINAL="$ARCHIVE.gpg"
  echo -e "\n############################################"
  echo "DONE: $FINAL"
  echo "Encrypted. Store the passphrase in your password manager — WITHOUT"
  echo "it this backup is permanently unreadable, including by you."
  echo "############################################"
else
  FINAL="$ARCHIVE"
  echo -e "\n############################################"
  echo "DONE: $FINAL"
  echo "WARNING: gpg is not installed — this archive is NOT encrypted and"
  echo "contains real patient CIN numbers, phone numbers, and pro bank RIBs."
  echo "Install gpg and re-run, or encrypt it yourself before storing it."
  echo "############################################"
fi

echo ""
echo "Move $FINAL to encrypted, access-controlled storage now"
echo "(e.g. your password manager's file vault, or an access-controlled"
echo "private cloud folder). Never email it. Never put it in git."
