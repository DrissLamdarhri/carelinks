# 🔄 Fix Yoga Sessions - Real-time Sync & Schema

## ✅ Problèmes résolus

1. **Erreur colonnes manquantes** : Les colonnes `level`, `capacity`, `duration_min`, etc. n'existent pas dans la table
2. **Pas de synchronisation** : Les changements admin n'étaient pas propagés en temps réel

## 🔧 Étapes à suivre

### Étape 1️⃣ : Corriger le schéma Supabase

**TRÈS IMPORTANT** : Exécutez ce script SQL dans Supabase SQL Editor :

1. Allez sur https://app.supabase.com → Votre projet
2. **SQL Editor** → **New Query**
3. Copiez-collez le contenu de : `supabase/fix-yoga-sessions-schema.sql`
4. Cliquez **Run**

```sql
-- Cela ajoutera les colonnes manquantes :
-- - level
-- - image_url
-- - duration_min
-- - capacity
-- - address
-- - is_online
-- - meeting_url
-- - location
```

### Étape 2️⃣ : Tester l'app

```bash
pnpm dev
```

Allez à : http://localhost:5173/admin

### Étape 3️⃣ : Créer une séance yoga

1. Login : `admin@carelink.ma` / `CareLinkAdmin2024!`
2. Onglet **Yoga**
3. Cliquez **"+ Nouvelle séance"**
4. Remplissez le formulaire
5. Sélectionnez une image depuis PC
6. Cliquez **"Créer la séance"** ✅

### Étape 4️⃣ : Tester la synchronisation Realtime

Ouvrez **deux navigateurs** côte à côte :

**Navigateur 1 :** Admin panel
- Créez une nouvelle séance
- Supprimez une séance
- Modifiez une séance

**Navigateur 2 :** Page patients (si disponible)
- Vous devriez voir les changements en **temps réel** ✨

## 🎯 Comment ça marche

### Synchronisation Realtime 
```javascript
// Quand l'admin CRÉE une séance
supabase.from("yoga_sessions").insert(...)
  → Trigger Realtime "INSERT" event
  → Tous les clients reçoivent la mise à jour
  → Liste rafraîchie automatiquement

// Quand l'admin SUPPRIME une séance
supabase.from("yoga_sessions").delete().eq("id", id)
  → Trigger Realtime "DELETE" event
  → Séance disparaît de la liste

// Quand l'admin MODIFIE une séance
supabase.from("yoga_sessions").update(...).eq("id", id)
  → Trigger Realtime "UPDATE" event
  → Les changements s'affichent immédiatement
```

### Architecture
```
Admin Panel (AdminPanel.tsx)
  ↓
  useEffect → Realtime subscription "yoga:changes"
  ↓
  Table yoga_sessions
  ↓
  postgres_changes EVENT
  ↓
  Redéclenche la requête SELECT
  ↓
  setSessions() → setState update
  ↓
  UI re-render avec les nouvelles données ✨
```

## 📝 Colonnes maintenant supportées

| Colonne | Type | Default | Description |
|---------|------|---------|-------------|
| id | uuid | uuid_generate_v4() | ID unique |
| title | text | - | Titre de la séance |
| description | text | null | Description (stocke "Instructeur: ...") |
| level | text | 'Tous niveaux' | Niveau (Débutant/Intermédiaire/Avancé) |
| starts_at | timestamptz | - | Date/heure de la séance |
| duration_min | int | 60 | Durée en minutes |
| capacity | int | 10 | Places disponibles |
| price_mad | numeric | - | Prix en MAD |
| image_url | text | null | URL/base64 de l'image (bonus) |
| address | text | null | Adresse (stocke base64 de l'image) |
| is_online | boolean | false | Est-ce en ligne ? |
| meeting_url | text | null | URL de réunion en ligne |
| instructor_id | uuid | null | Référence au professionnel |
| location | geography | null | Coordinates GPS |

## ✨ Features maintenant actives

✅ **Upload image depuis PC** - Stocké en base64  
✅ **Créer une séance** - Réaltime sync  
✅ **Modifier une séance** - Réaltime sync  
✅ **Supprimer une séance** - Réaltime sync  
✅ **Synchronisation instantanée** - À tous les clients connectés  
✅ **Aucune rechargement page** - Les changements s'affichent directement  

## 🐛 Troubleshooting

### ❌ "Still getting schema error"
→ Le cache Supabase n'a pas été rafraîchi. Attendez 30 secondes et réessayez.

### ❌ "Les séances ne se synchronisent pas"
→ Vérifiez que vous êtes sur la même page admin
→ Ouvrez les DevTools (F12) et regardez la console pour les erreurs

### ❌ "Impossible de créer une séance"
→ Vérifiez que `price_mad` est un nombre valide
→ Vérifiez que `starts_at` est au bon format ISO

## 📚 Fichiers modifiés

- `src/app/components/AdminPanel.tsx` - UI + Realtime sync
- `supabase/fix-yoga-sessions-schema.sql` - Migration schéma
- `supabase/add-image-url-yoga-sessions.sql` - Backup de la migration

---

**Status:** ✅ Ready to test!
