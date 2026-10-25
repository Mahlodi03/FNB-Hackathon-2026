-- Ready For Work Employer AI Talent Matching MVP. Apply ONCE to development DB.
-- Private employer job briefs, service-role-only state, public-consented published evidence.
-- Existing assessments, privacy policies, results, and integrity records are not changed.
begin;

create table public.talent_job_briefs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 5 and 100),
  description text not null check (char_length(btrim(description)) between 50 and 1600),
  required_skills text[] not null check (cardinality(required_skills) between 1 and 8),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default clock_timestamp()
);
create index talent_briefs_owner_idx on public.talent_job_briefs(employer_id,status,created_at desc);
create table public.talent_match_runs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.profiles(id) on delete cascade,
  brief_id uuid not null references public.talent_job_briefs(id) on delete restrict,
  status text not null default 'reserved' check (status in ('reserved','completed','failed')),
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz
);
create index talent_runs_owner_month_idx on public.talent_match_runs(employer_id,created_at desc);
create table public.talent_shortlists (
  employer_id uuid not null references public.profiles(id) on delete cascade,
  brief_id uuid not null references public.talent_job_briefs(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  saved_at timestamptz not null default clock_timestamp(),
  primary key (employer_id,brief_id,student_id)
);
create index talent_shortlists_owner_idx on public.talent_shortlists(employer_id,brief_id);

alter table public.talent_job_briefs enable row level security;
alter table public.talent_match_runs enable row level security;
alter table public.talent_shortlists enable row level security;
revoke all on public.talent_job_briefs, public.talent_match_runs, public.talent_shortlists from public,anon,authenticated;
grant select,insert,update on public.talent_job_briefs to service_role;
grant select,insert,update on public.talent_match_runs to service_role;
grant select,insert,delete on public.talent_shortlists to service_role;

-- Calls below are only executed by protected server APIs with service-role credentials.
-- Defense in depth: every mutation revalidates employer role and active demo Premium.
create function public.talent_create_brief(p_employer_id uuid,p_title text,p_description text,p_skills text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_count int; v_now timestamptz;
begin
  select id into v_id from public.profiles where id=p_employer_id and role='employer' for update;
  if not found then return jsonb_build_object('status','not_eligible'); end if;
  v_now:=clock_timestamp();
  if not exists(select 1 from public.account_entitlements where user_id=p_employer_id and plan='premium'
    and source='admin_demo' and expires_at>v_now) then return jsonb_build_object('status','not_eligible'); end if;
  if p_title is null or char_length(btrim(p_title)) not between 5 and 100
    or p_description is null or char_length(btrim(p_description)) not between 50 and 1600
    or cardinality(p_skills) not between 1 and 8 then return jsonb_build_object('status','invalid'); end if;
  select count(*) into v_count from public.talent_job_briefs where employer_id=p_employer_id and status='active';
  if v_count>=3 then return jsonb_build_object('status','brief_limit'); end if;
  insert into public.talent_job_briefs(employer_id,title,description,required_skills)
  values(p_employer_id,btrim(p_title),btrim(p_description),p_skills) returning id into v_id;
  return jsonb_build_object('status','created','briefId',v_id);
end; $$;
revoke all on function public.talent_create_brief(uuid,text,text,text[]) from public,anon,authenticated;
grant execute on function public.talent_create_brief(uuid,text,text,text[]) to service_role;

create function public.talent_archive_brief(p_employer_id uuid,p_brief_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text;
begin
  select role into v_role from public.profiles where id=p_employer_id;
  if v_role is distinct from 'employer' then return jsonb_build_object('status','not_eligible'); end if;
  if not exists(select 1 from public.account_entitlements where user_id=p_employer_id and plan='premium'
    and source='admin_demo' and expires_at>clock_timestamp()) then return jsonb_build_object('status','not_eligible'); end if;
  update public.talent_job_briefs set status='archived'
    where id=p_brief_id and employer_id=p_employer_id and status='active';
  if not found then return jsonb_build_object('status','not_found'); end if;
  return jsonb_build_object('status','archived');
end; $$;
revoke all on function public.talent_archive_brief(uuid,uuid) from public,anon,authenticated;
grant execute on function public.talent_archive_brief(uuid,uuid) to service_role;

create function public.talent_reserve_run(p_employer_id uuid,p_brief_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_profile uuid; v_count int; v_run uuid; v_now timestamptz; v_month timestamptz;
begin
  -- A row lock serializes simultaneous runs for *different* briefs by this employer.
  select id into v_profile from public.profiles where id=p_employer_id and role='employer' for update;
  if not found then return jsonb_build_object('status','not_eligible'); end if;
  v_now:=clock_timestamp();
  if not exists(select 1 from public.account_entitlements where user_id=p_employer_id and plan='premium'
    and source='admin_demo' and expires_at>v_now) then return jsonb_build_object('status','not_eligible'); end if;
  if not exists(select 1 from public.talent_job_briefs where id=p_brief_id and employer_id=p_employer_id and status='active')
  then return jsonb_build_object('status','not_found'); end if;
  v_month:=date_trunc('month',v_now at time zone 'UTC') at time zone 'UTC';
  select count(*) into v_count from public.talent_match_runs
    where employer_id=p_employer_id and created_at>=v_month;
  if v_count>=20 then return jsonb_build_object('status','monthly_limit'); end if;
  insert into public.talent_match_runs(employer_id,brief_id) values(p_employer_id,p_brief_id) returning id into v_run;
  return jsonb_build_object('status','reserved','runId',v_run);
end; $$;
revoke all on function public.talent_reserve_run(uuid,uuid) from public,anon,authenticated;
grant execute on function public.talent_reserve_run(uuid,uuid) to service_role;

create function public.talent_finish_run(p_employer_id uuid,p_run_id uuid,p_success boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.talent_match_runs set status=case when p_success then 'completed' else 'failed' end,
    completed_at=clock_timestamp()
  where id=p_run_id and employer_id=p_employer_id and status='reserved';
end; $$;
revoke all on function public.talent_finish_run(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.talent_finish_run(uuid,uuid,boolean) to service_role;

-- Includes ONLY opted-in students and their published passing AI-assisted result cards.
-- Does not expose submissions, grades, integrity events, feedback, sealed questions or PII to AI.
create function public.talent_public_evidence()
returns table(student_id uuid,username text,full_name text,field_of_interest text,
              task_title text,concept text,skills text[])
language sql stable security definer set search_path='' as $$
  select p.id,p.username,p.full_name,p.field_of_interest,t.title,t.concept,t.skills
  from public.profiles p
  join public.attempts a on a.student_id=p.id
  join public.results r on r.attempt_id=a.id
  join public.tasks t on t.id=a.task_id
  where p.role='student' and p.is_public=true
    and r.passed=true and r.visibility='published' and r.grading_source='ai_assisted'
  order by p.id,r.graded_at desc
  limit 1500;
$$;
revoke all on function public.talent_public_evidence() from public,anon,authenticated;
grant execute on function public.talent_public_evidence() to service_role;

create function public.talent_save_shortlist(p_employer_id uuid,p_brief_id uuid,p_student_id uuid,p_save boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text;
begin
  select role into v_role from public.profiles where id=p_employer_id;
  if v_role is distinct from 'employer' or not exists(select 1 from public.account_entitlements
    where user_id=p_employer_id and plan='premium' and source='admin_demo' and expires_at>clock_timestamp())
  then return jsonb_build_object('status','not_eligible'); end if;
  if not exists(select 1 from public.talent_job_briefs where id=p_brief_id and employer_id=p_employer_id)
  then return jsonb_build_object('status','not_found'); end if;
  if p_save then
    if not exists(select 1 from public.profiles p join public.attempts a on a.student_id=p.id
      join public.results r on r.attempt_id=a.id
      where p.id=p_student_id and p.role='student' and p.is_public=true
        and r.passed=true and r.visibility='published' and r.grading_source='ai_assisted')
    then return jsonb_build_object('status','not_available'); end if;
    insert into public.talent_shortlists(employer_id,brief_id,student_id)
      values(p_employer_id,p_brief_id,p_student_id) on conflict do nothing;
  else
    delete from public.talent_shortlists where employer_id=p_employer_id
      and brief_id=p_brief_id and student_id=p_student_id;
  end if;
  return jsonb_build_object('status',case when p_save then 'saved' else 'removed' end);
end; $$;
revoke all on function public.talent_save_shortlist(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.talent_save_shortlist(uuid,uuid,uuid,boolean) to service_role;

-- A saved shortlist is shown only while the student remains opted in AND has
-- eligible published passing evidence. Withdrawal never leaves a stale profile visible.
create function public.talent_visible_shortlists(p_employer_id uuid)
returns table(brief_id uuid,student_id uuid,username text,full_name text)
language sql stable security definer set search_path='' as $$
  select s.brief_id,p.id,p.username,p.full_name from public.talent_shortlists s
  join public.profiles p on p.id=s.student_id
  where s.employer_id=p_employer_id and p.role='student' and p.is_public=true
    and exists(select 1 from public.attempts a join public.results r on r.attempt_id=a.id
      where a.student_id=p.id and r.passed=true and r.visibility='published' and r.grading_source='ai_assisted')
  order by s.saved_at desc limit 100;
$$;
revoke all on function public.talent_visible_shortlists(uuid) from public,anon,authenticated;
grant execute on function public.talent_visible_shortlists(uuid) to service_role;

commit;
