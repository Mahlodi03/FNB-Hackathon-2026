import { describe, expect, it } from "vitest";
import { classifyIntegritySnapshot, SHADOW_TRIAGE_POLICY, type TriageInput } from "./rules";
import type { IntegrityEventType } from "../../../contracts/domain";

const startedAt = "2026-10-25T09:00:00.000Z";
const expiresAt = "2026-10-25T09:30:00.000Z";
const submittedAt = "2026-10-25T09:20:00.000Z";
const receivedAt = "2026-10-25T09:15:00.000Z";
function events(type: IntegrityEventType, n: number) {
  return Array.from({ length: n }, () => ({ eventType: type, recordedAt: receivedAt }));
}
function fixture(overrides: Partial<TriageInput> = {}): TriageInput {
  return {
    attempt: { status: "graded", startedAt, expiresAt, submittedAt },
    result: { visibility: "withheld", gradingSource: "ai_assisted" },
    existingHumanDecision: null,
    events: [],
    eventsTruncated: false,
    ...overrides,
  };
}
const triage = (changes: Partial<TriageInput> = {}) => classifyIntegritySnapshot(fixture(changes));

describe("observation-only integrity triage v1", () => {
  it("is deterministic, policy-versioned, and never a publication decision", () => {
    const a = triage();
    expect(triage()).toEqual(a);
    expect(a.policyVersion).toBe(SHADOW_TRIAGE_POLICY);
    expect(a.observationOnly).toBe(true);
    expect(a.telemetryCoverage).toBe("unverified");
  });
  it("never grades or labels unfinished attempts for misconduct", () => {
    expect(triage({ attempt: { status: "in_progress", startedAt, expiresAt, submittedAt: null } }).band).toBe("not_applicable");
    expect(triage({ attempt: { status: "submitted", startedAt, expiresAt, submittedAt } }).band).toBe("not_applicable");
    expect(triage({ attempt: { status: "invalidated", startedAt, expiresAt, submittedAt: null } }).band).toBe("not_applicable");
  });
  it("respects an existing human decision even with warning events", () => {
    for (const decision of ["cleared", "needs_investigation", "withheld"] as const) {
      expect(triage({ existingHumanDecision: decision, events: events("multiple_faces", 5) }).band).toBe("human_decision_exists");
    }
  });
  it("does not mistake missing grade for a routine assessment", () => {
    expect(triage({ result: null }).reasonCodes).toContain("GRADED_RESULT_MISSING");
  });
  it("treats missing timestamps as insufficient data", () => {
    expect(triage({ attempt: { status: "graded", startedAt, expiresAt, submittedAt: null } }).band).toBe("insufficient_data");
    expect(triage({ attempt: { status: "graded", startedAt: "invalid", expiresAt, submittedAt } }).band).toBe("insufficient_data");
  });
  it("does not excuse late or impossible submissions", () => {
    expect(triage({ attempt: { status: "graded", startedAt, expiresAt, submittedAt: "2026-10-25T09:31:00.000Z" } }).band).toBe("insufficient_data");
    expect(triage({ attempt: { status: "graded", startedAt, expiresAt, submittedAt: "2026-10-25T08:59:00.000Z" } }).band).toBe("insufficient_data");
  });
  it("does not treat capped or truncated event logs as clean", () => {
    expect(triage({ eventsTruncated: true }).band).toBe("insufficient_data");
    expect(triage({ events: events("tab_hidden", 250) }).band).toBe("insufficient_data");
  });
  it("does not silently accept invalid event timestamps", () => {
    expect(triage({ events: [{ eventType: "tab_hidden", recordedAt: "invalid" }] }).band).toBe("insufficient_data");
  });
  it("identifies a routine candidate but never claims full monitoring coverage", () => {
    const outcome = triage();
    expect(outcome.band).toBe("routine_candidate");
    expect(outcome.reasonCodes).toContain("MONITORING_COVERAGE_UNVERIFIED");
    expect(outcome.reasonCodes).toContain("NO_RECORDED_WARNINGS");
  });
  it("treats brief tab and blur signals as potential routine behavior", () => {
    expect(triage({ events: [...events("tab_hidden", 1), ...events("window_blur", 1)] }).band).toBe("routine_candidate");
  });
  it("does not equate camera failure with cheating", () => {
    const x = triage({ events: events("permission_lost", 2) });
    expect(x.band).toBe("monitor");
    expect(x.reasonCodes).not.toContain("MULTIPLE_SIGNAL_GROUPS_REPEATED");
  });
  it("does not escalate repeated face signals alone into a verdict", () => {
    expect(triage({ events: events("multiple_faces", 5) }).band).toBe("monitor");
  });
  it("avoids double-counting tab-hidden and blur as separate groups", () => {
    expect(triage({ events: [...events("tab_hidden", 4), ...events("window_blur", 4)] }).band).toBe("monitor");
  });
  it("marks repeated independent groups for investigation without withholding", () => {
    const a = triage({ events: [...events("tab_hidden", 4), ...events("multiple_faces", 2)] });
    const b = triage({ events: [...events("window_blur", 4), ...events("paste_attempt", 3)] });
    expect(a.band).toBe("review_candidate");
    expect(b.band).toBe("review_candidate");
    expect(a.observationOnly).toBe(true);
  });
  it("does not escalate a single clipboard warning", () => {
    expect(triage({ events: events("paste_attempt", 1) }).band).toBe("monitor");
  });
  it("returns aggregate counts without storing student identities or answers", () => {
    const x = triage({ events: [...events("tab_hidden", 2), ...events("multiple_faces", 1)] });
    expect(x.recordedEventCount).toBe(3);
    expect(x.eventCounts.tab_hidden).toBe(2);
    expect(x.eventCounts.multiple_faces).toBe(1);
    expect(JSON.stringify(x)).not.toContain("student_id");
  });
});
