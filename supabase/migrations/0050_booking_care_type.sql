-- ============================================================================
-- CareLink — Persist the specific care type a patient picks (0050)
--
--   • The "Type de soin" picker on the request screen (Pansement, Injection
--     IM, Bilan sanguin, ... / kiné equivalents) was purely local UI state —
--     `handleSubmit` never sent it to the server. Every downstream screen
--     (patient home "Prochain rendez-vous", the pro's open-demand feed and
--     mission cards, the tracking screen) could therefore only ever show the
--     coarse `specialty` ("Soins infirmiers" / raw "nurse"), never which
--     specific care was actually requested — indistinguishable whether it's
--     a dressing change or a blood draw.
--   • Adds `bookings.care_type` (free text — mirrors how the picker itself is
--     just a label from `service_types`/a hardcoded fallback list, not an FK).
--   • `open_demands` (0028) is the redacted copy of open bookings the pro's
--     live feed subscribes to over Realtime — care_type is not privacy
--     sensitive (unlike address/notes), so it's mirrored there too via
--     sync_open_demand() (last redefined in 0043 for the yoga exclusion).
-- Idempotent. Run once in Supabase → SQL Editor.
-- ============================================================================

alter table public.bookings
  add column if not exists care_type text;

alter table public.open_demands
  add column if not exists care_type text;

create or replace function public.sync_open_demand()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.open_demands where booking_id = old.id;
    return old;
  end if;

  -- Only `open` bookings are visible to the market, and yoga never bids —
  -- its instructor is fixed by the session, price is fixed by the class.
  if new.status::text <> 'open' or new.specialty = 'yoga_instructor' then
    delete from public.open_demands where booking_id = new.id;
    return new;
  end if;

  insert into public.open_demands (
    booking_id, specialty, urgency, scheduled_at,
    budget_min_mad, budget_max_mad, area_label, approx_lat, approx_lng, care_type, created_at
  ) values (
    new.id, new.specialty, new.urgency, new.scheduled_at,
    new.budget_min_mad, new.budget_max_mad,
    public.area_from_address(new.address),
    round(st_y(new.location::geometry)::numeric, 2),
    round(st_x(new.location::geometry)::numeric, 2),
    new.care_type,
    coalesce(new.created_at, now())
  )
  on conflict (booking_id) do update set
    specialty      = excluded.specialty,
    urgency        = excluded.urgency,
    scheduled_at   = excluded.scheduled_at,
    budget_min_mad = excluded.budget_min_mad,
    budget_max_mad = excluded.budget_max_mad,
    area_label     = excluded.area_label,
    approx_lat     = excluded.approx_lat,
    approx_lng     = excluded.approx_lng,
    care_type      = excluded.care_type;

  return new;
end $$;

-- Backfill care_type on demands that are open right now.
update public.open_demands d
   set care_type = b.care_type
  from public.bookings b
 where d.booking_id = b.id
   and b.care_type is not null
   and d.care_type is distinct from b.care_type;
