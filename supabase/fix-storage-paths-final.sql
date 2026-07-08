-- Fix storage_path in pro_documents to match actual files in Storage
-- This script updates the storage_path values to use the CORRECT file names
-- that actually exist in the pro-documents bucket

-- First, let's see what we have
SELECT id, professional_id, doc_type, storage_path 
FROM pro_documents 
LIMIT 10;

-- The issue: storage_path has wrong timestamps/filenames
-- Example from logs:
-- Current: 64b25e81-bfbc-4c4f-8c79-23344f715007/selfie-1783524197934.jpg
-- Should be: 64b25e81-bfbc-4c4f-8c79-23344f715007/selfie-1783396428883.jpg

-- We need to manually update based on what exists in Storage
-- For the professional 64b25e81-bfbc-4c4f-8c79-23344f715007:

UPDATE pro_documents 
SET storage_path = '64b25e81-bfbc-4c4f-8c79-23344f715007/selfie-1783396428883.jpg'
WHERE professional_id = '64b25e81-bfbc-4c4f-8c79-23344f715007'
AND doc_type = 'selfie';

UPDATE pro_documents 
SET storage_path = '64b25e81-bfbc-4c4f-8c79-23344f715007/cin-1783396427616.jpg'
WHERE professional_id = '64b25e81-bfbc-4c4f-8c79-23344f715007'
AND doc_type = 'cin';

UPDATE pro_documents 
SET storage_path = '64b25e81-bfbc-4c4f-8c79-23344f715007/diploma-1783396425667.jpg'
WHERE professional_id = '64b25e81-bfbc-4c4f-8c79-23344f715007'
AND doc_type = 'diploma';

-- Verify
SELECT doc_type, storage_path FROM pro_documents 
WHERE professional_id = '64b25e81-bfbc-4c4f-8c79-23344f715007'
ORDER BY doc_type;
