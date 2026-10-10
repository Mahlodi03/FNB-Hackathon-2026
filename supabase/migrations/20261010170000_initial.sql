-- Ready For Work schema v1. Apply in a fresh Supabase project via migrations.
-- Safety model: database owner/service role writes assessments after authenticated API checks.
-- Browser clients have no direct write permission to attempts, results, flags or tasks.
create extension if not exists pgcrypto;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check (length(username) between 3 and 50),
 role text not null default 'student' check (role in ('student','employer','admin')),
 full_name text not null default '',
 institution text,
 field_of_interest text,
 bio text,
 avatar_url text,
 is_public boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create or replace function public.create_profile_after_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
declare requested_role text;
begin
 requested_role := new.raw_user_meta_data->>'role';
 if requested_role not in ('student','employer') or requested_role is null then
   requested_role := 'student';
 end if;
 insert into public.profiles(id, username, role, full_name)
 values (new.id, 'user_' || replace(left(new.id::text, 18), '-', ''), requested_role,
         left(coalesce(new.raw_user_meta_data->>'full_name', ''), 160));
 return new;
end $$;
create trigger auth_user_created after insert on auth.users
for each row execute procedure public.create_profile_after_signup();

create or replace function public.prevent_role_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if new.role is distinct from old.role or new.id is distinct from old.id then
   raise exception 'role and id are immutable in normal profile updates';
 end if;
 new.updated_at := now();
 return new;
end $$;
create trigger guard_profile_role before update on public.profiles
for each row execute procedure public.prevent_role_change();
-- Promote a specific account to admin via trusted SQL maintenance only, never via signup.
-- Temporarily disabling the above trigger for trusted maintenance is an explicit operator action.

create table public.tasks (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique,
 title text not null,
 concept text not null,
 difficulty text not null check (difficulty in ('beginner','intermediate','advanced')),
 duration_seconds integer not null check (duration_seconds between 300 and 14400),
 theory_prompt text not null,
 practical_prompt text not null,
 understanding_guidance text not null,
 rubric jsonb not null,
 pass_mark integer not null check (pass_mark between 1 and 100),
 skills text[] not null default '{}',
 status text not null default 'draft' check (status in ('draft','published')),
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.attempts (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.profiles(id),
 task_id uuid not null references public.tasks(id),
 status text not null default 'in_progress' check (status in ('in_progress','awaiting_understanding','submitted','graded','invalidated')),
 theory_answer text,
 practical_answer text,
 understanding_question text,
 understanding_answer text,
 rules_accepted_at timestamptz not null,
 started_at timestamptz not null default now(),
 expires_at timestamptz not null,
 submitted_at timestamptz,
 invalidated_reason text,
 share_submission boolean not null default false,
 created_at timestamptz not null default now(),
 constraint attempt_expiry_after_start check (expires_at > started_at)
);
-- Enforce one assessment start per student/task for hackathon MVP; define policy for interrupted starts separately.
create unique index one_attempt_per_student_task on public.attempts(student_id,task_id);
create index attempts_student_idx on public.attempts(student_id,created_at desc);

create table public.integrity_events (
 id uuid primary key default gen_random_uuid(),
 attempt_id uuid not null references public.attempts(id) on delete cascade,
 event_type text not null check(event_type in (
   'tab_hidden','window_blur','fullscreen_exit','paste_attempt','copy_attempt',
   'camera_track_ended','face_missing','multiple_faces','display_change','permission_lost')),
 client_claimed_at timestamptz,
 recorded_at timestamptz not null default now()
);
create index integrity_attempt_idx on public.integrity_events(attempt_id,recorded_at desc);

create table public.results (
 id uuid primary key default gen_random_uuid(),
 attempt_id uuid not null unique references public.attempts(id) on delete cascade,
 theory_score numeric(5,2) not null check (theory_score between 0 and 100),
 practical_score numeric(5,2) not null check (practical_score between 0 and 100),
 understanding_score numeric(5,2) not null check (understanding_score between 0 and 100),
 overall_score numeric(5,2) not null check (overall_score between 0 and 100),
 passed boolean not null,
 feedback text not null,
 strengths jsonb not null default '[]'::jsonb,
 improvements jsonb not null default '[]'::jsonb,
 grading_source text not null check (grading_source in ('ai_assisted','manual_review')),
 visibility text not null default 'provisional' check (visibility in ('provisional','published','withheld')),
 graded_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.attempts enable row level security;
alter table public.integrity_events enable row level security;
alter table public.results enable row level security;

create policy profile_select on public.profiles for select to anon,authenticated
using (id = (select auth.uid()) or (role = 'student' and is_public = true));
create policy profile_self_edit on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- prevent_role_change trigger prevents role privilege escalation (even with broad update column grants).
create policy task_read_published on public.tasks for select to anon,authenticated
using (status = 'published');
-- Public submission details deliberately flow ONLY through the consent-filtered RPC below.
-- RLS directly grants owners read access to raw answers/scores; no circular RLS joins.
create policy attempt_read_own on public.attempts for select to authenticated
using (student_id = (select auth.uid()));
create policy results_read_own on public.results for select to authenticated
using (exists (select 1 from public.attempts a
 where a.id = results.attempt_id and a.student_id = (select auth.uid())));
create policy events_read_own on public.integrity_events for select to authenticated
using (exists (select 1 from public.attempts a where a.id = integrity_events.attempt_id and a.student_id=(select auth.uid())));
-- The absence of insert/update/delete RLS policies blocks browser writes. Protected Next.js
-- route handlers verify user+ownership+role, validate Zod, then use server-only service role.
-- Never return private integrity events on public profile APIs.

-- Purpose-built safe public card projection. Anyone may see summary cards for a publicly
-- opted-in student, but this function never returns feedback, private answers or warnings.
create or replace function public.public_student_result_cards(p_student_id uuid)
returns table(attempt_id uuid, task_id uuid, task_title text, concept text, skills text[],
              overall_score numeric, graded_at timestamptz)
language sql stable security definer set search_path = '' as $$
 select a.id,t.id,t.title,t.concept,t.skills,r.overall_score,r.graded_at
 from public.profiles p
 join public.attempts a on a.student_id=p.id
 join public.results r on r.attempt_id=a.id
 join public.tasks t on t.id=a.task_id
 where p.id = p_student_id and p.role='student' and p.is_public = true
   and r.passed=true and r.visibility='published' and r.grading_source='ai_assisted'
 order by r.graded_at desc;
$$;
revoke all on function public.public_student_result_cards(uuid) from public;
grant execute on function public.public_student_result_cards(uuid) to anon,authenticated;

-- Detailed public submission - consent gate applied inside trusted SQL; no raw media or warnings.
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
       and r.visibility='published' and r.grading_source='ai_assisted';
$$;
revoke all on function public.public_student_submission_detail(uuid) from public;
grant execute on function public.public_student_submission_detail(uuid) to anon,authenticated;
