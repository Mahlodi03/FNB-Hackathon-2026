-- Phase 3B1: Atomic system clearance with TWO rollout gates, BOTH OFF by default.
-- Do not enable the switch or allowlist until a separate, controlled live test is approved.
-- No scheduled job or application endpoint invokes this RPC in Phase 3B1.
-- A service-role call is necessary but insufficient: global enablement AND explicit
-- allowlisting of the specific attempt are also required.

create table public.integrity_auto_clearance_settings (
  singleton boolean primary key default true check (singleton = true),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.integrity_auto_clearance_settings(singleton, enabled)
values (true, false);

create table public.integrity_auto_clearance_allowlist (
  attempt_id uuid primary key references public.attempts(id) on delete restrict,
  allowed_at timestamptz not null default now(),
  note text not null check (char_length(btrim(note)) between 20 and 500)
);

-- Separate from human review history. Do not pretend a system decision was made
-- by a human reviewer. One immutable, idempotent clearance record per attempt.
create table public.integrity_system_clearance_history (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.attempts(id) on delete restrict,
  actor_kind text not null default 'system' check (actor_kind = 'system'),
  decision text not null default 'cleared' check (decision = 'cleared'),
  policy_version text not null check (policy_version = 'integrity-system-clearance-2026-10-25-pilot-v1'),
  reason_codes text[] not null check (cardinality(reason_codes) between 1 and 20),
  previous_visibility text not null check (previous_visibility = 'withheld'),
  new_visibility text not null check (new_visibility = 'published'),
  integrity_event_count integer not null check (integrity_event_count between 0 and 2),
  monitoring_receipt_count integer not null check (monitoring_receipt_count between 2 and 600),
  max_receipt_gap_seconds numeric(10,3) not null check (max_receipt_gap_seconds between 0 and 60),
  decided_at timestamptz not null default clock_timestamp()
);
create index integrity_system_clearance_history_time_idx
  on public.integrity_system_clearance_history(decided_at desc);

alter table public.integrity_auto_clearance_settings enable row level security;
alter table public.integrity_auto_clearance_allowlist enable row level security;
alter table public.integrity_system_clearance_history enable row level security;

-- No browser-facing RLS policies. Service-role code can inspect, but CANNOT
-- enable the switch, create allowlist rows, or directly insert audit records.
-- Only a project database administrator may update the first two tables.
revoke all on table
  public.integrity_auto_clearance_settings,
  public.integrity_auto_clearance_allowlist,
  public.integrity_system_clearance_history
  from public, anon, authenticated, service_role;
grant select on table
  public.integrity_auto_clearance_settings,
  public.integrity_auto_clearance_allowlist,
  public.integrity_system_clearance_history to service_role;

-- Reuse the already-installed immutable human history trigger function.
create trigger integrity_system_clearance_history_immutable
before update or delete on public.integrity_system_clearance_history
for each row execute function public.reject_integrity_review_history_mutation();

-- All eligibility is recomputed INSIDE the same SQL transaction that publishes.
-- Any data calculated earlier by an HTTP API is NOT trusted as authorization.
-- Browser receipts are self-reported; they only measure timely transport.
create function public.try_system_integrity_clearance(p_attempt_id uuid)
returns table(outcome text, clearance_id uuid, visibility text)
language plpgsql security definer set search_path = '' as $$
declare
  v_enabled boolean;
  v_attempt_status text;
  v_started timestamptz;
  v_expires timestamptz;
  v_submitted timestamptz;
  v_result_visibility text;
  v_passed boolean;
  v_grading_source text;
  v_graded_at timestamptz;
  v_history_id uuid;
  v_event_count integer;
  v_receipt_count integer;
  v_unhealthy_count integer;
  v_first_receipt timestamptz;
  v_last_receipt timestamptz;
  v_max_gap_seconds numeric;
  v_now timestamptz := clock_timestamp();
  v_affected integer;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'System clearance RPC unavailable' using errcode = '42501';
  end if;
  if p_attempt_id is null then
    raise exception 'Attempt ID is required' using errcode = '22023';
  end if;

  -- Lock the enablement row against simultaneous administrator changes.
  select s.enabled into v_enabled
    from public.integrity_auto_clearance_settings s
    where s.singleton = true for share;
  if v_enabled is distinct from true then
    return query select 'disabled'::text, null::uuid, null::text;
    return;
  end if;

  -- An explicit allowlist entry is required for every pilot attempt.
  perform 1 from public.integrity_auto_clearance_allowlist x
    where x.attempt_id = p_attempt_id for share;
  if not found then
    return query select 'not_allowlisted'::text, null::uuid, null::text;
    return;
  end if;

  -- Match the human review RPC's lock order. Under READ COMMITTED this also
  -- serializes against concurrent human decisions for this same attempt.
  select a.status, a.started_at, a.expires_at, a.submitted_at,
         r.visibility, r.passed, r.grading_source, r.graded_at
    into v_attempt_status, v_started, v_expires, v_submitted,
         v_result_visibility, v_passed, v_grading_source, v_graded_at
    from public.attempts a
    join public.results r on r.attempt_id = a.id
    where a.id = p_attempt_id
    for update of a, r;
  if not found then
    return query select 'not_graded_or_missing'::text, null::uuid, null::text;
    return;
  end if;

  -- The human decision may have committed while we waited on the row lock.
  -- Check both the state AND immutable history to catch legacy mismatches.
  if exists (select 1 from public.integrity_review_state s where s.attempt_id = p_attempt_id)
     or exists (select 1 from public.integrity_review_history h where h.attempt_id = p_attempt_id) then
    return query select 'human_decision_exists'::text, null::uuid, v_result_visibility;
    return;
  end if;

  select h.id into v_history_id from public.integrity_system_clearance_history h
    where h.attempt_id = p_attempt_id;
  if found then
    return query select 'already_recorded'::text, v_history_id, v_result_visibility;
    return;
  end if;

  if v_attempt_status is distinct from 'graded'
     or v_passed is distinct from true
     or v_grading_source is distinct from 'ai_assisted'
     or v_result_visibility is distinct from 'withheld'
     or v_started is null or v_expires is null or v_submitted is null
     or v_expires <= v_started or v_submitted < v_started
     or v_submitted > v_expires or v_graded_at is null
     or v_graded_at > v_now - interval '2 minutes'
     or v_submitted > v_now - interval '2 minutes' then
    return query select 'ineligible_result_or_unsettled'::text, null::uuid, v_result_visibility;
    return;
  end if;

  -- Strictly match the routine-only shadow proposal: zero or at most two
  -- ISOLATED navigation events. Face, camera, clipboard, and all other event
  -- classes are NOT automatically cleared in the pilot.
  select count(*)::integer into v_event_count
    from (select 1 from public.integrity_events e
          where e.attempt_id = p_attempt_id limit 3) limited_events;
  if v_event_count > 2 or exists (
    select 1 from public.integrity_events e
    where e.attempt_id = p_attempt_id
      and (e.event_type not in ('window_blur', 'tab_hidden', 'fullscreen_exit')
           or e.recorded_at < v_started or e.recorded_at > v_submitted)
  ) then
    return query select 'integrity_exception'::text, null::uuid, v_result_visibility;
    return;
  end if;

  -- Receipts are server timestamped but their booleans are browser claims,
  -- not proof of identity, camera presence, or absence of misconduct.
  select count(*)::integer,
         count(*) filter (where not (r.camera_track_live and r.fullscreen_active and r.page_visible))::integer,
         min(r.received_at), max(r.received_at)
    into v_receipt_count, v_unhealthy_count, v_first_receipt, v_last_receipt
    from public.integrity_monitor_receipts r where r.attempt_id = p_attempt_id;
  if v_receipt_count < 2 or v_receipt_count > 600 or v_unhealthy_count > 0
     or v_first_receipt < v_started or v_last_receipt > v_submitted then
    return query select 'monitoring_unverified_or_incomplete'::text, null::uuid, v_result_visibility;
    return;
  end if;

  select greatest(
    coalesce(max(extract(epoch from (timing.received_at - timing.previous_at))), 0),
    extract(epoch from (v_submitted - v_last_receipt))
  ) into v_max_gap_seconds
  from (
    select r.received_at,
           lag(r.received_at, 1, v_started) over (order by r.received_at, r.time_bucket) as previous_at
    from public.integrity_monitor_receipts r where r.attempt_id = p_attempt_id
  ) timing;
  if v_max_gap_seconds is null or v_max_gap_seconds > 60 then
    return query select 'monitoring_gaps'::text, null::uuid, v_result_visibility;
    return;
  end if;

  -- Publication and immutable audit are ONE atomic database transaction.
  -- A failed insert rolls back the visibility update. No grade is modified.
  update public.results
    set visibility = 'published'
    where attempt_id = p_attempt_id and visibility = 'withheld'
      and passed = true and grading_source = 'ai_assisted';
  get diagnostics v_affected = row_count;
  if v_affected <> 1 then
    raise exception 'Concurrent result change' using errcode = '40001';
  end if;

  insert into public.integrity_system_clearance_history
    (attempt_id, policy_version, reason_codes, previous_visibility, new_visibility,
     integrity_event_count, monitoring_receipt_count, max_receipt_gap_seconds)
  values (p_attempt_id, 'integrity-system-clearance-2026-10-25-pilot-v1',
          array['GRADED_PASSING_RESULT','HUMAN_DECISION_ABSENT','ISOLATED_OR_NO_NAVIGATION_WARNINGS',
                'REGULAR_RECEIPT_TRANSPORT_NOT_INDEPENDENT_CAMERA_PROOF'],
          'withheld','published', v_event_count, v_receipt_count, v_max_gap_seconds)
  returning id into v_history_id;

  return query select 'cleared'::text, v_history_id, 'published'::text;
end;
$$;

-- No browser role can execute the transaction. With BOTH rollout gates off,
-- even the service role receives only 'disabled' and makes no changes.
revoke all on function public.try_system_integrity_clearance(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.try_system_integrity_clearance(uuid) to service_role;
