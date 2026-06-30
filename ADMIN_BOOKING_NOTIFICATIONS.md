# Admin Booking Notifications System

## Vue d'ensemble

Ce système automatise l'enregistrement et la notification de **toutes les réservations** au panel admin, avec une **priorité spéciale pour les rendez-vous de psychologue**.

### Fonctionnalités principales

- ✅ **Enregistrement automatique** de chaque réservation
- ✅ **Notifications en temps réel** via Supabase Realtime
- ✅ **Priorisation** des rendez-vous de psychologue
- ✅ **Alertes urgentes** pour les cas critiques
- ✅ **Historique complet** de toutes les réservations
- ✅ **Filtrage** par spécialité, statut, et niveau d'alerte

---

## Architecture

### Composants

1. **`lib/admin/booking-notifications.ts`**
   - Gère l'enregistrement des réservations
   - Envoie les notifications en temps réel
   - Récupère les statistiques

2. **`lib/admin/use-booking-notifications.ts`**
   - Hook React pour l'intégration
   - Écoute les changements de réservations
   - Gère les notifications en temps réel

3. **`app/admin/bookings.tsx`**
   - Interface de gestion des réservations
   - Affiche les statistiques
   - Filtre les réservations par critère

4. **`supabase/admin-booking-logs.sql`**
   - Table de base de données
   - Triggers pour l'enregistrement automatique
   - Policies RLS pour l'accès admin

---

## Intégration

### 1. Exécuter la migration SQL

```bash
# Connectez-vous à Supabase et exécutez le fichier migration
supabase/admin-booking-logs.sql
```

Cela créera:
- Table `admin_booking_logs`
- Index pour optimiser les requêtes
- Triggers automatiques pour logger les réservations
- Policies RLS pour la sécurité

### 2. Utiliser le système dans votre code

#### Quand créer une réservation:

```typescript
import { notifyAdminNewBooking } from "@/lib/admin/booking-notifications";

async function createBooking(bookingData) {
  // Créer la réservation via Supabase
  const { data: booking } = await supabase
    .from("bookings")
    .insert([bookingData])
    .select()
    .single();

  // La notification est automatiquement envoyée via le trigger SQL
  // Mais vous pouvez aussi l'appeler manuellement:
  if (booking) {
    await notifyAdminNewBooking(booking);
  }

  return booking;
}
```

#### Quand mettre à jour une réservation:

```typescript
import { notifyAdminBookingStatusChange } from "@/lib/admin/booking-notifications";

async function updateBookingStatus(bookingId, newStatus) {
  const { data: oldBooking } = await supabase
    .from("bookings")
    .select()
    .eq("id", bookingId)
    .single();

  const { data: updatedBooking } = await supabase
    .from("bookings")
    .update({ status: newStatus })
    .eq("id", bookingId)
    .select()
    .single();

  // Notifier l'admin du changement de statut
  if (updatedBooking && oldBooking) {
    await notifyAdminBookingStatusChange(updatedBooking, oldBooking.status);
  }

  return updatedBooking;
}
```

#### Utiliser le hook dans les composants:

```typescript
import { useBookingNotifications } from "@/lib/admin/use-booking-notifications";

function BookingComponent() {
  const { booking } = useBooking();

  // Écouter les changements de la réservation
  useBookingNotifications(booking?.id ?? null, userId);

  return <View>{/* ... */}</View>;
}
```

---

## Fonctionnalités

### Niveaux d'alerte

| Niveau | Condition | Emoji |
|--------|-----------|-------|
| **CRITIQUE** | Psychologue + Urgent/Emergency | 🚨 |
| **ÉLEVÉE** | Psychologue OU Urgent/Emergency | ⚠️ |
| **NORMALE** | Autres réservations | ℹ️ |

### Filtrage dans l'admin

```typescript
// Toutes les réservations
await fetchAdminBookings();

// Filtrer par spécialité
await fetchAdminBookings({ specialty: "psychologist" });

// Filtrer par niveau d'alerte
await fetchAdminBookings({ alertLevel: "critical" });

// Filtrer par statut
await fetchAdminBookings({ status: "open" });

// Avec pagination
await fetchAdminBookings({ limit: 50, offset: 100 });
```

### Récupérer les stats

```typescript
const stats = await fetchBookingStats();
// Retourne:
// {
//   total: 342,              // Total des réservations
//   psychologist: 45,        // Rendez-vous psychologue
//   urgent: 12,              // Réservations urgentes
//   critical: 3,             // Réservations critiques
//   today: 8                 // Réservations d'aujourd'hui
// }
```

---

## Page Admin

La page `/admin/bookings` affiche:

### 📊 Statistiques en temps réel
- Nombre total de réservations
- Rendez-vous de psychologue
- Réservations urgentes et critiques
- Réservations d'aujourd'hui

### 🚨 Section priorité
- Liste des réservations critiques
- Identifiées automatiquement
- Affichées en premier

### 📋 Filtrage
- Par type: Tous / Psychologues / Critiques
- Tri par date et niveau d'alerte
- Pagination automatique

### 💾 Détails complets
- Spécialité et statut
- Date et adresse du rendez-vous
- Notes du patient
- Prix et urgence

---

## Base de données

### Table: `admin_booking_logs`

