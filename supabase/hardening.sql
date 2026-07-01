-- =====================================================================
-- CareLink — Hardening (Step 18)
-- Rate-limiting on bid creation + audit log + sanity checks.
-- =====================================================================

-- Rate-limit: max 30 bids per pro per minute
create or replace function public.rate_limit_bids()
returns trigger language plpgsql security definer as $$
declare v_count int;
begin
  select count(*) into v_count
    from public.bids
   where professional_id = new.professional_id
     and created_at > now() - interval '1 minute';
  if v_count >= 30 then
    raise exception 'Rate limit: trop d''offres en une minute' using errcode = 'P0001';
  end if;
  return new;
end; $$;

drop trigger if exists trg_rate_limit_bids on public.bids;
create trigger trg_rate_limit_bids before insert on public.bids
  for each row execute function public.rate_limit_bids();

-- Audit log for sensitive admin actions
create table if not exists public.audit_log (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  target_table text,
  target_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create policy "audit_admin_only" on public.audit_log for all using (public.current_role() = 'admin');

-- Helper called from app code: log admin moderation, refunds, etc.
create or replace function public.log_audit(p_action text, p_table text, p_target uuid, p_details jsonb)
returns void language sql security definer as $$
  insert into public.audit_log(actor_id, action, target_table, target_id, details)
  values (auth.uid(), p_action, p_table, p_target, p_details);
$$;
grant execute on function public.log_audit(text, text, uuid, jsonb) to authenticated;

-- Sanity: ensure professionals.is_available cannot be true unless approved
create or replace function public.guard_pro_availability()
returns trigger language plpgsql as $$
begin
  if new.is_available = true and new.verification_status <> 'approved' then
    new.is_available := false;
  end if;
  return new;
end; $$;

drop trigger if exists trg_guard_pro_availability on public.professionals;
create trigger trg_guard_pro_availability before insert or update on public.professionals
  for each row execute function public.guard_pro_availability();
