-- ============================================================================
-- CareLink — Phase 1 verification: tracking sessions + Realtime Authorization
--
-- Run in Supabase → SQL Editor AFTER 0051 and 0052.
--
-- Everything here runs inside a transaction that ROLLS BACK. It creates two
-- throwaway users and a throwaway booking, drives the booking through its full
-- lifecycle, and asserts the session state machine reacts correctly at every
-- step. Nothing is left behind.
--
-- Any failure raises immediately with the assertion name. Success prints
-- "ALL PHASE 1 CHECKS PASSED".
--
-- IDENTITY SIMULATION
--   auth.uid() reads the `request.jwt.claims` GUC, so set_config() lets us
--   evaluate the authorization predicates AS a specific user — patient, pro, or
--   an unrelated third party. Without this the can_*_stream() checks would all
--   return false because auth.uid() is NULL, and would pass for entirely the
--   wrong reason.
--
-- WHAT THIS CANNOT COVER
--   The Realtime policies are checked STRUCTURALLY here (they exist, on the
--   right table, RLS on) and their PREDICATES are checked functionally as each
--   role. But an actual websocket JOIN being refused end-to-end can only be
--   proven from a client holding a real JWT — see the manual test in the
--   report. Do not skip it.
-- ============================================================================

begin;

do $$
declare
  v_patient   uuid := gen_random_uuid();
  v_pro       uuid := gen_random_uuid();
  v_intruder  uuid := gen_random_uuid();
  v_booking   uuid;
  v_session   public.tracking_sessions;
  v_vol       char;
  v_count     integer;
  v_fn        text;
