import { describe, expect, it } from "vitest";
import { ingestIntegrityEvent, type EventStore } from "./ingest";
import { eventRateDecision, summariseEvents, type AttemptForIntegrity, type RecordedEvent } from "./rules";
import type { IntegrityEventType } from "../../contracts/domain";
import { withAttemptAdmissionLock } from "./lock";

const attemptId = "c5000000-0000-4000-8000-000000000001";
const owner = "c5000000-0000-4000-8000-000000000002";
const other = "c5000000-0000-4000-8000-000000000003";
const now = new Date("2026-10-21T13:00:00.000Z");
const validBody = { eventType: "tab_hidden", occurredAt: "2026-10-20T08:00:00.000Z" };
const active: AttemptForIntegrity = {
  id: attemptId, student_id: owner, status: "in_progress", expires_at: "2026-10-21T14:00:00.000Z",
};
function fakeStore(attempt: AttemptForIntegrity | null = active, events: RecordedEvent[] = []) {
  const stored = [...events];
  const store: EventStore = {
    getAttempt: async () => attempt,
    recentEvents: async (_, since) => stored.filter((event) => event.recorded_at >= since),
    countEvents: async () => stored.length,
    insertEvent: async (_, eventType: IntegrityEventType) => {
      stored.push({ event_type: eventType, recorded_at: now.toISOString() });
    },
  };
  return { store, stored };
}
const asOwner = { attemptId, body: validBody, studentId: owner, role: "student" };

describe("secure event ingestion", () => {
  it("rejects unauthenticated users before any DB operation", async () => {
    const { store } = fakeStore();
    expect((await ingestIntegrityEvent({ ...asOwner, studentId: null }, store, now)).status).toBe(401);
  });
  it("rejects non-student accounts", async () => {
    expect((await ingestIntegrityEvent({ ...asOwner, role: "employer" }, fakeStore().store, now)).status).toBe(403);
  });
  it("blocks a different student from writing to an owned attempt", async () => {
    const { store, stored } = fakeStore();
    expect((await ingestIntegrityEvent({ ...asOwner, studentId: other }, store, now)).status).toBe(403);
    expect(stored).toHaveLength(0);
  });
  it("rejects malformed attempt IDs and extra spoofed fields", async () => {
    const { store } = fakeStore();
    expect((await ingestIntegrityEvent({ ...asOwner, attemptId: "broken" }, store, now)).status).toBe(422);
    expect((await ingestIntegrityEvent({ ...asOwner, body: { ...validBody, warningCount: 10000, studentId: owner } }, store, now)).status).toBe(422);
    expect((await ingestIntegrityEvent({ ...asOwner, body: { eventType: "auto_ban", occurredAt: validBody.occurredAt } }, store, now)).status).toBe(422);
  });
  it("rejects completed and expired attempts", async () => {
    const completed = fakeStore({ ...active, status: "graded" });
    expect((await ingestIntegrityEvent(asOwner, completed.store, now)).status).toBe(409);
    const expired = fakeStore({ ...active, expires_at: "2026-10-21T12:59:59.000Z" });
    expect((await ingestIntegrityEvent(asOwner, expired.store, now)).status).toBe(409);
  });
  it("accepts valid events and derives count from storage, never from client", async () => {
    const { store, stored } = fakeStore();
    const response = await ingestIntegrityEvent(asOwner, store, now);
    expect(response).toEqual({ status: 200, body: { accepted: true, eventCount: 1, reviewRecommended: true } });
    expect(stored[0]).toEqual({ event_type: "tab_hidden", recorded_at: now.toISOString() });
    expect(stored[0].recorded_at).not.toBe(validBody.occurredAt);
  });
  it("deduplicates same-type bursts without another DB insert", async () => {
    const { store, stored } = fakeStore();
    await ingestIntegrityEvent(asOwner, store, now);
    const again = await ingestIntegrityEvent(asOwner, store, new Date(now.getTime() + 1000));
    expect(again.status).toBe(200);
    expect(stored).toHaveLength(1);
  });
  it("limits burst rates and attempt totals", async () => {
    const recent: RecordedEvent[] = Array.from({ length: 15 }, (_, i) => ({ event_type: "window_blur", recorded_at: new Date(now.getTime() - 10_000 - i * 100).toISOString() }));
    const { store, stored } = fakeStore(active, recent);
    expect((await ingestIntegrityEvent(asOwner, store, now)).status).toBe(429);
    expect(stored).toHaveLength(15);
    expect(eventRateDecision("tab_hidden", [], 250, now)).toBe("rate_limited");
  });
  it("serializes same-attempt concurrent admissions inside one server", async () => {
    const { store, stored } = fakeStore();
    const requests = Array.from({ length: 40 }, (_, i) => withAttemptAdmissionLock(attemptId, () =>
      ingestIntegrityEvent({ ...asOwner, body: { ...validBody, eventType: i % 2 ? "window_blur" : "tab_hidden" } }, store, now)));
    const results = await Promise.all(requests);
    expect(stored.length).toBeLessThanOrEqual(2); // duplicate cooldown, not 40 rows
    expect(results.every((result) => result.status === 200)).toBe(true);
  });
  it("does not convert false-positive signals into technical failure or a ban", () => {
    expect(summariseEvents(["window_blur", "tab_hidden"])).toEqual({ flaggedEventCount: 2, disqualifyingTechnicalFailure: false, reviewRecommended: true });
    expect(summariseEvents(["camera_track_ended"]).disqualifyingTechnicalFailure).toBe(true);
    expect(summariseEvents([]).reviewRecommended).toBe(false);
  });
});
