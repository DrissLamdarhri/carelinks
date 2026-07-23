# Instructions pour appliquer la migration

## Option 1: Via Supabase Dashboard (Recommandé pour test)

1. Allez à **Dashboard Supabase** (supabase.com)
2. Sélectionnez le projet `wjhzrovmktekfcjohhrw`
3. Allez à **SQL Editor** → **New query**
4. Copiez tout le contenu de `supabase/migrations/0025_appointment_plans.sql`
5. Collez dans l'éditeur
6. Cliquez **Run** (Ctrl+Enter)

## Option 2: Via Supabase CLI (Production)

```bash
cd C:\carelink
supabase migration list          # Voir les migrations appliquées
supabase db push                 # Applique les nouvelles migrations
```

## Vérifier la création

Après application, dans Supabase SQL Editor :

```sql
-- Voir la structure de la table
\d public.appointment_plans

-- Vérifier les colonnes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'appointment_plans';

-- Vérifier les RLS policies
SELECT * FROM pg_policies 
WHERE tablename = 'appointment_plans';
```

## Test: Créer un plan exemple

```sql
-- 1. Trouver un pro psychologue/kiné
SELECT id, full_name, specialty 
FROM public.professionals 
WHERE specialty IN ('psychologist', 'physiotherapist') 
LIMIT 1;

-- 2. Créer un plan (remplacer PRO_ID)
INSERT INTO public.appointment_plans (
  pro_id,
  plan_type,
  recurrence,
  title,
  description,
  price_per_session_mad,
  total_price_mad,
  session_duration_min,
  sessions_count,
  is_active
) VALUES (
  'PRO_ID',
  'subscription',
  'monthly',
  'Suivi psychologique mensuel',
  '4 séances de 1h par mois avec le Dr. Dupont',
  300,
  1200,
  60,
  4,
  true
);

-- 3. Vérifier l'insertion
SELECT * FROM public.appointment_plans 
WHERE pro_id = 'PRO_ID';
```

## Si erreur: "Table not found"

La table n'existe pas. Appliquez la migration d'abord via Option 1 ou 2.

## Après migration: Tester l'interface

1. Ouvrir http://localhost:5178/admin
2. Login (admin@carelink.ma / password)
3. Aller à "Plans d'appointment" dans la sidebar
4. Vérifier que les professionnels chargent
5. Créer un nouveau plan
6. Vérifier dans Supabase que le plan est créé
