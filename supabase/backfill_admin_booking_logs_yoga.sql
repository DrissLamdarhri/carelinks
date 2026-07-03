-- Backfill admin_booking_logs for yoga bookings
-- Run this as a SUPABASE ADMIN (SQL Editor or psql with service role) to insert missing admin logs

INSERT INTO admin_booking_logs (
  booking_id,
  patient_id,
  professional_id,
  specialty,
  status,
  urgency,
  scheduled_at,
  address,
  price,
  notes,
  is_psychologist,
  alert_level,
  notification_sent_at,
  created_at,
  updated_at
)
SELECT
  b.id AS booking_id,
  b.patient_id,
  b.professional_id,
  b.specialty,
  b.status,
  b.urgency,
  b.scheduled_at,
  b.address,
  COALESCE(b.final_price_mad, b.budget_max_mad) AS price,
  b.notes,
  (b.specialty = 'psychologist')::boolean AS is_psychologist,
  CASE
    WHEN b.specialty = 'psychologist' AND (b.urgency = 'urgent' OR b.urgency = 'emergency') THEN 'critical'
    WHEN b.specialty = 'psychologist' OR b.urgency = 'urgent' OR b.urgency = 'emergency' THEN 'high'
    ELSE 'normal'
  END AS alert_level,
  b.created_at AS notification_sent_at,
  b.created_at,
  b.created_at
FROM bookings b
LEFT JOIN admin_booking_logs a ON a.booking_id = b.id
WHERE b.specialty = 'yoga_instructor'
  AND a.booking_id IS NULL;
