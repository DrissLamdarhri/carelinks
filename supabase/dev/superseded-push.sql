-- Push subscriptions + locale on profile
alter table public.profiles add column if not exists locale text default 'fr';

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;
create policy "push_self" on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
