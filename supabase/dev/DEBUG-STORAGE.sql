-- Check pro-documents bucket status
SELECT id, name, public, created_at FROM storage.buckets WHERE id = 'pro-documents';

-- Check if any documents exist
SELECT COUNT(*) as total_documents FROM public.pro_documents;

-- Show recent documents with storage paths
SELECT 
  id, 
  professional_id, 
  doc_type, 
  storage_path, 
  is_verified,
  uploaded_at
FROM public.pro_documents
ORDER BY uploaded_at DESC
LIMIT 10;

-- Check what's in storage
SELECT 
  name, 
  bucket_id, 
  owner, 
  created_at
FROM storage.objects
WHERE bucket_id = 'pro-documents'
LIMIT 20;
