# Ready For Work — Student AI Career Coach MVP

**Baseline:** uploaded student-ai-career-coach-baseline.zip, containing the Subscription Foundation and prior merged milestones.
**Purpose:** student-only Premium AI guidance using their OWN published passing assessment summaries and public challenge metadata.
**Not included:** real billing, continuous chat history, employer AI matching, changes to assessment grading, changes to sealed challenges.

## Safety and scope

- Server-checked `student` role + active `admin_demo` Premium for BOTH GET and POST. Browser input is only a fixed career-goal enum; user IDs, roles, scores and tasks are never supplied by the browser.
- `loadCareerCoachContext` selects `tasks.id, slug, title, concept, difficulty, skills, duration_seconds` with `status=published`. **Never selects theory_prompt, practical_prompt, understanding_guidance, rubric, answers, results.feedback or integrity events.**
- Evidence comes only from the authenticated student's `getOwnPublishedResults` (own, passing, `published`, `ai_assisted` summaries). It is advisory and not a full skills assessment.
- Recommended challenge IDs are selected deterministically from real published task rows on the server. AI cannot invent a URL, task ID, score or challenge.
- Each successful quota reservation counts toward **5 AI requests per UTC day**, including failed AI calls. **60-second cooldown**. Atomic PostgreSQL reservation serializes concurrent requests per student. No prompts or AI outputs are persisted in the quota ledger.
- Only the **service_role** may read the quota table or execute quota RPCs. Normal students cannot change quota or self-upgrade to Premium. Role+entitlement are rechecked inside the quota RPC.
- `OPENAI_API_KEY` stays server-side; existing `OPENAI_MODEL` is used unless `OPENAI_CAREER_COACH_MODEL` is configured. `store:false`, bounded output tokens, no retry.

## 1. Install source files (do NOT apply SQL yet)

From `C:\Dev\FNB-Hackathon-2026`:

```powershell
# Confirm this branch was created from latest merged develop.
git branch --show-current
git status
# Expected: feature/student-ai-career-coach, clean before ZIP extraction.
```

Extract the companion ZIP into the repository root, preserving paths and overwriting the four intentional existing files (AppShell, dashboard, plans, globals.css).

Review changes:

```powershell
git status --short
git diff --check
git diff --stat
```

## 2. Full local validation

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

All four must succeed before migration. The existing `postcss.config.mjs` anonymous-default-export warning may still be present; zero lint errors are required. New tests are under `src/server/career-coach/rules.test.ts`.

## 3. Apply ONE migration to ready-for-work-dev

In Supabase SQL Editor, verify the project name, then **apply the contents of**:

`supabase/migrations/20261025140000_student_ai_career_coach.sql`

This SQL must be run as **one transaction**, only once, after the previous `20261025103000_subscription_foundation.sql` has already been applied. Do not copy/paste separate fragments. Do not apply to production.

Read-only object verification:

```sql
select
  to_regclass('public.career_coach_usage') is not null as usage_table,
  to_regprocedure('public.reserve_career_coach_request(uuid)') is not null as reserve_rpc,
  to_regprocedure('public.finish_career_coach_request(uuid,uuid,boolean)') is not null as finish_rpc;
```

Read-only privilege verification (expected FALSE, FALSE, FALSE, TRUE):

```sql
select
  has_table_privilege('authenticated','public.career_coach_usage','SELECT') as student_can_read_usage,
  has_function_privilege('authenticated','public.reserve_career_coach_request(uuid)','EXECUTE') as student_can_reserve,
  has_function_privilege('authenticated','public.finish_career_coach_request(uuid,uuid,boolean)','EXECUTE') as student_can_finish,
  has_function_privilege('service_role','public.reserve_career_coach_request(uuid)','EXECUTE') as server_can_reserve;
```

**Migration tracking:** if applying via SQL Editor, reconcile Supabase migration history before later using automated migration deployment. Do not rerun an already-applied migration.

## 4. Test the feature carefully (use disposable accounts)

1. Start `npm run dev`. As a **Free student**, open `/career-coach`: see upgrade/plan message. In DevTools POST `{ "goal": "data_analyst" }` to `/api/career-coach` while logged in as Free: expect `403` and `PREMIUM_REQUIRED`. `GET /api/career-coach` should also reject with `403`.
2. As **employer/admin**, POST to `/api/career-coach`: expect `403` for role authorization. A signed-out request should return `401`.
3. As administrator, grant demo Student Premium to a disposable student via `/admin/subscriptions`. This is simulated access only. Sign back in as the student.
4. Visit `/career-coach`, select a goal, click **Generate my career plan** once. If OpenAI credentials and model are configured, expect practical advice and **only existing published challenges**. Compare each displayed link with `/tasks`.
5. Repeat immediately (only if needed for testing): expect `429`, `COOLDOWN`. Wait at least 60 seconds before further calls. **Do not intentionally spend all five daily requests unless you need a cap test.**
6. Verify no private assessment question, raw submission, rubric or integrity signal appears in the request or response. A student with **zero published passing results** should see that insufficient evidence is available; no strengths may be fabricated.
7. Revoke demo Premium via admin, then verify the page is locked again and the API returns `403`. Previously created assessments, published results and integrity decisions must remain unchanged.

Read-only usage verification (replace only with your own disposable student UUID):

```sql
select status, created_at
from public.career_coach_usage
where student_id = 'YOUR_DISPOSABLE_STUDENT_UUID'
order by created_at;
```

Avoid placing real student secrets or OpenAI API keys in screenshots. Do not edit or delete usage ledger entries to test limits.

## 5. Git and PR

After live checks, stage only the listed files, then run `git diff --cached --check` and inspect `git diff --cached --name-only`. Exclude `.env.local`, `.next`, `node_modules`, and generated `next-env.d.ts`. Do not merge until CI passes.

## ZIP content

- New: `src/app/career-coach/page.tsx`, `CoachWorkspace.tsx`
- New: `src/app/api/career-coach/route.ts`
- New: `src/server/career-coach/{rules.ts,rules.test.ts,data.ts,ai.ts,usage.ts}`
- New migration: `supabase/migrations/20261025140000_student_ai_career_coach.sql`
- Modified: `src/features/shell/AppShell.tsx`, `src/app/dashboard/page.tsx`, `src/app/plans/page.tsx`, `src/app/globals.css`

**Caveat:** This patch has been syntax-checked offline, but the full npm suite and live OpenAI/Supabase calls could not be run in the packaging environment. Do not claim those checks passed until you run them locally.
