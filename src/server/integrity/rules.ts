import { z } from "zod";
import { IntegrityEventTypeSchema, type IntegrityEventType } from "../../contracts/domain";

export const AttemptIdSchema = z.string().uuid();
export const EventRequestSchema = z.object({
  eventType: IntegrityEventTypeSchema,
  occurredAt: z.string().datetime({ offset: true }),
}).strict();

export type AttemptForIntegrity = {
  id: string;
  student_id: string;
  status: string;
  expires_at: string;
};
export type RecordedEvent = { event_type: IntegrityEventType; recorded_at: string };

export const MAX_EVENTS_PER_MINUTE = 15;
export const MAX_EVENTS_PER_ATTEMPT = 250;
export const SAME_EVENT_COOLDOWN_MS = 5_000;

export function validateAttemptAccess(
  attempt: AttemptForIntegrity | null,
  studentId: string,
  now: Date,
): { status: number; code: string; error: string } | null {
  if (!attempt) return { status: 404, code: "ATTEMPT_NOT_FOUND", error: "Attempt not found" };
  if (attempt.student_id !== studentId) return { status: 403, code: "NOT_ATTEMPT_OWNER", error: "You do not own this attempt" };
  if (!["in_progress", "awaiting_understanding"].includes(attempt.status)) {
    return { status: 409, code: "ATTEMPT_INACTIVE", error: "This attempt no longer accepts events" };
  }
  const expiry = new Date(attempt.expires_at).getTime();
  if (!Number.isFinite(expiry) || expiry <= now.getTime()) {
    return { status: 409, code: "ATTEMPT_EXPIRED", error: "This attempt has expired" };
  }
  return null;
}

export function eventRateDecision(
  eventType: IntegrityEventType,
  recent: RecordedEvent[],
  totalCount: number,
  now: Date,
): "duplicate" | "rate_limited" | "accept" {
  const current = now.getTime();
  if (recent.some((event) => event.event_type === eventType &&
      current - Date.parse(event.recorded_at) >= 0 &&
      current - Date.parse(event.recorded_at) < SAME_EVENT_COOLDOWN_MS)) return "duplicate";
  if (recent.length >= MAX_EVENTS_PER_MINUTE || totalCount >= MAX_EVENTS_PER_ATTEMPT) return "rate_limited";
  return "accept";
}

/** A reported technical interruption is NOT evidence of deliberate misconduct. */
export const TECHNICAL_INTERRUPTION_TYPES: readonly IntegrityEventType[] = ["camera_track_ended", "permission_lost"];
export function summariseEvents(eventTypes: IntegrityEventType[]) {
  return {
    flaggedEventCount: eventTypes.length,
    disqualifyingTechnicalFailure: eventTypes.some((type) => TECHNICAL_INTERRUPTION_TYPES.includes(type)),
    reviewRecommended: eventTypes.length > 0,
  };
}
