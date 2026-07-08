-- ============================================================================
-- Fix: Allow admin access to yoga enrollments and sessions for real-time sync
-- ============================================================================
-- Run this in Supabase SQL Editor to fix admin access to yoga data

-- 1. Update yoga_enroll_read policy to allow admin access
DROP POLICY IF EXISTS "yoga_enroll_read" ON public.yoga_enrollments;
CREATE POLICY "yoga_enroll_read" ON public.yoga_enrollments
FOR SELECT USING (
  auth.uid() = patient_id
  OR exists (select 1 from public.yoga_sessions s where s.id = yoga_enrollments.session_id and s.instructor_id = auth.uid())
  OR public.current_role() = 'admin'
);

-- 2. Create admin write policy for yoga_enrollments (allow admin to manage enrollments)
CREATE POLICY "yoga_enroll_admin" ON public.yoga_enrollments
FOR ALL USING (public.current_role() = 'admin') WITH CHECK (public.current_role() = 'admin');

-- 3. Ensure yoga_sessions allows admin all access (should already exist, but verify)
DROP POLICY IF EXISTS "yoga_sessions_admin" ON public.yoga_sessions;
CREATE POLICY "yoga_sessions_admin" ON public.yoga_sessions
FOR ALL USING (public.current_role() = 'admin') WITH CHECK (public.current_role() = 'admin');

-- 4. Ensure yoga tables are in realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.yoga_enrollments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.yoga_sessions;

-- 5. Verify: Show all policies on yoga_enrollments
-- SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
-- FROM pg_policies
-- WHERE tablename IN ('yoga_enrollments', 'yoga_sessions')
-- ORDER BY tablename, policyname;
