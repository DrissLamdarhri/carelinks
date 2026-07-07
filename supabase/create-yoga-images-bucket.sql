-- =====================================================================
-- CareLink — Create yoga-images storage bucket with public access
-- Run in Supabase SQL Editor
-- 
-- IMPORTANT: This bucket stores yoga session images.
-- - Images are PUBLIC (everyone can view)
-- - Only ADMINS can upload (via admin panel)
-- - All images are in /yoga/ folder with timestamp
-- =====================================================================

-- 1. Create the yoga-images bucket (public; everyone can view, admins can upload)
insert into storage.buckets (id, name, public)
values ('yoga-images', 'yoga-images', true)
on conflict (id) do update
set public = excluded.public;

-- 2. RLS Policy: Admins can upload and manage yoga session images
drop policy if exists "admins upload yoga images" on storage.objects;
create policy "admins upload yoga images"
on storage.objects for all to authenticated
using (
  bucket_id = 'yoga-images'
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
)
with check (
  bucket_id = 'yoga-images'
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

-- 3. RLS Policy: Everyone can view yoga session images
drop policy if exists "public view yoga images" on storage.objects;
create policy "public view yoga images"
on storage.objects for select
using (bucket_id = 'yoga-images');
