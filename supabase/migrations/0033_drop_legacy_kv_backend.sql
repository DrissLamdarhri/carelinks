-- ============================================================================
-- CareLink — drop the legacy KV backend table.
-- ----------------------------------------------------------------------------
-- The Figma-Make KV edge function (deployed as `make-server-aa5d1aa6`) was
-- retired months ago in favour of direct Postgres tables, but two leftovers
-- were never cleaned up (CLAUDE.md flagged this explicitly as pending):
--   1. the edge function itself — still ACTIVE and reachable, still running
--      whatever code was last deployed to it, which pre-dates the removal of
--      the hardcoded ADMIN_KEY / X-Admin-Key admin bypass from this repo's
--      source. Undeployed via `supabase functions delete make-server-aa5d1aa6`.
--   2. this table — its blob storage. Nothing in the current app reads or
--      writes it (the mobile app and web admin both run on the relational
--      tables under RLS instead). Dropping it here.
--
-- Idempotent. Run once in Supabase → SQL Editor.
-- ============================================================================

drop table if exists public.kv_store_aa5d1aa6;

-- ── Sanity ──────────────────────────────────────────────────────────────────
select
  (select 1 from information_schema.tables where table_name = 'kv_store_aa5d1aa6') as should_be_null;
