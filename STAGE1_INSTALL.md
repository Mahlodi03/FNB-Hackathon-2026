# Ready For Work — Brand, Navigation & Student Directory (Stage 1)

This package is based on the previously supplied Figma UI source snapshot. It changes the shared shell, homepage, identity navigation and student-directory access only. It **does not replace** the assessment, AI or integrity service code.

## Apply safely

1. Commit/push your existing UI branch, then create `feature/figma-polish-stage1` from it.
2. Extract the accompanying `Changed_Files` ZIP into the project root (allow file replacements). Do **not** also apply the patch.
3. Run `npm run typecheck`, `npm test` and `npm run build` locally. If the build fails with OneDrive `EPERM` on `.next`, stop any dev server and remove only `.next` before rebuilding.
4. Apply the new SQL migration `supabase/migrations/20261024164000_students_directory_requires_login.sql` to the **development** Supabase project through your normal migration process, after reviewing it. This is required to enforce the signed-in restriction at database level. The Next.js pages/API also enforce the sign-in check before access.
5. Test as a signed-out visitor: `/` shows the public homepage with the actual logo, Home, Challenges, Log in and Get started. `/students` and `/students/<username>` redirect to login. `/api/profiles` should give HTTP 401.
6. Test student/employer/admin sessions: visiting `/` or clicking the logo goes to `/dashboard` or `/admin` respectively. Each logged-in navbar includes **Students**. Browse a public opted-in student; only actual bio/field/institution data appears on cards.
7. Once everything passes, `git add src public supabase/migrations/20261024164000_students_directory_requires_login.sql` and commit/push the feature branch. Do not merge to `develop` until reviewed.

## Cautions

- The supplied image is preserved as your logo, optimized/cropped into `public/brand/`. No third-party font files are included.
- You can keep public challenge browsing (`/tasks`), but student discovery now requires authentication.
- The underlying profile RLS initially allowed anonymous public profile reads and its RPCs granted anonymous access. Applying the included migration removes that anonymous access. Without the migration the site hides/blocks the directory but direct Supabase queries can still retrieve public opted-in profiles.
- The product still needs a full mobile visual review and browser checks. This package is Stage 1; it doesn't claim to complete the entire Figma redesign.
