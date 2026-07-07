-- =====================================================================
-- SIMPLE FIX: Make pro-documents bucket PUBLIC
-- Files accessible via direct URL without auth
-- =====================================================================

update storage.buckets 
set public = true 
where id = 'pro-documents';
