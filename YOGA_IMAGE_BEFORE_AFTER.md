# 📸 Comparaison Avant / Après - Image Upload Yoga

## 🔄 Avant (Ancieen système)
```
┌─────────────────────────────────────────┐
│ Nouvelle séance yoga                    │
├─────────────────────────────────────────┤
│ Titre de la séance: [cc             ]  │
│ Instructeur: [ccccccccccccccccc     ]  │
│ Date & Heure: [16/07/2026] [10:00]  │
│ Places max: [10]  Prix (MAD): [120] │
│ Niveau: [Débutant]  [Intermédiaire] │
│           [Avancé]  [Tous niveaux]  │
│                                     │
│ Image URL:                          │
│ [https://example.com/image.jpg    ] │  ← Champ texte pour URL
│                                     │
│ ┌─────────────────────────────────┐│
│ │  (preview si URL valide)        ││
│ └─────────────────────────────────┘│
│                                     │
│ [Annuler]      [Créer la séance]    │
└─────────────────────────────────────┘
```

**Problèmes:**
- ❌ Utilisateur doit trouver une URL online
- ❌ Pas de validation avant sélection
- ❌ Dépendance à un serveur externe


## ✨ Après (Nouveau système)
```
┌─────────────────────────────────────────┐
│ Nouvelle séance yoga                    │
├─────────────────────────────────────────┤
│ Titre de la séance: [cc             ]  │
│ Instructeur: [ccccccccccccccccc     ]  │
│ Date & Heure: [16/07/2026] [10:00]  │
│ Places max: [10]  Prix (MAD): [120] │
│ Niveau: [Débutant]  [Intermédiaire] │
│           [Avancé]  [Tous niveaux]  │
│                                     │
│ Image (depuis PC):                  │
│ [Choisir un fichier...           ]  │  ← File picker
│                                     │
│ ┌─────────────────────────────────┐│
│ │  📸 Prévisualisation:           ││
│ │  (s'affiche immédiatement)      ││
│ │  ┌─────────────────────────┐   ││
│ │  │                         │   ││
│ │  │   [Image Preview]       │   ││
│ │  │                         │   ││
│ │  └─────────────────────────┘   ││
│ └─────────────────────────────────┘│
│                                     │
│ [Annuler]      [Créer la séance]    │
└─────────────────────────────────────┘
```

**Avantages:**
- ✅ Sélectionner une image depuis le PC directement
- ✅ Prévisualisation instantanée
- ✅ Upload sécurisé vers Supabase Storage
- ✅ Pas de dépendance externe
- ✅ URL auto-générée et sauvegardée


## 🔧 Flux d'utilisation

```
┌──────────────────────────────────────────┐
│ 1. Admin clique "Nouvelle séance"        │
│    ↓                                      │
│ 2. Remplit le formulaire                 │
│    ↓                                      │
│ 3. Clique sur "Image (depuis PC)"        │
│    ↓                                      │
│ 4. Sélectionne une image du PC           │
│    ↓                                      │
│ 5. Prévisualisation s'affiche            │
│    ↓                                      │
│ 6. Clique "Créer la séance"              │
│    ↓                                      │
│ 7. [BACKEND]                             │
│    ├─ Upload vers Supabase Storage       │
│    ├─ Récupère URL publique              │
│    ├─ Sauvegarde séance + URL dans BD    │
│    └─ Retour success                     │
│    ↓                                      │
│ 8. Séance créée ✅                       │
│    Image visible sur la plateforme       │
└──────────────────────────────────────────┘
```

## 🗂️ Structure du stockage

```
Supabase Storage: yoga-images bucket
├── yoga/
│   ├── 1720353578000-photo1.jpg
│   ├── 1720353642000-hatha-flow.png
│   ├── 1720353721000-meditation.jpeg
│   └── [plus d'images avec timestamp...]
```

**Format:** `yoga/[TIMESTAMP]-[ORIGINAL_FILENAME]`
- Garantit l'unicité
- Évite les conflits de noms
- Facile à organiser


## 📊 Données sauvegardées

```javascript
{
  id: "uuid",
  title: "cc",
  instructor_id: null,
  level: "Débutant",
  image_url: "https://xxxxxxxx.supabase.co/storage/v1/object/public/yoga-images/yoga/1720353578000-photo1.jpg",  // ← Généré automatiquement
  starts_at: "2026-07-16T10:00:00.000Z",
  duration_min: 60,
  capacity: 10,
  price_mad: 120,
  description: "Instructeur: Name"
}
```

---

**Migration:** Les séances créées avant n'ont pas d'images. Seules les nouvelles séances utilisent ce système.
