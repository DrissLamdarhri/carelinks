-- ============================================================================
-- CareLink — seed a few REAL approved professionals for the booking map.
-- Run in Supabase Dashboard → SQL Editor → New query → Run.
-- Idempotent (fixed UUIDs). Safe to re-run.
--
-- Locations are near FÈS (34.037, -5.004) — the app's default center. If you test
-- somewhere else, change the lat/lng below to within ~15 km of your GPS, or the
-- radius filter hides them.
-- ============================================================================

-- pgcrypto is needed for crypt()/gen_salt() (present on Supabase by default)
create extension if not exists pgcrypto;

do $$
declare
  seed jsonb := '[
    {"id":"a1000000-0000-4000-8000-000000000001","name":"Fatima Zahra","email":"seed.fatima@carelink.test","spec":"nurse","lat":34.0421,"lng":-5.0081,"avatar":"https://randomuser.me/api/portraits/women/65.jpg","rate":180},
    {"id":"a1000000-0000-4000-8000-000000000002","name":"Karim Mansour","email":"seed.karim@carelink.test","spec":"physiotherapist","lat":34.0302,"lng":-4.9982,"avatar":"https://randomuser.me/api/portraits/men/32.jpg","rate":220},
    {"id":"a1000000-0000-4000-8000-000000000003","name":"Samira Rifai","email":"seed.samira@carelink.test","spec":"psychologist","lat":34.0455,"lng":-5.0011,"avatar":"https://randomuser.me/api/portraits/women/44.jpg","rate":350},
    {"id":"a1000000-0000-4000-8000-000000000004","name":"Youssef Bennani","email":"seed.youssef@carelink.test","spec":"nurse","lat":34.0281,"lng":-5.0124,"avatar":"https://randomuser.me/api/portraits/men/52.jpg","rate":160},
    {"id":"a1000000-0000-4000-8000-000000000005","name":"Nadia El Amrani","email":"seed.nadia@carelink.test","spec":"nurse","lat":34.0389,"lng":-4.9951,"avatar":"https://randomuser.me/api/portraits/women/68.jpg","rate":170}
  ]';
  p jsonb;
begin
  for p in select * from jsonb_array_elements(seed) loop
    -- 1) auth user (required — professionals.id → profiles.id → auth.users.id)
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      (p->>'id')::uuid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      p->>'email',
      crypt('CareLink123!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', p->>'name')
    ) on conflict (id) do nothing;

    -- 2) profile (role = professional, with avatar)
    insert into public.profiles (id, role, full_name, avatar_url, city, language)
    values ((p->>'id')::uuid, 'professional', p->>'name', p->>'avatar', 'Salé', 'fr')
    on conflict (id) do update
      set role = 'professional', full_name = excluded.full_name, avatar_url = excluded.avatar_url;

    -- 3) professional (APPROVED + available + PostGIS location + rating)
    insert into public.professionals (
      id, specialty, verification_status, verified_at, is_available,
      hourly_rate_mad, years_experience, rating_avg, rating_count, service_radius_km, location
    ) values (
      (p->>'id')::uuid,
      (p->>'spec')::pro_specialty,
      'approved', now(), true,
      (p->>'rate')::numeric, 5, 4.8, 120, 15,
      st_setsrid(st_makepoint((p->>'lng')::float, (p->>'lat')::float), 4326)::geography
    ) on conflict (id) do update
      set verification_status = 'approved', is_available = true,
          hourly_rate_mad = excluded.hourly_rate_mad,
          location = excluded.location;
  end loop;
end $$;

-- Make sure the app's roles can read the public view via PostgREST.
grant select on public.v_pros_public to anon, authenticated;

-- Verify they show up in the public view the app reads:
select id, full_name, specialty, rating_avg, hourly_rate_mad, lat, lng
from public.v_pros_public
where id in (
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000003',
  'a1000000-0000-4000-8000-000000000004',
  'a1000000-0000-4000-8000-000000000005'
);