```sql
Column                Type                      Description
---                   ---                       ---
id                    UUID (PK)                 Identifiant unique
booking_id            UUID (FK)                 Référence à la réservation
patient_id            UUID (FK)                 Identifiant du patient
professional_id       UUID (FK)                 Identifiant du pro (nullable)
specialty             VARCHAR                   Spécialité (nurse, psychologist, etc.)
status                VARCHAR                   Statut (open, matched, completed, etc.)
urgency               VARCHAR                   Urgence (normal, urgent, emergency)
scheduled_at          TIMESTAMP                 Date du rendez-vous
address               TEXT                      Adresse
price                 NUMERIC                   Prix final
notes                 TEXT                      Notes du patient
is_psychologist       BOOLEAN                   True si psychologue
alert_level           VARCHAR                   normal/high/critical
notification_sent_at  TIMESTAMP                 Quand notifié à l'admin
created_at            TIMESTAMP                 Création du log
updated_at            TIMESTAMP                 Dernière mise à jour
```

### Indexes
- `specialty` - pour filtrer par spécialité
- `alert_level` - pour les alertes prioritaires
- `is_psychologist` - pour les rendez-vous psy
- `status` - pour filtrer par statut
- `created_at` - pour le tri par date
- `scheduled_at` - pour les requêtes futures

---

## Triggers automatiques

### `log_booking_to_admin()`
S'exécute quand une nouvelle réservation est créée:
1. Enregistre la réservation dans `admin_booking_logs`
2. Détermine le niveau d'alerte automatiquement
3. Marque l'heure de notification

### `update_booking_log_on_status_change()`
S'exécute quand le statut d'une réservation change:
1. Met à jour le statut dans le log
2. Met à jour `updated_at`
3. Peut déclencher une notification

---

## Sécurité (RLS)

La table `admin_booking_logs` est protégée par une policy:
- ✅ Les administrateurs peuvent voir toutes les réservations
- ❌ Les patients ne voient que les leurs
- ❌ Les professionnels ne voient que les leurs

```sql
CREATE POLICY "Admins can view all booking logs" ON admin_booking_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

---

## Exemples d'utilisation

### 1. Afficher les psychologues urgents sur le dashboard

```typescript
const criticalPsychologists = await fetchAdminBookings({
  specialty: "psychologist",
  alertLevel: "critical"
});
```

### 2. Obtenir les notifications en temps réel

```typescript
import { useAdminBookingNotifications } from "@/lib/admin/use-booking-notifications";

function AdminDashboard() {
  useAdminBookingNotifications((payload) => {
    console.log("Nouvelle notification:", payload);
    // Mettre à jour l'interface
  });

  return <View>{/* ... */}</View>;
}
```

### 3. Notifier manuellement (si nécessaire)

```typescript
import { triggerBookingNotification } from "@/lib/admin/use-booking-notifications";

// Quand une réservation est créée
await triggerBookingNotification(booking, "create");

// Quand le statut change
await triggerBookingNotification(booking, "update", previousStatus);
```

---

## Flux complet

```
1. Patient crée une réservation
   ↓
2. La réservation est insertée dans la table 'bookings'
   ↓
3. Trigger SQL: log_booking_to_admin()
   ↓
4. Le log est créé dans admin_booking_logs
   ↓
5. Notification envoyée via Supabase Realtime
   ↓
6. Admin voit la réservation en temps réel sur /admin/bookings
   ↓
7. Si c'est un psychologue urgent → ALERTE CRITIQUE
```

---

## Déploiement

### Étapes:

1. **Créer la table**
   ```bash
   # Exécuter supabase/admin-booking-logs.sql dans la console Supabase
   ```

2. **Déployer le code**
   ```bash
   pnpm install
   pnpm build
   ```

3. **Tester**
   - Créer une réservation depuis l'app mobile
   - Vérifier que le log apparaît en base
   - Ouvrir `/admin/bookings`
   - Vérifier que la réservation apparaît

4. **Monitoring**
   - Consulter les logs Supabase
   - Vérifier les performances avec les index
   - Archiver les anciens logs si nécessaire

---

## Troubleshooting

### Les notifications n'arrivent pas

1. Vérifier que la migration SQL a été exécutée
2. Vérifier les logs Supabase
3. S'assurer que l'utilisateur est admin (role = 'admin')
4. Vérifier que Realtime est activé dans Supabase

### La page admin est lente

1. Augmenter les limites de pagination
2. Vérifier que les index sont créés
3. Ajouter plus de filters pour réduire les résultats

### Les psychologues n'apparaissent pas en priorité

1. Vérifier que `specialty` = "psychologist" dans la DB
2. Vérifier que le trigger `log_booking_to_admin` s'exécute
3. Consulter la table `admin_booking_logs`

---

## Performance

- **Temps de notification**: < 100ms
- **Nombre de requêtes**: 1 INSERT + 1 broadcast
- **Pagination**: 50 résultats par page par défaut
- **Rafraîchissement**: Auto-refresh toutes les 30 secondes

---

## Évolutions futures

- [ ] Notifications push vers les admins
- [ ] Email alerts pour les cas critiques
- [ ] SMS pour les psychologues urgents
- [ ] Export CSV des réservations
- [ ] Graphiques d'analyse
- [ ] Assignation automatique à un pro
- [ ] Système de tickets/escalade

---

## Support

Pour toute question, consultez:
- La documentation Supabase: https://supabase.com/docs
- Les types TypeScript: `lib/db/types.ts`
- Les hooks: `lib/admin/use-booking-notifications.ts`
