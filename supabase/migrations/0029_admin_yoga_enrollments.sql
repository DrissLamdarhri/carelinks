-- ============================================================================
-- CareLink — let admins see yoga enrollments.
-- Run in Supabase → SQL Editor. Idempotent.
--
-- WHY: yoga_enrollments could be read only by the patient themselves or the
-- session's instructor (0001_schema.sql). The admin panel therefore could NOT
-- see who enrolled or even the real per-session counts, so yoga management was
-- half-blind. This adds admin read (and full manage, e.g. removing a bad
-- enrollment) so the admin can follow the whole yoga process.
-- ============================================================================

drop policy if exists "yoga_enroll_admin" on public.yoga_enrollments;
create policy "yoga_enroll_admin" on public.yoga_enrollments for all
  using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- Verify: an admin session can now count enrollments.
select count(*) as total_enrollments from public.yoga_enrollments;
