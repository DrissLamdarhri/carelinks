-- ============================================================================
-- CareLink — Profile settings & messaging backend extensions
-- ----------------------------------------------------------------------------
-- Run in Supabase SQL Editor after schema.sql
-- ============================================================================

-- ── Profiles: policy + consent fields ───────────────────────────────────────
alter table public.profiles
  add column if not exists policy_version text,
  add column if not exists policy_accepted_at timestamptz,
  add column if not exists consent_share_data boolean default true,
  add column if not exists consent_reminders boolean default true,
  add column if not exists consent_analytics boolean default true;

-- ── Saved addresses ─────────────────────────────────────────────────────────
create table if not exists public.addresses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text,
  street text not null,
  city text not null,
  postal_code text not null,
  country text not null default 'Maroc',
  notes text,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_addresses_user on public.addresses(user_id, created_at desc);
create unique index if not exists uniq_addresses_default on public.addresses(user_id) where is_default;

-- ── Notification preferences ────────────────────────────────────────────────
create table if not exists public.notification_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean default true,
  email_enabled boolean default true,
  sms_enabled boolean default false,
  appointment_enabled boolean default true,
  messages_enabled boolean default true,
  reminders_enabled boolean default true,
  security_enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Messaging backend (conversations + receipts) ────────────────────────────
create table if not exists public.conversations (
  id uuid primary key default uuid_generate_v4(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamptz default now()
);
create unique index if not exists uniq_conversations_booking on public.conversations(booking_id) where booking_id is not null;

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role user_role,
  joined_at timestamptz default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);
create index if not exists idx_conv_participants_user on public.conversation_participants(user_id, joined_at desc);

create table if not exists public.conversation_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  type text default 'text',
  attachment_url text,
  created_at timestamptz default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index if not exists idx_conv_messages_conv on public.conversation_messages(conversation_id, created_at);

create table if not exists public.message_receipts (
  message_id uuid not null references public.conversation_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, user_id)
);

-- ── Triggers: updated_at ─────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_addresses_updated') then
    create trigger trg_addresses_updated
      before update on public.addresses
      for each row execute function public.set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_notification_settings_updated') then
    create trigger trg_notification_settings_updated
      before update on public.notification_settings
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.addresses enable row level security;
alter table public.notification_settings enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.message_receipts enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'addresses_owner') then
    create policy "addresses_owner"
      on public.addresses for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'notification_settings_owner') then
    create policy "notification_settings_owner"
      on public.notification_settings for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'conversations_participant_read') then
    create policy "conversations_participant_read"
      on public.conversations for select
      using (
        exists (
          select 1 from public.conversation_participants cp
          where cp.conversation_id = id and cp.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'conversations_creator_insert') then
    create policy "conversations_creator_insert"
      on public.conversations for insert
      with check (auth.uid() = created_by);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'conversation_participants_read') then
    create policy "conversation_participants_read"
      on public.conversation_participants for select
      using (
        auth.uid() = user_id
        or exists (
          select 1 from public.conversation_participants cp
          where cp.conversation_id = conversation_id and cp.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'conversation_participants_self_write') then
    create policy "conversation_participants_self_write"
      on public.conversation_participants for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'conversation_messages_read') then
    create policy "conversation_messages_read"
      on public.conversation_messages for select
      using (
        exists (
          select 1 from public.conversation_participants cp
          where cp.conversation_id = conversation_id and cp.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'conversation_messages_send') then
    create policy "conversation_messages_send"
      on public.conversation_messages for insert
      with check (
        sender_id = auth.uid()
        and exists (
          select 1 from public.conversation_participants cp
          where cp.conversation_id = conversation_id and cp.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'conversation_messages_edit') then
    create policy "conversation_messages_edit"
      on public.conversation_messages for update
      using (sender_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'message_receipts_self') then
    create policy "message_receipts_self"
      on public.message_receipts for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
