-- ============================================================================
-- CareLink — KYC OCR runs in the ADMIN'S BROWSER (Tesseract.js), for free.
-- Run once in Supabase → SQL Editor, after 0056. Idempotent. Moves no money.
--
-- 0056 sent each CIN / diploma to the analyze-pro-document edge function
-- (Claude vision, paid). Now the web admin panel reads the documents itself
-- with Tesseract.js when a professional's file is opened — no API key, no
-- cost, and the ID cards never leave the admin's machine — and saves the
-- result in pro_document_ocr. Hence:
--   1. admins may INSERT / UPDATE pro_document_ocr (still no policy for pros:
--      a pro cannot forge their own result; reading stays admin-only);
--   2. the upload trigger only records the document as 'pending' — it no
--      longer calls the edge function (which stays deployed, unused, and can
--      be re-enabled by re-running 0056's trigger function).
-- ============================================================================

drop policy if exists pro_document_ocr_admin_insert on public.pro_document_ocr;
create policy pro_document_ocr_admin_insert
  on public.pro_document_ocr for insert
  to authenticated
  with check (public.current_role() = 'admin');

drop policy if exists pro_document_ocr_admin_update on public.pro_document_ocr;
create policy pro_document_ocr_admin_update
  on public.pro_document_ocr for update
  to authenticated
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- Upload → 'pending' only; the admin panel analyses it on next opening.
create or replace function public.analyze_pro_document_on_upload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.doc_type) like '%selfie%' then
    return new;
  end if;
  insert into public.pro_document_ocr (document_id, professional_id, ocr_status, requested_at)
  values (new.id, new.professional_id, 'pending', now())
  on conflict (document_id) do update
    set ocr_status = 'pending', ocr_error = null, requested_at = now();
  return new;
exception when others then
  raise warning 'analyze_pro_document_on_upload skipped: %', sqlerrm;
  return new;
end;
$$;

-- ── Sanity ───────────────────────────────────────────────────────────────────
select
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'pro_document_ocr') as policies_expect_3,
  (select count(*) from pg_trigger where tgname = 'trg_analyze_pro_document') as trigger_ok;
