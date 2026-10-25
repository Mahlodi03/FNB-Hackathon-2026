import { describe, expect, it } from "vitest";
import { getAssessmentProgressState } from "./progress-state";

const deadline = "2026-10-25T13:00:00.000Z";
const before = Date.parse("2026-10-25T12:59:59.000Z");
const onDeadline = Date.parse(deadline);
const after = Date.parse("2026-10-25T13:01:00.000Z");

function state(status: string, now: number, options?: {
  passed?: boolean | null;
  visibility?: string | null;
  expiresAt?: string;
}) {
  return getAssessmentProgressState({
    status,
    expiresAt: options?.expiresAt ?? deadline,
    passed: options?.passed ?? null,
    visibility: options?.visibility ?? null,
  }, now);
}

describe("student assessment progress display", () => {
  it("shows an unexpired attempt as in progress", () => {
    expect(state("in_progress", before).label).toBe("In progress");
    expect(state("awaiting_understanding", before).label).toBe("In progress");
  });

  it("shows unfinished attempts as expired at the original deadline", () => {
    expect(state("in_progress", onDeadline).label).toBe("Time expired — not submitted");
    expect(state("awaiting_understanding", after).label).toBe("Time expired — not submitted");
    expect(state("in_progress", after, { expiresAt: "invalid" }).label)
      .toBe("Time expired — not submitted");
  });

  it("does not expire a properly submitted attempt waiting for grading", () => {
    expect(state("submitted", after).label).toBe("Awaiting result");
  });

  it("preserves graded pass and improvement outcomes even after expiry", () => {
    expect(state("graded", after, { passed: true, visibility: "published" }).label).toBe("Passed");
    expect(state("graded", after, { passed: false, visibility: "provisional" }).label).toBe("Needs improvement");
  });

  it("preserves withheld review state independently of elapsed time", () => {
    expect(state("graded", after, { passed: true, visibility: "withheld" }).label).toBe("Private review");
    expect(state("submitted", after, { passed: true, visibility: "withheld" }).label).toBe("Private review");
  });

  it("preserves invalidation independently of the deadline", () => {
    expect(state("invalidated", before).label).toBe("Invalidated");
    expect(state("invalidated", after).label).toBe("Invalidated");
  });

  it("does not invent a final result for an unknown status", () => {
    expect(state("unexpected", after).label).toBe("Status unavailable");
  });
});
