#!/usr/bin/env node
// ============================================================================
// CareLink — restore storage files into a (usually NEW) Supabase project.
//
// The upload-direction counterpart to backup-storage.mjs. Use this when
// migrating to a different Supabase project (new account, hit a quota,
// recovering from a lost project) — after the schema migrations have been
// run there (they create the buckets), this puts the actual files back.
//
// Run from your own machine:
//   1. Point .env.backup at the NEW project:
//        SUPABASE_URL=https://<new-ref>.supabase.co
//        SUPABASE_SERVICE_ROLE_KEY=<new project's service role key>
//   2. node scripts/backup/restore-storage.mjs <path-to-backup>/storage
//      (the "storage" folder produced by backup-storage.mjs, or extracted
//      from a decrypted run-full-backup.sh archive)
// ============================================================================
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_FILE = join(HERE, ".env.backup");
const srcRoot = process.argv[2];

if (!srcRoot || !existsSync(srcRoot)) {
  console.error("Usage: node restore-storage.mjs <path-to-backup>/storage");
  process.exit(1);
}
if (!existsSync(ENV_FILE)) {
  console.error(`Missing ${ENV_FILE} — point it at the NEW project before restoring.`);
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

console.log(`==> Restoring into ${SUPABASE_URL}`);
console.log("    Double-check this is the project you intend — this uploads for real.\n");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const buckets = readdirSync(srcRoot).filter((b) => statSync(join(srcRoot, b)).isDirectory());
let totalOk = 0, totalFail = 0;

for (const bucket of buckets) {
  const files = walk(join(srcRoot, bucket));
  console.log(`==> ${bucket} (${files.length} file(s))`);
  let ok = 0, failed = 0;
  for (const filePath of files) {
    // Storage object paths are always forward-slash, regardless of OS.
    const objectPath = relative(join(srcRoot, bucket), filePath).replace(/\\/g, "/");
    const { error } = await supabase.storage
      .from(bucket)
      .upload(objectPath, readFileSync(filePath), { upsert: true });
    if (error) {
      console.warn(`  ! upload failed: ${objectPath} (${error.message})`);
      failed++;
    } else {
      ok++;
    }
  }
  console.log(`    ${ok} restored${failed ? `, ${failed} failed` : ""}`);
  totalOk += ok; totalFail += failed;
}

console.log(`\n==> Done: ${totalOk} file(s) restored${totalFail ? `, ${totalFail} failed` : ""}.`);
if (totalFail > 0) process.exitCode = 1;
