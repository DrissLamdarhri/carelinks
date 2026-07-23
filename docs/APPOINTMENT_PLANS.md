# Plans d'Appointment pour Psychologues et Kinésithérapeutes

## 📋 Vue d'ensemble

Une nouvelle interface d'administration a été ajoutée pour permettre aux psychologues et kinésithérapeutes de configurer des plans d'appointments (réservations) mensuels, hebdomadaires ou autres formules d'abonnement/programme.

## 🎯 Fonctionnalités

### Types de Plans
- **Séance unique** : Une consultation ponctuelle
- **Récurrent** : Même créneau répété selon une fréquence (hebdomadaire, bi-hebdomadaire, mensuel, quotidien)
- **Abonnement** : Forfait prépayé de N séances (ex: 4 séances/mois)
- **Programme (Kiné)** : Programme de rééducation sur X séances (ex: 8 séances + suivi)

### Configuration de chaque Plan
- **Titre** : Nom du plan (ex: "Suivi psychologique mensuel")
- **Description** : Détails supplémentaires
- **Fréquence** : Hebdomadaire, bi-hebdomadaire, mensuel, quotidien
- **Nombre de séances** : Pour les plans récurrents/abonnements
- **Durée de séance** : 30 min, 45 min, 60 min, 90 min, 120 min
- **Prix par séance** : En MAD
- **Prix total** : Calculé automatiquement (prix_par_séance × nombre_séances)
- **Statut** : Actif/Inactif

## 🏗️ Architecture

### Base de Données
Nouvelle table `appointment_plans` :
- `id` : UUID primaire
- `pro_id` : Référence au professionnel
- `plan_type` : 'single' | 'recurring' | 'subscription' | 'program'
- `recurrence` : 'none' | 'weekly' | 'biweekly' | 'monthly' | 'daily'
- `title`, `description`
- `price_per_session_mad`, `total_price_mad`
- `session_duration_min`, `sessions_count`
- `is_active`

RLS configurée :
- Pros ne peuvent voir/modifier que leurs propres plans
- Patients ne voient que les plans actifs
- Admins ont accès complet

### Composant React
**Fichier** : `src/app/components/PsychologistPlansManager.tsx`

Fonctionnalités :
- ✅ Sélection du professionnel
- ✅ Liste des plans avec expansion
- ✅ Création/Modification/Suppression de plans
- ✅ Validation des champs
- ✅ Calcul automatique du prix total
- ✅ Animations fluides (motion/react)

### Panel Admin
- Nouvel onglet "Plans d'appointment" dans le menu latéral
- Accessible via `/admin/dashboard` → tab "Plans d'appointment"
- Icône cerveau (Brain icon)

## 📍 Utilisation dans l'Admin

1. **Navigation** : Cliquer sur "Plans d'appointment" dans la sidebar
2. **Sélectionner un pro** : Dropdown avec tous les psychologues/kinés disponibles
3. **Créer un plan** : Cliquer sur "Nouveau plan"
4. **Configuration** :
   - Remplir titre + description
   - Choisir type de plan
   - Pour récurrent/abonnement/programme : choisir fréquence et nombre de séances
   - Fixer la durée et le prix
   - Valider

5. **Gérer les plans** :
   - Voir tous les plans du pro
   - Cliquer pour voir détails/modifier/supprimer
   - Toggle actif/inactif

## 🔗 Intégration Future

Ces plans s'intègrent avec le système existant de réservations :
- Lors d'une nouvelle réservation, le patient choisira un plan parmi ceux actifs du pro
- Un booking crée une `series_id` si le plan est récurrent/abonnement/programme
- Les sessions partagent des metadata (session_mode, plan_type, recurrence, series_id, etc.)

Les champs de la table `bookings` concernés :
```sql
- session_mode      : 'in_person' | 'remote'
- plan_type         : 'single' | 'recurring' | 'subscription'
- recurrence        : 'none' | 'weekly' | 'biweekly' | 'monthly'
- series_id         : UUID liée à toutes les sessions du plan
- session_index     : Position dans la série (1-based)
- session_total     : Nombre total de sessions
- meet_link, zoom_link : Liens vidéo snapshottés
```

## 🚀 Déploiement

### Étapes
1. **Migration DB** : Exécuter `supabase/migrations/0025_appointment_plans.sql` dans Supabase
2. **Code** : Les fichiers sont déjà en place
3. **Test** : Accéder à /admin → Plans d'appointment
4. **Vérification** : Créer un plan test, vérifier qu'il apparaît

### Vérification
```sql
-- Voir tous les plans
SELECT * FROM public.appointment_plans;

-- Voir les plans d'un pro spécifique
SELECT * FROM public.appointment_plans 
WHERE pro_id = 'YOUR_PRO_ID';
```

## 📝 Notes Techniques

- **Animations** : Utilise `motion/react` pour expand/collapse des plans
- **Validations** : Côté client + RLS côté DB
- **Tarification** : Automatiquement calculée (price_per_session × sessions_count)
- **Timezone** : Les timestamps sont en UTC (timestamptz)
- **Images** : Pas d'image pour les plans (optionnel à ajouter)

## 🎨 UI/UX

- Design cohérent avec le reste de l'admin (couleurs, spacing)
- Couleur dominante : Violet (Psychologues)
- Couleur Rose (Programme Kiné)
- Icons lucide-react pour les types de plans
- Modal pour création/modification

## ❓ FAQ

**Q: Un pro peut-il avoir plusieurs plans du même type?**
A: Oui, il peut créer plusieurs "Abonnements" ou "Programmes" avec des configurations différentes.

**Q: Les prix sont-ils fixes une fois le plan créé?**
A: Non, l'admin peut modifier un plan existant et changer le prix.

**Q: Comment les patients verront-ils les plans?**
A: À intégrer dans le flow de réservation (future phase).

**Q: Quelle devise?**
A: MAD (Dirham marocain) uniquement.

**Q: Peut-on archiver un plan sans le supprimer?**
A: Oui, utiliser le checkbox "Actif" pour désactiver temporairement.
