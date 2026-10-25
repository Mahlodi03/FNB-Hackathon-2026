# Ready For Work — Employer Premium AI Talent Matching MVP

## Starting point

Prepared against the uploaded `employer-talent-matching-baseline.zip` after the merged Career Coach and MediaPipe changes. Install on `feature/employer-ai-talent-matching` with a clean working tree. This is an **additive hackathon MVP**. It does not change grading, challenge sealing, camera monitoring, the public student directory, or student subscription limits.

## Scope

- Employer Premium-only job briefs: up to **3 active briefs** at a time. Archived briefs do not count toward the cap; they cannot be matched again.
- Employer Premium-only AI-assisted matching: **20 reserved runs per UTC month**. Unsuccessful/failed reserved calls also count, preventing unlimited costly retries.
- AI interprets only employer-provided job description and skill requirements. Student names, profile fields, published grade details, submissions, integrity flags, and questions **are never sent to OpenAI** by this feature.
- Deterministic published-evidence skill coverage produces up to 8 recommended candidates with supporting challenge titles and skills not yet evidenced. This is **not a hiring probability or ranking of human worth**.
- Students must be opted into public discovery **and** have at least one passing, published, AI-assisted assessment result. Student Premium cannot influence matching.
- Employer shortlists remain private to the employer. List reads re-check public opt-in and eligible published evidence; withdrawn candidates will not be shown on reload.
- Free employers continue to use `/students`; Free and non-employer users cannot call the matching APIs. Administrator demo Premium remains simulated, not billed.

## Install

1. `git branch --show-current` must be `feature/employer-ai-talent-matching`, and `git status` must be clean before extracting the patch.
2. Extract the ZIP to `C:\Dev\FNB-Hackathon-2026` preserving the directory tree. Four existing files are changed: `src/app/dashboard/page.tsx`, `src/app/plans/page.tsx`, `src/features/shell/AppShell.tsx`, `src/app/globals.css`.
3. Do **not** run the migration until local checks pass.
4. Run:
   ```powershell
   git status --short
   git diff --check
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```
   Expected: zero ESLint errors; one existing PostCSS warning may persist; all tests and build should pass. New match-rules tests: 6. Previous baseline had 135 passing tests and 4 live AI skips, so expect **141 passing tests, 4 skipped** if unchanged.
5. Check that `OPENAI_API_KEY` and `OPENAI_MODEL` work for your existing Career Coach. Optional: `OPENAI_TALENT_MODEL` overrides the model for this feature. Do not commit `.env.local` or any secrets.

## Development database migration — apply ONCE

Use **ready-for-work-dev** Supabase SQL Editor. Before applying, check:

```sql
select
  to_regclass('public.talent_job_briefs') is not null as briefs_exist,
  to_regclass('public.talent_match_runs') is not null as runs_exist,
  to_regclass('public.talent_shortlists') is not null as shortlists_exist;
```

Only if **all three are false**, paste the entire `supabase/migrations/20261025153000_employer_talent_matching.sql` and run it once. Do not rerun if any object exists.

Verify objects:

```sql
select
  to_regclass('public.talent_job_briefs') is not null as briefs_exist,
  to_regclass('public.talent_match_runs') is not null as runs_exist,
  to_regclass('public.talent_shortlists') is not null as shortlists_exist,
  to_regprocedure('public.talent_create_brief(uuid,text,text,text[])') is not null as create_rpc,
  to_regprocedure('public.talent_archive_brief(uuid,uuid)') is not null as archive_rpc,
  to_regprocedure('public.talent_reserve_run(uuid,uuid)') is not null as reserve_rpc,
  to_regprocedure('public.talent_finish_run(uuid,uuid,boolean)') is not null as finish_rpc,
  to_regprocedure('public.talent_public_evidence()') is not null as evidence_rpc,
  to_regprocedure('public.talent_save_shortlist(uuid,uuid,uuid,boolean)') is not null as shortlist_rpc,
  to_regprocedure('public.talent_visible_shortlists(uuid)') is not null as visible_rpc;
```

Verify grants:

```sql
select
  has_table_privilege('authenticated','public.talent_job_briefs','SELECT') as browser_reads_briefs,
  has_table_privilege('authenticated','public.talent_match_runs','SELECT') as browser_reads_runs,
  has_table_privilege('authenticated','public.talent_shortlists','SELECT') as browser_reads_shortlists,
  has_function_privilege('authenticated','public.talent_reserve_run(uuid,uuid)','EXECUTE') as browser_reserves,
  has_function_privilege('authenticated','public.talent_public_evidence()','EXECUTE') as browser_reads_evidence_rpc,
  has_function_privilege('service_role','public.talent_reserve_run(uuid,uuid)','EXECUTE') as server_reserves;
```

Expected: first five **false**, last **true**.

## Safe staged live tests

Use *disposable employer and opted-in student accounts that you control*. Do not manipulate real student results or change consent for other students. Start with Free employer:

1. `/talent-matching` should show the locked Employer Premium card. POST to each `/api/talent-matching/briefs`, `/runs`, and `/shortlists` must return `403` with `PREMIUM_REQUIRED`; student/admin roles must receive `403 Role not authorized`.
2. Confirm no rows added to the three `talent_*` tables for the test employer. Public `/students` must still load for Free employers.
3. Grant 30-day **demo Employer Premium** using the existing `/admin/subscriptions` screen.
4. Reload `/talent-matching`: expect unlocked workspace, `0/3` active briefs, `0/20` monthly runs (unless already used). Create a brief using the sample text in the form; verify one active brief in SQL.
5. Create a second/third brief to validate 3 active (optional). Fourth should be rejected. Archive to free a slot; archive cannot be matched.
6. Click **Find matches once**. Expect job analysis grounded in the brief, the first monthly run counted, and optional candidate cards only for opted-in students with published passing evidence. Empty results can be valid if no eligible evidence exists. Do not promise a candidate match.
7. Inspect browser Network: the POST request to your server should contain only `{briefId}`; the server's external OpenAI call receives only the job brief, not students. Do not expose service-role keys or access restricted tables directly from the browser.
8. If a candidate appears, shortlist and reload; ensure employer ownership. Withdraw your own test student's public consent and reload: saved profile must disappear. Restore consent only if the student explicitly wants it.
9. Revoke demo Premium; `/talent-matching` should lock and all matching POSTs should deny access. The Free `/students` directory should still work, and stored briefs/runs should remain intact.

Read-only SQL for the test employer (replace the ID):

```sql
select status,count(*) from public.talent_job_briefs
where employer_id='YOUR_DISPOSABLE_EMPLOYER_UUID' group by status;
select status,count(*) from public.talent_match_runs
where employer_id='YOUR_DISPOSABLE_EMPLOYER_UUID' group by status;
select count(*) from public.talent_shortlists
where employer_id='YOUR_DISPOSABLE_EMPLOYER_UUID';
```

**Do not commit/merge until:** all local checks pass, the migration + database grants are verified, and at least one real Premium matching run and Free/role authorization check pass.

## Deployment notes

The SQL migration file must be tracked in Git even if it has already been applied manually to dev. Reconcile Supabase migration history before automated deployment; apply it in other environments through the normal migration process. This feature does not create Stripe/payments or verify monetary subscriptions. Usage resets at the UTC month boundary. The evidence projection caps rows at 1500 for the hackathon MVP; scale and pagination fairness need review before production.
