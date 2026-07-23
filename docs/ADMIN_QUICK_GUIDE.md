# 🎯 Guide Rapide - Plans d'Appointment Admin

## Accès Rapide

```
Dashboard Admin → Plans d'appointment (menu gauche)
```

## 📌 Les 4 Types de Plans

| Type | Description | Exemple | Récurrence |
|------|-------------|---------|-----------|
| **Séance unique** | Consultation ponctuelle | "Consultation initiale" | Aucune |
| **Récurrent** | Même créneau répété | "Suivi hebdo" | Weekly/Bi-weekly/Monthly/Daily |
| **Abonnement** | Pack prépayé | "4 séances/mois" | Monthly |
| **Programme** | Rééducation sur N séances | "Programme de kinésithérapie 8 séances" | Weekly/Monthly |

## ➕ Créer un Plan

### Étape 1: Sélectionner le Pro
```
Dropdown "Sélectionner un professionnel"
→ Choisir un psychologue ou kinésithérapeute
```

### Étape 2: Cliquer "Nouveau plan"
```
Bouton violet en haut à droite
```

### Étape 3: Remplir le Formulaire

#### Champs obligatoires (*):
1. **Titre*** : Ex: "Suivi psychologique mensuel"
2. **Type de plan*** : Sélectionner parmi les 4 types
3. **Fréquence*** (sauf séance unique) : Weekly, Bi-weekly, Monthly, Daily
4. **Nombre de séances*** (sauf séance unique) : 1, 4, 8...
5. **Durée de séance*** : Choisir 30/45/60/90/120 min
6. **Prix par séance*** : En MAD

#### Champs optionnels:
- **Description** : Détails (bénéfices, public ciblé, etc.)
- **Actif** : Checkbox pour activer/désactiver

### Étape 4: Confirmer
```
Le prix total est calculé auto: prix/séance × nombre de séances
Cliquer "Créer le plan"
```

## 📝 Exemples de Configuration

### Exemple 1: Psychologue - Suivi mensuel

```
Titre: Suivi psychologique mensuel
Type: Abonnement
Fréquence: Mensuel
Nombre de séances: 4
Durée: 60 min
Prix/séance: 300 MAD
Total: 1.200 MAD
Description: Suivi mensuel avec prise en charge psy complète
Actif: ✓
```

### Exemple 2: Kinésithérapeute - Programme rééducation

```
Titre: Programme de rééducation post-opératoire
Type: Programme (Kiné)
Fréquence: Hebdomadaire
Nombre de séances: 8
Durée: 45 min
Prix/séance: 200 MAD
Total: 1.600 MAD
Description: 8 séances de rééducation post-opératoire
Actif: ✓
```

### Exemple 3: Psychologue - Suivi hebdomadaire

```
Titre: Suivi psychologique hebdomadaire
Type: Récurrent
Fréquence: Hebdomadaire
Nombre de séances: 1 (par semaine)
Durée: 60 min
Prix/séance: 250 MAD
Total: 250 MAD
Description: Consultation psy chaque mardi 10h-11h
Actif: ✓
```

## 🔍 Voir les Plans

### Affichage Liste

Chaque plan s'affiche avec:
- 🧠 Type (icône + label)
- 📅 Fréquence
- 💰 Prix total
- ✅ Statut (actif/inactif)

### Développer un Plan

Cliquer sur la ligne → Voir détails:
- Durée de séance
- Prix/séance
- Description complète
- Actions (Modifier, Supprimer)

## ✏️ Modifier un Plan

1. Développer le plan (flèche)
2. Cliquer "Modifier"
3. Changer les champs
4. Cliquer "Mettre à jour"

**Note**: Les modifications n'affectent que les nouveaux bookings

## 🗑️ Supprimer un Plan

1. Développer le plan
2. Cliquer "Supprimer"
3. Confirmer

**Attention**: Les bookings existants restent intacts

## 🔴 Désactiver Temporairement

Au lieu de supprimer, on peut:
1. Cliquer "Modifier"
2. Décocher "Actif"
3. Sauvegarder

→ Le plan devient invisible pour les nouveaux bookings

## 💡 Conseils d'Utilisation

### ✅ Bonnes Pratiques

- **Titre clair** : "Suivi psy mensuel" plutôt que "Plan 1"
- **Description utile** : Inclure les objectifs, public cible
- **Prix cohérent** : Pour un abonnement, offrir une réduction vs à l'unité
- **Fréquence realiste** : Vérifier dispo du pro avant de créer
- **Activer progressivement** : Tester avec un patient d'abord

### ❌ À Éviter

- ❌ Plans sans titre
- ❌ Prix incohérent
- ❌ Récurrence quotidienne (sauf cas spécial)
- ❌ Trop de plans pour même pro (confusant pour patient)
- ❌ Laisser des plans inactifs créer du clutter

## 📊 Statistiques

Pour analyser les plans:

```sql
-- Nombre de plans par pro
SELECT pro_id, COUNT(*) as nb_plans 
FROM public.appointment_plans 
GROUP BY pro_id;

-- Plans les plus chers
SELECT title, total_price_mad, sessions_count 
FROM public.appointment_plans 
ORDER BY total_price_mad DESC;

-- Plans actifs
SELECT * FROM public.appointment_plans 
WHERE is_active = true;
```

## ⚙️ Paramètres Système

Si modification manuelle nécessaire (SQL):

```sql
-- Désactiver tous les plans d'un pro
UPDATE public.appointment_plans 
SET is_active = false 
WHERE pro_id = 'PRO_UUID';

-- Changer prix tous les plans
UPDATE public.appointment_plans 
SET price_per_session_mad = price_per_session_mad * 1.1 
WHERE is_active = true;

-- Supprimer tous les plans d'un pro
DELETE FROM public.appointment_plans 
WHERE pro_id = 'PRO_UUID';
```

## 🆘 Troubleshooting

### Problème: "Aucun professionnel trouvé"
- ✅ Vérifier qu'il y a des psychologues/kinés dans la DB
- ✅ Vérifier qu'ils sont marqués `is_available = true`

### Problème: "Erreur lors de la création"
- ✅ Vérifier tous les champs obligatoires sont remplis
- ✅ Vérifier que le pro est toujours disponible
- ✅ Regarder la console du navigateur pour détails

### Problème: "Le plan n'apparaît pas"
- ✅ Vérifier que `is_active = true`
- ✅ Vérifier que le pro est correct
- ✅ Rafraîchir la page (F5)

### Problème: "Impossible de modifier/supprimer"
- ✅ Vérifier que vous êtes connecté comme admin
- ✅ Vérifier les RLS policies dans Supabase
- ✅ Vérifier les logs Supabase

## 📞 Besoin d'Aide?

1. Consulter `docs/APPOINTMENT_PLANS.md` pour détails techniques
2. Consulter `docs/MIGRATION_APPOINTMENT_PLANS.md` pour configuration DB
3. Vérifier les logs Supabase (Dashboard → Logs)
4. Demander support dev
