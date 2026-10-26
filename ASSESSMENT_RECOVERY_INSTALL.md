# Ready For Work — Assessment Recovery (Stage 1)

SOURCE: Reconstructed from your uploaded fix-assessment-persistence project, then applied the earlier Figma, Stage 1, Sealed Challenges and Stage 2 overlays. This is not a fresh checkout of your live GitHub develop branch; review changes locally.

## Installation

1. Confirm develop is up to date and create `feature/assessment-recovery` from it (skip if already on that branch).
2. Copy contents of the ZIP into the project root, preserving paths. These are changed files ONLY, not the whole app.
3. Apply `supabase/migrations/20261024190000_assessment_recovery_drafts.sql` ONCE to the ready-for-work-dev Supabase database (SQL Editor). Keep the migration file in Git.
4. Run `npm run typecheck`, `npm test`, `npm run build`.
5. Test on a newly published task as a test student. Type answers, see autosave confirmation, refresh, re-run camera/fullscreen preflight, and confirm the SAME attempt ID, SAME deadline, and restored drafts. Test AI question then refresh, and submitted-grade retry.
6. Test after expiry: no answer changes or new attempt should be accepted. Test separate student cannot access another student's attempt or drafts.

## Security and limitations

- The server verifies the signed-in student and attempt ownership. Draft writes use the service-role client only after authorization, and conditional updates enforce status/expiry. Never expose the service-role key.
- Separate nullable columns store editable drafts; submitted/locked answers remain untouched. No new student write RLS policies are added.
- Question prompts remain sealed until the timer starts, and after refresh the UI requires camera/fullscreen preflight again before fetching them. Server ownership/expiry still gate challenge access.
- Refresh does not restart the deadline. Previously submitted answers can retry grading after expiry, but expired in-progress attempts cannot submit new answers.
- Autosave is debounced by ~1.2 seconds: edits just before a crash or network outage may be lost. Multiple tabs and simultaneous draft writes have not been exhaustively tested. This is an MVP, not a guarantee against all disconnections.
- Never test resume by consuming the one allowed attempt on your only task; use a fresh test account/task.
- The latest changes were syntax-checked, but npm dependencies could not be installed offline here (`zod-validation-error` was missing), so integration/build validation must be done locally.
- Unrelated dependency advisories, including Monaco/DOMPurify, remain separate release blockers.


## Reviewed patch notes (comparison with uploaded develop ZIP, 2026-10-24)

This reviewed overlay additionally:
- Tightens the follow-up question display condition: after refresh an active attempt requires restored preflight; a **server-confirmed** submitted attempt can retry grading without restarting the timed exam. The original ZIP already gated initial recovery, but used the local `submissionStarted` flag as an exception.
- Persists draft clearing (including two empty initial answers).
- Retries the current editable draft on the browser's `online` event.
- Prevents an obsolete draft request from overwriting the UI's newer save status (not a cross-tab/server conflict solution).

The upload is a source archive, not a live checkout. Verify the local Git branch and compare any uncommitted edits before applying.
The new draft columns are nullable; the migration doesn't change RLS or stored answers.
Do not run this patch or migration on production before local and development-project verification.
