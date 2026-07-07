# 📸 Upload Image Yoga - Guide d'implémentation

## ✅ Changements effectués

### 1. **AdminPanel.tsx** - Modifications du formulaire
- ✅ Remplacé le champ d'URL image par un **input fichier** avec sélection depuis le PC
- ✅ Ajouté la **prévisualisation d'image** en temps réel
- ✅ Modifié l'état pour stocker `imageFile: File | null` au lieu de `imageUrl: string`
- ✅ Ajouté `imagePreview` state pour afficher la prévisualisation

### 2. **addYogaSession()** - Fonction d'upload
- ✅ **Upload vers Supabase Storage** : le fichier est uploadé dans le bucket `yoga-images`
- ✅ **Génération d'URL publique** : récupération automatique de l'URL pour la base de données
- ✅ **Gestion d'erreurs** : validation du fichier et gestion des erreurs d'upload

### 3. **Bucket Supabase** - Configuration
- ✅ Fichier SQL créé : `supabase/create-yoga-images-bucket.sql`
- 🔧 **À faire** : Exécuter ce script dans l'éditeur SQL de Supabase

## 🚀 Étapes de mise en œuvre

### Étape 1️⃣ : Créer le bucket Supabase Storage

1. Allez sur https://app.supabase.com/projects
2. Sélectionnez votre projet (ref: `wjhzrovmktekfcjohhrw`)
3. Allez dans **SQL Editor**
4. Créez une nouvelle query
5. Copiez le contenu de `supabase/create-yoga-images-bucket.sql`
6. Exécutez la query

**OU via CLI:**
```bash
supabase db execute --file supabase/create-yoga-images-bucket.sql
```

### Étape 2️⃣ : Tester en local

```bash
# Depuis la racine du projet
pnpm dev

# Allez à http://localhost:5173/admin
# Connexion admin : admin@carelink.ma / CareLinkAdmin2024!
# Accédez à l'onglet "Yoga"
```

### Étape 3️⃣ : Tester la création de séance

1. Cliquez sur **"+ Nouvelle séance"**
2. Remplissez les champs :
   - Titre : ex. "Hatha Flow Matinal"
   - Instructeur : ex. "Sarah"
   - Date & Heure : selectionnez une date
   - Places max : 10
   - Prix : 120 MAD
   - **Niveau** : sélectionnez (ex. Débutant)
   - **Image** : cliquez et uploadez une image depuis votre PC ✨
3. La prévisualisation s'affiche
4. Cliquez **"Créer la séance"**
5. L'image est uploadée vers Supabase Storage et sauvegardée

## 🎯 Fonctionnalités

✅ **Upload local** : sélection fichier depuis PC au lieu d'URL  
✅ **Prévisualisation** : affichage immédiat de l'image sélectionnée  
✅ **Stockage Supabase** : persévérance et accès public via URL  
✅ **RLS Sécurisé** : seuls les admins peuvent uploader  
✅ **Accès public** : les images sont visibles par tous  

## 🔒 Sécurité

- Les admins seuls peuvent uploader des images via la politique `"admins upload yoga images"`
- Les images sont stockées dans un bucket public `yoga-images`
- Tous les utilisateurs peuvent voir les images
- Les fichiers sont organisés dans des dossiers `yoga/` avec timestamp pour éviter les conflits

## 🐛 Troubleshooting

### ❌ "Le bucket yoga-images n'existe pas"
→ Exécutez le script SQL `supabase/create-yoga-images-bucket.sql` dans Supabase

### ❌ "Erreur upload: insufficient_quota ou permission denied"
→ Vérifiez que votre user_id a le rôle 'admin' dans la table `profiles`

### ❌ "Image ne s'affiche pas après création"
→ Vérifiez que la RLS policy `"public view yoga images"` est activée

## 📝 Notes
- Les images sont stockées indéfiniment (à moins d'implémenter une politique de rétention)
- Taille max recommandée : 5 MB par image
- Formats supportés : JPG, PNG, GIF, WebP
