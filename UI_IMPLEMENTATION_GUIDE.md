# Ready For Work — Figma-inspired UI integration

Based on the uploaded `FNB-Hackathon-2026-fix-assessment-persistence.zip` snapshot and the 37 Figma site screenshots.

## Scope

This is a **frontend redesign**, with two related task-listing fixes: a direct database query replaces `http://localhost:3000` in the task list and detail pages. It retains the uploaded assessment start, AI understanding, submission, scoring, and integrity event APIs unchanged.

### Built from existing/verified features

- White sidebar, pale-blue workspace, rounded cards, purple-to-blue gradients, responsive layouts.
- Dynamic navigation based on the authenticated Supabase role (student/employer/admin), **not** a user-editable role switcher.
- Real student dashboard and progress, using the student's own RLS-protected attempts and results.
- My Evidence page uses only passed **published** results and existing consent/sharing controls. Withheld results never appear as public evidence.
- Employer dashboard shows only genuinely public student directory data, without invented candidates or hiring metrics.
- Task library and challenge detail page load actual published tasks directly from Supabase.
- Admin landing page is role-restricted, with access to the existing tasks interface and the **read-only** private integrity page.
- Login/signup restyled; existing sign-in, Google sign-in, signup and server actions preserved.
- Assessment workspace with step indicators, server-owned countdown, theory textarea, Monaco practical editor, AI follow-up, result display, local-only camera preview and observed event count. The assessment UI is designed to match Figma even though the screenshots did not show that particular workflow.

### Not included because unbuilt/unverified

- Figma-only assessment requests, employer invitations, organization analytics, notification center, messaging, account management, persistent integrity review decisions, recommendations and role switches.
- Client-side code execution: Monaco remains an editor; code is assessed by the existing AI/rubric backend, not run in a sandbox.
- Camera video recording or face recognition. The camera remains local; browser signals can be privately reviewed and do not prove misconduct.
- Page reload recovery for active assessments. Keep a started assessment page open until the result is saved.

The existing admin task editing UI is retained, but its privileged database writes have **not** been verified in this UI-only work. Verify task creation/publishing separately before presenting those operations as working.

## Applying the changes on Windows (PowerShell)

1. Make sure the local `fix/assessment-persistence` branch is clean and all relevant changes are committed/pushed.
2. Run:

   ```powershell
   git switch fix/assessment-persistence
   git status
   git switch -c feature/figma-ui
   ```

3. Download `ReadyForWork_Figma_UI.patch` and save it in the project root.
4. Test whether it applies:

   ```powershell
   git apply --check .\ReadyForWork_Figma_UI.patch
   ```

5. If clean, apply:

   ```powershell
   git apply .\ReadyForWork_Figma_UI.patch
   ```

   Or extract `ReadyForWork_Figma_UI_Changed_Files.zip` into the project root, preserving folder paths; **choose either method, not both**.

6. Install dependencies if not already installed and test:

   ```powershell
   npm ci
   npm run typecheck
   npm test
   npm run build
   ```

7. Run `npm run dev`, visit `/login`, `/signup`, `/dashboard`, `/tasks`, `/progress`, `/evidence`, `/profile`, `/students`, `/admin`, `/admin/integrity`, and an assessment for a published task.
8. Commit when tests and role-based screens behave correctly:

   ```powershell
   git add src
   git commit -m "feat(ui): implement Figma-inspired role dashboards and assessment workspace"
   git push -u origin feature/figma-ui
   ```

   The guide is optional; the patch modifies `src` only. Do not merge into `develop` until the team tests it.

## Important checks

- Student accounts cannot access `/admin/integrity` (expect 404).
- Public profiles show published, passed results only; withheld results remain private.
- `/tasks` and `/tasks/[slug]` use real Supabase published tasks.
- Admin navigation uses database roles; no manual Student/Employer/Admin toggle.
- A live assessment requires camera and fullscreen preflight; countdown starts only on server-created attempt; answers lock; submission writes to the backend; grade response and monitoring cessation remain unchanged.
- Employer workspace displays actual available public profiles, not the fictional statistics shown in the design reference.
- Check responsive sidebar, laptop/tablet widths, keyboard focus and alerts.
- Remaining dependency advisories (especially DOMPurify via Monaco) must be resolved before public deployment.

## Verification performed in the authoring environment

- 82 TypeScript/TSX files passed TypeScript transpiler **syntax diagnostics**.
- The patch was checked against the exact uploaded project snapshot using `git apply --check`.
- **Full `npm run typecheck`, `npm test`, `npm run build` could not run here** because npm package installation failed due unavailable registry DNS (`EAI_AGAIN`). Run those commands in your local clone; do not treat syntax checks as build/test passes.
- No production deployment or live Supabase verification was conducted against the redesign.
