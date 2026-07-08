-- Add admin notifications when a professional uploads a document
-- Run this in Supabase SQL Editor (after schema.sql has been applied)

create or replace function public.notify_pro_document_uploaded()
returns trigger
language plpgsql
security definer
as $$
declare
  v_pro_name text;
begin
  select coalesce(p.full_name, 'Un professionnel') into v_pro_name
  from public.profiles p where p.id = new.professional_id;

  insert into public.notifications (user_id, kind, title, body, payload)
  select a.id, 'system', 'Nouveau document KYC', v_pro_name || ' a envoyé un document: ' || new.doc_type,
    jsonb_build_object('professional_id', new.professional_id, 'document_id', new.id, 'storage_path', new.storage_path)
  from public.profiles a
  where a.role = 'admin';

  return new;
end;
$$;

-- Trigger

drop trigger if exists trg_notify_prodoc_uploaded on public.pro_documents;
create trigger trg_notify_prodoc_uploaded
after insert on public.pro_documents
for each row execute function public.notify_pro_document_uploaded();
