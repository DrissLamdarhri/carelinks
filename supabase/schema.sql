-- ============================================================================
-- CareLink — Schéma de base de données (PostgreSQL / Supabase)
-- ----------------------------------------------------------------------------
-- À exécuter dans Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================================

-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists postgis;

-- ── Enums ───────────────────────────────────────────────────────────────────
create type user_role         as enum ('patient', 'professional', 'admin');
create type pro_specialty     as enum ('nurse', 'psychologist', 'yoga_instructor', 'physiotherapist');
create type verification_status as enum ('pending', 'approved', 'rejected');
create type booking_status    as enum ('open', 'matched', 'in_progress', 'completed', 'cancelled');
create type bid_status        as enum ('pending', 'accepted', 'rejected', 'withdrawn');
create type urgency_level     as enum ('normal', 'urgent', 'emergency');
create type notification_kind as enum ('new_bid', 'bid_accepted', 'booking_status', 'message', 'system');

-- ============================================================================
-- TABLE 1 : profiles (étend auth.users — clé partagée)
-- ============================================================================
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  role            user_role not null,
  full_name       text not null,
  email           text,
  phone           text unique,                       -- format E.164 +212...
  avatar_url      text,
  city            text,
  language        text default 'fr',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index idx_profiles_role on public.profiles(role);
create index idx_profiles_city on public.profiles(city);

-- ============================================================================
-- TABLE 2 : patients (1:1 avec profiles)
-- ============================================================================
create table public.patients (
  id              uuid primary key references public.profiles(id) on delete cascade,
  date_of_birth   date,
  gender          text,
  emergency_contact_phone text,
  medical_notes   text,
  created_at      timestamptz default now()
);

-- ============================================================================
-- TABLE 3 : services (catalogue maître — yoga, soins, kiné, psy)
-- ============================================================================
create table public.services (
  id              uuid primary key default uuid_generate_v4(),
  specialty       pro_specialty not null,
  name            text not null,
  description     text,
  base_price_mad  numeric(10,2),
  duration_min    int,
  is_active       boolean default true,
  created_at      timestamptz default now()
);
create index idx_services_specialty on public.services(specialty) where is_active;

-- ============================================================================
-- TABLE 4 : professionals (1:1 avec profiles)
-- ============================================================================
create table public.professionals (
  id                    uuid primary key references public.profiles(id) on delete cascade,
  specialty             pro_specialty not null,
  bio                   text,
  years_experience      int default 0,
  hourly_rate_mad       numeric(10,2),
  verification_status   verification_status default 'pending',
  verified_at           timestamptz,
  verified_by           uuid references public.profiles(id) on delete set null,
  rejection_reason      text,
  rating_avg            numeric(3,2) default 0,    -- mis à jour par trigger
  rating_count          int default 0,
  total_bookings        int default 0,
  is_available          boolean default true,
  location              geography(Point, 4326),    -- PostGIS lng/lat
  service_radius_km     int default 10,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);
create index idx_pros_specialty   on public.professionals(specialty)        where verification_status = 'approved';
create index idx_pros_verified    on public.professionals(verification_status);
create index idx_pros_location    on public.professionals using gist(location);

-- ============================================================================
-- TABLE 5 : pro_services (N:M — services proposés par chaque pro)
-- ============================================================================
create table public.pro_services (
  professional_id uuid references public.professionals(id) on delete cascade,
  service_id      uuid references public.services(id) on delete cascade,
  custom_price_mad numeric(10,2),
  primary key (professional_id, service_id)
);

