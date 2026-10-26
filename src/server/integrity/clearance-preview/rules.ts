/**
 * PHASE 3A: A proposal only. This function can neither authorize nor perform
 * a database write, change a score, or decide that misconduct occurred.
 *
 * Browser telemetry is self-reported. Even a regular sequence of receipts
 * does not prove continuous camera operation, identity, or academic honesty.
 */
export const CLEARANCE_PREVIEW_POLICY = "integrity-clearance-preview-2026-10-25-v1" as const;

export type ClearancePreviewOutcome =
  | "future_clearance_candidate"
  | "already_visible"
  | "existing_human_decision"
  | "requires_exception_review"
  | "not_applicable";

export type ClearancePreviewInput = {
  attemptStatus: string;
  result: { passed: boolean; visibility: string; gradingSource: string } | null;
  existingHumanDecision: "cleared" | "needs_investigation" | "withheld" | null;
  triage: { band: string; observationOnly: boolean; telemetryCoverage: string };
  monitoring: {
    transportStatus: string;
    receiptCount: number;
    claimedHealthyReceiptCount: number;
    authenticity: string;
    observationOnly: boolean;
    autoClearanceEligible: boolean;
  };
};

export type ClearancePreviewOutput = {
  policyVersion: typeof CLEARANCE_PREVIEW_POLICY;
  outcome: ClearancePreviewOutcome;
  reasonCodes: string[];
  candidateForFutureClearance: boolean;
  /** Hard safety invariant: this phase never authorizes publication. */
  autoClearanceEnabled: false;
  observationOnly: true;
  authenticity: "browser_reports_not_independent_proof";
};

/** Deterministic, fail-closed proposal for *future* routine clearance. */
export function previewRoutineClearance(input: ClearancePreviewInput): ClearancePreviewOutput {
  const base = {
    policyVersion: CLEARANCE_PREVIEW_POLICY,
    autoClearanceEnabled: false as const,
    observationOnly: true as const,
    authenticity: "browser_reports_not_independent_proof" as const,
  };
  const outcome = (kind: ClearancePreviewOutcome, reasonCodes: string[]): ClearancePreviewOutput => ({
    ...base,
    outcome: kind,
    reasonCodes,
    candidateForFutureClearance: kind === "future_clearance_candidate",
  });

  if (input.attemptStatus !== "graded") {
    return outcome("not_applicable", ["ATTEMPT_NOT_GRADED"]);
  }
  if (input.existingHumanDecision !== null) {
    return outcome("existing_human_decision", ["HUMAN_DECISION_HAS_PRIORITY"]);
  }
  if (!input.result || typeof input.result.passed !== "boolean") {
    return outcome("requires_exception_review", ["GRADE_MISSING_OR_INVALID"]);
  }
  // Do not re-publish already visible evidence or override any unusual state.
  if (input.result.visibility === "published") {
    return outcome("already_visible", ["RESULT_ALREADY_PUBLISHED"]);
  }
  if (!["withheld", "provisional"].includes(input.result.visibility)) {
    return outcome("requires_exception_review", ["UNEXPECTED_RESULT_VISIBILITY"]);
  }
  if (input.result.gradingSource !== "ai_assisted") {
    return outcome("requires_exception_review", ["NON_AI_ASSISTED_GRADE"]);
  }
  // A failed result or an already provisional result is not a candidate for
  // changing *public* evidence visibility; keep its existing result intact.
  if (!input.result.passed) {
    return outcome("not_applicable", ["RESULT_DID_NOT_PASS_NO_PUBLIC_EVIDENCE"]);
  }
  if (input.result.visibility !== "withheld") {
    return outcome("requires_exception_review", ["PASSED_RESULT_NOT_WITHHELD"]);
  }
  if (
    !input.triage.observationOnly ||
    input.triage.telemetryCoverage !== "unverified" ||
    input.triage.band !== "routine_candidate"
  ) {
    return outcome("requires_exception_review", ["TRIAGE_NOT_ROUTINE_OR_NOT_TRUSTED"]);
  }
  if (
    !input.monitoring.observationOnly ||
    input.monitoring.autoClearanceEligible !== false ||
    input.monitoring.authenticity !== "client_reported_not_independently_verified"
  ) {
    return outcome("requires_exception_review", ["MONITORING_REPORT_CONTRACT_INVALID"]);
  }
  if (input.monitoring.transportStatus !== "regular_transport") {
    return outcome("requires_exception_review", ["MONITORING_TRANSPORT_NOT_REGULAR"]);
  }
  if (
    !Number.isSafeInteger(input.monitoring.receiptCount) ||
    !Number.isSafeInteger(input.monitoring.claimedHealthyReceiptCount) ||
    input.monitoring.receiptCount < 2 ||
    input.monitoring.claimedHealthyReceiptCount !== input.monitoring.receiptCount
  ) {
    return outcome("requires_exception_review", ["MONITORING_RECEIPT_CLAIMS_INCOMPLETE"]);
  }

  return outcome("future_clearance_candidate", [
    "SUBMITTED_AND_GRADED_PASSING_EVIDENCE",
    "ROUTINE_SHADOW_CLASSIFICATION",
    "SERVER_RECEIPTS_REGULAR_AND_CLIENT_CLAIMS_HEALTHY",
    "BROWSER_REPORTS_ARE_NOT_INDEPENDENT_PROOF",
    "DRY_RUN_ONLY_NO_DATABASE_WRITES",
  ]);
}
