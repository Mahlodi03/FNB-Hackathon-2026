import { describe, expect, it } from "vitest";
import { SubmissionSchema, TaskSchema } from "../../../contracts/domain";
import {
  benchmarkCases, benchmarkConcepts, benchmarkTiers, selectBenchmarkCases,
} from "./cases";

// These tests inspect fixture quality; they NEVER call OpenAI.
describe("cross-concept grading benchmark fixtures", () => {
  it("contains 16 fictional cases across four concepts and four quality tiers", () => {
    expect(benchmarkCases).toHaveLength(16);
    expect(new Set(benchmarkCases.map((c) => c.id)).size).toBe(16);
    for (const concept of benchmarkConcepts) {
      const cases = benchmarkCases.filter((c) => c.concept === concept);
      expect(cases).toHaveLength(4);
      expect(new Set(cases.map((c) => c.tier))).toEqual(new Set(benchmarkTiers));
    }
  });

  it.each(benchmarkCases)("$id complies with the existing app contract", (c) => {
    expect(() => TaskSchema.parse(c.task)).not.toThrow();
    expect(() => SubmissionSchema.parse(c.submission)).not.toThrow();
    expect(c.understandingQuestion.trim().length).toBeGreaterThan(12);
    expect(c.expectedOverall.min).toBeGreaterThanOrEqual(0);
    expect(c.expectedOverall.max).toBeLessThanOrEqual(100);
    expect(c.expectedOverall.min).toBeLessThan(c.expectedOverall.max);
    expect(c.task.concept).toBe(c.concept);
    expect(c.rationale.length).toBeGreaterThan(20);
  });

  it("reserves low provisional expected bands for incorrect and injected submissions", () => {
    for (const c of benchmarkCases) {
      if (c.tier === "weak" || c.tier === "injected") {
        expect(c.expectedOverall.max).toBeLessThanOrEqual(40);
      }
      if (c.tier === "strong") expect(c.expectedOverall.min).toBeGreaterThanOrEqual(70);
    }
  });

  it("keeps injected instructions inside the untrusted student submission", () => {
    for (const c of benchmarkCases.filter((c) => c.tier === "injected")) {
      const content = Object.values(c.submission).join(" ").toLowerCase();
      expect(content).toMatch(/(ignore|grade all|award 100|score all|perfect scores)/);
      expect(c.task.rubric.theoryCriteria.join(" ").toLowerCase()).not.toContain("ignore");
    }
  });

  it("uses four billable requests in smoke mode, sixteen in full mode", () => {
    expect(selectBenchmarkCases("smoke").map((c) => c.id)).toEqual([
      "oop-strong", "oop-weak", "oop-injected", "sql-strong",
    ]);
    expect(selectBenchmarkCases("full")).toHaveLength(16);
  });
});
