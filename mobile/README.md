# CareLink Mobile (React Native + Expo Router)

Application mobile CareLink — réutilise `shared/` (DAL, auth, i18n, realtime) avec le portail web.

## Stack

- **Expo SDK 53** (React Native 0.76, React 18.3)
- **expo-router 4** (file-based routing, typed routes)
- **NativeWind 4** (Tailwind CSS pour RN)
- **Supabase JS** (auth PKCE + AsyncStorage, realtime)
- **DM Sans / DM Serif Display** via `@expo-google-fonts`

## Prérequis

- Node.js 20+
- pnpm 9+
- Expo Go app (iOS/Android) ou un simulateur Xcode/Android Studio

## Installation locale (VS Code)

```bash
# Depuis la racine du monorepo
pnpm install

# Configurer les variables d'environnement
cd mobile
cp .env.example .env
# → édite .env avec ton URL et anon key Supabase

# Lancer Metro
pnpm start
```

Scanne le QR code avec **Expo Go** (Android) ou l'app **Camera** (iOS).

## Scripts

| Commande              | Action                              |
|-----------------------|-------------------------------------|
| `pnpm start`          | Lance Metro bundler (`expo start --clear`) |
| `pnpm android`        | Ouvre sur émulateur Android         |
| `pnpm ios`            | Ouvre sur simulateur iOS            |
| `pnpm build:preview`  | Build EAS interne (Android+iOS)     |
| `pnpm build:prod`     | Build EAS production                |

## Structure

```
mobile/
├── app/                          # expo-router (file-based)
│   ├── _layout.tsx               # Root: AuthProvider + I18n + fonts + deep-links
│   ├── index.tsx                 # Redirect selon auth/role
│   ├── (auth)/                   # Login (Google + email/password)
│   ├── (patient)/                # Portail patient (tabs)
│   └── (pro)/                    # Portail professionnel (tabs)
├── app.json                      # Config Expo (sans assets pour démarrage rapide)
├── babel.config.js               # NativeWind preset + reanimated plugin
├── metro.config.js               # NativeWind + monorepo (watchFolders)
├── tailwind.config.js            # Couleurs CareLink + fonts DM
├── global.css                    # @tailwind directives
├── tsconfig.json                 # Étend expo/tsconfig.base + alias shared
└── eas.json                      # EAS Build profiles
```

Le code partagé avec le web vit dans `../shared/` :

- `supabase.ts` — client Supabase (PKCE + AsyncStorage)
- `auth-context.tsx` — `<AuthProvider>` + Google Sign-In via expo-auth-session
- `db/` — DAL + hooks Realtime
- `i18n.ts` — Provider FR/AR
- `push-native.ts` — Expo Push tokens

## Ajouter les assets (optionnel)

Pour personnaliser icône/splash, place ces fichiers dans `mobile/assets/` :

- `icon.png` (1024×1024)
- `splash.png` (1284×2778, fond `#0D0870`)
- `adaptive-icon.png` (1024×1024, foreground)
- `notification-icon.png` (96×96, monochrome blanc)

Puis remets les chemins correspondants dans `app.json` (`expo.icon`, `expo.splash.image`,
`expo.android.adaptiveIcon.foregroundImage`, plugin `expo-notifications.icon`).

Pour les builds Android avec FCM, ajoute `google-services.json` à la racine de `mobile/`
et la ligne `"googleServicesFile": "./google-services.json"` dans `app.json` → `android`.

## Resolver de monorepo

`metro.config.js` ajoute `workspaceRoot` à `watchFolders` pour que Metro résolve
`@carelink/shared` depuis `../shared/`. `tsconfig.json` a l'alias correspondant.

## Troubleshooting

- **`Unable to resolve @carelink/shared`** → relancer `pnpm install` à la racine, puis `pnpm start --clear`.
- **`expo-router` typed routes error** → supprime `.expo/` et relance.
- **Fonts ne s'affichent pas** → vérifier qu'`useFonts` charge avant le rendu (déjà géré dans `_layout.tsx`).
