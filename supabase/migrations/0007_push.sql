-- ============================================================================
-- CareLink — Push notifications: make them actually fire.
-- Run once in Supabase → SQL Editor. Idempotent.
--   1. Rebuild push_subscriptions to match the app (expo_push_token + platform).
--   2. On every notifications insert, POST to the Expo Push API via pg_net
--      (no edge function needed) → the user's device gets a real push.
-- ============================================================================

-- ── 1. push_subscriptions (one token per user) ──────────────────────────────
-- Safe to drop: the old shape (endpoint/payload) never matched the client, so
-- no tokens were ever stored.
drop table if exists public.push_subscriptions cascade;
create table public.push_subscriptions (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  platform        text,
  updated_at      timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
create policy "push_self" on public.push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 2. Auto-send to Expo on notification insert ─────────────────────────────
create extension if not exists pg_net;

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
          'kind',       new.kind
        )
      )
    );
  end loop;
  return new;
end $$;

drop trigger if exists trg_send_push on public.notifications;
create trigger trg_send_push after insert on public.notifications
  for each row execute function public.send_push_on_notification();

-- ── Sanity ──────────────────────────────────────────────────────────────────
select
  (select 1 from information_schema.columns
    where table_name = 'push_subscriptions' and column_name = 'expo_push_token') as token_col_ok,
  (select 1 from pg_extension where extname = 'pg_net')                          as pg_net_ok,
  (select 1 from pg_trigger where tgname = 'trg_send_push')                      as send_trigger_ok;
