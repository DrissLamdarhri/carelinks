-- ============================================================================
-- CareLink — commission applies to SERVICE payments only. trip_comp / penalty
-- ledger rows keep commission 0 (nurse gets the full trip comp; penalty is flat).
-- Run once in Supabase → SQL Editor. Idempotent. (Follow-up to 0022.)
-- ============================================================================
create or replace function public.set_payment_commission()
returns trigger language plpgsql as $$
begin
  if coalesce(new.commission_mad, 0) = 0 and coalesce(new.kind, 'service') = 'service' then
    new.commission_mad := public.calc_commission(new.amount_mad);
  end if;
  return new;
end $$;

-- clean any existing helper rows created before this fix
update public.payments set commission_mad = 0 where kind in ('trip_comp','penalty') and commission_mad <> 0;

select count(*) filter (where kind in ('trip_comp','penalty') and commission_mad <> 0) as should_be_0
from public.payments;
