-- Student directory and published submissions require sign-in, even if a user
-- attempts to bypass the Next.js pages and call Supabase's public API directly.
-- All student-public profile preferences and result-sharing conditions remain.

drop policy if exists profile_select on public.profiles;
create policy profile_select on public.profiles
for select to authenticated
using (id = (select auth.uid()) or (role = 'student' and is_public = true));

revoke execute on function public.public_student_result_cards(uuid) from anon;
revoke execute on function public.public_student_submission_detail(uuid) from anon;
-- authenticated was explicitly granted in the original migration and remains so.
