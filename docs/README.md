# CareLink — Developer Docs

Internal engineering documentation for the CareLink home-care marketplace. Start with the root
[`CLAUDE.md`](../CLAUDE.md) for the 5-minute orientation, then dive into the topic you need.

| Doc | Read it when you… |
|-----|-------------------|
| [architecture.md](architecture.md) | Need the big picture: monorepo, the two backends, the marketplace flow, auth/roles |
| [database.md](database.md) | Touch the DB: tables, enums, RLS, triggers, RPCs, the SQL file set + run order |
| [mobile-app.md](mobile-app.md) | Work in `mobile-app/`: routes, user flows, `lib/` modules, hooks, state |
| [web-app.md](web-app.md) | Work in `src/`: components by domain, which data path each uses, admin |
| [backend-realtime-push.md](backend-realtime-push.md) | Touch Edge Functions, Realtime channels, or push notifications |
| [maps-i18n-design.md](maps-i18n-design.md) | Touch the map, localization, theming/brand, or subscriptions/paywall |
| [map-system-audit.md](map-system-audit.md) | Work on the map: surface inventory, what's done, ranked issues/roadmap |
| [real-map-setup.md](real-map-setup.md) | **The real map (react-native-maps) — chosen path.** Setup, cost, verify, rollback |
| [map-option-b-maplibre.md](map-option-b-maplibre.md) | Alternative: MapLibre + MapTiler (only if you need pixel-perfect custom cartography) |
| [tech-debt-and-security.md](tech-debt-and-security.md) | Before shipping — dead code, duplication, and security landmines |
| [setup-and-deployment.md](setup-and-deployment.md) | Set up locally or deploy the DB / Edge Functions / mobile build |

## Product in one paragraph

Patients in Morocco request home care (nurse / psychologist / yoga instructor / physiotherapist). The
request fans out to nearby verified professionals who submit competitive bids (reverse auction). The patient
accepts a bid, then gets live GPS tracking, in-app chat, payment (CMI/Stripe/cash), and rates the pro
afterward. Pros go through KYC document verification + MFA. Admins moderate KYC and monitor bookings.
Everything runs on Supabase; prices are in **MAD**; the default UI language is **French**.

## The single most important caveat

There are **two unsynchronized backends** with **incompatible data models** — a KV-based Edge Function
(web/demo) and direct Postgres tables (mobile/production). See
[architecture.md § Dual data path](architecture.md#the-dual-data-path). Build on the relational tables.
