# CareLink — Full Supabase Runbook

Run files in this order in **SQL Editor**:

1. `schema.sql` — 12 tables, RLS, enums, base triggers
2. `triggers.sql` — notification triggers + auth user → profile
3. `geo.sql` — PostGIS columns + `find_pros_within` RPC
4. `payments.sql` — payments table + capture-on-complete trigger
5. `yoga-capacity.sql` — server-side enrollment guard
6. `disputes.sql` — cancel reason + dispute flag + open_dispute RPC
7. `push.sql` — push_subscriptions + profiles.locale
8. `hardening.sql` — bid rate-limit + audit log + availability guard

## Buckets
```sql
insert into storage.buckets (id,name,public) values ('pro-documents','pro-documents',false)
on conflict do nothing;
```
Storage policy (own folder):
```sql
create policy "pros own files"
on storage.objects for all to authenticated
using (bucket_id = 'pro-documents' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'pro-documents' and (storage.foldername(name))[1] = auth.uid()::text);
```

## Auth
- Authentication → URL Configuration → Site URL = your Figma Make preview URL
- Authentication → Providers → Google → enable + paste Client ID / Secret

## Replication
Database → Replication → enable on: `notifications`, `bids`, `bookings`, `messages`, `payments`.
