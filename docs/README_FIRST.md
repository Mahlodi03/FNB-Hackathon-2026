# READY FOR WORK | Team kickoff

**Read this before prompting an AI assistant.** This is a scaffold, not the completed app. The homepage, task catalog, fake students, and assessment preview use invented fixture data. Real auth, writes, AI, camera/screen checks, and grading are deliberately disabled, not secretly simulated.

## One command path

1. Install Node 22 and npm 10 or newer.
2. `npm install` (creates `package-lock.json` the team should commit before branching)
3. `cp .env.example .env.local` (Windows: copy manually)
4. `npm run dev` and open `http://localhost:3000`.
5. Verify `http://localhost:3000/api/health` returns `{ok:true,...}`.
6. Run `npm run typecheck && npm run lint && npm test && npm run build`.
7. Integrator creates a Supabase project and applies `supabase/migrations/0001_initial.sql` and optionally `supabase/seed.sql`. Create credentials **privately** and put them in `.env.local`; never commit secrets. For initial admin access see `docs/ADMIN_BOOTSTRAP.md` (trusted operator only).

## Roles and folder ownership

| Person | Branch | Sole-write ownership |
|--|--|--|
| P1 | feature/identity-profiles | `src/app/login`, `signup`, `profile`, `students`; `src/app/api/profiles`; `src/features/identity` |
| P2 | feature/assessments-tasks | `src/app/tasks`, `assessment`, `admin/tasks`; `src/app/api/tasks`, `src/app/api/admin/tasks`, `src/app/api/attempts/start`, `.../understanding`, `.../submit`; `src/features/assessments` |
| P3 | feature/ai-evaluation | `src/server/ai`, `src/features/grading`, `src/content/task-bank` (new dir) |
| P4 | feature/integrity-review | `src/server/integrity`, `src/features/integrity`, `src/app/api/attempts/[attemptId]/events`, `src/app/admin/integrity` |

Shared/frozen: `src/contracts/*`, `supabase/migrations/*`, `src/lib/supabase/*`, `src/server/auth/actor.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `package.json`, `.github/*`, `src/content/demo.ts` and this document. Changes to these require an approved separate `chore/contracts-*` branch maintained by integrator. Avoid editing another person's files.

## Required shared integration points

- P2 calls `assessmentAi.generateUnderstanding` and `assessmentAi.evaluate` from P3's module, defined in `src/contracts/services.ts`.
- P2 calls `assessmentPolicy.checkSnapshot` and renders P4's monitoring component/hook **only after** both PRs merge. Do not copy implementation into P2 files.
- P1 builds auth UI and profile screens and uses the safe public_student_result_cards() SQL RPC for summaries and public_student_submission_detail() for consented detail; do not fetch raw results/attempts for public views. P2/P4 call the shared `requireActor()` helper and independently verify each attempt owner; never accept user-supplied IDs/roles as proof.
- P3 never exposes `OPENAI_API_KEY` to the client. Result scores/pass are server-calculated by `src/contracts/scoring.ts`.
- P4 event detection supplies signals, never certain proof; no audio, look-away or AI-extension guarantee.

## Protected backend contract (501 until assigned owner finishes)

| Method | Path | Owner | Contract |
|--|--|--|--|
| GET | `/api/tasks` | P2 | `{tasks:Task[]}` |
| POST | `/api/tasks` | P2 | Authenticated admin only; TaskCreateSchema fields |
| POST | `/api/attempts/start` | P2 | `StartAttemptRequestSchema` → `StartAttemptResponseSchema` |
| POST | `/api/attempts/:id/understanding` | P2+P3 | `GenerateUnderstandingRequestSchema` → question (initial answers frozen) |
| POST | `/api/attempts/:id/submit` | P2+P3+P4 | `SubmitAttemptRequestSchema` → `SubmitAttemptResponseSchema` |
| POST | `/api/attempts/:id/events` | P4 | `SaveIntegrityEventRequestSchema` → `SaveIntegrityEventResponseSchema` |
| GET | `/api/profiles` | P1 | Only public students; no employer directory |
| PATCH/DELETE | `/api/admin/tasks/:id` | P2 | Admin only; DELETE is archival (draft), not destructive |

Detailed invariants: `docs/API_CONTRACT.md` and `docs/SECURITY_RULES.md`.

## Branch + PR flow

`main` = stable release, `develop` = integration; branch from latest `develop` (create it initially). Every person opens PR into `develop`, never directly to `main`. PR must include test output, screenshots, exact endpoints, data/schema changes, and confirm no protected files modified. Integrator merges after CI, rebase immediately on merge. Promote `develop` → `main` at demo freeze.

```bash
git checkout develop && git pull
git checkout -b feature/identity-profiles  # substitute your branch
# work, test, commit
git push -u origin feature/identity-profiles
```

## Core product constraints

- Only students sign up as student, employers as employer; admin is assigned by trusted operations.
- Students consent to assessment rules and optionally sharing their detailed submissions.
- Full-screen/tab/copy-paste/camera signals are browser-side *signals*, not guaranteed anti-cheating.
- No microphone access, audio recording, video recording, look-away checks or automated public cheating labels.
- Second-screen window management must fail closed only when feature detectable and user explicitly chose strict supported-browser assessment; unsupported browsers get an explanatory error, not false allegations.
- AI grades code without running it; accuracy must not be claimed as verified execution.
- Rubric weights total 100%; overall is computed on server. No retries by default, but invalidated technical sessions require a documented exception policy.
- Data privacy: no raw media, warnings hidden from public; admin flags require appropriate review. No automatic profile reset.
