import { describe, expect, it } from "vitest";
import { ingestMonitoringReceipt, summariseMonitoringTransport, MONITORING_INTERVAL_MS,
  type MonitoringReceiptStore, type StoredMonitoringReceipt } from "./monitoring-coverage";
import type { AttemptForIntegrity } from "./rules";

const id = "c5000000-0000-4000-8000-000000000001";
const owner = "c5000000-0000-4000-8000-000000000002";
const other = "c5000000-0000-4000-8000-000000000003";
const now = new Date("2026-10-25T16:00:00.000Z");
const attempt: AttemptForIntegrity = {
  id, student_id: owner, status: "in_progress", expires_at: "2026-10-25T17:00:00.000Z",
};
const claim = { cameraTrackLive: true, fullscreenActive: true, pageVisible: true };
function storeFor(row: AttemptForIntegrity | null = attempt) {
  const writes: { bucket: number; claim: typeof claim }[] = [];
  const store: MonitoringReceiptStore = {
    getAttempt: async () => row,
    record: async (_attemptId, bucket, receipt) => { writes.push({ bucket, claim: receipt }); },
  };
  return { store, writes };
}
const input = { attemptId: id, studentId: owner, role: "student", body: claim };
const receipt = (received_at: string, healthy = true): StoredMonitoringReceipt => ({
  received_at, camera_track_live: healthy, fullscreen_active: healthy, page_visible: healthy,
});
const graded = { status: "graded", startedAt: "2026-10-25T16:00:00.000Z", submittedAt: "2026-10-25T16:02:00.000Z" };

describe("observation-only monitoring transport receipts", () => {
  it("accepts owner receipt, storing claims in a server time bucket", async () => {
    const { store, writes } = storeFor();
    expect(await ingestMonitoringReceipt(input, store, now)).toEqual({ status: 200, body: { accepted: true, observationOnly: true } });
    expect(writes).toEqual([{ bucket: Math.floor(now.getTime() / MONITORING_INTERVAL_MS), claim }]);
  });
  it("rejects signed-out and non-student access", async () => {
    const { store, writes } = storeFor();
    expect((await ingestMonitoringReceipt({ ...input, studentId: null }, store, now)).status).toBe(401);
    expect((await ingestMonitoringReceipt({ ...input, role: "employer" }, store, now)).status).toBe(403);
    expect(writes).toHaveLength(0);
  });
  it("rejects a different student and unknown attempts", async () => {
    expect((await ingestMonitoringReceipt({ ...input, studentId: other }, storeFor().store, now)).status).toBe(403);
    expect((await ingestMonitoringReceipt(input, storeFor(null).store, now)).status).toBe(404);
  });
  it("rejects malformed IDs, spoofed identity and extra fields", async () => {
    const { store, writes } = storeFor();
    expect((await ingestMonitoringReceipt({ ...input, attemptId: "bad" }, store, now)).status).toBe(422);
    expect((await ingestMonitoringReceipt({ ...input, body: { ...claim, studentId: owner } }, store, now)).status).toBe(422);
    expect((await ingestMonitoringReceipt({ ...input, body: { ...claim, autoClear: true } }, store, now)).status).toBe(422);
    expect((await ingestMonitoringReceipt({ ...input, body: { ...claim, cameraTrackLive: "yes" } }, store, now)).status).toBe(422);
    expect(writes).toHaveLength(0);
  });
  it("rejects expired, graded, invalidated and inactive attempts", async () => {
    for (const status of ["graded", "submitted", "invalidated"]) {
      expect((await ingestMonitoringReceipt(input, storeFor({ ...attempt, status }).store, now)).status).toBe(409);
    }
    expect((await ingestMonitoringReceipt(input, storeFor({ ...attempt, expires_at: now.toISOString() }).store, now)).status).toBe(409);
  });
  it("uses server receipt buckets independent of client timestamps", async () => {
    const { store, writes } = storeFor();
    await ingestMonitoringReceipt(input, store, now);
    await ingestMonitoringReceipt(input, store, new Date(now.getTime() + 10_000));
    expect(writes[0].bucket).toBe(writes[1].bucket);
    // The SQL primary key provides durable cross-instance deduplication.
  });
  it("does not infer coverage where none was reported", () => {
    expect(summariseMonitoringTransport({ ...graded, receipts: [], truncated: false }).transportStatus).toBe("no_receipts");
  });
  it("labels regular server delivery without asserting camera truthfulness", () => {
    const report = summariseMonitoringTransport({ ...graded, receipts: [
      receipt("2026-10-25T16:00:10Z"), receipt("2026-10-25T16:00:40Z"),
      receipt("2026-10-25T16:01:10Z"), receipt("2026-10-25T16:01:40Z"),
    ], truncated: false });
    expect(report.transportStatus).toBe("regular_transport");
    expect(report.authenticity).toBe("client_reported_not_independently_verified");
    expect(report.autoClearanceEligible).toBe(false);
  });
  it("detects a long missing interval without accusing a student", () => {
    const report = summariseMonitoringTransport({ ...graded, receipts: [receipt("2026-10-25T16:00:10Z"), receipt("2026-10-25T16:01:50Z")], truncated: false });
    expect(report.transportStatus).toBe("partial_transport");
    expect(report.autoClearanceEligible).toBe(false);
  });
  it("counts unhealthy browser claims separately from transport", () => {
    const report = summariseMonitoringTransport({ ...graded, receipts: [receipt("2026-10-25T16:00:10Z"), receipt("2026-10-25T16:00:40Z", false), receipt("2026-10-25T16:01:10Z"), receipt("2026-10-25T16:01:40Z")], truncated: false });
    expect(report.claimedHealthyReceiptCount).toBe(3);
    expect(report.receiptCount).toBe(4);
  });
  it("never treats malformed, out-of-window or capped data as complete", () => {
    expect(summariseMonitoringTransport({ ...graded, receipts: [receipt("invalid")], truncated: false }).transportStatus).toBe("unassessable");
    expect(summariseMonitoringTransport({ ...graded, receipts: [receipt("2026-10-25T16:05:00Z")], truncated: false }).transportStatus).toBe("unassessable");
    expect(summariseMonitoringTransport({ ...graded, receipts: [], truncated: true }).transportStatus).toBe("unassessable");
  });
  it("does not assess expired or unfinished attempts", () => {
    expect(summariseMonitoringTransport({ ...graded, status: "in_progress", receipts: [receipt("2026-10-25T16:00:10Z")], truncated: false }).transportStatus).toBe("not_applicable");
  });
});
