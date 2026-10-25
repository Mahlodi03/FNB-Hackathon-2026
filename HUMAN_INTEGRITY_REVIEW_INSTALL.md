# Human Integrity Review — installation and validation

Source baseline: `bae76cb` (Assessment Recovery merged into `develop`). This archive is **only the changed/new files**, not the whole app. Keep this work on `feature/human-integrity-review`. It does not deploy or execute any database change by itself.

## 1. Safely apply overlay

1. Confirm `git status --short --branch` shows `feature/human-integrity-review` and no unexpected uncommitted changes.
2. Extract the ZIP **into the repository root**, preserving directories. Existing files changed: `src/app/admin/integrity/page.tsx`, `src/app/admin/page.tsx`. Other files are new.
3. Inspect the diff with `git diff --check`, `git diff -- src/app/admin/integrity/page.tsx src/app/admin/page.tsx`, `git status --short`.
4. Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. The archive author could syntax-check TypeScript and added policy/validation unit tests, but did not run the complete Next.js lint/test/build pipeline. Administrator authorization and transactional behavior require the live checks below.

## 2. Supabase migration (development only)

After validating that Supabase project `ready-for-work-dev` is the intended *development* database (not a live production system), make a backup and review `supabase/migrations/20261025090000_human_integrity_review.sql`. Apply **once** through SQL Editor. Keep the migration file under source control; running SQL Editor does **not** register it in the Supabase CLI migration history. Before applying to another environment, reconcile its existing migration ledger.

Migration creates:
- `integrity_review_history`: append-only audit rows (reviewer, decision, written reason, old/new visibility, timestamp)
- `integrity_review_state`: current status per attempt
- `record_integrity_review` service-role-only transaction that locks a graded result, validates reviewer role, changes visibility and writes history/state atomically

No client RLS access is added. Students, employers and anonymous clients are explicitly denied RPC execution. Do not expose service-role credentials.

## 3. Live checks

Use a disposable graded *flagged* attempt and a legitimate admin account. Suggested test:

1. Before review, inspect `public.results` row and observe `visibility='withheld'` for a flagged attempt. The private `/admin/integrity` page should show a review link.
2. As a student or employer, `/admin/integrity` should remain inaccessible. A direct POST to `/api/admin/integrity/reviews` should return 403 (or 401 signed out). Direct Supabase RPC invocation under student auth should be denied.
3. As admin, open `/admin/integrity/[attemptId]`. The page must display server-recorded signals, current visibility and any prior decisions.
4. Choose **Further investigation**, enter a meaningful reason (20–2000 characters), save. The current status should update and `results.visibility` should remain `withheld`. One new history row should exist.
5. Choose **Clear** on a passed AI-assisted graded test attempt. Result visibility should change to `published`; published evidence should appear **only if** student `is_public=true` and existing consent/publication requirements are met.
6. Choose **Withhold** on that same disposable graded attempt and record a new reason. `results.visibility` must return to `withheld`, and public evidence must disappear. Both human decisions remain in history; scores stay the same.
7. Clear a failed or non-AI result if one is available: it must remain `provisional`, never `published`.
8. Check different admin account's history entries if available; reviewer IDs should be distinct.
9. Verify unauthenticated or student clients cannot read `integrity_review_history` / `integrity_review_state` through Supabase.

For verification use read-only SQL (substitute disposable UUID):

```sql
select a.id,a.status,r.passed,r.grading_source,r.visibility,r.overall_score
from public.attempts a join public.results r on r.attempt_id=a.id
where a.id='YOUR_TEST_ATTEMPT_UUID';

select decision, reason, reviewer_id, previous_visibility, new_visibility, reviewed_at
from public.integrity_review_history
where attempt_id='YOUR_TEST_ATTEMPT_UUID'
order by reviewed_at desc;
```

## 4. Rules and limitations

- Browser signals are **not proof of misconduct**. Review is for evidence publication, not a finding of guilt, and does not change scores.
- A graded result is required before recording a review; unfinished attempts remain triage-only.
- Public result RPCs already enforce `visibility='published'`, passed, AI-assisted grading and public profile consent. No public profile/evidence RPCs are modified here.
- The main triage page shows up to 100 latest events, each detail page up to 100 latest events and 100 audit entries; historical audit rows remain stored in the database.
- This hackathon MVP has no student appeal workflow, appeal notifications, review queue pagination, or administrator staffing controls. Do not represent these as implemented.
- Service role is allowed to read state/history; only the privileged RPC is intended to write. Database superusers can still administer schema but ordinary account updates cannot rewrite history.
- Always use the real merged Figma-inspired styles already present in the app.

## 5. Git

After lint, typecheck, tests, build and live review pass, stage only intended files and open a PR into `develop`. Do not merge while CI is failing; do not include `.env.local` or keys.
