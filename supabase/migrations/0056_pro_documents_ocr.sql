-- ============================================================================
-- CareLink — automatic OCR of professionals' KYC documents (CIN + diploma).
-- Run once in Supabase → SQL Editor. Idempotent. Moves no money.
--
-- Flow: a pro uploads a CIN / diploma → a pro_documents row is inserted → the
-- trigger below records an 'pending' OCR row and calls the
-- `analyze-pro-document` edge function (pg_net) → the function sets
-- 'processing', reads the file with Claude vision and stores 'done' + the
-- fields read (or 'error' + the reason). The admin panels show the state live
-- (Realtime, polling fallback) and cross-check the fields with
-- profiles.full_name. Approval stays a human decision (notify-pro-status).
--
-- WHY A SEPARATE TABLE AND NOT COLUMNS ON pro_documents
-- `prodocs_owner_all` (0013) lets a pro UPDATE their own pro_documents rows:
-- OCR columns there could be overwritten from the app with a reading that
-- "matches". RLS also filters rows, not columns, so ocr_data on a row the pro
-- can read could not be hidden from them. Here: one admin SELECT policy
-- (same model as prodocs_admin_read) and deliberately NO insert/update/delete
-- policy — only the service role (the edge function) and this trigger
-- (security definer) write.
--
-- ONE-TIME SETUP for the trigger (it only records 'pending' until done): pick a
-- long random string and store it in BOTH places —
--   select vault.create_secret('<random>', 'ocr_trigger_secret');     -- SQL
--   supabase secrets set OCR_TRIGGER_SECRET=<random>                    -- CLI
-- ============================================================================

-- An unreleased draft of this migration created pro_document_ocr with other
-- columns (status/extracted/…). It only ever held re-computable OCR output.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'pro_document_ocr'
                and column_name = 'extracted') then
    drop table public.pro_document_ocr;
  end if;
end $$;

create table if not exists public.pro_document_ocr (
  document_id     uuid primary key references public.pro_documents(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  ocr_status      text not null default 'pending'
                  check (ocr_status in ('pending', 'processing', 'done', 'error')),
  -- Fields read off the document, see the edge function's schemas:
  --   CIN     {kind:'cin', nom, prenom, nom_arabe, prenom_arabe, numero_cin,
  --            date_naissance, lieu_naissance, date_expiration, lisible, …}
  --   diplôme {kind:'diploma', nom_titulaire, intitule, etablissement, annee, lisible, …}
  ocr_data        jsonb,
  ocr_error       text,
  ocr_model       text,
  -- When the analysis was last requested; a 'pending'/'processing' row older
  -- than a few minutes is stuck (trigger not configured, function crashed).
  requested_at    timestamptz not null default now(),
  -- When the last analysis finished (done or error).
  ocr_at          timestamptz
);

create index if not exists idx_pro_document_ocr_pro
  on public.pro_document_ocr (professional_id);

comment on table public.pro_document_ocr is
  'OCR of KYC documents (CIN, diploma). Written only by the analyze-pro-document edge function and the upload trigger. Admin read-only.';

alter table public.pro_document_ocr enable row level security;

drop policy if exists pro_document_ocr_admin_read on public.pro_document_ocr;
create policy pro_document_ocr_admin_read
  on public.pro_document_ocr for select
  to authenticated
  using (public.current_role() = 'admin');

-- Deliberately absent: INSERT / UPDATE / DELETE policies (service role only).

-- Live state in the admin panels. Realtime applies the SELECT policy above,
-- so only admins receive these changes.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime'
                    and schemaname = 'public' and tablename = 'pro_document_ocr') then
    alter publication supabase_realtime add table public.pro_document_ocr;
  end if;
end $$;

-- ── Automatic analysis on upload ─────────────────────────────────────────────
-- Same shape as trg_notify_prodoc_uploaded (0017): after insert, security
-- definer. Never blocks or fails the upload: a missing secret or a pg_net error
-- leaves the row 'pending', and the admin panel catches it up.
create extension if not exists pg_net;

create or replace function public.analyze_pro_document_on_upload()
returns trigger
language plpgsql
security definer
set search_path = public, net, extensions, vault
as $$
declare
  v_secret text;
begin
  -- doc_type: the app writes 'cin' | 'diploma' | 'selfie'; the initial schema
  -- documented 'id' | 'diploma' | 'license'. Only selfies are not analysed.
  if lower(new.doc_type) like '%selfie%' then
    return new;
  end if;

  insert into public.pro_document_ocr (document_id, professional_id, ocr_status, requested_at)
  values (new.id, new.professional_id, 'pending', now())
  on conflict (document_id) do update
    set ocr_status = 'pending', ocr_error = null, requested_at = now();

  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'ocr_trigger_secret' limit 1;
  if v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url     := 'https://wjhzrovmktekfcjohhrw.supabase.co/functions/v1/analyze-pro-document',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ocr-secret', v_secret),
    body    := jsonb_build_object('documentId', new.id),
    -- A PDF can take a while; don't let pg_net hang up early.
    timeout_milliseconds := 120000
  );
  return new;
exception when others then
  raise warning 'analyze_pro_document_on_upload skipped: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_analyze_pro_document on public.pro_documents;
create trigger trg_analyze_pro_document
after insert on public.pro_documents
for each row execute function public.analyze_pro_document_on_upload();

-- ── Sanity ───────────────────────────────────────────────────────────────────
select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'pro_document_ocr') as table_ok,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'pro_document_ocr'
      and cmd <> 'SELECT') as mutating_policies_must_be_zero,
  (select count(*) from pg_trigger where tgname = 'trg_analyze_pro_document') as trigger_ok,
  (select count(*) from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'pro_document_ocr') as realtime_ok,
  (select count(*) from vault.decrypted_secrets
    where name = 'ocr_trigger_secret') as trigger_secret_set;
