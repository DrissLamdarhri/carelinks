  -- ============================================================================
  -- CareLink — yoga: push reminder 2h before class starts.
  -- Run once in Supabase → SQL Editor. Idempotent.
  --
  -- WHY: nothing reminded a patient their class was coming up — the first time
  -- they'd think about it again was whenever they happened to open the app.
  -- No-shows on a fixed-capacity class (unlike an on-demand booking) waste a
  -- seat someone else could have taken.
  --
  -- HOW PUSH ACTUALLY GETS SENT (checked directly — no new send path needed):
  -- `public.notifications` already has an AFTER INSERT trigger
  -- (send_push_on_notification, 0007_push.sql) that POSTs to Expo's push API
  -- for every row inserted, using whatever's in push_subscriptions for that
  -- user_id. So this migration only has to INSERT into notifications at the
  -- right time — the same pattern 0037/0041 already use for other reminders/
  -- notices, not a new push mechanism.
  --
  -- Dedup: reminder_sent_at lives on yoga_enrollments (not yoga_sessions) so a
  -- patient who enrolls AFTER the reminder already fired for existing
  -- attendees still gets their own reminder later, instead of silently missing
  -- it forever because the session-level flag was already set.
  -- ============================================================================

  alter table public.yoga_enrollments
    add column if not exists reminder_sent_at timestamptz;

  -- send_push_on_notification() (0007_push.sql) only forwards `booking_id` and
  -- `kind` into the push tap payload — not the rest of `payload`. The app's tap
  -- handler needs to tell "your class starts soon" apart from an ordinary
  -- booking_status push (e.g. a cancellation) so it can open the class recap
  -- popup instead of a live tracking screen. Widening this one field is
  -- additive and backward-compatible: every existing consumer only ever reads
  -- `data.booking_id`, so nothing else changes behavior.
  create or replace function public.send_push_on_notification()
  returns trigger language plpgsql security definer
  set search_path = public, net, extensions as $$
  declare tok text;
  begin
    for tok in
      select expo_push_token from public.push_subscriptions where user_id = new.user_id
    loop
      perform net.http_post(
        url     := 'https://exp.host/--/api/v2/push/send',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body    := jsonb_build_object(
          'to',    tok,
          'title', coalesce(new.title, 'CareLink'),
          'body',  coalesce(new.body, ''),
          'sound', 'default',
          'data',  jsonb_build_object(
            'booking_id', new.payload ->> 'booking_id',
            'kind',       new.kind,
            'type',       new.payload ->> 'type'
          )
        )
      );
    end loop;
    return new;
  end $$;

  create or replace function public.send_yoga_class_reminders()
  returns integer
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    v_count integer := 0;
    r record;
  begin
    for r in
      select e.session_id, e.patient_id, e.booking_id,
            s.title, s.address, s.city, s.starts_at
        from public.yoga_enrollments e
        join public.yoga_sessions s on s.id = e.session_id
      where s.status = 'scheduled'
        and e.reminder_sent_at is null
        and s.starts_at > now()
        and s.starts_at <= now() + interval '2 hours'
    loop
      insert into public.notifications (user_id, kind, title, body, payload)
      values (
        r.patient_id,
        'booking_status',
        'Votre cours de yoga commence bientôt',
        '"' || r.title || '" débute à ' || to_char(r.starts_at, 'HH24:MI') ||
          coalesce(' · ' || r.address, '') || coalesce(', ' || r.city, '') || '.',
        jsonb_build_object(
          'type', 'yoga_class_reminder',
          'session_id', r.session_id,
          'booking_id', r.booking_id
        )
      );

      update public.yoga_enrollments
        set reminder_sent_at = now()
      where session_id = r.session_id and patient_id = r.patient_id;

      v_count := v_count + 1;
    end loop;

    return v_count;
  end $$;

  grant execute on function public.send_yoga_class_reminders() to authenticated;

  create extension if not exists pg_cron with schema extensions;

  select cron.schedule(
    'send-yoga-class-reminders',
    '*/5 * * * *',
    $$ select public.send_yoga_class_reminders(); $$
  );

  -- ── Sanity ───────────────────────────────────────────────────────────────────
  select
    (select count(*) from pg_proc where proname = 'send_yoga_class_reminders') as reminder_fn_ok,
    (select count(*) from cron.job where jobname = 'send-yoga-class-reminders') as cron_job_ok,
    (select count(*) from information_schema.columns
      where table_name = 'yoga_enrollments' and column_name = 'reminder_sent_at') as reminder_col_ok;
