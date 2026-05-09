# CareLink — Guide de démarrage local (SDK 54)

## Architecture du monorepo

```
carelink/
├── src/          ← Web Vite  →  Admin panel uniquement (/admin)
├── shared/       ← @carelink/shared  →  Supabase, auth, types, realtime
├── mobile/       ← Expo SDK 54  →  App patient + pro
└── supabase/     ← Edge Functions + SQL schemas
```

---

## Prérequis

| Outil | Version | Installation |
|---|---|---|
| Node.js | **18+** | https://nodejs.org |
| pnpm | **9+** | `npm install -g pnpm` |
| Expo Go | **SDK 54** | App Store / Play Store |

```bash
# Vérifiez vos versions
node -v    # doit afficher v18+
pnpm -v    # doit afficher 9+
```

---

## Étape 1 — Télécharger le projet depuis Figma Make

Dans Figma Make → **"Export"** ou **"Download code"** → extrayez le `.zip`

---

## Étape 2 — Installer toutes les dépendances

```bash
cd carelink/      # ← racine du monorepo
pnpm install      # installe root + shared + mobile en une fois
```

---

## Étape 3 — Corriger automatiquement les versions (optionnel mais recommandé)

```bash
cd mobile
npx expo install --fix   # Expo détecte et corrige toutes les versions peer
pnpm install             # réinstalle avec les corrections
```

---

## Étape 4 — Lancer l'app sur votre téléphone

```bash
cd mobile
npx expo start --clear
```

**QR code affiché dans le terminal :**
- 📱 **iOS** → ouvrez l'Appareil Photo et scannez
- 🤖 **Android** → ouvrez **Expo Go** et scannez

> ⚠️ Téléphone + ordinateur = **même réseau Wi-Fi**

---

## Admin panel (web local)

```bash
cd carelink/      # racine
npx vite          # → http://localhost:5173
# Allez sur http://localhost:5173/admin
```

---

## Portails

| Portail | Utilisateur | Plateforme |
|---|---|---|
| `/(patient)` | Patients | 📱 Expo Go |
| `/(pro)` | Infirmiers, kinés... | 📱 Expo Go |
| `/admin` | Vous | 🖥️ Navigateur |

---

## Dépannage

### Erreur "SDK mismatch"
```bash
cd mobile && npx expo install --fix && cd .. && pnpm install
```

### "Can't resolve @carelink/shared"
```bash
# Toujours lancer depuis la racine d'abord
cd carelink/ && pnpm install
cd mobile && npx expo start --clear
```

### Expo Go plante / écran blanc
→ Vérifiez même Wi-Fi, relancez avec `npx expo start --clear`

### NativeWind ne s'applique pas
→ Le `--clear` vide le cache Tailwind/Metro — obligatoire après changement CSS

### Supabase "Network error"
→ Les credentials sont hardcodés dans `shared/supabase.ts` — aucun `.env` requis pour dev

---

## Versions SDK 54 (package.json mobile/)

| Package | Version |
|---|---|
| expo | ~54.0.0 |
| react-native | 0.79.2 |
| expo-router | ~5.0.0 |
| react-native-reanimated | ~3.17.0 |
| react-native-safe-area-context | 5.0.0 |
| nativewind | ^4.1.23 |
