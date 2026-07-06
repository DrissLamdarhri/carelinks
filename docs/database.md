# Database (Supabase / PostgreSQL)

Canonical schema: [`supabase/schema.sql`](../supabase/schema.sql). PostGIS + `uuid-ossp` extensions.
Everything below is Path B (the relational/production model).

## Core tables

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `profiles` | Extends `auth.users` (shared PK) | `role` (enum), `full_name`, `email`, `phone` (E.164, unique), `avatar_url`, `city`, `language`, consent/policy fields, `mfa_enabled`, `mfa_method` |
| `patients` | 1:1 with profiles | `date_of_birth`, `gender`, `emergency_contact_phone`, `medical_notes` |
| `professionals` | 1:1 with profiles | `specialty`, `bio`, `years_experience`, `hourly_rate_mad`, `verification_status`, `rating_avg`/`rating_count` (trigger-maintained), `is_available`, `location` (geography), `service_radius_km` |
| `services` | Master catalog (seeded) | `specialty`, `name`, `base_price_mad`, `duration_min` |
| `pro_services` | N:M pros ↔ services | `custom_price_mad` |
| `pro_documents` | KYC docs | `doc_type` (diploma/license/id), `storage_path`, `is_verified` |
| `bookings` | Patient care request | `patient_id`, `specialty`, `professional_id` (null until matched), `status`, `urgency`, `scheduled_at`, `address`, `location`, budget/`final_price_mad` |
| `bids` | Pro offer on a booking | `booking_id`, `professional_id`, `price_mad`, `eta_min`, `status`; unique(booking_id, professional_id) |
| `ratings` | Patient → pro review | `booking_id` (unique), `stars` 1–5, `comment` |
| `yoga_sessions` / `yoga_enrollments` | Group yoga classes | `capacity`, `price_mad`, `starts_at`; enrollment capacity enforced by trigger |
| `messages` | 1:1 chat tied to a booking | `booking_id`, `sender_id`, `body`, `read_at` |
| `notifications` | In-app notifications | `user_id`, `kind`, `title`, `body`, `payload` (jsonb), `is_read` |

Added by later SQL files: `payments`, `push_subscriptions`, `addresses`, `notification_settings`,
`mfa_backup_codes`, `audit_log`, `admin_booking_logs`, and the `conversations`/`conversation_messages`
messaging model.

## Enums

`user_role` (patient/professional/admin) · `pro_specialty` (nurse/psychologist/yoga_instructor/
physiotherapist) · `verification_status` (pending/approved/rejected) · `booking_status`
(open/matched/in_progress/completed/cancelled) · `bid_status` (pending/accepted/rejected/withdrawn) ·
`urgency_level` (normal/urgent/emergency) · `notification_kind` (new_bid/bid_accepted/booking_status/
message/system) · `payment_status` (pending/authorized/captured/refunded/failed) · `payment_provider`
(cmi/stripe/cash).

> **Specialty mapping:** UI keys (yoga, psy, kine, "Injection IM"…) are normalized to the enum by
> `toDbSpecialty()` — present in `mobile-app/lib/db/types.ts`, `src/…`, and the Edge Function. Keep the three
> copies in sync.

## RLS (Row-Level Security) — the model

All tables have RLS enabled. A `security definer` helper `current_role()` returns the caller's role without
recursing. Representative policies:

- **profiles:** self read/write; admins read all.
- **professionals:** public read when `verification_status='approved'` (or self/admin); self write; admin all.
- **bookings:** patient owns theirs; pros can read `open` bookings + ones they're matched to; admin all.
- **bids:** pro writes their own; the booking's patient reads them; admin reads.
- **messages:** only the booking's patient/professional participants.
- **notifications / addresses / notification_settings:** owner only.
- **pro_documents:** owner pro + admin.

## Triggers & RPCs

- **`handle_new_user`** (on `auth.users` insert) — auto-creates `public.profiles` (role from metadata,
  default `patient`). `supabase/triggers.sql`.
- **`set_updated_at`** — maintains `updated_at` on profiles/professionals/bookings.
- **`recalc_pro_rating`** — recomputes `professionals.rating_avg`/`rating_count` after any `ratings` change.
- **`increment_pro_bookings`** — bumps `total_bookings` when a booking hits `completed`.
- **Notification triggers** (`triggers.sql`): `notify_new_bid`, `notify_bid_accepted`,
  `notify_booking_status`, `notify_new_message` — insert `notifications` rows.
- **`capture_on_complete`** (`payments.sql`) — authorize→capture→refund payment following booking status.
- **`enforce_yoga_capacity`** — blocks over-capacity enrollment.
- **`log_booking_to_admin`** (`admin-booking-logs.sql`) — mirrors bookings into `admin_booking_logs` with
  `alert_level` (psychologist + urgent/emergency ⇒ critical).
- **RPCs:** `nearby_pros(lat,lng,specialty,radius)` and `find_pros_within(booking_id, radius_km)` (PostGIS
  `ST_DWithin`); `set_pro_location`, `set_booking_location`, `open_dispute`.
- **View:** `v_pros_public` — approved pros joined with profile + lat/lng.

## SQL file set & run order

Per [`supabase/RUNBOOK.md`](../supabase/RUNBOOK.md), apply in this order:

1. `schema.sql` — 12 core tables, enums, RLS, `v_pros_public`, `nearby_pros`.
2. `triggers.sql` — notification triggers, `handle_new_user`, realtime publication.
3. `geo.sql` — PostGIS columns, GIST indexes, geo RPCs.
4. `payments.sql` — payments table + escrow triggers + 15% commission.
5. `yoga-capacity.sql` — enrollment capacity trigger.
6. `disputes.sql` — dispute columns + `open_dispute`.
7. `push.sql` — `push_subscriptions` + `profiles.locale`.
8. `hardening.sql` — bid rate-limit, `audit_log`, availability guard.

Apply separately as needed: `mfa.sql`, `profile-messaging.sql` (addresses / notification_settings /
conversations), `admin-booking-logs.sql`, `backfill_admin_booking_logs_yoga.sql`.

### ⚠️ Do NOT run these in production

- `fixes.sql` — consolidated dev fixes; **loosens RLS** (`profiles_insert WITH CHECK (true)`, pro insert when
  `auth.uid() IS NULL`), creates public `avatars` bucket.
- `fix-rls-policies.sql` — allows **public (anyone) uploads** to `pro-documents`.
- `fix-rls-policies-option2.sql` — **"nuclear": disables RLS on `storage.objects` globally.**

These exist to unblock local dev. See [tech-debt-and-security.md](tech-debt-and-security.md).

## Schema gaps (referenced in code but not fully in checked-in SQL)

- **`subscriptions`** table — queried by `mobile-app/lib/hooks/useSubscription.ts`; no DDL in `supabase/`.
- **`push_subscriptions` mobile columns** — mobile upserts `expo_push_token` + `platform`, but `push.sql`
  only defines `endpoint` + `payload` (web shape).
- **`admin_booking_logs`** exists in `admin-booking-logs.sql` but depends on an assumed
  `update_updated_at_column()` helper.

## Storage buckets

- **`avatars`** (public) — created in `fixes.sql`; own-folder write policy keyed on `auth.uid()`.
- **`pro-documents`** (private per RUNBOOK) — own-folder policy intended, but the `fix-rls-*.sql` scripts
  loosen/disable it. Used by KYC upload (`KycUploader` web, `useDocumentPicker`/`lib/db/storage.ts` mobile).
