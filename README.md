# Ready For Work — FNB Hackathon 2026

**An integration-ready Next.js starter for a four-person team.** This is a scaffold, **not** the finished assessment platform.

- **Tech:** Next.js 16, TypeScript, React 19, Tailwind 4, Supabase Auth/Postgres, Zod, OpenAI (future server integration), Monaco (assessment editor integration), MediaPipe (future on-device face checks), Vercel hosting.
- **Works now:** landing page, sample task catalog/filter, task details, assessment UI preview, sample public profiles, placeholders for auth/admin, `/api/health`, fictional GET `/api/tasks` and `/api/profiles`, schema and contract tests.
- **Not wired yet:** real sign-up, database persistence, assessment start/submit, AI, proctoring, active admin CRUD. These endpoints return **501** or UI buttons are disabled by design.

## Get running

```bash
npm install
cp .env.example .env.local
npm run dev
# open http://localhost:3000
```

`.env.example` defaults to `NEXT_PUBLIC_DEMO_MODE=true` for no-secrets preview. To implement real flows, create Supabase and OpenAI accounts, apply `supabase/migrations/0001_initial.sql` and optionally `supabase/seed.sql`, enter private credentials in `.env.local`, and implement the feature endpoints. Demo fixtures are **fictional**, not verified people or scores.

## Read before coding

1. [`docs/README_FIRST.md`](docs/README_FIRST.md) — ownership, setup, branches, integration.
2. [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) — frozen payloads and endpoints.
3. [`docs/SECURITY_RULES.md`](docs/SECURITY_RULES.md) — auth, POPIA and fairness.
4. [`docs/INTEGRATION_PLAN.md`](docs/INTEGRATION_PLAN.md) — 10–14 working-day schedule.
5. The four teammate PDFs (supplied alongside this ZIP) — personal instructions and AI-agent prompts.

The final system should show assessment evidence, not claim that web proctoring proves students never cheated.
