import { describe, expect, it } from "vitest";
import type { Evaluation } from "../../../contracts/domain";
import { benchmarkCases, selectBenchmarkCases } from "./cases";
import { buildBenchmarkReport } from "./report";

const sample = selectBenchmarkCases("smoke");
function evaluation(score: number): Evaluation {
  return {
    scores: { theory: score, practical: score, understanding: score },
    feedback: "Fictional model feedback for testing the benchmark report.",
    strengths: [],
    improvements: [],
  };
}

describe("benchmark report — deterministic, zero API charges", () => {
  it("computes weighted overall from section scores instead of trusting a model", () => {
    const result = buildBenchmarkReport([benchmarkCases[0]], [{
      caseId: benchmarkCases[0].id,
      evaluation: { ...evaluation(90), scores: { theory: 60, practical: 80, understanding: 100 } },
    }]);
    expect(result.rows[0].overall).toBe(78);
    expect(result.rows[0].expectedRange).toBe("75-100");
    expect(result.outOfRange).toEqual([]);
  });

  it("reports provisional outliers and concerning score inversions", () => {
    const observations = sample.map((c) => ({
      caseId: c.id,
      evaluation: evaluation(c.tier === "weak" ? 98 : c.tier === "injected" ? 99 : 10),
    }));
    const report = buildBenchmarkReport(sample, observations);
    expect(report.outOfRange.length).toBeGreaterThan(0);
    expect(report.safetyFindings.some((s) => s.includes("injected"))).toBe(true);
    expect(report.safetyFindings.some((s) => s.includes("did not beat weak"))).toBe(true);
  });

  it("accepts valid fictional observations without safety findings", () => {
    const report = buildBenchmarkReport(sample, sample.map((c) => ({
      caseId: c.id, evaluation: evaluation(c.tier === "strong" ? 95 : 5),
    })));
    expect(report.safetyFindings).toEqual([]);
    expect(report.outOfRange).toEqual([]);
  });

  it("rejects missing, duplicate and unknown observations", () => {
    expect(() => buildBenchmarkReport(sample, [])).toThrow("BENCHMARK_MISSING_OBSERVATIONS");
    const repeated = sample.map(() => ({ caseId: sample[0].id, evaluation: evaluation(50) }));
    expect(() => buildBenchmarkReport(sample, repeated)).toThrow("BENCHMARK_DUPLICATE_OBSERVATION");
    const unknown = sample.map((c, index) => ({
      caseId: index === 0 ? "not-a-case" : c.id,
      evaluation: evaluation(50),
    }));
    expect(() => buildBenchmarkReport(sample, unknown)).toThrow("BENCHMARK_UNKNOWN_CASE");
  });

  it("rejects a fabricated out-of-range section score", () => {
    expect(() => buildBenchmarkReport([sample[0]], [{
      caseId: sample[0].id,
      evaluation: { ...evaluation(80), scores: { theory: 101, practical: 80, understanding: 80 } },
    }])).toThrow();
  });
});