-- ============================================================================
-- TABLE 6 : pro_documents (diplômes, certifications, CIN)
-- ============================================================================
create table public.pro_documents (
  id              uuid primary key default uuid_generate_v4(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  doc_type        text not null,                   -- 'diploma' | 'license' | 'id'
  storage_path    text not null,                   -- chemin dans Supabase Storage
  is_verified     boolean default false,
  uploaded_at     timestamptz default now()
);
create index idx_documents_pro on public.pro_documents(professional_id);

-- ============================================================================
-- TABLE 7 : bookings (demande de service par un patient)
-- ============================================================================
create table public.bookings (
  id              uuid primary key default uuid_generate_v4(),
  patient_id      uuid not null references public.patients(id) on delete cascade,
  service_id      uuid references public.services(id) on delete set null,
  specialty       pro_specialty not null,
  professional_id uuid references public.professionals(id) on delete set null, -- nul tant que pas matché
  status          booking_status default 'open',
  urgency         urgency_level default 'normal',
  scheduled_at    timestamptz,
  address         text,
  location        geography(Point, 4326),
  notes           text,
  budget_min_mad  numeric(10,2),
  budget_max_mad  numeric(10,2) check (budget_max_mad >= budget_min_mad),
  final_price_mad numeric(10,2),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  completed_at    timestamptz,
  cancelled_at    timestamptz,
  cancel_reason   text
);
create index idx_bookings_patient   on public.bookings(patient_id);
create index idx_bookings_pro       on public.bookings(professional_id);
create index idx_bookings_status    on public.bookings(status);
create index idx_bookings_open      on public.bookings(specialty, created_at desc) where status = 'open';
create index idx_bookings_location  on public.bookings using gist(location);

-- ============================================================================
-- TABLE 8 : bids (enchères inversées — pros répondent aux bookings open)
-- ============================================================================
create table public.bids (
  id              uuid primary key default uuid_generate_v4(),
  booking_id      uuid not null references public.bookings(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  price_mad       numeric(10,2) not null check (price_mad > 0),
  eta_min         int,                              -- minutes pour arriver
  message         text,
  status          bid_status default 'pending',
  created_at      timestamptz default now(),
  responded_at    timestamptz,
  unique (booking_id, professional_id)             -- 1 bid par pro par booking
);
create index idx_bids_booking on public.bids(booking_id, created_at);
create index idx_bids_pro     on public.bids(professional_id);

-- ============================================================================
-- TABLE 9 : ratings (avis patient → pro)
-- ============================================================================
create table public.ratings (
  id              uuid primary key default uuid_generate_v4(),
  booking_id      uuid not null unique references public.bookings(id) on delete cascade,
  patient_id      uuid not null references public.patients(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  stars           int not null check (stars between 1 and 5),
  comment         text,
  created_at      timestamptz default now()
);
create index idx_ratings_pro on public.ratings(professional_id);

-- ============================================================================
-- TABLE 10 : yoga_sessions (cours de yoga groupés/programmés)
-- ============================================================================
create table public.yoga_sessions (
  id              uuid primary key default uuid_generate_v4(),
  instructor_id   uuid not null references public.professionals(id) on delete cascade,
  title           text not null,
  description     text,
  starts_at       timestamptz not null,
  duration_min    int default 60,
  capacity        int default 10,
  price_mad       numeric(10,2) not null,
  location        geography(Point, 4326),
  address         text,
  is_online       boolean default false,
  meeting_url     text,
  created_at      timestamptz default now()
);
create index idx_yoga_upcoming on public.yoga_sessions(starts_at);  -- pas de filtre now() (non IMMUTABLE)

create table public.yoga_enrollments (
  session_id uuid references public.yoga_sessions(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  enrolled_at timestamptz default now(),
  primary key (session_id, patient_id)
);

-- ============================================================================
-- TABLE 11 : messages (chat 1:1 lié à un booking)
-- ============================================================================
create table public.messages (
  id              uuid primary key default uuid_generate_v4(),
  booking_id      uuid not null references public.bookings(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null,
  read_at         timestamptz,
  created_at      timestamptz default now()
);
create index idx_messages_booking on public.messages(booking_id, created_at);

-- ============================================================================
-- TABLE 12 : notifications
-- ============================================================================
create table public.notifications (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  kind            notification_kind not null,
  title           text not null,
  body            text,
  payload         jsonb,                             -- ids liés (booking_id, bid_id…)
  read_at         timestamptz,
  created_at      timestamptz default now()
);
create index idx_notifications_user on public.notifications(user_id, created_at desc) where read_at is null;

-- ============================================================================
-- TRIGGERS — updated_at automatique
-- ============================================================================
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_profiles_updated      before update on public.profiles      for each row execute function public.set_updated_at();
create trigger trg_pros_updated          before update on public.professionals for each row execute function public.set_updated_at();
create trigger trg_bookings_updated      before update on public.bookings      for each row execute function public.set_updated_at();

-- ── Mise à jour automatique du rating moyen d'un pro après chaque avis ─────
create or replace function public.recalc_pro_rating() returns trigger language plpgsql as $$
begin
  update public.professionals p set
    rating_avg   = coalesce((select avg(stars)::numeric(3,2) from public.ratings where professional_id = p.id), 0),
    rating_count = (select count(*) from public.ratings where professional_id = p.id)
  where p.id = coalesce(new.professional_id, old.professional_id);
  return null;
end $$;
create trigger trg_ratings_recalc after insert or update or delete on public.ratings
  for each row execute function public.recalc_pro_rating();

-- ── Incrémente total_bookings quand un booking passe à 'completed' ─────────
create or replace function public.increment_pro_bookings() returns trigger language plpgsql as $$
begin
  if new.status = 'completed' and old.status <> 'completed' and new.professional_id is not null then
    update public.professionals set total_bookings = total_bookings + 1 where id = new.professional_id;
  end if;
  return new;
end $$;
create trigger trg_bookings_complete after update on public.bookings
  for each row execute function public.increment_pro_bookings();

-- ============================================================================
-- VUES — requêtes courantes simplifiées
-- ============================================================================
create or replace view public.v_pros_public as
select
  p.id, p.full_name, p.avatar_url, p.city, p.phone,
  pr.specialty, pr.bio, pr.hourly_rate_mad, pr.rating_avg, pr.rating_count,
  pr.total_bookings, pr.years_experience, pr.is_available,
  st_y(pr.location::geometry) as lat,
  st_x(pr.location::geometry) as lng
from public.profiles p
join public.professionals pr on pr.id = p.id
where pr.verification_status = 'approved';

-- ── RPC : recherche de pros à proximité ────────────────────────────────────
create or replace function public.nearby_pros(
  p_lat double precision,
  p_lng double precision,
  p_specialty pro_specialty default null,
  p_radius_km int default 10
)
returns table (
  id uuid, full_name text, avatar_url text, specialty pro_specialty,
  rating_avg numeric, hourly_rate_mad numeric, distance_km double precision
)
language sql stable as $$
  select pr.id, pf.full_name, pf.avatar_url, pr.specialty,
         pr.rating_avg, pr.hourly_rate_mad,
         st_distance(pr.location, st_makepoint(p_lng, p_lat)::geography) / 1000.0 as distance_km
  from public.professionals pr
  join public.profiles pf on pf.id = pr.id
  where pr.verification_status = 'approved'
    and pr.is_available
    and (p_specialty is null or pr.specialty = p_specialty)
    and st_dwithin(pr.location, st_makepoint(p_lng, p_lat)::geography, p_radius_km * 1000)
  order by distance_km
  limit 50;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles        enable row level security;
alter table public.patients        enable row level security;
alter table public.professionals   enable row level security;
alter table public.services        enable row level security;
alter table public.pro_services    enable row level security;
alter table public.pro_documents   enable row level security;
alter table public.bookings        enable row level security;
alter table public.bids            enable row level security;
alter table public.ratings         enable row level security;
alter table public.yoga_sessions   enable row level security;
alter table public.yoga_enrollments enable row level security;
alter table public.messages        enable row level security;
alter table public.notifications   enable row level security;

-- helper : récupérer le rôle du user connecté (évite récursion RLS)
create or replace function public.current_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ── profiles : chacun lit/édite le sien ; admins voient tout ───────────────
create policy "profiles_self_read"  on public.profiles for select using (auth.uid() = id or public.current_role() = 'admin');
create policy "profiles_self_write" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert"     on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_admin_all"  on public.profiles for all    using (public.current_role() = 'admin');

-- ── patients ───────────────────────────────────────────────────────────────
create policy "patients_self"      on public.patients for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "patients_admin"     on public.patients for select using (public.current_role() = 'admin');

-- ── professionals : lecture publique (approved), écriture self, admin all ──
create policy "pros_public_read"   on public.professionals for select using (verification_status = 'approved' or auth.uid() = id or public.current_role() = 'admin');
create policy "pros_self_write"    on public.professionals for update using (auth.uid() = id);
create policy "pros_self_insert"   on public.professionals for insert with check (auth.uid() = id);
create policy "pros_admin_all"     on public.professionals for all using (public.current_role() = 'admin');

-- ── services : lecture publique, écriture admin ────────────────────────────
create policy "services_read"      on public.services for select using (true);
create policy "services_admin"     on public.services for all using (public.current_role() = 'admin');

-- ── pro_services / pro_documents : pro propriétaire + admin ────────────────
create policy "proserv_owner"      on public.pro_services for all using (auth.uid() = professional_id or public.current_role() = 'admin');
create policy "proserv_read"       on public.pro_services for select using (true);
create policy "prodocs_owner"      on public.pro_documents for all using (auth.uid() = professional_id or public.current_role() = 'admin');

-- ── bookings : patient propriétaire, pro matché, pros voient les 'open', admin ──
create policy "bookings_patient"   on public.bookings for all using (auth.uid() = patient_id);
create policy "bookings_pro_view"  on public.bookings for select using (
  auth.uid() = professional_id
  or (status = 'open' and public.current_role() = 'professional')
);
create policy "bookings_pro_update" on public.bookings for update using (auth.uid() = professional_id);
create policy "bookings_admin"     on public.bookings for all using (public.current_role() = 'admin');

-- ── bids : pro propriétaire écrit ; patient du booking lit ; admin all ────
create policy "bids_pro_write"     on public.bids for all using (auth.uid() = professional_id) with check (auth.uid() = professional_id);
create policy "bids_patient_read"  on public.bids for select using (
  exists (select 1 from public.bookings b where b.id = bids.booking_id and b.patient_id = auth.uid())
);
create policy "bids_admin"         on public.bids for select using (public.current_role() = 'admin');

-- ── ratings : patient écrit le sien ; lecture publique ; admin all ─────────
create policy "ratings_read"       on public.ratings for select using (true);
create policy "ratings_patient"    on public.ratings for insert with check (auth.uid() = patient_id);
create policy "ratings_admin"      on public.ratings for all using (public.current_role() = 'admin');

-- ── yoga_sessions : lecture publique, instructeur écrit ────────────────────
create policy "yoga_read"          on public.yoga_sessions for select using (true);
create policy "yoga_instructor"    on public.yoga_sessions for all using (auth.uid() = instructor_id);
create policy "yoga_enroll_self"   on public.yoga_enrollments for all using (auth.uid() = patient_id);
create policy "yoga_enroll_read"   on public.yoga_enrollments for select using (
  auth.uid() = patient_id
  or exists (select 1 from public.yoga_sessions s where s.id = yoga_enrollments.session_id and s.instructor_id = auth.uid())
);

-- ── messages : participants du booking ─────────────────────────────────────
create policy "messages_participants" on public.messages for all using (
  exists (
    select 1 from public.bookings b
    where b.id = messages.booking_id
      and (b.patient_id = auth.uid() or b.professional_id = auth.uid())
  )
);

-- ── notifications : destinataire seul ──────────────────────────────────────
create policy "notif_owner"        on public.notifications for all using (auth.uid() = user_id);

-- ============================================================================
-- DONNÉES DE SEED — services de base
-- ============================================================================
insert into public.services (specialty, name, description, base_price_mad, duration_min) values
  ('nurse',           'Injection',          'Injection intramusculaire ou sous-cutanée à domicile',  150, 20),
  ('nurse',           'Pansement',          'Réfection de pansement post-opératoire',                 120, 30),
  ('nurse',           'Prise de sang',      'Prélèvement sanguin à domicile',                         200, 20),
  ('psychologist',    'Consultation',       'Séance de psychothérapie',                               400, 60),
  ('yoga_instructor', 'Yoga individuel',    'Cours particulier à domicile',                           300, 60),
  ('physiotherapist', 'Séance kiné',        'Rééducation à domicile',                                 250, 45)
on conflict do nothing;

-- ============================================================================
-- FIN — Schéma prêt pour CareLink
-- ============================================================================