-- Human Integrity Review: privileged, atomic decisions with an append-only audit.
-- Apply once to ready-for-work-dev AFTER the existing assessment migrations.
-- Do not expose either review table or this RPC to anon/authenticated clients.

create table public.integrity_review_history (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete restrict,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check (decision in ('cleared', 'needs_investigation', 'withheld')),
  reason text not null check (char_length(btrim(reason)) between 20 and 2000),
  previous_visibility text not null check (previous_visibility in ('provisional', 'published', 'withheld')),
  new_visibility text not null check (new_visibility in ('provisional', 'published', 'withheld')),
  reviewed_at timestamptz not null default clock_timestamp()
);
create index integrity_review_history_attempt_idx
  on public.integrity_review_history(attempt_id, reviewed_at desc, id desc);

-- State is a fast lookup for the current decision. History never gets overwritten.
create table public.integrity_review_state (
  attempt_id uuid primary key references public.attempts(id) on delete restrict,
  review_id uuid not null references public.integrity_review_history(id) on delete restrict,
  decision text not null check (decision in ('cleared', 'needs_investigation', 'withheld')),
  reviewed_at timestamptz not null,
  reviewer_id uuid not null references public.profiles(id) on delete restrict
);

alter table public.integrity_review_history enable row level security;
alter table public.integrity_review_state enable row level security;
-- Service role is used only by authenticated, admin-authorized server routes.
-- There are deliberately no browser-facing RLS policies.
revoke all on table public.integrity_review_history, public.integrity_review_state from public, anon, authenticated;
grant select on table public.integrity_review_history, public.integrity_review_state to service_role;

-- Append-only protection, including accidental direct service-role edits.
create function public.reject_integrity_review_history_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Integrity review history is immutable';
end;
$$;
create trigger integrity_review_history_immutable
before update or delete on public.integrity_review_history
for each row execute function public.reject_integrity_review_history_mutation();

-- Access to this function is REVOKED from browsers. It is invoked by the trusted
-- Next.js server after requireActor(['admin']), using the service-role key.
-- It verifies the supplied reviewer against the database again, and serializes
-- concurrent decisions with a row lock on the graded result.
create function public.record_integrity_review(
  p_attempt_id uuid, p_reviewer_id uuid, p_decision text, p_reason text
)
returns table(review_id uuid, visibility text, reviewed_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
  v_old_visibility text;
  v_new_visibility text;
  v_passed boolean;
  v_grading_source text;
  v_review_id uuid;
  v_reviewed_at timestamptz;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Review RPC unavailable' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id=p_reviewer_id and role='admin') then
    raise exception 'Reviewer is not an administrator' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('cleared','needs_investigation','withheld')
    or char_length(v_reason) not between 20 and 2000 then
    raise exception 'Invalid review decision or reason' using errcode = '22023';
  end if;

  select a.status, r.visibility, r.passed, r.grading_source
    into v_status, v_old_visibility, v_passed, v_grading_source
  from public.attempts a
  join public.results r on r.attempt_id = a.id
  where a.id = p_attempt_id
  for update of a, r;

  if not found or v_status <> 'graded' then
    raise exception 'A completed graded attempt is required for review' using errcode = 'P0002';
  end if;

  -- Clearing an attempt never changes the grade or publishes an ineligible result.
  if p_decision = 'cleared' then
    v_new_visibility := case when v_passed and v_grading_source = 'ai_assisted'
      then 'published' else 'provisional' end;
  else
    v_new_visibility := 'withheld';
  end if;

  update public.results set visibility=v_new_visibility where attempt_id=p_attempt_id;
  insert into public.integrity_review_history
    (attempt_id, reviewer_id, decision, reason, previous_visibility, new_visibility)
  values (p_attempt_id, p_reviewer_id, p_decision, v_reason, v_old_visibility, v_new_visibility)
  returning id, integrity_review_history.reviewed_at into v_review_id, v_reviewed_at;

  insert into public.integrity_review_state
    (attempt_id, review_id, decision, reviewer_id, reviewed_at)
  values (p_attempt_id, v_review_id, p_decision, p_reviewer_id, v_reviewed_at)
  on conflict (attempt_id) do update set
    review_id=excluded.review_id,
    decision=excluded.decision,
    reviewer_id=excluded.reviewer_id,
    reviewed_at=excluded.reviewed_at;

  return query select v_review_id, v_new_visibility, v_reviewed_at;
end;
$$;

revoke all on function public.record_integrity_review(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.record_integrity_review(uuid,uuid,text,text) to service_role;
revoke all on function public.reject_integrity_review_history_mutation() from public, anon, authenticated;
