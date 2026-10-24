import { AttemptIdSchema, EventRequestSchema, eventRateDecision, validateAttemptAccess,
  type AttemptForIntegrity, type RecordedEvent } from "./rules";
import type { IntegrityEventType } from "../../contracts/domain";

export interface EventStore {
  getAttempt(attemptId: string): Promise<AttemptForIntegrity | null>;
  recentEvents(attemptId: string, since: string): Promise<RecordedEvent[]>;
  countEvents(attemptId: string): Promise<number>;
  insertEvent(attemptId: string, eventType: IntegrityEventType): Promise<void>;
}
export type EventResult = {
  status: number;
  body: { accepted: true; eventCount: number; reviewRecommended: boolean } |
    { error: string; code: string };
};

/** Purely API-level admission: never trust user IDs, warning counts or punishment fields. */
export async function ingestIntegrityEvent(
  input: { attemptId: string; body: unknown; studentId: string | null; role?: string },
  store: EventStore,
  now = new Date(),
): Promise<EventResult> {
  if (!input.studentId) return { status: 401, body: { error: "Authentication required", code: "UNAUTHENTICATED" } };
  if (input.role !== "student") return { status: 403, body: { error: "Student role required", code: "ROLE_FORBIDDEN" } };
  if (!AttemptIdSchema.safeParse(input.attemptId).success) {
    return { status: 422, body: { error: "Invalid attempt ID", code: "INVALID_ATTEMPT_ID" } };
  }
  const parsed = EventRequestSchema.safeParse(input.body);
  if (!parsed.success) return { status: 422, body: { error: "Invalid integrity event", code: "INVALID_EVENT" } };

  const attempt = await store.getAttempt(input.attemptId);
  const access = validateAttemptAccess(attempt, input.studentId, now);
  if (access) return { status: access.status, body: { error: access.error, code: access.code } };

  const [recent, total] = await Promise.all([
    store.recentEvents(input.attemptId, new Date(now.getTime() - 60_000).toISOString()),
    store.countEvents(input.attemptId),
  ]);
  const decision = eventRateDecision(parsed.data.eventType, recent, total, now);
  if (decision === "rate_limited") {
    return { status: 429, body: { error: "Event rate limit reached", code: "EVENT_RATE_LIMIT" } };
  }
  if (decision === "duplicate") {
    return { status: 200, body: { accepted: true, eventCount: total, reviewRecommended: total > 0 } };
  }
  // Only type + attempt ID go to storage. DB sets recorded_at; client timestamp is discarded.
  await store.insertEvent(input.attemptId, parsed.data.eventType);
  const count = await store.countEvents(input.attemptId);
  return { status: 200, body: { accepted: true, eventCount: count, reviewRecommended: count > 0 } };
}
