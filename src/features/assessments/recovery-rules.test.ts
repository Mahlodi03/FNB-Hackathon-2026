import { describe, expect, it } from "vitest";
import { canResumeTimedAttempt, canSaveDraft, deadlinePassed } from "./recovery-rules";

const NOW = Date.parse("2026-10-24T15:00:00Z");
const BEFORE = "2026-10-24T14:59:59Z";
const AFTER = "2026-10-24T15:20:00Z";

describe("assessment recovery state rules", () => {
  it("keeps the original timer and rejects expired or invalid deadlines", () => {
    expect(deadlinePassed(BEFORE, NOW)).toBe(true);
    expect(deadlinePassed("invalid", NOW)).toBe(true);
    expect(deadlinePassed(AFTER, NOW)).toBe(false);
  });
  it("only resumes active, unexpired stages", () => {
    expect(canResumeTimedAttempt("in_progress", AFTER, NOW)).toBe(true);
    expect(canResumeTimedAttempt("awaiting_understanding", AFTER, NOW)).toBe(true);
    for (const status of ["submitted", "graded", "invalidated"]) {
      expect(canResumeTimedAttempt(status, AFTER, NOW)).toBe(false);
    }
    expect(canResumeTimedAttempt("in_progress", BEFORE, NOW)).toBe(false);
  });
  it("never changes locked or completed answers by autosaving drafts", () => {
    expect(canSaveDraft("initial", "in_progress", AFTER, false, NOW)).toBe(true);
    expect(canSaveDraft("initial", "in_progress", AFTER, true, NOW)).toBe(false);
    expect(canSaveDraft("initial", "awaiting_understanding", AFTER, false, NOW)).toBe(false);
    expect(canSaveDraft("understanding", "awaiting_understanding", AFTER, true, NOW)).toBe(true);
    expect(canSaveDraft("understanding", "submitted", AFTER, true, NOW)).toBe(false);
    expect(canSaveDraft("understanding", "awaiting_understanding", BEFORE, true, NOW)).toBe(false);
  });
});
