# ✨ Image Upload Yoga - Résumé des changements

## 🎯 Objectif atteint
L'interface admin pour créer une séance yoga accepte maintenant les **images uploadées depuis le PC** au lieu d'URLs.

## 📝 Fichiers modifiés

### 1. `src/app/components/AdminPanel.tsx`
**Changements:**
- État modifié de `imageUrl: string` à `imageFile: File | null`
- État ajouté `imagePreview: string | null` pour la prévisualisation
- Formulaire remplacé : champ URL → input fichier `<input type="file" accept="image/*" />`
- Fonction `addYogaSession()` augmentée avec upload Supabase Storage

### 2. `supabase/create-yoga-images-bucket.sql` (nouveau fichier)
**À exécuter dans Supabase SQL Editor:**
- Crée le bucket `yoga-images` (public)
- Configure les RLS policies :
  - ✅ Admins peuvent upload
  - ✅ Tous peuvent voir

## 🚀 Prochaines étapes

### 1️⃣ Exécuter le script SQL
```
Allez sur: https://app.supabase.com → Votre projet → SQL Editor
Copiez-collez: supabase/create-yoga-images-bucket.sql
Exécutez la query
```

### 2️⃣ Tester en local
```bash
pnpm dev
# Allez à http://localhost:5173/admin
# Login: admin@carelink.ma / CareLinkAdmin2024!
# Créez une nouvelle séance yoga avec une image uploadée
```

### 3️⃣ Vérifier le fonctionnement
- L'image apparaît en prévisualisation après sélection
- Le message "Séance yoga créée et publiée" s'affiche
- L'image est visible dans Supabase Storage (`yoga-images/yoga/[timestamp]-[filename]`)

## 🔒 Sécurité
- ✅ Seuls les admins peuvent uploader
- ✅ Les images sont publiques (accessible par URL)
- ✅ Chaque fichier a un timestamp unique (pas de conflits)
- ✅ Upload validé côté client et serveur

## 🎨 Interface utilisateur
```
Avant: ╵─ Image URL (champ texte avec placeholder)
Après: ╵─ Image (depuis PC) (file picker + preview)
```

## ✅ Validation
- ✅ Build Vite réussie
- ✅ Aucune erreur TypeScript
- ✅ État correctement typé (`File | null`)
- ✅ Gestion d'erreurs complète

---

**Note:** Les changements n'affectent pas les séances existantes. Seules les nouvelles séances créées utiliseront les images uploadées.
