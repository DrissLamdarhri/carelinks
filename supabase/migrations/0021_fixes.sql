-- =====================================================================
-- CareLink — Consolidated fixes
-- Run in Supabase SQL Editor (in this exact order).
-- Idempotent: safe to re-run.
-- =====================================================================

-- =====================================================================
-- BLOCK 1 — professionals.city column + sync from profiles
-- =====================================================================

alter table public.professionals
  add column if not exists city text;

update public.professionals pr
   set city = p.city
  from public.profiles p
 where p.id = pr.id
   and pr.city is null;

create index if not exists idx_professionals_city
  on public.professionals (city);

create or replace function public.sync_professional_city()
returns trigger language plpgsql security definer as $$
begin
  update public.professionals
     set city = new.city
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_sync_professional_city on public.profiles;
create trigger trg_sync_professional_city
after update of city on public.profiles
for each row
when (new.role = 'professional')
execute function public.sync_professional_city();

create or replace function public.set_professional_city_on_insert()
returns trigger language plpgsql security definer as $$
begin
  if new.city is null then
    select city into new.city from public.profiles where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_professional_city_insert on public.professionals;
create trigger trg_set_professional_city_insert
before insert on public.professionals
for each row
execute function public.set_professional_city_on_insert();


-- =====================================================================
-- BLOCK 2 — notifications: align schema with frontend (is_read + payload)
-- =====================================================================

alter table public.notifications
  add column if not exists is_read boolean not null default false;

update public.notifications
   set is_read = true
 where read_at is not null
   and is_read = false;

do $$ begin
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='notifications' and column_name='data')
     and not exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='notifications' and column_name='payload') then
    alter table public.notifications rename column data to payload;
  end if;
end $$;

alter table public.notifications
  add column if not exists payload jsonb;

create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, created_at desc)
  where is_read = false;

create or replace function public.notify_new_bid()
returns trigger language plpgsql security definer as $$
declare v_patient_id uuid; v_pro_name text;
begin
  select b.patient_id into v_patient_id from public.bookings b where b.id = new.booking_id;
  select coalesce(p.full_name, 'Un professionnel') into v_pro_name from public.profiles p where p.id = new.professional_id;
  if v_patient_id is not null then
    insert into public.notifications (user_id, kind, title, body, payload)
    values (v_patient_id, 'new_bid', 'Nouvelle offre reçue',
            v_pro_name || ' a proposé ' || new.amount_mad || ' MAD',
            jsonb_build_object('booking_id', new.booking_id, 'bid_id', new.id,
                               'price_mad', new.amount_mad, 'pro_id', new.professional_id,
                               'pro_name', v_pro_name));
  end if;
  return new;
end; $$;

create or replace function public.notify_bid_accepted()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.notifications (user_id, kind, title, body, payload)
    values (new.professional_id, 'bid_accepted', 'Offre acceptée',
            'Votre offre de ' || new.amount_mad || ' MAD a été acceptée',
            jsonb_build_object('booking_id', new.booking_id, 'bid_id', new.id,
                               'price_mad', new.amount_mad));
  end if;
  return new;
end; $$;

create or replace function public.notify_booking_status()
returns trigger language plpgsql security definer as $$
declare v_body text;
begin
  if new.status is distinct from old.status then
    v_body := case new.status
      when 'matched' then 'Un professionnel a été assigné'
      when 'in_progress' then 'La prestation a commencé'
      when 'completed' then 'La prestation est terminée'
      when 'cancelled' then 'La prestation a été annulée'
      else 'Statut mis à jour' end;
    insert into public.notifications (user_id, kind, title, body, payload)
    values (new.patient_id, 'booking_status', 'Statut de la prestation', v_body,
            jsonb_build_object('booking_id', new.id, 'status', new.status, 'message', v_body));
    if new.professional_id is not null then
      insert into public.notifications (user_id, kind, title, body, payload)
      values (new.professional_id, 'booking_status', 'Statut de la prestation', v_body,
              jsonb_build_object('booking_id', new.id, 'status', new.status, 'message', v_body));
    end if;
  end if;
  return new;
end; $$;

create or replace function public.notify_new_message()
returns trigger language plpgsql security definer as $$
declare v_sender_name text;
begin
  select coalesce(p.full_name, 'Nouveau message') into v_sender_name from public.profiles p where p.id = new.sender_id;
  insert into public.notifications (user_id, kind, title, body, payload)
  values (new.recipient_id, 'message', v_sender_name, left(new.body, 140),
          jsonb_build_object('booking_id', new.booking_id, 'message_id', new.id,
                             'sender_id', new.sender_id, 'body', new.body));
  return new;
end; $$;

