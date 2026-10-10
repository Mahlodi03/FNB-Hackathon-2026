# Technology choices (MVP)

- **Next.js 16 / React 19 / TypeScript**: frontend pages and authenticated server route handlers together; no split Express service.
- **Tailwind CSS 4 + lucide-react**: flexible responsive visuals; shadcn/ui can be added by approved integrator PR if desired but is not installed in the starter.
- **Supabase** (PostgreSQL + Auth + RLS): users, tasks, submissions, private flags and rubric results. Uses `@supabase/ssr` for Next.js cookie sessions.
- **OpenAI API (server-only)**: tailored understanding question and AI evaluation against criteria; strict Zod parsing; server computes pass/fail and weighted score.
- **Monaco Editor** (`@monaco-editor/react`): coding answer editor; no code execution.
- **MediaPipe** (`@mediapipe/tasks-vision`): optional local-only multiple-face signals, not a blocker for first release.
- **Window Management API** (experimental): strict supported-desktop browser screen checks, only with explicit permission; cannot discover every second device.
- **Vitest, TypeScript typecheck, ESLint, GitHub Actions**: quality gates; GitHub protected `develop` for PRs, `main` for releases.
- **Vercel**: proposed Next.js deployment, plus hosted Supabase. This starter itself is not deployed.

**Cost/quality trade-offs:** Keep model calls to one understanding question and one grading call per attempt, use a cap on text sizes, and log request IDs without student answer bodies. Privacy review of hosting location, subprocessors and retention is required before production rollout.
