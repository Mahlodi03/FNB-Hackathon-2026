# API contract v1 - change by approved contract PR only

Every route response has `Content-Type: application/json`. Errors are `{ "error": string, "code": string }` with 4xx / 5xx as appropriate. Current unfinished operations return **501 NOT_IMPLEMENTED**. Never pretend that fixture data is saved. Zod schemas are the single source of truth at `src/contracts/{domain,api,services,scoring}.ts`.

## Auth and authorization

Backend routes obtain current identity using `await requireActor()` from `src/server/auth/actor.ts` (it verifies identity via `serverSupabase().auth.getUser()`); a session reported by client JS, the `studentId` in a request, and user metadata **are not authentication**. Check the profile role in the database. Service-role DB client exists solely in `src/lib/supabase/admin.ts` for audited actions after identity/role/attempt ownership checks.

- `GET /api/tasks?concept=&difficulty=` public published tasks only. Demo GET returns `{tasks,source:'fictional_demo'}`; real uses `{tasks}`.
- `POST /api/tasks` admin create validated against `TaskCreateSchema` (id auto generated; draft default). Status defaults to `draft`. Admin publishing requires completeness validation.
- `POST /api/attempts/start` body `{taskId, rulesAccepted:true}`. Creates unique attempt tied to authenticated STUDENT and server timestamp; accepts no `studentId`, `expiresAt` or score from client; refuses already-started task. `expiresAt = serverTime + task.durationSeconds`. Start only once and return `{attemptId,status:'in_progress',expiresAt}`.
- `POST /api/attempts/:id/understanding` body `{theoryAnswer,practicalAnswer}`. Owner-only before expiration; transactionally freeze original answers and status, reject subsequent edits, call P3 to generate *one* personalized question, persist and return `{question,attemptStatus:'awaiting_understanding'}`. Retry must return SAME persisted question, not regenerate.
- `POST /api/attempts/:id/submit` body `{theoryAnswer,practicalAnswer,understandingAnswer}`. Compare first two answers with persisted frozen values (or omit them in future agreed contract). Owner-only and before expiry; no rewrites; idempotent submission, then P3 grader + P4 policy; store provisional server-derived scoring and status. Return `{attemptId,status:'submitted'|'graded',resultId?}`. No pass/fail based solely on AI output; calculate from rubric server-side. Publish only when integrity policy allows and score passes; otherwise withhold pending decision. Avoid duplicate grading on retries via unique results.attempt_id.
- `POST /api/attempts/:id/events` body `{eventType,occurredAt}`. Owner-only, active attempt only; server also records timestamp; event type allowlist, rate limit and deduplicate. Counts returned from DB, not client. No raw frames, audio or video. Technical loss may invalidate attempt; false positives go to private review.
- `GET /api/profiles?q=` only public STUDENT profiles, paginated/searchable; never return employer contact info. Public score cards use `public_student_result_cards(student_uuid)` RPC; public opted-in answer/feedback details use `public_student_submission_detail(attempt_uuid)` RPC. Raw attempts/results/warnings are owner-only by RLS. Never `SELECT *` for public views.
- `PATCH /api/admin/tasks/:id` and `DELETE /api/admin/tasks/:id` admin-only; deletion is `status='draft'` or soft archive, not physical delete of historical task.

## Service interface ownership

Person 3 fills `assessmentAi` in `src/server/ai/index.ts` implementing `AssessmentAiService` without changing its signature. Person 4 fills `assessmentPolicy` in `src/server/integrity/index.ts` implementing `AssessmentPolicy` without changing its signature. Person 2 owns HTTP routes and calls these exports; Person 1 supplies auth helper. If a change is required, write a contract proposal, get approval and merge `chore/contracts-*` before changing feature branches.

## SQL-to-TypeScript translation

Database uses snake_case columns and TS uses camelCase. Mapper functions belong to each owning feature module; never leak raw DB types directly into frontend props. Run Zod parse at server input boundaries and on AI output. Fixtures in `src/content/demo.ts` are fictional and may never be submitted as real outcomes.