drop trigger if exists trg_notify_new_bid        on public.bids;
create trigger trg_notify_new_bid        after insert on public.bids       for each row execute function public.notify_new_bid();

drop trigger if exists trg_notify_bid_accepted   on public.bids;
create trigger trg_notify_bid_accepted   after update on public.bids       for each row execute function public.notify_bid_accepted();

drop trigger if exists trg_notify_booking_status on public.bookings;
create trigger trg_notify_booking_status after update on public.bookings   for each row execute function public.notify_booking_status();

drop trigger if exists trg_notify_new_message    on public.messages;
create trigger trg_notify_new_message    after insert on public.messages   for each row execute function public.notify_new_message();


-- =====================================================================
-- BLOCK 3 — Pro role + admin notifications on pro registration
-- =====================================================================

update public.profiles p
   set role = 'professional'
  from public.professionals pr
 where pr.id = p.id
   and p.role is distinct from 'professional';

create or replace function public.set_role_on_pro_insert()
returns trigger language plpgsql security definer as $$
begin
  update public.profiles
     set role = 'professional'
   where id = new.id
     and role is distinct from 'professional';
  return new;
end; $$;

drop trigger if exists trg_set_role_on_pro_insert on public.professionals;
create trigger trg_set_role_on_pro_insert
after insert on public.professionals
for each row execute function public.set_role_on_pro_insert();

create or replace function public.notify_admins_new_pro()
returns trigger language plpgsql security definer as $$
declare v_pro_name text;
begin
  select coalesce(p.full_name, 'Nouveau professionnel')
    into v_pro_name
    from public.profiles p where p.id = new.id;

  insert into public.notifications (user_id, kind, title, body, payload)
  select a.id,
         'system',
         'Nouvelle inscription pro',
         v_pro_name || ' (' || new.specialty || ') attend une vérification KYC',
         jsonb_build_object(
           'pro_id',     new.id,
           'specialty',  new.specialty,
           'pro_name',   v_pro_name,
           'event',      'pro_registered'
         )
    from public.profiles a
   where a.role = 'admin';

  return new;
end; $$;

drop trigger if exists trg_notify_admins_new_pro on public.professionals;
create trigger trg_notify_admins_new_pro
after insert on public.professionals
for each row execute function public.notify_admins_new_pro();

create or replace function public.notify_admins_pro_reverify()
returns trigger language plpgsql security definer as $$
declare v_pro_name text;
begin
  if new.verification_status = 'pending'
     and old.verification_status is distinct from 'pending' then
    select coalesce(p.full_name, 'Pro') into v_pro_name
      from public.profiles p where p.id = new.id;
    insert into public.notifications (user_id, kind, title, body, payload)
    select a.id, 'system',
           'Re-vérification pro requise',
           v_pro_name || ' a soumis de nouveaux documents',
           jsonb_build_object('pro_id', new.id, 'event', 'pro_reverify')
      from public.profiles a where a.role = 'admin';
  end if;
  return new;
end; $$;

drop trigger if exists trg_notify_admins_pro_reverify on public.professionals;
create trigger trg_notify_admins_pro_reverify
after update on public.professionals
for each row execute function public.notify_admins_pro_reverify();


-- =====================================================================
-- BLOCK 4 — Realtime publication (idempotent)
-- =====================================================================

do $$ begin
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.bids;          exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.bookings;      exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.messages;      exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.professionals; exception when duplicate_object then null; end;
end $$;


-- =====================================================================
-- BLOCK 5 — Fix RLS policy for profiles & professionals insert (auth signup)
-- =====================================================================

-- Allow profile inserts during signup (auth.uid() is NULL during auth.users trigger)
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles
  for insert with check (true);

-- Allow professionals inserts during signup (same reason)
drop policy if exists "pros_self_insert" on public.professionals;
create policy "pros_self_insert" on public.professionals
  for insert with check (auth.uid() = id OR auth.uid() IS NULL);

-- Recreate update policy
drop policy if exists "profiles_self_write" on public.profiles;
create policy "profiles_self_write" on public.profiles 
  for update using (auth.uid() = id) 
  with check (auth.uid() = id);


-- =====================================================================
-- BLOCK 6 — Avatars storage bucket + policies
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "avatar_public_read" on storage.objects;
create policy "avatar_public_read"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "avatar_upload_own" on storage.objects;
create policy "avatar_upload_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatar_update_own" on storage.objects;
create policy "avatar_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatar_delete_own" on storage.objects;
create policy "avatar_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);


-- =====================================================================
-- BLOCK 7 — Promote your admin account
-- IMPORTANT: replace the email below with YOUR admin email, then uncomment.
-- =====================================================================

-- update public.profiles
--    set role = 'admin'
--  where id = (select id from auth.users where email = 'admin@carelink.ma');
