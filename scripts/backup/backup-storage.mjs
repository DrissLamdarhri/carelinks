#!/usr/bin/env node
// ============================================================================
// CareLink — full storage backup (every file in every bucket).
//
// pg_dump does NOT include Storage file contents (only metadata rows in
// storage.objects) — without this script, a database restore would leave
// every avatar, CIN photo, diploma and yoga class photo missing.
//
// Run from your own machine:
//   1. cp scripts/backup/.env.backup.example scripts/backup/.env.backup
//      and fill in SUPABASE_SERVICE_ROLE_KEY (dashboard: Settings -> API).
//      The service role key bypasses RLS — required to read the PRIVATE
//      buckets (pro-documents, patient-ids). Never share this key.
//   2. node scripts/backup/backup-storage.mjs
//
// Output: backups/<timestamp>/storage/<bucket>/<path...>  (git-ignored).
// ============================================================================
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = join(HERE, ".env.backup");

if (!existsSync(ENV_FILE)) {
  console.error(`Missing ${ENV_FILE} — copy .env.backup.example to .env.backup and fill it in first.`);
  process.exit(1);
}
for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = process.env[m[1]] ?? m[2];
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env.backup");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Every bucket created across the migrations — keep this list in sync if a
// new bucket is added (grep: `into storage.buckets` in supabase/migrations/).
const BUCKETS = ["avatars", "pro-documents", "patient-ids", "yoga-images"];

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outRoot = join(HERE, "..", "..", "backups", stamp, "storage");

async function listAllRecursive(bucket, prefix = "") {
  const files = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) {
    console.warn(`  ! list failed for ${bucket}/${prefix}: ${error.message}`);
    return files;
  }
  for (const entry of data ?? []) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      // A folder (no id, no metadata) — recurse into it.
      files.push(...(await listAllRecursive(bucket, path)));
    } else {
      files.push(path);
    }
  }
  return files;
}

async function backupBucket(bucket) {
  console.log(`==> ${bucket}`);
  const files = await listAllRecursive(bucket);
  let ok = 0, failed = 0;
  for (const path of files) {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error) {
      console.warn(`  ! download failed: ${path} (${error.message})`);
      failed++;
      continue;
    }
    const destPath = join(outRoot, bucket, path);
    mkdirSync(dirname(destPath), { recursive: true });
    writeFileSync(destPath, Buffer.from(await data.arrayBuffer()));
    ok++;
  }
  console.log(`    ${ok} file(s) saved${failed ? `, ${failed} failed` : ""} (${files.length} total)`);
  return { bucket, total: files.length, ok, failed };
}

const results = [];
for (const bucket of BUCKETS) {
  results.push(await backupBucket(bucket));
}

console.log(`\n==> Done: ${outRoot}`);
const totalFailed = results.reduce((s, r) => s + r.failed, 0);
if (totalFailed > 0) {
  console.warn(`WARNING: ${totalFailed} file(s) failed to download — see log above.`);
  process.exitCode = 1;
}
console.log("    Move this off this machine — pro-documents and patient-ids");
console.log("    contain CIN photos and diplomas. Treat as strictly confidential.");
