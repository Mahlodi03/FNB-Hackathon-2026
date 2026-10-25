-- Student AI Career Coach MVP. Apply ONCE after subscription_foundation.
-- The coach uses a protected quota ledger; no prompts, responses or student
-- assessment evidence are stored here. No payments or billing involved.
begin;

create table public.career_coach_usage (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  status text not null default 'reserved' check (status in ('reserved','completed','failed'))
);
create index career_coach_usage_student_time
  on public.career_coach_usage(student_id,created_at desc);
alter table public.career_coach_usage enable row level security;
revoke all on public.career_coach_usage from public, anon, authenticated;
grant select, insert, update on public.career_coach_usage to service_role;

-- Serialize requests per student by locking the same profile row used by
-- assessment starts. Defend against a direct RPC call with service_role check.
create function public.reserve_career_coach_request(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_now timestamptz;
  v_today timestamptz;
  v_used integer;
  v_last timestamptz;
  v_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select p.role into v_role from public.profiles p
    where p.id = p_student_id for update;
  if v_role is distinct from 'student' then
    return jsonb_build_object('status','not_eligible');
  end if;
  v_now := clock_timestamp();
  if not exists (
    select 1 from public.account_entitlements e
    where e.user_id = p_student_id and e.plan = 'premium'
      and e.source = 'admin_demo' and e.expires_at > v_now
  ) then
    return jsonb_build_object('status','not_eligible');
  end if;

  -- Count every reservation, including failures, to limit repeated AI charges.
  -- Period resets at UTC midnight rather than local browser midnight.
  v_today := date_trunc('day',v_now at time zone 'UTC') at time zone 'UTC';
  select count(*)::integer into v_used from public.career_coach_usage u
    where u.student_id = p_student_id and u.created_at >= v_today;
  if v_used >= 5 then
    return jsonb_build_object('status','daily_limit');
  end if;
  select max(u.created_at) into v_last from public.career_coach_usage u
    where u.student_id = p_student_id;
  if v_last is not null and v_last > v_now - interval '60 seconds' then
    return jsonb_build_object('status','cooldown');
  end if;

  insert into public.career_coach_usage(student_id,created_at)
    values(p_student_id,v_now) returning id into v_id;
  return jsonb_build_object('status','reserved','requestId',v_id);
end;
$$;
revoke all on function public.reserve_career_coach_request(uuid) from public, anon, authenticated;
grant execute on function public.reserve_career_coach_request(uuid) to service_role;

create function public.finish_career_coach_request(
  p_student_id uuid, p_request_id uuid, p_success boolean
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  update public.career_coach_usage
    set status = case when p_success then 'completed' else 'failed' end
    where id = p_request_id and student_id = p_student_id and status = 'reserved';
end;
$$;
revoke all on function public.finish_career_coach_request(uuid,uuid,boolean)
  from public, anon, authenticated;
grant execute on function public.finish_career_coach_request(uuid,uuid,boolean)
  to service_role;
commit;
