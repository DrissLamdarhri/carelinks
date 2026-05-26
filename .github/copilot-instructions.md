# Copilot instructions for CareLink

## Build, test, lint
- Web admin (Vite, repo root): `pnpm build` (build), `pnpm dev` (serve `/admin` locally).
- Mobile workspace app (Expo SDK 54): `pnpm -C mobile start` (or `start:online`), `pnpm -C mobile android`, `pnpm -C mobile ios`, `pnpm -C mobile build:preview` / `pnpm -C mobile build:prod`.
- Standalone `mobile-app` (not in pnpm workspace): `pnpm -C mobile-app start` / `start:usb` / `start:online`, `pnpm -C mobile-app lint`, `pnpm -C mobile-app type-check`, `pnpm -C mobile-app build`.

## High-level architecture
- Monorepo with pnpm workspaces: root web app (Vite + React Router), `shared/` package, and `mobile/` Expo app; `supabase/` contains edge functions and SQL schemas.
- Web app in `src/` renders a mobile-preview shell for patient/pro flows and exposes admin pages at `/admin` (see `src/app/routes.tsx`).
- Mobile app in `mobile/` uses Expo Router file-based routes (`app/(auth)`, `app/(patient)`, `app/(pro)`); `app/index.tsx` redirects by auth role.
- Shared data/auth layer lives in `shared/` and is consumed by the mobile app (Supabase client, auth context, i18n, realtime).

## Key conventions
- Install dependencies from repo root with `pnpm install`; workspace packages (`shared`, `mobile`) are linked there. `mobile-app` is separate and managed with its own `pnpm -C mobile-app ...`.
- Mobile uses shared providers from `shared/auth-context.tsx`, `shared/i18n.tsx`, and `shared/supabase.ts`; root layout `mobile/app/_layout.tsx` wires them and handles OAuth deep links.
- Supabase config differs by platform: web uses `utils/supabase/info.ts` (projectId/publicAnonKey), mobile reads `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `shared/supabase.ts` (with fallbacks).
- Metro is configured for monorepo in `mobile/metro.config.js` (watchFolders + extraNodeModules). Keep this pattern when adding RN deps to avoid duplicate React.
- `mobile-app` scripts hardcode `REACT_NATIVE_PACKAGER_HOSTNAME`; update the IP in `mobile-app/package.json` when running on a different network.
