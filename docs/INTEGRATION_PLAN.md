# Practical delivery plan for four intermediate developers (10-14 working days)

DAY 0 - integrator: create repo and `develop`, commit npm lockfile, agree branch naming, apply schema in dev Supabase project, share non-secret env names and local setup. Protect main/develop, enable CI. Team runs health route/typecheck/tests.

DAYS 1-3 - independent slices: P1 auth/profile signup/login and public directory; P2 task list/editor/attempt start; P3 prompt/grader mocks and test fixtures; P4 integrity event listeners and permissions preflight. Each person codes in owned paths and uses mocked interfaces for collaborators.

DAYS 4-6 - independent slices: P1 privacy/share submission and employer view; P2 locked two-stage submission flow + admin task CRUD; P3 structured rubric grading and adversarial evaluation tests; P4 event ingestion, warnings and admin review, plus display detection feasibility tests.

DAY 7 - integrate first vertical slice: P1 user → P2 attempt → P3 personalized question/grade → P4 integrity check → P1 published profile. Shared integration fixes happen in small reviewed PRs. Prevent collisions by assigning a single integrator as owner of contracts and top-level layout.

DAYS 8-10 - test accounts, expiry server rules, repeated requests, false warning reports, mobile browsing (assessments desktop only), access control, connection interruptions. Generate 10-20 reviewed tasks, prepare seeded demo accounts. Fix any security bypass before UI polish.

DAYS 11-14 - polish, accessibility, demo rehearsals, screenshots, reserve time for reliability. Freeze to `main` at least one day before demo, tag the release and preserve backup demo.

## Merge gates

- A PR touches only its owner's files (exception: reviewed shared integration PR).
- No unimplemented buttons presented as working features.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass.
- Sensitive paths require automated unauthorized-user tests.
- All preview or demo-mode features visibly labeled.
- Owner records exact tested routes, status codes, sample requests/responses, and screenshots.

## Demo acceptance story

Student signs up → profile edited → views task → accepts rules → supported browser + camera consent → assessment starts with server expiry → answers theory and practical → originals freeze → one personalized understanding question → submits → feedback from structured grader → passed eligible result on public profile → employer searches and inspects opted-in submission → admin publishes a reviewed new task.

## Non-goals during first release

Real-time video uploads, audio surveillance, look-away classification, guaranteed extension detection, blanket public cheating labels, guaranteed second-device detection, automated code execution, unchecked batch generation of 200+ published tasks, unconditional permanent bans.
