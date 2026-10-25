import { z } from "zod";
import { AttemptIdSchema, validateAttemptAccess, type AttemptForIntegrity } from "./rules";

/** Client claims are telemetry, NOT independent proof of camera operation or identity. */
export const MonitoringReceiptSchema = z.object({
  cameraTrackLive: z.boolean(),
  fullscreenActive: z.boolean(),
  pageVisible: z.boolean(),
}).strict();
export type MonitoringReceiptClaim = z.infer<typeof MonitoringReceiptSchema>;
export const MONITORING_INTERVAL_MS = 30_000;

export interface MonitoringReceiptStore {
  getAttempt(attemptId: string): Promise<AttemptForIntegrity | null>;
  /** DB-enforced unique (attempt_id, time_bucket) makes retries idempotent. */
  record(attemptId: string, timeBucket: number, claims: MonitoringReceiptClaim): Promise<void>;
}

export type MonitoringReceiptResult = {
  status: number;
  body: { accepted: true; observationOnly: true } | { error: string; code: string };
};

/** Rejects non-owner, completed/expired, malformed and spoofed-data submissions. */
export async function ingestMonitoringReceipt(
  input: { attemptId: string; body: unknown; studentId: string | null; role?: string },
  store: MonitoringReceiptStore,
  now = new Date(),
): Promise<MonitoringReceiptResult> {
  if (!input.studentId) return { status: 401, body: { error: "Authentication required", code: "UNAUTHENTICATED" } };
  if (input.role !== "student") return { status: 403, body: { error: "Student role required", code: "ROLE_FORBIDDEN" } };
  if (!AttemptIdSchema.safeParse(input.attemptId).success) return { status: 422, body: { error: "Invalid attempt ID", code: "INVALID_ATTEMPT_ID" } };
  const parsed = MonitoringReceiptSchema.safeParse(input.body);
  if (!parsed.success) return { status: 422, body: { error: "Invalid monitoring receipt", code: "INVALID_RECEIPT" } };
  if (!Number.isFinite(now.getTime())) return { status: 503, body: { error: "Clock unavailable", code: "CLOCK_UNAVAILABLE" } };
  const attempt = await store.getAttempt(input.attemptId);
  const access = validateAttemptAccess(attempt, input.studentId, now);
  if (access) return { status: access.status, body: { error: access.error, code: access.code } };
  const bucket = Math.floor(now.getTime() / MONITORING_INTERVAL_MS);
  await store.record(input.attemptId, bucket, parsed.data);
  return { status: 200, body: { accepted: true, observationOnly: true } };
}

export type StoredMonitoringReceipt = {
  received_at: string;
  camera_track_live: boolean;
  fullscreen_active: boolean;
  page_visible: boolean;
};
export type MonitoringTransportStatus = "not_applicable" | "no_receipts" | "partial_transport" | "regular_transport" | "unassessable";

/**
 * Measures SERVER-RECEIVED receipt regularity, not truthfulness of browser claims.
 * No result produced here may authorize clearance or change assessment decisions.
 */
export function summariseMonitoringTransport(input: {
  status: string;
  startedAt: string;
  submittedAt: string | null;
  receipts: readonly StoredMonitoringReceipt[];
  truncated: boolean;
}) {
  const base = {
    receiptCount: input.receipts.length,
    claimedHealthyReceiptCount: input.receipts.filter((r) =>
      r.camera_track_live === true && r.fullscreen_active === true && r.page_visible === true).length,
    authenticity: "client_reported_not_independently_verified" as const,
    observationOnly: true as const,
    autoClearanceEligible: false as const,
  };
  const report = (transportStatus: MonitoringTransportStatus, reason: string, maxGapSeconds: number | null = null) =>
    ({ ...base, transportStatus, reason, maxGapSeconds });
  if (input.status !== "graded") return report("not_applicable", "NOT_GRADED");
  const start = Date.parse(input.startedAt);
  const end = input.submittedAt ? Date.parse(input.submittedAt) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || input.truncated) {
    return report("unassessable", "INCOMPLETE_OR_INVALID_INPUT");
  }
  if (!input.receipts.length) return report("no_receipts", "NO_SERVER_RECEIPTS");
  const timestamps = input.receipts.map((r) => Date.parse(r.received_at)).sort((a, b) => a - b);
  if (timestamps.some((t) => !Number.isFinite(t) || t < start || t > end)) {
    return report("unassessable", "RECEIPTS_OUTSIDE_SUBMISSION_WINDOW");
  }
  const gaps = [timestamps[0] - start, ...timestamps.slice(1).map((t, i) => t - timestamps[i]), end - timestamps[timestamps.length - 1]];
  const maxGap = Math.max(...gaps);
  // 60s tolerance for a 30s heartbeat; gaps are not presumed misconduct.
  return maxGap <= 60_000
    ? report("regular_transport", "SERVER_RECEIPTS_WITHIN_60S_GAPS", Math.ceil(maxGap / 1000))
    : report("partial_transport", "SERVER_RECEIPTS_HAVE_GAPS", Math.ceil(maxGap / 1000));
}
