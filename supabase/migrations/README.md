# CareLink — Database migrations

Ordered, dependency-correct SQL. Applying `0001 → 0021` in order on a **fresh**
Supabase project reproduces the entire backend (tables, RLS, triggers, RPCs,
views, storage buckets, realtime).

## Fresh environment — one command
With the Supabase CLI linked to the project:

```bash
supabase db push          # applies every migration in order
```

Or, without the CLI, paste each file `0001…0021` **in numeric order** into the
SQL Editor.

## Order & what each adds
| # | File | Adds |
|---|------|------|
| 0001 | schema | types, tables, RLS, base functions/triggers, public views |
| 0002 | triggers | notification triggers (new bid / accepted / status / **message**) |
| 0003 | geo | PostGIS helpers + `v_pros_public` distance search |
| 0004 | booking_loop | `accept_bid`, `get_track_coords`, realtime publication |
| 0005 | payments | payments table, commission, capture-on-complete, **payouts** |
| 0006 | commission_20 | platform commission = 20% |
| 0007 | push | `push_subscriptions` + send-to-Expo trigger (`pg_net`) |
| 0008 | kyc_gating | `is_approved_pro` + only approved pros can bid |
| 0009 | kyc_self_approve | trigger blocking pros from self-approving verification |
| 0010 | cancellation_penalty | warnings/suspension + `cancel_with_penalty` |
| 0011 | rating_recalc | `recalc_pro_rating` SECURITY DEFINER (score actually updates) |
| 0012–0014 | pro_documents_* | private `pro-documents` bucket + table & storage RLS |
| 0015 | disputes | disputes table |
| 0016–0017 | admin logs / prodocs notif | admin booking logs + KYC upload notifications |
| 0018 | profile_messaging | profile + messaging additions |
| 0019 | yoga_capacity | yoga session capacity |
| 0020 | hardening | security hardening |
| 0021 | fixes | misc fixes |

## Notes
- **The current production DB was set up by running these manually** and is
  equivalent — do not re-run migrations against it (they'd conflict on existing
  objects). Migrations are for **new** environments.
- Superseded / one-off scripts (old `payments.sql`, `push.sql`, the standalone
  `fix_message_notify.sql`, MFA, backfills) live in `supabase/dev/` and are **not**
  part of the migration path.
- `supabase/dev/` also holds verification scripts (`verify-*.mjs`) — dev-only.
