import type { IntegrityEventType } from "../../../contracts/domain";

/** SHADOW ONLY: classifications are diagnostic, never publication or misconduct decisions. */
export const SHADOW_TRIAGE_POLICY = "shadow-triage-2026-10-25-v1" as const;

export type TriageBand =
  | "routine_candidate"
  | "monitor"
  | "review_candidate"
  | "insufficient_data"
  | "human_decision_exists"
  | "not_applicable";

export type TriageInput = {
  attempt: {
    status: string;
    startedAt: string;
    expiresAt: string;
    submittedAt: string | null;
  };
  result: { visibility: string; gradingSource: string } | null;
  existingHumanDecision: "cleared" | "needs_investigation" | "withheld" | null;
  events: readonly { eventType: IntegrityEventType; recordedAt: string }[];
  /** True if the data source did not retrieve every recorded event. */
  eventsTruncated: boolean;
};

export type TriageOutput = {
  policyVersion: typeof SHADOW_TRIAGE_POLICY;
  band: TriageBand;
  reasonCodes: string[];
  recordedEventCount: number;
  eventCounts: Partial<Record<IntegrityEventType, number>>;
  telemetryCoverage: "unverified";
  /** Invariant: this engine cannot mutate or authorize publication. */
  observationOnly: true;
};

/**
 * Deterministic pilot rules. Thresholds are hypotheses for calibration, NOT
 * findings of cheating. Browser-reported events can be missing or misleading.
 * We do not have positive monitoring heartbeat/coverage records yet.
 */
export function classifyIntegritySnapshot(input: TriageInput): TriageOutput {
  const eventCounts: Partial<Record<IntegrityEventType, number>> = {};
  for (const event of input.events) {
    eventCounts[event.eventType] = (eventCounts[event.eventType] ?? 0) + 1;
  }
  const base = {
    policyVersion: SHADOW_TRIAGE_POLICY,
    recordedEventCount: input.events.length,
    eventCounts,
    telemetryCoverage: "unverified" as const,
    observationOnly: true as const,
  };
  const output = (band: TriageBand, reasonCodes: string[]): TriageOutput => ({
    ...base, band, reasonCodes,
  });

  // Never suggest a score or integrity decision for an incomplete/expired attempt.
  if (input.attempt.status !== "graded") {
    return output("not_applicable", ["NOT_A_GRADED_ATTEMPT"]);
  }
  // Existing human decisions must never be superseded by a shadow suggestion.
  if (input.existingHumanDecision !== null) {
    return output("human_decision_exists", ["EXISTING_HUMAN_DECISION"]);
  }
  if (!input.result) return output("insufficient_data", ["GRADED_RESULT_MISSING"]);

  const started = Date.parse(input.attempt.startedAt);
  const expires = Date.parse(input.attempt.expiresAt);
  const submitted = input.attempt.submittedAt === null ? NaN : Date.parse(input.attempt.submittedAt);
  if (![started, expires, submitted].every(Number.isFinite)) {
    return output("insufficient_data", ["ASSESSMENT_TIMESTAMPS_MISSING"]);
  }
  if (expires <= started || submitted < started || submitted > expires) {
    return output("insufficient_data", ["ASSESSMENT_TIMESTAMPS_INCONSISTENT"]);
  }
  if (input.eventsTruncated || input.events.length >= 250) {
    return output("insufficient_data", ["EVENT_HISTORY_INCOMPLETE_OR_CAPPED"]);
  }
  if (input.events.some((event) => !Number.isFinite(Date.parse(event.recordedAt)))) {
    return output("insufficient_data", ["EVENT_TIMESTAMP_INVALID"]);
  }

  const count = (type: IntegrityEventType) => eventCounts[type] ?? 0;
  // A blur and a hidden-tab event commonly describe the same user action;
  // avoid treating them as independent corroborating incidents.
  const navigationSignals = Math.max(count("tab_hidden"), count("window_blur"));
  const faceSignals = count("multiple_faces");
  const clipboardSignals = count("copy_attempt") + count("paste_attempt");
  const reasonCodes: string[] = ["MONITORING_COVERAGE_UNVERIFIED"];

  // Pilot review candidates require *different* groups of repeated signals.
  // Even this designation is not proof of wrongdoing or a withholding command.
  if (navigationSignals >= 4 && (faceSignals >= 2 || clipboardSignals >= 3)) {
    reasonCodes.push("MULTIPLE_SIGNAL_GROUPS_REPEATED");
    return output("review_candidate", reasonCodes);
  }

  const mildTypes: readonly IntegrityEventType[] = ["window_blur", "tab_hidden", "fullscreen_exit"];
  if (
    input.events.length === 0 ||
    (input.events.length <= 2 && input.events.every((event) => mildTypes.includes(event.eventType)))
  ) {
    reasonCodes.push(input.events.length === 0 ? "NO_RECORDED_WARNINGS" : "ISOLATED_NAVIGATION_WARNINGS");
    return output("routine_candidate", reasonCodes);
  }

  // Includes camera/permission failure, repeated navigation and other warning
  // types: review frequency/context later; NEVER automatically penalize here.
  reasonCodes.push("WARNING_SIGNALS_REQUIRE_CONTEXT");
  return output("monitor", reasonCodes);
}
