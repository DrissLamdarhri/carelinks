-- =====================================================================
-- CareLink — Notification Triggers
-- Run AFTER schema.sql. Inserts rows into public.notifications on key
-- domain events so the Realtime subscription in /src/lib/db/realtime.ts
-- (useUserNotifications) picks them up automatically.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. NEW BID  -> notify the patient who owns the booking
-- ---------------------------------------------------------------------
create or replace function public.notify_new_bid()
returns trigger
language plpgsql
security definer
as $$
declare
  v_patient_id uuid;
  v_pro_name   text;
begin
  select b.patient_id into v_patient_id
  from public.bookings b where b.id = new.booking_id;

  select coalesce(p.full_name, 'Un professionnel') into v_pro_name
  from public.profiles p where p.id = new.professional_id;

  if v_patient_id is not null then
    insert into public.notifications (user_id, kind, title, body, payload)
    values (
      v_patient_id,
      'new_bid',
      'Nouvelle offre reçue',
      v_pro_name || ' a proposé ' || new.amount_mad || ' MAD',
      jsonb_build_object(
        'booking_id', new.booking_id,
        'bid_id',     new.id,
        'amount',     new.amount_mad,
        'pro_id',     new.professional_id
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_new_bid on public.bids;
create trigger trg_notify_new_bid
after insert on public.bids
for each row execute function public.notify_new_bid();

-- ---------------------------------------------------------------------
-- 2. BID ACCEPTED  -> notify the professional whose bid won
-- ---------------------------------------------------------------------
create or replace function public.notify_bid_accepted()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.notifications (user_id, kind, title, body, payload)
    values (
      new.professional_id,
      'bid_accepted',
      'Offre acceptée',
      'Votre offre de ' || new.amount_mad || ' MAD a été acceptée',
      jsonb_build_object(
        'booking_id', new.booking_id,
        'bid_id',     new.id,
        'amount',     new.amount_mad
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_bid_accepted on public.bids;
create trigger trg_notify_bid_accepted
after update on public.bids
for each row execute function public.notify_bid_accepted();

-- ---------------------------------------------------------------------
-- 3. BOOKING STATUS CHANGE  -> notify both patient and professional
-- ---------------------------------------------------------------------
create or replace function public.notify_booking_status()
returns trigger
language plpgsql
security definer
as $$
declare
  v_title text;
  v_body  text;
begin
  if new.status is distinct from old.status then
    v_title := 'Statut de la prestation';
    v_body  := case new.status
      when 'matched'     then 'Un professionnel a été assigné'
      when 'in_progress' then 'La prestation a commencé'
      when 'completed'   then 'La prestation est terminée'
      when 'cancelled'   then 'La prestation a été annulée'
      else 'Statut mis à jour'
    end;

    insert into public.notifications (user_id, kind, title, body, payload)
    values (
      new.patient_id,
      'booking_status',
      v_title, v_body,
      jsonb_build_object('booking_id', new.id, 'status', new.status)
    );

    if new.professional_id is not null then
      insert into public.notifications (user_id, kind, title, body, payload)
      values (
        new.professional_id,
        'booking_status',
        v_title, v_body,
        jsonb_build_object('booking_id', new.id, 'status', new.status)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_booking_status on public.bookings;
create trigger trg_notify_booking_status
after update on public.bookings
for each row execute function public.notify_booking_status();

-- ---------------------------------------------------------------------
-- 4. NEW MESSAGE  -> notify the recipient
-- ---------------------------------------------------------------------
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
as $$
declare
  v_sender_name text;
  v_recipient   uuid;
begin
  select coalesce(p.full_name, 'Nouveau message') into v_sender_name
  from public.profiles p where p.id = new.sender_id;

  -- messages has no recipient_id — the recipient is the OTHER party on the booking.
  select case when new.sender_id = b.patient_id then b.professional_id else b.patient_id end
    into v_recipient
  from public.bookings b where b.id = new.booking_id;

  if v_recipient is not null then
    insert into public.notifications (user_id, kind, title, body, payload)
    values (
      v_recipient,
      'message',
      v_sender_name,
      left(new.body, 140),
      jsonb_build_object(
        'booking_id', new.booking_id,
        'message_id', new.id,
        'sender_id',  new.sender_id
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_new_message on public.messages;
create trigger trg_notify_new_message
after insert on public.messages
for each row execute function public.notify_new_message();

-- ---------------------------------------------------------------------
-- 5. AUTO-PROFILE on auth.users insert (Google OAuth + email/password)
-- Ensures every authenticated user gets a row in public.profiles.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  v_role user_role;
begin
  -- Safely cast role from metadata, defaulting to 'patient' if invalid
  v_role := CASE
    WHEN new.raw_user_meta_data->>'role' IN ('patient', 'professional', 'admin') 
      THEN (new.raw_user_meta_data->>'role')::user_role
    ELSE 'patient'::user_role
  END;

  insert into public.profiles (id, full_name, avatar_url, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'avatar_url',
    v_role,
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 6. REALTIME PUBLICATION  -> ensure these tables broadcast changes
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.bids;
alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.messages;
