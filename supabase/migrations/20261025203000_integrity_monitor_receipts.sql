-- Phase 2: SERVER-RECEIVED, CLIENT-REPORTED monitoring receipts (observation only).
-- Never store images, video, face identifiers, browser fingerprinting, or sealed answers.
-- Never use a receipt to prove identity, misconduct or eligibility for automatic clearance.
create table if not exists public.integrity_monitor_receipts (
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  time_bucket bigint not null check (time_bucket > 0),
  received_at timestamptz not null default now(),
  camera_track_live boolean not null,
  fullscreen_active boolean not null,
  page_visible boolean not null,
  constraint integrity_monitor_receipts_pkey primary key (attempt_id, time_bucket)
);
create index if not exists integrity_monitor_receipts_attempt_time_idx
  on public.integrity_monitor_receipts (attempt_id, received_at);

alter table public.integrity_monitor_receipts enable row level security;
-- No browser insert/select/update/delete policies. Next.js validates student ownership,
-- active attempt and original expiry; server-only service role performs inserts/reads.
revoke all on table public.integrity_monitor_receipts from public, anon, authenticated;
grant select, insert on table public.integrity_monitor_receipts to service_role;
