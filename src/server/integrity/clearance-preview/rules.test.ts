import { describe, expect, it } from "vitest";
import { CLEARANCE_PREVIEW_POLICY, previewRoutineClearance, type ClearancePreviewInput } from "./rules";
import { classifyIntegritySnapshot } from "../triage/rules";
import { summariseMonitoringTransport } from "../monitoring-coverage";

function fixture(changes: Partial<ClearancePreviewInput> = {}): ClearancePreviewInput {
  return {
    attemptStatus: "graded",
    result: { passed: true, visibility: "withheld", gradingSource: "ai_assisted" },
    existingHumanDecision: null,
    triage: { band: "routine_candidate", observationOnly: true, telemetryCoverage: "unverified" },
    monitoring: {
      transportStatus: "regular_transport", receiptCount: 5,
      claimedHealthyReceiptCount: 5,
      authenticity: "client_reported_not_independently_verified",
      observationOnly: true, autoClearanceEligible: false,
    },
    ...changes,
  };
}
const preview = (changes: Partial<ClearancePreviewInput> = {}) => previewRoutineClearance(fixture(changes));

describe("Phase 3A routine-clearance dry run", () => {
  it("identifies a narrow hypothetical candidate without enabling writes", () => {
    const result = preview();
    expect(result.policyVersion).toBe(CLEARANCE_PREVIEW_POLICY);
    expect(result.outcome).toBe("future_clearance_candidate");
    expect(result.candidateForFutureClearance).toBe(true);
    expect(result.observationOnly).toBe(true);
    expect(result.autoClearanceEnabled).toBe(false);
    expect(result.authenticity).toBe("browser_reports_not_independent_proof");
    expect(preview()).toEqual(result);
  });
  it.each(["in_progress", "awaiting_understanding", "submitted", "invalidated"])(
    "never proposes clearance for %s", (attemptStatus) => {
      expect(preview({ attemptStatus }).outcome).toBe("not_applicable");
    },
  );
  it.each(["cleared", "needs_investigation", "withheld"] as const)(
    "never overrides the human decision %s", (existingHumanDecision) => {
      expect(preview({ existingHumanDecision }).outcome).toBe("existing_human_decision");
    },
  );
  it("does not approve a missing or malformed grade", () => {
    expect(preview({ result: null }).candidateForFutureClearance).toBe(false);
    expect(preview({ result: { passed: undefined as unknown as boolean, visibility: "withheld", gradingSource: "ai_assisted" } }).candidateForFutureClearance).toBe(false);
  });
  it("does not republish an already published result", () => {
    expect(preview({ result: { passed: true, visibility: "published", gradingSource: "ai_assisted" } }).outcome).toBe("already_visible");
  });
  it("never promotes failed scores into public passing evidence", () => {
    expect(preview({ result: { passed: false, visibility: "withheld", gradingSource: "ai_assisted" } }).outcome).toBe("not_applicable");
  });
  it("does not change provisional results or manually graded results", () => {
    expect(preview({ result: { passed: true, visibility: "provisional", gradingSource: "ai_assisted" } }).candidateForFutureClearance).toBe(false);
    expect(preview({ result: { passed: true, visibility: "withheld", gradingSource: "manual_review" } }).candidateForFutureClearance).toBe(false);
  });
  it("rejects unknown result visibility", () => {
    expect(preview({ result: { passed: true, visibility: "unknown", gradingSource: "ai_assisted" } }).candidateForFutureClearance).toBe(false);
  });
  it.each(["monitor", "review_candidate", "insufficient_data", "human_decision_exists", "not_applicable"])(
    "never clears %s triage", (band) => {
      expect(preview({ triage: { ...fixture().triage, band } }).candidateForFutureClearance).toBe(false);
    },
  );
  it("does not trust altered triage contracts", () => {
    expect(preview({ triage: { ...fixture().triage, observationOnly: false } }).candidateForFutureClearance).toBe(false);
  });
  it.each(["no_receipts", "partial_transport", "unassessable", "not_applicable"])(
    "does not clear %s transport", (transportStatus) => {
      expect(preview({ monitoring: { ...fixture().monitoring, transportStatus } }).candidateForFutureClearance).toBe(false);
    },
  );
  it("requires at least two receipts and no browser-reported unhealthy interval", () => {
    expect(preview({ monitoring: { ...fixture().monitoring, receiptCount: 1, claimedHealthyReceiptCount: 1 } }).candidateForFutureClearance).toBe(false);
    expect(preview({ monitoring: { ...fixture().monitoring, claimedHealthyReceiptCount: 4 } }).candidateForFutureClearance).toBe(false);
    expect(preview({ monitoring: { ...fixture().monitoring, receiptCount: -1, claimedHealthyReceiptCount: -1 } }).candidateForFutureClearance).toBe(false);
  });
  it("does not trust invalid or non-observation-only monitoring reports", () => {
    expect(preview({ monitoring: { ...fixture().monitoring, autoClearanceEligible: true } }).candidateForFutureClearance).toBe(false);
    expect(preview({ monitoring: { ...fixture().monitoring, observationOnly: false } }).candidateForFutureClearance).toBe(false);
    expect(preview({ monitoring: { ...fixture().monitoring, authenticity: "verified" } }).candidateForFutureClearance).toBe(false);
  });
  it("composes the real shadow triage and transport summaries without authorizing publication", () => {
    const triage = classifyIntegritySnapshot({
      attempt: {
        status: "graded", startedAt: "2026-10-25T11:00:00Z",
        expiresAt: "2026-10-25T11:30:00Z", submittedAt: "2026-10-25T11:02:00Z",
      },
      result: { visibility: "withheld", gradingSource: "ai_assisted" },
      existingHumanDecision: null, events: [], eventsTruncated: false,
    });
    const received_at = ["11:00:10", "11:00:40", "11:01:10", "11:01:40"].map((time) => ({
      received_at: `2026-10-25T${time}Z`, camera_track_live: true,
      fullscreen_active: true, page_visible: true,
    }));
    const monitoring = summariseMonitoringTransport({
      status: "graded", startedAt: "2026-10-25T11:00:00Z",
      submittedAt: "2026-10-25T11:02:00Z", receipts: received_at, truncated: false,
    });
    expect(previewRoutineClearance({ ...fixture(), triage, monitoring })).toMatchObject({
      outcome: "future_clearance_candidate", autoClearanceEnabled: false,
    });
  });
  it("never promotes a genuine face-loss event based on otherwise regular receipts", () => {
    const triage = classifyIntegritySnapshot({
      attempt: {
        status: "graded", startedAt: "2026-10-25T11:00:00Z",
        expiresAt: "2026-10-25T11:30:00Z", submittedAt: "2026-10-25T11:02:00Z",
      },
      result: { visibility: "withheld", gradingSource: "ai_assisted" },
      existingHumanDecision: null,
      events: [{ eventType: "face_missing", recordedAt: "2026-10-25T11:01:00Z" }],
      eventsTruncated: false,
    });
    expect(triage.band).toBe("monitor");
    expect(preview({ triage }).candidateForFutureClearance).toBe(false);
  });
  it("never returns student identity, face data, grade values, or answers", () => {
    const report = JSON.stringify(preview());
    expect(report).not.toContain("student_id");
    expect(report).not.toContain("face_image");
    expect(report).not.toContain("overall_score");
    expect(report).not.toContain("theory_answer");
  });
});
