-- Server-side capacity enforcement for yoga enrollments.
create or replace function public.enforce_yoga_capacity()
returns trigger language plpgsql security definer as $$
declare
  v_count int;
  v_capacity int;
begin
  select count(*) into v_count from public.yoga_enrollments where session_id = new.session_id;
  select capacity into v_capacity from public.yoga_sessions where id = new.session_id;
  if v_count >= v_capacity then
    raise exception 'Session complète';
  end if;
  return new;
end; $$;

drop trigger if exists trg_yoga_capacity on public.yoga_enrollments;
create trigger trg_yoga_capacity before insert on public.yoga_enrollments
  for each row execute function public.enforce_yoga_capacity();
