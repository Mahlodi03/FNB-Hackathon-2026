-- Keep published student result summaries visible to signed-in directory users,
-- but restrict shared answer/feedback details to employers, administrators, or
-- the student who owns the attempt. Student consent remains mandatory for all.
-- This is a DB-side guard: hiding a Next.js link alone would not protect the RPC.
begin;

create or replace function public.public_student_submission_detail(p_attempt_id uuid)
returns table(task_title text, theory_answer text, practical_answer text,
              understanding_question text, understanding_answer text,
              feedback text, overall_score numeric, graded_at timestamptz)
language sql stable security definer set search_path = '' as $$
 select t.title,a.theory_answer,a.practical_answer,a.understanding_question,
        a.understanding_answer,r.feedback,r.overall_score,r.graded_at
 from public.attempts a
 join public.profiles p on p.id=a.student_id
 join public.tasks t on t.id=a.task_id
 join public.results r on r.attempt_id=a.id
 where a.id=p_attempt_id and p.role='student' and p.is_public=true
       and a.share_submission=true and r.passed=true
       and r.visibility='published' and r.grading_source='ai_assisted'
       and exists (
         select 1 from public.profiles viewer
         where viewer.id = (select auth.uid())
           and (viewer.role in ('employer','admin') or viewer.id = a.student_id)
       );
$$;
revoke all on function public.public_student_submission_detail(uuid) from public,anon;
grant execute on function public.public_student_submission_detail(uuid) to authenticated;

commit;
