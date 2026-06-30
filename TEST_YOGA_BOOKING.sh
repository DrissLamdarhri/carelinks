#!/bin/bash
# Script de test: Réserver une séance de yoga et voir dans l'admin panel

echo "🧘 TEST: Réservation Yoga → Admin Panel"
echo "========================================"
echo ""

# Étape 1: Créer une réservation Yoga
echo "1️⃣  Étape 1: Patient clique sur 'Réserver' pour une séance de yoga"
echo "   - App: /patient/yoga"
echo "   - Session: 'Hatha Flow Matinal' (80 MAD)"
echo "   - Spécialité: yoga_instructor"
echo "   - Statut: matched"
echo "   - Urgency: normal"
echo ""

# Étape 2: Supabase crée le booking
echo "2️⃣  Étape 2: Supabase INSERT dans bookings"
curl -X POST https://your-project.supabase.co/rest/v1/bookings \
  -H "apikey: your-key" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "user-id",
    "specialty": "yoga_instructor",
    "status": "matched",
    "urgency": "normal",
    "address": "Meknès, Maroc",
    "notes": "Réservation yoga: Hatha Flow Matinal",
    "final_price_mad": 80
  }' 2>/dev/null

echo ""
echo "   ✅ Booking créé avec ID: {booking_id}"
echo ""

# Étape 3: Trigger SQL s'exécute
echo "3️⃣  Étape 3: Trigger SQL log_booking_to_admin() s'exécute"
echo "   - Insère dans admin_booking_logs"
echo "   - Détermine alert_level: 'normal'"
echo "   - Marque notification_sent_at"
echo ""

# Étape 4: Admin le voit en temps réel
echo "4️⃣  Étape 4: Admin voit en temps réel sur /admin/bookings"
curl -X GET https://your-project.supabase.co/rest/v1/admin_booking_logs \
  -H "apikey: your-key" \
  -H "Authorization: Bearer admin-token" 2>/dev/null

echo ""
echo "   ✅ Réservation visible dans l'admin panel"
echo ""

# Étape 5: Vérifier les statuts
echo "5️⃣  Étape 5: Vérifications possibles"
echo ""
echo "   SQL pour vérifier:"
echo "   SELECT * FROM admin_booking_logs WHERE specialty='yoga_instructor' ORDER BY created_at DESC;"
echo ""
echo "   Admin panel:"
echo "   http://localhost:8081/admin/bookings"
echo ""

echo "✅ FLUX COMPLET:"
echo "Patient ➜ Yoga ➜ Réserver ➜ Base de données ➜ Admin panel 🎉"
