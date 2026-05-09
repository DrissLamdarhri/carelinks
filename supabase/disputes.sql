-- Cancellation reason + dispute flag — Step 15
alter table public.bookings
  add column if not exists cancel_reason text,
  add column if not exists dispute_open boolean not null default false,
  add column if not exists dispute_resolved_at timestamptz;

create or replace function public.open_dispute(p_booking_id uuid, p_reason text)
returns void language plpgsql security definer as $$
begin
  update public.bookings set dispute_open = true, cancel_reason = p_reason where id = p_booking_id;
  insert into public.notifications (user_id, kind, title, body, data)
  select b.patient_id, 'system', 'Litige ouvert', 'Notre équipe a été alertée',
         jsonb_build_object('booking_id', b.id)
    from public.bookings b where b.id = p_booking_id;
end; $$;
grant execute on function public.open_dispute(uuid, text) to authenticated;
