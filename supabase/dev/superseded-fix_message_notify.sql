-- ============================================================================
-- FIX — new-message notifications (chat).
-- The old notify_new_message referenced new.recipient_id (messages has no such
-- column) and inserted into a "data" column (the table uses "payload"). This
-- corrects it: recipient = the other party on the booking; insert into payload.
-- Also enables push for chat (the send-push trigger fires on any notification).
-- Run once in Supabase → SQL Editor. Idempotent.
-- ============================================================================

create or replace function public.notify_new_message()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_sender_name text;
  v_recipient   uuid;
begin
  select coalesce(p.full_name, 'Nouveau message') into v_sender_name
  from public.profiles p where p.id = new.sender_id;

  select case when new.sender_id = b.patient_id then b.professional_id else b.patient_id end
    into v_recipient
  from public.bookings b where b.id = new.booking_id;

  if v_recipient is not null then
    insert into public.notifications (user_id, kind, title, body, payload)
    values (
      v_recipient, 'message', v_sender_name, left(new.body, 140),
      jsonb_build_object('booking_id', new.booking_id, 'message_id', new.id, 'sender_id', new.sender_id)
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_new_message on public.messages;
create trigger trg_notify_new_message
  after insert on public.messages
  for each row execute function public.notify_new_message();

select 'message notifications fixed (recipient from booking, payload column)' as result;
