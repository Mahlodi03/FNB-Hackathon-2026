import "server-only";
import { serviceSupabase } from "@/lib/supabase/admin";
import type { IntegrityEventType } from "@/contracts/domain";
import type { EventStore } from "./ingest";
import type { AttemptForIntegrity, RecordedEvent } from "./rules";

/** Requires caller to perform student-role and attempt ownership checks before any write. */
export function integrityEventStore(): EventStore {
  const db = serviceSupabase();
  return {
    async getAttempt(attemptId): Promise<AttemptForIntegrity | null> {
      const { data, error } = await db.from("attempts")
        .select("id,student_id,status,expires_at").eq("id", attemptId).maybeSingle();
      if (error) throw new Error("Unable to load attempt");
      return data;
    },
    async recentEvents(attemptId, since): Promise<RecordedEvent[]> {
      const { data, error } = await db.from("integrity_events")
        .select("event_type,recorded_at").eq("attempt_id", attemptId)
        .gte("recorded_at", since).order("recorded_at", { ascending: false }).limit(251);
      if (error) throw new Error("Unable to inspect event rate");
      return (data ?? []) as RecordedEvent[];
    },
    async countEvents(attemptId): Promise<number> {
      const { count, error } = await db.from("integrity_events")
        .select("id", { count: "exact", head: true }).eq("attempt_id", attemptId);
      if (error || count === null) throw new Error("Unable to count events");
      return count;
    },
    async insertEvent(attemptId, eventType: IntegrityEventType): Promise<void> {
      const { error } = await db.from("integrity_events")
        .insert({ attempt_id: attemptId, event_type: eventType });
      if (error) throw new Error("Unable to save integrity event");
    },
  };
}
