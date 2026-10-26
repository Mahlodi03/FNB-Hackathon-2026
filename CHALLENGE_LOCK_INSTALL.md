# Ready For Work — Seal assessment questions until the timer starts

## Install

Use on the `feature/figma-polish-stage1` branch (or a new branch from it). Back up your working tree first (`git status`); copy only the files in the accompanying changed-files ZIP into your project root, preserving subdirectories. Do **not** copy older full-project ZIPs over your latest work.

## Required Supabase migration

Apply `supabase/migrations/20261024173000_seal_challenge_questions.sql` to the **development Supabase project** once, after inspecting it. This is essential: simply hiding prompts in Next.js would still allow a browser to query the published `tasks` table directly. The migration removes table-wide SELECT and grants only metadata columns. No new table is required.

Do not use `GRANT SELECT ON public.tasks TO anon, authenticated` or reinstate `SELECT *` access. Admin tasks create/update/archive use server-only `serviceSupabase()` after `requireActor(['admin'])`.

## Expected flow

- `/tasks` shows title, concept, difficulty, time and pass mark only, with **Start challenge**.
- Clicking Start challenge opens `/assessment/{taskId}` with **preflight only**. There are **no hidden prompts in the HTML/React props**.
- Student accepts rules and completes camera/fullscreen preflight.
- POST `/api/attempts/start` creates an attempt, setting the server-owned expiry (timer starts).
- GET `/api/attempts/{attemptId}/challenge` checks student authentication, ownership, active state, and expiry. It returns only theory/practical prompts, not rubric or model guidance.
- Existing AI understanding and grading routes use authorized server-side task reads.
- Old `/tasks/{slug}` links redirect to preflight instead of exposing questions.

## Local checks

```
npm run typecheck
npm test
npm run build
```

Then start `npm run dev` and check as an unauthenticated browser and as a signed-in test student. Under `/api/tasks`, neither `theory_prompt`, `practical_prompt`, `understanding_guidance`, nor `rubric` should appear. Browser-initiated Supabase `tasks?select=theory_prompt` or `tasks?select=*` queries must fail for anon/authenticated users. The metadata query should still work. `GET /api/attempts/{id}/challenge` must return 401 for signed-out users and 404 for an attempt that belongs to another student; it should return prompts only after that student's attempt is successfully created. Check that starting the attempt starts the timer and shows the questions. Test admin task management afterward.

**Test caution**: Your schema allows one attempt per student per task. Use a new test task and account. There is currently no complete resume-from-refresh support, so keep the assessment page open during a timed attempt.

## Caveats

- The question text may still be guessed/shared out-of-band by someone who previously completed a fixed task. To resist memorization, a future iteration should generate variants or select from a secure question pool per attempt.
- Existing public evidence detail can reveal previously submitted *answers* for students who opted in; that may allow preparation on repeated static tasks. Consider holding answer-detail visibility until tasks retire or use per-attempt variants.
- No migrations are automatically applied by extracting a ZIP. Apply in Supabase SQL Editor or use your usual migration process once per environment.
- We have not verified against your live database; the client-side build and live workflow must be checked in your dev environment.
