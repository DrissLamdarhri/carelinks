  -- ============================================================================
  -- CareLink — Realtime Authorization for live tracking (Phase 1 of the redesign)
  -- Run once in Supabase → SQL Editor, AFTER 0051. Idempotent.
  --
  -- THE HOLE THIS CLOSES
  --   The tracking channel was `supabase.channel('tracking:<bookingId>')` — a
  --   PUBLIC Realtime broadcast channel. Supabase applies RLS to
  --   `postgres_changes`, but NOT to broadcast on public channels. Combined with
  --   an anon key that ships inside the app bundle, the effective access model
  --   was "anyone who learns a booking UUID can stream a nurse's live GPS in
  --   real time" — no account, no membership in the booking, nothing.
  --
  --   A UUID is an identifier, not a credential. They leak through notification
  --   payloads, logs, deep links, screenshots and support tickets. For a
  --   healthcare product broadcasting a named professional's physical location,
  --   that is a personal-safety problem, not merely a compliance one.
  --
  --   Realtime Authorization moves the decision into Postgres: a client that is
  --   not a party to the booking is refused at JOIN time by the server.
  --
  -- SCOPE NOTE — this only affects channels the client opens with
  --   `{ config: { private: true } }`. Public channels are unaffected (and remain
  --   unauthenticated), which is exactly why the client change in this phase must
  --   ship together with this migration.
  --
  -- TWO TOPICS, NOT ONE
  --   Realtime authorizes per TOPIC, not per event. Putting both directions on
  --   one channel would mean the nurse's app receives the patient's position and
  --   is trusted to ignore it — a client-side check, which is precisely what we
  --   refuse to rely on. So the streams are separate topics with separate rules:
  --
  --     tracking:<booking_id>:pro      nurse → patient   (the default stream)
  --     tracking:<booking_id>:patient  patient → nurse   (opt-in, expiring)
  --
  --   When the patient's grant lapses, the nurse's SUBSCRIPTION stops being
  --   authorized. Sharing ends because Postgres says so.
  -- ============================================================================

  -- ── Topic parsing ───────────────────────────────────────────────────────────
  -- Never let a malformed topic raise: an exception inside an RLS predicate is a
  -- denial-of-service vector on the whole Realtime connection. Bad input simply
  -- yields NULL, which fails the policy closed.
  create or replace function public.tracking_topic_booking(p_topic text)
  returns uuid
  language plpgsql
  immutable
  as $$
  declare
    v_id uuid;
  begin
    if p_topic is null or p_topic not like 'tracking:%' then
      return null;
    end if;
    begin
      v_id := split_part(p_topic, ':', 2)::uuid;
    exception when others then
      return null;
    end;
    return v_id;
  end;
  $$;

  comment on function public.tracking_topic_booking is
    'Extracts the booking id from a tracking:<uuid>:<stream> Realtime topic. Returns NULL for anything malformed so policies fail closed.';

  -- ── Authorization predicates ────────────────────────────────────────────────
  -- One function per (stream, direction). Policies stay declarative and the rule
  -- lives in exactly one place.

  /** May the caller RECEIVE the nurse's position stream? Both parties, until the
  *  session ends. 'pending' is allowed so the channel can be joined the moment
  *  the booking is accepted — no GPS flows yet (see the send rule below), but
  *  the socket is warm and the UI has somewhere to attach. */
  create or replace function public.can_receive_pro_stream(b_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public as $$
    select exists (
      select 1 from public.tracking_sessions s
      where s.booking_id = b_id
        and s.status <> 'ended'
        and auth.uid() in (s.patient_id, s.pro_id)
    );
  $$;

  /** May the caller SEND on the nurse's stream? Only the assigned professional,
  *  and only while the session is 'active' — i.e. only after they pressed
  *  "Je pars" and the booking reached en_route. This is what makes "no GPS
  *  before departure" a server-enforced guarantee rather than a client promise:
  *  a modified app broadcasting early is rejected by the server. */
  create or replace function public.can_send_pro_stream(b_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public as $$
    select exists (
      select 1 from public.tracking_sessions s
      where s.booking_id = b_id
        and s.status = 'active'
        and auth.uid() = s.pro_id
    );
  $$;

  /** May the caller RECEIVE the patient's opt-in stream? The patient always may
  *  (it is their own data, and their app renders it). The nurse may ONLY while
  *  an unexpired, un-revoked grant exists. */
  create or replace function public.can_receive_patient_stream(b_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public as $$
    select exists (
      select 1 from public.tracking_sessions s
      where s.booking_id = b_id
        and s.status <> 'ended'
        and (
          auth.uid() = s.patient_id
          or (auth.uid() = s.pro_id and public.tracking_share_active(s))
        )
    );
  $$;

  /** May the caller SEND on the patient's stream? Only the patient, only during
  *  an active trip, only while their own grant stands. Revoking is immediate:
  *  the next publish is refused. */
  create or replace function public.can_send_patient_stream(b_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public as $$
    select exists (
      select 1 from public.tracking_sessions s
      where s.booking_id = b_id
        and s.status = 'active'
        and auth.uid() = s.patient_id
        and public.tracking_share_active(s)
    );
  $$;

  -- Strip BOTH the implicit PUBLIC grant and Supabase's DIRECT default-privileges
  -- grant to `anon` before allowing anything — see the long note in 0051.
  -- REVOKE ... FROM PUBLIC does not remove a direct grant. These predicates are
  -- only ever evaluated inside policies scoped `to authenticated`, so `anon` has
  -- no legitimate reason to hold execute rights on them.
  revoke execute on function public.tracking_topic_booking(text)     from public, anon;
  revoke execute on function public.can_receive_pro_stream(uuid)     from public, anon;
  revoke execute on function public.can_send_pro_stream(uuid)        from public, anon;
  revoke execute on function public.can_receive_patient_stream(uuid) from public, anon;
  revoke execute on function public.can_send_patient_stream(uuid)    from public, anon;

  grant execute on function public.tracking_topic_booking(text)       to authenticated;
  grant execute on function public.can_receive_pro_stream(uuid)       to authenticated;
  grant execute on function public.can_send_pro_stream(uuid)          to authenticated;
  grant execute on function public.can_receive_patient_stream(uuid)   to authenticated;
  grant execute on function public.can_send_patient_stream(uuid)      to authenticated;

  -- ── Realtime policies ───────────────────────────────────────────────────────
  -- DO NOT `alter table realtime.messages enable row level security`.
  --   a) It is unnecessary — Supabase enables RLS on that table by default:
  --      https://supabase.com/docs/guides/realtime/authorization
  --   b) It is impossible — the table is owned by `supabase_realtime_admin`, and
  --      ALTER TABLE requires ownership, so the `postgres` role the SQL editor
  --      runs as gets `42501: must be owner of table messages`. Because the
  --      editor runs a script in one transaction, that single redundant
  --      statement aborted this entire migration.
  -- Creating POLICIES on the table is the officially supported operation and is
  -- all that is required.
  --
  -- Fail loudly if the platform assumption ever stops holding, rather than
  -- silently installing policies that are never enforced.
  -- Assert the platform invariant we depend on (read-only). We do NOT gate on
  -- table ownership here: `realtime.messages` is owned by
  -- `supabase_realtime_admin` and `postgres` is deliberately not a member, yet
  -- Supabase explicitly permits policy DDL on this one table —
  --
  --   "Realtime locks down the `realtime` schema … Creating a table or function
  --    in `realtime` is expected to fail with `permission denied for schema
  --    realtime` … Managing RLS policies on `realtime.messages` is allowed."
  --   — https://supabase.com/docs/guides/realtime/authorization
  --
  -- An earlier revision of this file gated on pg_has_role(...,'USAGE'), i.e. the
  -- ordinary Postgres ownership rule. That is the wrong predicate for this table
  -- and blocked a migration the platform would have accepted. The CREATE POLICY
  -- statements below are their own test: if the platform ever stops allowing
  -- them, they fail loudly and specifically.
  do $$
  declare
    v_owner text;
    v_rls   boolean;
  begin
    select pg_get_userbyid(c.relowner), c.relrowsecurity
      into v_owner, v_rls
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'realtime' and c.relname = 'messages';

    if v_rls is distinct from true then
      raise exception
        'RLS is not enabled on realtime.messages — private channels would be unprotected. '
        'Supabase enables this by default; contact support rather than forcing it here.';
    end if;

    raise notice 'realtime.messages: owner=%, rls=% — proceeding with policy DDL',
      v_owner, v_rls;
  end $$;

  -- One policy per (stream, direction). Permissive policies are OR-ed, so each
  -- can be read and audited in isolation — a single CASE covering everything is
  -- harder to reason about and harder to revoke selectively.
  --
  -- Each policy follows the documented shape:
  --   • the cheap topic pattern test first, so the session lookup only runs on
  --     topics this policy is actually about;
  --   • `extension in ('broadcast')` — tracking uses broadcast only. Without it
  --     these policies would also authorize PRESENCE on a tracking topic, which
  --     would disclose who is currently connected to a visit;
  --   • `(select ...)` around auth.uid()/realtime.topic() so Postgres evaluates
  --     them once per statement (InitPlan) instead of once per row.

  -- Nurse position stream — receive: both parties, until the session ends.
  drop policy if exists "carelink_tracking_pro_receive" on realtime.messages;
  create policy "carelink_tracking_pro_receive"
    on realtime.messages for select
    to authenticated
    using (
      realtime.messages.extension in ('broadcast')
      and (select realtime.topic()) like 'tracking:%:pro'
      and public.can_receive_pro_stream(
            public.tracking_topic_booking((select realtime.topic())))
    );

  -- Nurse position stream — send: the assigned professional, only once the
  -- session is 'active'. This is the server-side guarantee that no location
  -- flows before the nurse presses "Je pars".
  drop policy if exists "carelink_tracking_pro_send" on realtime.messages;
  create policy "carelink_tracking_pro_send"
    on realtime.messages for insert
    to authenticated
    with check (
      realtime.messages.extension in ('broadcast')
      and (select realtime.topic()) like 'tracking:%:pro'
      and public.can_send_pro_stream(
            public.tracking_topic_booking((select realtime.topic())))
    );

  -- Patient opt-in stream — receive: the patient always; the nurse only while an
  -- unexpired, un-revoked consent exists.
  drop policy if exists "carelink_tracking_patient_receive" on realtime.messages;
  create policy "carelink_tracking_patient_receive"
    on realtime.messages for select
    to authenticated
    using (
      realtime.messages.extension in ('broadcast')
      and (select realtime.topic()) like 'tracking:%:patient'
      and public.can_receive_patient_stream(
            public.tracking_topic_booking((select realtime.topic())))
    );

  -- Patient opt-in stream — send: only the patient, only while their own consent
  -- stands. Revocation takes effect on the next publish.
  drop policy if exists "carelink_tracking_patient_send" on realtime.messages;
  create policy "carelink_tracking_patient_send"
    on realtime.messages for insert
    to authenticated
    with check (
      realtime.messages.extension in ('broadcast')
      and (select realtime.topic()) like 'tracking:%:patient'
      and public.can_send_patient_stream(
            public.tracking_topic_booking((select realtime.topic())))
    );

  -- Superseded by the four policies above (kept as a no-op drop so re-running an
  -- older copy of this file cannot leave a stale, laxer policy behind).
  drop policy if exists "carelink_tracking_receive" on realtime.messages;
  drop policy if exists "carelink_tracking_send"    on realtime.messages;

  -- ── Existing private-ish channel: `private-user-<uid>` ──────────────────────
  -- lib/hooks/useSubscription.ts joins a channel NAMED "private-user-<id>" that
  -- is not actually private — same class of hole, different blast radius. Its
  -- policy lands here so the client can be flipped to a real private channel
  -- without a second migration. Only the owning user may listen; the sender is
  -- the service role (which bypasses RLS), so there is no send policy.
  drop policy if exists "carelink_private_user_receive" on realtime.messages;
  create policy "carelink_private_user_receive"
    on realtime.messages for select
    to authenticated
    using (
      realtime.messages.extension in ('broadcast')
      and (select realtime.topic()) = 'private-user-' || (select auth.uid())::text
    );

  -- ── Verification ────────────────────────────────────────────────────────────
  -- Expect carelink_policies = 5 and rls_enabled = true.
  --   4 tracking policies (pro receive/send, patient receive/send)
  -- + 1 private-user receive
  select
    (select count(*) from pg_policies
      where schemaname = 'realtime' and tablename = 'messages'
        and policyname like 'carelink_%')                    as carelink_policies,
    (select relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'realtime' and c.relname = 'messages') as rls_enabled,
    -- Informational: who actually owns the table on this project.
    (select pg_get_userbyid(c.relowner) from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'realtime' and c.relname = 'messages') as messages_owner;
