-- Reveal assessment questions only after an authenticated student's attempt starts.
-- RLS filters published rows, but alone cannot conceal columns from SELECT *.
-- This migration grants the browser only challenge metadata columns.
-- Do not grant unrestricted SELECT on public.tasks back to anon/authenticated.

revoke select on table public.tasks from public, anon, authenticated;

grant select (
  id, slug, title, concept, difficulty, duration_seconds,
  pass_mark, skills, status, created_at, updated_at
) on public.tasks to anon, authenticated;

-- The authenticated server verifies attempt ownership and expiry. It may then
-- fetch question prompts via a server-only service role client. The service role
-- credential must never be sent to browsers or embedded in NEXT_PUBLIC_* vars.
