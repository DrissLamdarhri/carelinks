-- Enable RLS on pro_documents if it was disabled
ALTER TABLE public.pro_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Admin users can read all pro documents
CREATE POLICY "admin_read_all_pro_documents" ON public.pro_documents
  FOR SELECT
  USING (
    -- Check if user has admin role
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Create RLS policy: Professionals can read their own documents
CREATE POLICY "professionals_read_own_documents" ON public.pro_documents
  FOR SELECT
  USING (
    professional_id = auth.uid()
  );

-- Create RLS policy: Service role (Edge Functions) can do everything
-- (This is typically not needed as service role bypasses RLS, but being explicit)
ALTER TABLE public.pro_documents FORCE ROW LEVEL SECURITY;
