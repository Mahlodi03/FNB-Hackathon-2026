-- Assessment recovery: editable drafts are separate from immutable submitted answers.
-- Existing RLS policies remain unchanged. Only authorized server routes update these fields.
alter table public.attempts
  add column if not exists theory_draft text,
  add column if not exists practical_draft text,
  add column if not exists understanding_draft text,
  add column if not exists draft_updated_at timestamptz;

-- Keep the existing assessment answer size limits consistent with API validation.
-- Drafts are private to the student under the existing attempts RLS policy.
