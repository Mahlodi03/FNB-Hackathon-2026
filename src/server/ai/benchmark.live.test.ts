import { describe, expect, it, vi } from "vitest";
import { selectBenchmarkCases } from "../../features/grading/benchmark/cases";
import { buildBenchmarkReport, type GradingObservation } from "../../features/grading/benchmark/report";

// Explicit opt-in only: 4 billable API calls in smoke mode, 16 in full mode.
vi.mock("server-only", () => ({}));

const enabled = process.env.RUN_LIVE_GRADING_BENCHMARK === "true";

describe("cross-concept live AI grading benchmark (opt-in; billable)", () => {
  it.skipIf(!enabled)("prints provisional scoring audit and catches gross inversions", async () => {
    // Node 22+ can load .env.local. Keep secrets out of the test report.
    if (typeof process.loadEnvFile === "function") {
      try { process.loadEnvFile(".env.local"); }
      catch { /* CI may already provide OPENAI_API_KEY and OPENAI_MODEL. */ }
    }
    const { assessmentAi } = await import("./index");
    const mode = process.env.BENCHMARK_MODE === "full" ? "full" : "smoke";
    const cases = selectBenchmarkCases(mode);
    console.info(`Live benchmark mode: ${mode}. Requests to make: ${cases.length}. Model: ${process.env.OPENAI_MODEL ?? "not set"}`);

    const observations: GradingObservation[] = [];
    // Sequential calls deliberately limit rate-limit pressure and uncontrolled bursts.
    for (const benchmarkCase of cases) {
      const evaluation = await assessmentAi.evaluate({
        task: benchmarkCase.task,
        understandingQuestion: benchmarkCase.understandingQuestion,
        submission: benchmarkCase.submission,
      });
      observations.push({ caseId: benchmarkCase.id, evaluation });
    }

    const report = buildBenchmarkReport(cases, observations);
    console.table(report.rows.map(({ caseId, theory, practical, understanding, overall, expectedRange, withinProvisionalRange }) => ({
      caseId, theory, practical, understanding, overall,
      provisionalBand: expectedRange,
      inBand: withinProvisionalRange,
    })));
    console.info("Provisional band deviations (manual review required):", report.outOfRange);
    console.info("Severe discriminatory or injection findings:", report.safetyFindings);
    console.info("The expected ranges are preliminary; humans must review evidence before using as calibrated labels.");

    // Failing this is a serious concern. Out-of-band scores are REVIEW FLAGS, not automatic verdicts.
    expect(report.safetyFindings).toEqual([]);
  }, 15 * 60_000);
});
