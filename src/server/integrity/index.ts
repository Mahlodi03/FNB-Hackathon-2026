import "server-only";
import type { AssessmentPolicy } from "@/contracts/services";
import { RubricSchema, IntegrityEventTypeSchema } from "@/contracts/domain";
import { serviceSupabase } from "@/lib/supabase/admin";
import { AttemptIdSchema, summariseEvents } from "./rules";

/** P2 calls this on the server during submission. It never modifies an attempt or score. */
export const assessmentPolicy: AssessmentPolicy = {
  async checkSnapshot({ attemptId, taskRubric }) {
    AttemptIdSchema.parse(attemptId);
    RubricSchema.parse(taskRubric); // interface input preserved; v1 rubric has no integrity thresholds.
    const db = serviceSupabase();
    const { data: attempt, error: attemptError } = await db.from("attempts")
      .select("id").eq("id", attemptId).maybeSingle();
    if (attemptError || !attempt) throw new Error("Attempt unavailable for integrity review");
    const { data, error } = await db.from("integrity_events")
      .select("event_type").eq("attempt_id", attemptId);
    if (error) throw new Error("Unable to read integrity events");
    const types = (data ?? []).map((row) => IntegrityEventTypeSchema.parse(row.event_type));
    return summariseEvents(types);
  },
};
