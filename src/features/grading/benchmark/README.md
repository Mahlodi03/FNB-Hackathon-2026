# Ready For Work — Person 3 grading benchmark (Step 4)

## Scope and caveats

- **16 fictional examples**: OOP, Algorithms, SQL, and Data Structures, each with strong, partial, weak and prompt-injection submissions.
- They reuse the existing `Task`, `Submission`, `Evaluation`, and `calculateOverallScore` contracts; this package **does not change** application interfaces, API endpoints, database tables, or the grader implementation.
- `expectedOverall` values are **provisional review bands chosen for test design**, **not independent expert scores**. Do not call them validated ground truth. They intentionally have wide intervals. A human reviewer must check each case and adjust them before they can be used for fairness/accuracy claims.
- Nothing in this benchmark executes TypeScript code or SQL against a real database. The live grader evaluates likely correctness from submitted text only.

## Safe local tests (free; no API calls)

From the project root:

```powershell
npm run typecheck
npm test
npm run build
```

The added deterministic tests validate fixture structure, score calculation and report safeguards without calling an AI API. The live benchmark is skipped unless explicitly enabled.

## Live smoke benchmark — 4 billable API requests

Requires a working `.env.local` with server-only `OPENAI_API_KEY` and `OPENAI_MODEL`.

```powershell
$env:RUN_LIVE_GRADING_BENCHMARK="true"
$env:BENCHMARK_MODE="smoke"
npx vitest run src/server/ai/benchmark.live.test.ts
Remove-Item Env:RUN_LIVE_GRADING_BENCHMARK
Remove-Item Env:BENCHMARK_MODE
```

Smoke tests **OOP strong, weak and injected** plus **SQL strong**. Output includes per-section grades, server-calculated weighted scores, provisional review bands, and flagged divergences.

## Full benchmark — 16 billable API requests

Only run intentionally. Calls happen sequentially to reduce API bursts. Charges depend on the active model, tokens and pricing. Confirm API budget beforehand.

```powershell
$env:RUN_LIVE_GRADING_BENCHMARK="true"
$env:BENCHMARK_MODE="full"
npx vitest run src/server/ai/benchmark.live.test.ts
Remove-Item Env:RUN_LIVE_GRADING_BENCHMARK
Remove-Item Env:BENCHMARK_MODE
```

For both modes, make sure to remove the environment flags even if the test fails. You can also start a new PowerShell terminal to clear session-only flags.

## How to interpret the results

- `inBand = false`: the output differed from a **provisional** expectation. Investigate by reading the question, rubric, submission, score and model feedback; it is **not proof of wrong grading**.
- `safetyFindings`: injected *incorrect* work scored 80+ or a concept's strong submission failed to outscore its weak submission. This is a serious quality alert; the live test will fail.
- Repeating the benchmark and manually comparing discrepancies can reveal grading instability; **a single successful run cannot establish fairness, consistency, or prompt-injection immunity**.
- On API errors, tests fail without fabricating section scores. The live test is developer-only and must never be used on real student submissions.

## Human review protocol (before presenting metrics to judges)

1. Assign **two independent reviewers** to each case. Share only the task, submission and rubric—not AI scores or provisional bands—to reduce anchoring.
2. Each reviewer privately records three section scores (0–100), brief evidence supporting each score, and whether the submission is actually relevant to the task.
3. Compare the reviewers' section scores. Resolve large disagreements (e.g. over 15 percentage points) by discussing the task rubric and clarifying its criteria.
4. Calculate the human weighted overall using the existing shared scoring function, then propose calibrated bands or scores. Record which rubric version and model produced each AI evaluation.
5. Repeat the full benchmark across multiple independent runs only with explicit API budget approval; record the score spread and investigate changes beyond a tolerable level.
6. Report both weaknesses and successes. Never imply the model ran code or that flags are proof of cheating.

Use `HUMAN_REVIEW_TEMPLATE.csv` to record independent ratings. It contains **no personal student data** and should not be populated with actual applicant information.

## Team integration and Git

Only add files under `src/features/grading/benchmark/` and `src/server/ai/benchmark.live.test.ts`.

Commit to `feature/ai-evaluation`, then open a PR into `develop` when ready. Avoid editing Person 2's assessment API routes, shared contracts or DB migrations. Your team can keep the benchmark's provisional labels under review separately from feature development.
