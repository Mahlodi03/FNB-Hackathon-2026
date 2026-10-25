import { z } from "zod";
import { AccessError, requireActor } from "@/server/auth/actor";
import { serviceSupabase } from "@/lib/supabase/admin";
import { IntegrityEventTypeSchema } from "@/contracts/domain";
import { classifyIntegritySnapshot, SHADOW_TRIAGE_POLICY } from "@/server/integrity/triage/rules";
import type { TriageInput, TriageBand } from "@/server/integrity/triage/rules";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  attemptId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
}).strict();

const noStore = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };
function reply(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: noStore });
}

type AttemptRow = {
  id: string;
  status: string;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
};
type ResultRow = { attempt_id: string; visibility: string; grading_source: string };
type ReviewRow = { attempt_id: string; decision: "cleared" | "needs_investigation" | "withheld" };

/**
 * Read-only, admin-only shadow triage preview of real attempts. No inserts, updates,
 * RPC writes, AI calls, result-visibility changes or student-facing exposure.
 * Pages are bounded to avoid reading unbounded private warning histories.
 */
export async function GET(request: Request) {
  try {
    await requireActor(["admin"]);
    const url = new URL(request.url);
    const supplied = Object.fromEntries(url.searchParams.entries());
    const parsed = QuerySchema.safeParse(supplied);
    if (!parsed.success) return reply({ error: "Invalid triage query" }, 400);

    const { attemptId, limit, offset } = parsed.data;
    const db = serviceSupabase();
    let attempts: AttemptRow[];

    if (attemptId) {
      const { data, error } = await db.from("attempts")
        .select("id,status,started_at,expires_at,submitted_at")
        .eq("id", attemptId).maybeSingle();
      if (error) throw new Error("Unable to load attempt for shadow triage");
      if (!data) return reply({ error: "Attempt not found" }, 404);
      attempts = [data as AttemptRow];
    } else {
      // This preview samples graded attempts; expired unsubmitted attempts are
      // deliberately NOT routed into integrity decisions or grading.
      const { data, error } = await db.from("attempts")
        .select("id,status,started_at,expires_at,submitted_at")
        .eq("status", "graded")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw new Error("Unable to list attempts for shadow triage");
      attempts = (data ?? []) as AttemptRow[];
    }

    if (!attempts.length) return reply({
      policyVersion: SHADOW_TRIAGE_POLICY, observationOnly: true,
      pagination: { limit, offset, returned: 0 }, counts: {}, attempts: [],
    });

    const ids = attempts.map((attempt) => attempt.id);
    const [resultsResponse, reviewsResponse] = await Promise.all([
      db.from("results").select("attempt_id,visibility,grading_source").in("attempt_id", ids),
      db.from("integrity_review_state").select("attempt_id,decision").in("attempt_id", ids),
    ]);
    if (resultsResponse.error || reviewsResponse.error) {
      throw new Error("Unable to load private grading/review state");
    }
    const results = new Map(((resultsResponse.data ?? []) as ResultRow[]).map((r) => [r.attempt_id, r]));
    const reviews = new Map(((reviewsResponse.data ?? []) as ReviewRow[]).map((r) => [r.attempt_id, r]));

    const summaries = [];
    // Limit DB concurrency so this exploratory endpoint remains manageable.
    for (let i = 0; i < attempts.length; i += 5) {
      const batch = attempts.slice(i, i + 5);
      const evaluated = await Promise.all(batch.map(async (attempt) => {
        const { data, error } = await db.from("integrity_events")
          .select("event_type,recorded_at").eq("attempt_id", attempt.id)
          .order("recorded_at", { ascending: false }).limit(251);
        if (error) throw new Error("Unable to read private integrity event history");
        const events: TriageInput["events"][number][] = [];
        for (const row of data ?? []) {
          const type = IntegrityEventTypeSchema.safeParse(row.event_type);
          if (!type.success) throw new Error("Unexpected stored integrity signal type");
          events.push({ eventType: type.data, recordedAt: row.recorded_at });
        }
        const result = results.get(attempt.id);
        const review = reviews.get(attempt.id);
        const snapshot = classifyIntegritySnapshot({
          attempt: {
            status: attempt.status,
            startedAt: attempt.started_at,
            expiresAt: attempt.expires_at,
            submittedAt: attempt.submitted_at,
          },
          result: result ? { visibility: result.visibility, gradingSource: result.grading_source } : null,
          existingHumanDecision: review?.decision ?? null,
          events,
          eventsTruncated: events.length > 250,
        });
        return {
          attemptId: attempt.id,
          storedStatus: attempt.status,
          currentVisibility: result?.visibility ?? null,
          existingHumanDecision: review?.decision ?? null,
          ...snapshot,
        };
      }));
      summaries.push(...evaluated);
    }

    const counts: Partial<Record<TriageBand, number>> = {};
    for (const summary of summaries) counts[summary.band] = (counts[summary.band] ?? 0) + 1;
    return reply({
      policyVersion: SHADOW_TRIAGE_POLICY,
      observationOnly: true,
      explanation: "Diagnostic shadow classifications only. No result, review or score was changed. Warning events alone do not establish misconduct; monitoring coverage cannot yet be verified.",
      pagination: { limit, offset, returned: summaries.length },
      counts, attempts: summaries,
    });
  } catch (error) {
    if (error instanceof AccessError) return reply({ error: error.message }, error.status);
    console.error("Private shadow integrity triage preview failed", error);
    return reply({ error: "Shadow integrity preview unavailable" }, 503);
  }
}
