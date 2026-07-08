-- ============================================================================
-- SECURITY FIX — prevent pros from self-approving their KYC.
-- The pros_self_write policy lets a pro UPDATE their own professionals row (for
-- bio, availability, etc.), but with no column restriction they could also set
-- verification_status='approved' and bypass KYC. This trigger locks the
-- verification fields so ONLY admins can change them.
-- Run once in Supabase → SQL Editor. Idempotent.
-- ============================================================================

create or replace function public.protect_verification_fields()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  -- Non-admins cannot change verification fields — revert to the old values.
  if public.current_role() is distinct from 'admin' then
    new.verification_status := old.verification_status;
    new.verified_at         := old.verified_at;
    new.verified_by         := old.verified_by;
  end if;
  return new;
end $$;

drop trigger if exists trg_protect_verification on public.professionals;
create trigger trg_protect_verification
  before update on public.professionals
  for each row execute function public.protect_verification_fields();

select 'KYC self-approval locked — only admins can set verification_status' as result;
