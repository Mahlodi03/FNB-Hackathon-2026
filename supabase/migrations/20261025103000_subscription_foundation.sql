-- Ready For Work — hackathon subscription foundation.
-- Apply ONCE to ready-for-work-dev before deploying the matching API code.
-- Demo entitlements are NOT paid subscriptions. No billing integration is present.
-- Existing attempts count toward the ten lifetime Free starts.
begin;

create table public.account_entitlements (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan text not null default 'premium' check (plan = 'premium'),
  source text not null default 'admin_demo' check (source = 'admin_demo'),
  expires_at timestamptz not null,
  granted_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entitlement_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  admin_id uuid not null references public.profiles(id),
  action text not null check (action in ('grant','revoke')),
  expires_at timestamptz,
  recorded_at timestamptz not null default now()
);

alter table public.account_entitlements enable row level security;
alter table public.entitlement_audit enable row level security;
revoke all on table public.account_entitlements from public, anon, authenticated;
revoke all on table public.entitlement_audit from public, anon, authenticated;
grant select, insert, update, delete on table public.account_entitlements to service_role;
grant select, insert on table public.entitlement_audit to service_role;
-- No browser RLS policies: only the protected service-role server API reads/writes.

-- Uses the student's profile row as a transaction lock to serialize *all* starts
-- for the same student, even when requests target different challenges.
-- Ownership and student role are verified again inside the DB transaction.
create function public.start_student_attempt(
  p_student_id uuid,
  p_task_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_duration integer;
  v_existing record;
  v_used integer;
  v_premium boolean;
  v_now timestamptz;
  v_id uuid;
  v_deadline timestamptz;
begin
  select p.role into v_role
    from public.profiles p
    where p.id = p_student_id
    for update;
  if v_role is distinct from 'student' then
    return jsonb_build_object('status','not_available');
  end if;

  -- Use the database clock after acquiring the student lock.
  v_now := clock_timestamp();
  select t.duration_seconds into v_duration
    from public.tasks t
    where t.id = p_task_id and t.status = 'published';
  if not found or v_duration < 300 or v_duration > 14400 then
    return jsonb_build_object('status','not_available');
  end if;

  -- Always check existing attempts BEFORE the free allowance. Reconnects
  -- do not consume another unlock and cannot reset the original deadline.
  select a.id, a.status, a.expires_at into v_existing
    from public.attempts a
    where a.student_id = p_student_id and a.task_id = p_task_id;
  if found then
    if v_existing.status in ('in_progress','awaiting_understanding')
       and v_existing.expires_at > v_now then
      return jsonb_build_object('status','resumed',
        'attemptId',v_existing.id,'expiresAt',v_existing.expires_at);
    end if;
    return jsonb_build_object('status','already_attempted');
  end if;

  select count(*)::integer into v_used
    from public.attempts a where a.student_id = p_student_id;
  select exists (
    select 1 from public.account_entitlements e
    where e.user_id = p_student_id and e.plan = 'premium'
      and e.source = 'admin_demo' and e.expires_at > v_now
  ) into v_premium;

  if v_used >= 10 and not v_premium then
    return jsonb_build_object('status','limit_reached','usedUnlocks',v_used,'freeLimit',10);
  end if;

  v_deadline := v_now + make_interval(secs => v_duration);
  insert into public.attempts (
    student_id, task_id, status, rules_accepted_at, started_at, expires_at
  ) values (p_student_id, p_task_id, 'in_progress',v_now,v_now,v_deadline)
  returning id into v_id;
  return jsonb_build_object('status','created','attemptId',v_id,
    'expiresAt',v_deadline,'usedUnlocks',v_used+1,'freeLimit',10);
end;
$$;
revoke all on function public.start_student_attempt(uuid,uuid) from public, anon, authenticated;
grant execute on function public.start_student_attempt(uuid,uuid) to service_role;

-- Administrator-managed demo activation only, with an audit trail.
-- No client can self-upgrade, and non-admins cannot invoke this function.
create function public.set_demo_entitlement(
  p_admin_id uuid,
  p_user_id uuid,
  p_action text,
  p_days integer default 30
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_admin_role text;
  v_expires timestamptz;
begin
  select role into v_admin_role from public.profiles where id = p_admin_id;
  if v_admin_role is distinct from 'admin' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select role into v_role from public.profiles where id = p_user_id for update;
  if v_role not in ('student','employer') or v_role is null then
    raise exception 'Target must be a student or employer' using errcode = '22023';
  end if;
  if p_action = 'grant' and p_days between 1 and 90 then
    v_expires := clock_timestamp() + make_interval(days => p_days);
    insert into public.account_entitlements(user_id,plan,source,expires_at,granted_by)
      values (p_user_id,'premium','admin_demo',v_expires,p_admin_id)
    on conflict (user_id) do update set
      expires_at = excluded.expires_at,
      granted_by = excluded.granted_by,
      updated_at = clock_timestamp();
  elsif p_action = 'revoke' then
    delete from public.account_entitlements
      where user_id = p_user_id and source = 'admin_demo';
  else
    raise exception 'Invalid entitlement action or duration' using errcode = '22023';
  end if;
  insert into public.entitlement_audit(user_id,admin_id,action,expires_at)
    values (p_user_id,p_admin_id,p_action,v_expires);
  return jsonb_build_object('action',p_action,'expiresAt',v_expires);
end;
$$;
revoke all on function public.set_demo_entitlement(uuid,uuid,text,integer) from public, anon, authenticated;
grant execute on function public.set_demo_entitlement(uuid,uuid,text,integer) to service_role;

commit;
