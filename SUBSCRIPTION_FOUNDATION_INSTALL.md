# Ready For Work — Subscription Foundation MVP (25 October 2026)

**Baseline:** `develop` commit `ee0ae7f` (includes merged Assessment Recovery and Human Integrity Review).
**Feature branch:** `feature/subscription-foundation`.

## Scope (implemented by this overlay)

- Students: **10 lifetime challenge starts**, counting historical distinct task attempts. A challenge consumes an unlock only when its first attempt is created. Returning to that attempt, refreshing, autosaving, grading, and reviewing results consume **zero additional unlocks**.
- Free users at 10: the backend refuses starts for *new* tasks, while previous attempts/results remain accessible.
- Premium demo students: unlimited starts across *different, published* tasks. **One attempt per student/task still applies.** All starts (including Premium starts) count toward the lifetime total if the demo entitlement expires.
- Employers: Free/Premium **demo entitlement only**. Existing employer search is unaffected. AI Talent Matching/shortlists are **not implemented yet**.
- Admin: `/admin/subscriptions` grants/revokes demo access for existing student/employer UUIDs (1–90 days). The grant and revoke are audited. Admin roles unchanged.
- `/plans` and existing dashboard/task catalog show clear Free/Premium information with proposed R39 student and R299 employer price points. **No charges, checkout, payment provider, Career Coach, or Talent Matching yet.**

## Installation — carefully

1. Confirm clean working tree on `feature/subscription-foundation` based on `ee0ae7f`:
   ```powershell
   git branch --show-current
   git status --short
   git log -1 --oneline
   ```
2. Copy the overlay ZIP **contents** into the repository root, preserving paths. Only the modified/new files in the ZIP are provided. Do **not** overwrite `.env.local`, `.next`, or `node_modules`.
3. Inspect the changes:
   ```powershell
   git status --short
   git diff --check
   git diff --stat
   ```
4. Before applying the migration, confirm `ready-for-work-dev` is the intended development Supabase project, take a backup, and check objects are absent:
   ```sql
   select
     to_regclass('public.account_entitlements') is not null as entitlements_exist,
     to_regclass('public.entitlement_audit') is not null as audit_exists,
     to_regprocedure('public.start_student_attempt(uuid,uuid)') is not null as start_function_exists,
     to_regprocedure('public.set_demo_entitlement(uuid,uuid,text,integer)') is not null as admin_function_exists;
   ```
   Expected: **all false**. If any are true, STOP and inspect the schema before proceeding.
5. Run **the entire file** `supabase/migrations/20261025103000_subscription_foundation.sql` in Supabase SQL Editor **ONCE**. It already contains `BEGIN;` and `COMMIT;`. Do not insert another transaction wrapper. Keep the migration tracked in Git. Direct SQL Editor execution does not update the Supabase CLI's migration ledger; reconcile before deployment to another database.
6. Rerun the existence check (all true). Check grants:
   ```sql
   select
     has_table_privilege('authenticated','public.account_entitlements','SELECT') as student_can_read_entitlements,
     has_table_privilege('authenticated','public.entitlement_audit','SELECT') as student_can_read_audit,
     has_function_privilege('authenticated','public.start_student_attempt(uuid,uuid)','EXECUTE') as student_can_run_start_rpc,
     has_function_privilege('authenticated','public.set_demo_entitlement(uuid,uuid,text,integer)','EXECUTE') as student_can_change_demo,
     has_function_privilege('service_role','public.start_student_attempt(uuid,uuid)','EXECUTE') as service_can_run_start;
   ```
   Expected: **false, false, false, false, true**.
7. Locally run:
   ```powershell
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```
   Any failing check must be resolved before committing. The overlay was syntax-checked but full package-based validation was **not available** in the packaging environment.

## Essential live validation (use disposable accounts and tasks)

1. Sign in as a new disposable student with no attempts. `/dashboard`, `/tasks`, and `/plans` should show Free `0 of 10` starts.
2. Start one published test challenge, note attempt UUID/deadline. Reload/reconnect and verify same UUID/deadline, restored saved answers, no extra unlock. Verify sealed prompts stay hidden until camera/fullscreen preflight.
3. In a disposable student with 9 attempts, issue two **simultaneous** start requests for different *new* published tasks (each requires rules acceptance). Exactly **one** may create an attempt; the other must receive `403` with code `FREE_CHALLENGE_LIMIT_REACHED`. Verify the DB count is exactly 10. Do not attempt this on anyone's important/student account.
4. With 10 attempts, `/tasks` should show new challenges locked and existing ones accessible. Direct POST `/api/attempts/start` for a new task must return `403`. The lock must not depend on the UI.
5. As admin, visit `/admin/subscriptions` and grant **30-day demo Premium** to this test student by their UUID. The student should show Premium demo; another new published challenge should start. The same task must still refuse a second attempt.
6. Revoke demo access and confirm the student returns to Free with all lifetime attempts still counted; progress and published/withheld evidence do not change. Check `public.entitlement_audit` has grant and revoke entries.
7. As a disposable employer, verify the Free directory still shows only opted-in/published evidence. Grant/revoke employer demo Premium; verify current directory access is unchanged and AI matching is not falsely displayed as implemented.
8. As an ordinary student, POST `/api/admin/subscriptions/demo` should return `403` and not create an entitlement or audit entry. Check browser cannot directly call the start/grant database functions via authenticated Supabase role.
9. Ensure `npm run build` still includes `/api/attempts/recovery`, `/admin/integrity/[attemptId]`, and `/api/admin/integrity/reviews`.

### Read-only database checks

```sql
-- Use the UUID of your disposable student; never edit or delete old attempts.
select count(*) as lifetime_starts from public.attempts
where student_id = 'REPLACE_WITH_TEST_STUDENT_UUID';

select user_id, plan, source, expires_at from public.account_entitlements
where user_id = 'REPLACE_WITH_TEST_STUDENT_UUID';

select action, expires_at, recorded_at from public.entitlement_audit
where user_id = 'REPLACE_WITH_TEST_STUDENT_UUID'
order by recorded_at;
```

## Architecture and safety

- Student and employer roles remain the **existing roles** in `profiles`.
- The authenticated assessment start route calls a **service-role-only SQL function**. Postgres locks the **student profile row**, checks published task and existing attempt, counts starts, verifies active demo entitlement and inserts the new attempt **inside one transaction**. No browser INSERT permission is added.
- Existing attempt and deadline are returned before checking the Free quota. Expired attempts remain non-restartable.
- Admin demo grants use a second protected database function that verifies the administrator role again and appends an audit record.
- Subscription tables have RLS enabled, **no authenticated or anonymous policies**, and no direct grants to browser roles. Service-role credentials remain server-only.
- This migration **does not touch** results, integrity reviews, grading scores, student profile discoverability or sealed question policies.
- Do not represent demo Premium as a paid subscription. For actual payments, implement provider-verified webhooks/renewals and legal review in a separate feature before accepting money.

## After successful testing

Review `git diff`, ensure `.env.local`/secrets are absent, commit and push the feature branch, and open a pull request **into `develop`**. Don't merge until GitHub Actions checks pass.
