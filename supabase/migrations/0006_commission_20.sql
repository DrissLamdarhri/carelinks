-- ============================================================================
-- CareLink — set the platform commission to 20% (matches the CMI payment flow).
-- Run once in Supabase → SQL Editor. Idempotent.
-- Pro net = amount − commission; a flat 5 MAD patient service fee is added in-app.
-- ============================================================================
create or replace function public.calc_commission(p_amount integer)
returns integer language sql immutable as $$ select greatest(1, (p_amount * 20) / 100) $$;

select public.calc_commission(150) as should_be_30;