begin
  -- ── 0. Structure ─────────────────────────────────────────────────────────
  if to_regclass('public.tracking_sessions') is null then
    raise exception 'FAIL 0.1: tracking_sessions table missing';
  end if;

  select count(*) into v_count from pg_trigger
   where tgname = 'trg_sync_tracking_session' and not tgisinternal;
  if v_count <> 1 then raise exception 'FAIL 0.2: lifecycle trigger not installed'; end if;

  -- The share predicate MUST be STABLE, not IMMUTABLE: it reads now(), and an
  -- IMMUTABLE marking lets the planner fold it to a constant, which would mean
  -- expired shares never actually expire.
  select provolatile into v_vol from pg_proc
   where oid = 'public.tracking_share_active(public.tracking_sessions)'::regprocedure;
  if v_vol <> 's' then
    raise exception 'FAIL 0.3: tracking_share_active volatility is %, expected s (STABLE)', v_vol;
  end if;

  -- No client-writable path to the table.
  select count(*) into v_count from pg_policies
   where tablename = 'tracking_sessions' and cmd in ('INSERT','UPDATE','DELETE','ALL');
  if v_count <> 0 then
    raise exception 'FAIL 0.4: tracking_sessions has % write polic(ies); it must be read-only to clients', v_count;
  end if;

  -- Realtime Authorization must actually be armed: 4 tracking policies
  -- (pro receive/send, patient receive/send) + 1 private-user receive.
  select count(*) into v_count from pg_policies
   where schemaname = 'realtime' and tablename = 'messages' and policyname like 'carelink_%';
  if v_count <> 5 then
    raise exception 'FAIL 0.5: expected 5 carelink realtime policies, found % — did 0052 apply cleanly?', v_count;
  end if;

  -- Enabled by Supabase by default; we never try to set it (that requires
  -- ownership of a table owned by supabase_realtime_admin). We only assert it.
  if not (select relrowsecurity from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'realtime' and c.relname = 'messages') then
    raise exception 'FAIL 0.6: RLS is NOT enabled on realtime.messages — private channels are unprotected';
  end if;

  -- Presence must NOT be authorized on tracking topics: every policy is scoped
  -- to the broadcast extension, or it would disclose who is connected.
  select count(*) into v_count from pg_policies
   where schemaname = 'realtime' and tablename = 'messages'
     and policyname like 'carelink_%'
     and coalesce(qual, with_check) not like '%broadcast%';
  if v_count <> 0 then
    raise exception 'FAIL 0.9: % carelink polic(ies) are not scoped to the broadcast extension', v_count;
  end if;

  -- `anon` must not hold EXECUTE on ANY Phase 1 function. Checking one or two
  -- of them let the rest through: Supabase's default-privileges rule grants
  -- execute directly to anon on every new function in this schema, and
  -- `REVOKE ... FROM PUBLIC` does not strip a direct grant. Enumerate them all,
  -- and print the live ACL so a failure is diagnosable without a second round
  -- trip.
  for v_fn in
    select unnest(array[
      'public.tracking_share_active(public.tracking_sessions)',
      'public.update_tracking_position(uuid, double precision, double precision, double precision, double precision, bigint)',
      'public.grant_patient_live_share(uuid, integer)',
      'public.revoke_patient_live_share(uuid)',
      'public.decline_patient_live_share(uuid)',
      'public.expire_stale_tracking_sessions(integer)',
      'public.tracking_topic_booking(text)',
      'public.can_receive_pro_stream(uuid)',
      'public.can_send_pro_stream(uuid)',
      'public.can_receive_patient_stream(uuid)',
      'public.can_send_patient_stream(uuid)'
    ])
  loop
    if has_function_privilege('anon', v_fn, 'execute') then
      raise exception 'FAIL 0.7: anon can execute % — acl=%',
        v_fn,
        coalesce((select proacl::text from pg_proc where oid = v_fn::regprocedure), '(default)');
    end if;
  end loop;

  -- The expiry sweep is infrastructure: not even a logged-in user may call it.
  if has_function_privilege('authenticated',
       'public.expire_stale_tracking_sessions(integer)', 'execute') then
    raise exception 'FAIL 0.8: authenticated can execute the expiry sweep';
  end if;

  -- Conversely, the app MUST still work: authenticated needs the consent RPCs.
  if not has_function_privilege('authenticated',
       'public.grant_patient_live_share(uuid, integer)', 'execute') then
    raise exception 'FAIL 0.8b: authenticated LOST execute on grant_patient_live_share — the revoke was too broad';
  end if;

  -- ── 1. Fixtures ──────────────────────────────────────────────────────────
  -- `trg_on_auth_user_created` (migration 0002) already inserts into
  -- public.profiles for every new auth.users row, deriving `role` from
  -- raw_user_meta_data and defaulting to 'patient'. Supplying the metadata here
  -- exercises the real signup path rather than fighting it — an earlier version
  -- of this script inserted profiles directly and died on profiles_pkey.
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          raw_user_meta_data, created_at, updated_at)
  values (v_patient, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'verify-patient@carelink.test', '',
          jsonb_build_object('role', 'patient', 'full_name', 'Verify Patient'),
          now(), now()),
         (v_pro,     '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'verify-pro@carelink.test', '',
          jsonb_build_object('role', 'professional', 'full_name', 'Verify Pro'),
          now(), now()),
         (v_intruder,'00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'verify-intruder@carelink.test', '',
          jsonb_build_object('role', 'patient', 'full_name', 'Verify Intruder'),
          now(), now());

  -- Belt and braces: guarantee the rows and roles exist even in an environment
  -- where that trigger is absent or behaves differently.
  insert into public.profiles (id, role, full_name)
  values (v_patient,  'patient',      'Verify Patient'),
         (v_pro,      'professional', 'Verify Pro'),
         (v_intruder, 'patient',      'Verify Intruder')
  on conflict (id) do update
    set role = excluded.role, full_name = excluded.full_name;

  -- The trigger does NOT create these role-specific rows.
  insert into public.patients (id) values (v_patient), (v_intruder)
    on conflict (id) do nothing;
  insert into public.professionals (id, specialty) values (v_pro, 'nurse')
    on conflict (id) do nothing;

  -- ── 2. matched → session 'pending', GPS forbidden ────────────────────────
  -- `specialty` is NOT NULL with no default — omitting it fails before any
  -- Phase 1 logic is even reached.
  insert into public.bookings (patient_id, professional_id, specialty, status, address)
  values (v_patient, v_pro, 'nurse', 'matched', 'Verify address, Fès')
  returning id into v_booking;

  select * into v_session from public.tracking_sessions where booking_id = v_booking;
  if v_session.id is null then
    raise exception 'FAIL 2.1: no session created on matched';
  end if;
  if v_session.status <> 'pending' then
    raise exception 'FAIL 2.2: session status is %, expected pending', v_session.status;
  end if;
  if v_session.gps_started_at is not null then
    raise exception 'FAIL 2.3: gps_started_at set while still pending';
  end if;

  -- THE GPS GATE. As the genuine assigned professional, sending must still be
  -- refused while the session is only 'pending'. This is the server-side
  -- guarantee that no location flows before the nurse presses "Je pars".
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_pro)::text, true);
  if public.can_send_pro_stream(v_booking) then
    raise exception 'FAIL 2.4: the assigned pro can send before en_route — GPS gate is broken';
  end if;
  -- …but both parties may already JOIN, so the channel is warm at acceptance.
  if not public.can_receive_pro_stream(v_booking) then
    raise exception 'FAIL 2.5: assigned pro cannot join their own pending session';
  end if;
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_patient)::text, true);
  if not public.can_receive_pro_stream(v_booking) then
    raise exception 'FAIL 2.6: patient cannot join their own pending session';
  end if;

  -- ── 3. en_route → session 'active', GPS permitted ────────────────────────
  update public.bookings set status = 'en_route' where id = v_booking;
  select * into v_session from public.tracking_sessions where booking_id = v_booking;
  if v_session.status <> 'active' then
    raise exception 'FAIL 3.1: session status is %, expected active', v_session.status;
  end if;
  if v_session.gps_started_at is null then
    raise exception 'FAIL 3.2: gps_started_at not stamped on en_route';
  end if;

  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_pro)::text, true);
  if not public.can_send_pro_stream(v_booking) then
    raise exception 'FAIL 3.3: assigned pro cannot send once en_route';
  end if;

  -- The patient must never be able to publish on the professional's stream —
  -- otherwise anyone on the booking could forge the nurse's position.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_patient)::text, true);
  if public.can_send_pro_stream(v_booking) then
    raise exception 'FAIL 3.4: the PATIENT can publish on the pro stream';
  end if;

  -- ── 3b. THE CORE SECURITY TEST: an unrelated user is locked out ──────────
  -- This is the hole Phase 1 exists to close. A third party who knows the
  -- booking UUID must get nothing, on either stream, in either direction.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_intruder)::text, true);
  if public.can_receive_pro_stream(v_booking) then
    raise exception 'FAIL 3.5: SECURITY — an unrelated user can receive the nurse position stream';
  end if;
  if public.can_send_pro_stream(v_booking) then
    raise exception 'FAIL 3.6: SECURITY — an unrelated user can publish to the pro stream';
  end if;
  if public.can_receive_patient_stream(v_booking) then
    raise exception 'FAIL 3.7: SECURITY — an unrelated user can receive the patient stream';
  end if;
  if public.can_send_patient_stream(v_booking) then
    raise exception 'FAIL 3.8: SECURITY — an unrelated user can publish to the patient stream';
  end if;

  -- ── 4. Patient share: default-off, and the NURSE's access follows it ─────
  -- The predicate and the authorization consequence are tested together: it is
  -- the nurse's ability to SUBSCRIBE that must track the patient's consent, not
  -- merely a boolean somewhere.
  if public.tracking_share_active(v_session) then
    raise exception 'FAIL 4.1: share reads active with no grant';
  end if;
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_pro)::text, true);
  if public.can_receive_patient_stream(v_booking) then
    raise exception 'FAIL 4.2: nurse can receive the patient stream with NO consent granted';
  end if;

  update public.tracking_sessions
     set patient_share_granted_at = now(),
         patient_share_expires_at = now() + interval '10 minutes',
         patient_share_revoked_at = null
   where booking_id = v_booking;
  select * into v_session from public.tracking_sessions where booking_id = v_booking;
  if not public.tracking_share_active(v_session) then
    raise exception 'FAIL 4.3: granted, unexpired share reads inactive';
  end if;
  if not public.can_receive_patient_stream(v_booking) then
    raise exception 'FAIL 4.4: nurse cannot receive the patient stream despite valid consent';
  end if;

  -- Expiry: the automatic-termination guarantee.
  update public.tracking_sessions
     set patient_share_expires_at = now() - interval '1 second'
   where booking_id = v_booking;
  select * into v_session from public.tracking_sessions where booking_id = v_booking;
  if public.tracking_share_active(v_session) then
    raise exception 'FAIL 4.5: EXPIRED share still reads active';
  end if;
  if public.can_receive_patient_stream(v_booking) then
    raise exception 'FAIL 4.6: nurse still receives the patient stream after the grant EXPIRED';
  end if;

  -- Revocation wins immediately, even well before expiry.
  update public.tracking_sessions
     set patient_share_expires_at = now() + interval '10 minutes',
         patient_share_revoked_at = now()
   where booking_id = v_booking;
  select * into v_session from public.tracking_sessions where booking_id = v_booking;
  if public.tracking_share_active(v_session) then
    raise exception 'FAIL 4.7: REVOKED share still reads active';
  end if;
  if public.can_receive_patient_stream(v_booking) then
    raise exception 'FAIL 4.8: nurse still receives the patient stream after REVOCATION';
  end if;

  -- The patient always sees their own stream, consent or not — it is their data.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_patient)::text, true);
  if not public.can_receive_patient_stream(v_booking) then
    raise exception 'FAIL 4.9: patient locked out of their own stream';
  end if;

  -- ── 5. Re-match must wipe consent (privacy) ──────────────────────────────
  update public.tracking_sessions
     set patient_share_granted_at = now(),
         patient_share_expires_at = now() + interval '10 minutes',
         patient_share_revoked_at = null
   where booking_id = v_booking;
  update public.bookings set status = 'matched' where id = v_booking;
  select * into v_session from public.tracking_sessions where booking_id = v_booking;
  if v_session.patient_share_granted_at is not null then
    raise exception 'FAIL 5.1: consent survived a re-match — it would carry to a different nurse';
  end if;
  if v_session.status <> 'pending' then
    raise exception 'FAIL 5.2: re-match left session in %, expected pending', v_session.status;
  end if;

  -- ── 6. Terminal states close the session permanently ─────────────────────
  update public.bookings set status = 'en_route'    where id = v_booking;
  update public.bookings set status = 'in_progress' where id = v_booking;
  select * into v_session from public.tracking_sessions where booking_id = v_booking;
  if v_session.status <> 'ended' then
    raise exception 'FAIL 6.1: arrival did not end the session (status %)', v_session.status;
  end if;
  if v_session.end_reason <> 'arrived' then
    raise exception 'FAIL 6.2: end_reason is %, expected arrived', v_session.end_reason;
  end if;
  if v_session.patient_share_revoked_at is null then
    raise exception 'FAIL 6.3: patient share not revoked when the visit began';
  end if;

  -- Location sharing must be over for BOTH parties, permanently.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_pro)::text, true);
  if public.can_send_pro_stream(v_booking) then
    raise exception 'FAIL 6.4: pro can still publish after arrival';
  end if;
  if public.can_receive_pro_stream(v_booking) then
    raise exception 'FAIL 6.5: pro can still receive after the session ended';
  end if;
  if public.can_receive_patient_stream(v_booking) then
    raise exception 'FAIL 6.6: nurse can still receive the patient stream after arrival';
  end if;
  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_patient)::text, true);
  if public.can_receive_pro_stream(v_booking) then
    raise exception 'FAIL 6.7: patient can still receive after the session ended';
  end if;

  -- ── 7. Topic parsing fails closed ────────────────────────────────────────
  if public.tracking_topic_booking('tracking:not-a-uuid:pro') is not null then
    raise exception 'FAIL 7.1: malformed topic did not parse to NULL';
  end if;
  if public.tracking_topic_booking('chat:' || v_booking::text) is not null then
    raise exception 'FAIL 7.2: non-tracking topic parsed as a tracking topic';
  end if;
  if public.tracking_topic_booking('tracking:' || v_booking::text || ':pro') <> v_booking then
    raise exception 'FAIL 7.3: well-formed topic failed to parse';
  end if;

  -- ── 8. Expiry sweep closes abandoned sessions ────────────────────────────
  update public.bookings set status = 'matched' where id = v_booking;
  update public.tracking_sessions
     set created_at = now() - interval '48 hours' where booking_id = v_booking;
  perform public.expire_stale_tracking_sessions(12);
  select * into v_session from public.tracking_sessions where booking_id = v_booking;
  if v_session.status <> 'ended' or v_session.end_reason <> 'expired' then
    raise exception 'FAIL 8.1: stale session not swept (status %, reason %)',
      v_session.status, v_session.end_reason;
  end if;

  perform set_config('request.jwt.claims', '', true);
  raise notice 'ALL PHASE 1 CHECKS PASSED';
end $$;

rollback;
