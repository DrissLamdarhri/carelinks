-- Migration: Create admin_booking_logs table
-- Enregistre toutes les réservations pour l'administration
-- Priorité spéciale pour les rendez-vous de psychologue

CREATE TABLE IF NOT EXISTS admin_booking_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  specialty VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  urgency VARCHAR NOT NULL,
  
  scheduled_at TIMESTAMP WITH TIME ZONE,
  address TEXT,
  price NUMERIC,
  notes TEXT,
  
  is_psychologist BOOLEAN DEFAULT FALSE,
  alert_level VARCHAR NOT NULL DEFAULT 'normal' CHECK (alert_level IN ('normal', 'high', 'critical')),
  
  notification_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Index pour les queries fréquentes
  CONSTRAINT alert_level_valid CHECK (alert_level IN ('normal', 'high', 'critical'))
);

-- Indexes pour optimiser les requêtes
CREATE INDEX idx_admin_booking_logs_specialty ON admin_booking_logs(specialty);
CREATE INDEX idx_admin_booking_logs_alert_level ON admin_booking_logs(alert_level);
CREATE INDEX idx_admin_booking_logs_is_psychologist ON admin_booking_logs(is_psychologist);
CREATE INDEX idx_admin_booking_logs_status ON admin_booking_logs(status);
CREATE INDEX idx_admin_booking_logs_created_at ON admin_booking_logs(created_at DESC);
CREATE INDEX idx_admin_booking_logs_scheduled_at ON admin_booking_logs(scheduled_at);

-- RLS (Row Level Security) - Les administrateurs uniquement
ALTER TABLE admin_booking_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all booking logs" ON admin_booking_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admin write policies: restrict insert/update/delete to admin users (triggers run with SECURITY DEFINER)
CREATE POLICY "Admins can insert booking logs" ON admin_booking_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update booking logs" ON admin_booking_logs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete booking logs" ON admin_booking_logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger pour mettre à jour updated_at
CREATE TRIGGER update_admin_booking_logs_updated_at
  BEFORE UPDATE ON admin_booking_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Fonction helper pour créer un log lors d'une nouvelle réservation
CREATE OR REPLACE FUNCTION log_booking_to_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
    notification_sent_at
  ) VALUES (
    NEW.id,
    NEW.patient_id,
    NEW.professional_id,
    NEW.specialty,
    NEW.status,
    NEW.urgency,
    NEW.scheduled_at,
    NEW.address,
    COALESCE(NEW.final_price_mad, NEW.budget_max_mad),
    NEW.notes,
    NEW.specialty = 'psychologist',
    CASE
      WHEN NEW.specialty = 'psychologist' AND (NEW.urgency = 'urgent' OR NEW.urgency = 'emergency') THEN 'critical'
      WHEN NEW.specialty = 'psychologist' OR NEW.urgency = 'urgent' OR NEW.urgency = 'emergency' THEN 'high'
      ELSE 'normal'
    END,
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Trigger pour logger les nouvelles réservations
CREATE TRIGGER booking_created_trigger
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION log_booking_to_admin();

-- Trigger pour mettre à jour le log lors d'un changement de statut
CREATE OR REPLACE FUNCTION update_booking_log_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    UPDATE admin_booking_logs
    SET status = NEW.status, updated_at = NOW()
    WHERE booking_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER booking_status_change_trigger
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_log_on_status_change();
