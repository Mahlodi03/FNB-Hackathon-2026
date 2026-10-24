import { z } from "zod";
import { AccessError, requireActor } from "@/server/auth/actor";
import { serverSupabase } from "@/lib/supabase/server";
import { serviceSupabase } from "@/lib/supabase/admin";
import { deadlinePassed, canSaveDraft } from "@/features/assessments/recovery-rules";

const DraftSchema = z.discriminatedUnion("stage", [
  z.object({ stage: z.literal("initial"), theoryDraft: z.string().max(15_000), practicalDraft: z.string().max(40_000) }).strict(),
  z.object({ stage: z.literal("understanding"), understandingDraft: z.string().max(15_000) }).strict(),
]);
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function PATCH(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  try {
    const actor = await requireActor(["student"]);
    const { attemptId } = await params;
    if (!z.string().uuid().safeParse(attemptId).success) {
      return Response.json({ error: "Invalid attempt ID" }, { status: 400, headers });
    }
    const body = await request.json().catch(() => null);
    const input = DraftSchema.safeParse(body);
    if (!input.success) return Response.json({ error: "Invalid draft" }, { status: 400, headers });

    // Do not treat an elevated client as an authorization check.
    const db = await serverSupabase();
    const { data: attempt, error: readError } = await db.from("attempts")
      .select("id, student_id, status, expires_at, theory_answer, practical_answer")
      .eq("id", attemptId).eq("student_id", actor.userId).maybeSingle();
    if (readError) {
      console.error("Draft authorization read failed:", readError);
      return Response.json({ error: "Unable to save draft" }, { status: 500, headers });
    }
    if (!attempt) return Response.json({ error: "Attempt not found" }, { status: 404, headers });
    if (deadlinePassed(attempt.expires_at)) {
      return Response.json({ error: "Assessment deadline has passed" }, { status: 410, headers });
    }

    const privileged = serviceSupabase();
    const now = new Date().toISOString();
    const query = privileged.from("attempts");
    let save;
    if (input.data.stage === "initial") {
      if (!canSaveDraft("initial", attempt.status, attempt.expires_at,
        attempt.theory_answer !== null || attempt.practical_answer !== null)) {
        return Response.json({ error: "Initial answers are already locked" }, { status: 409, headers });
      }
      save = await query.update({
        theory_draft: input.data.theoryDraft,
        practical_draft: input.data.practicalDraft,
        draft_updated_at: now,
      }).eq("id", attemptId).eq("student_id", actor.userId).eq("status", "in_progress")
        .is("theory_answer", null).is("practical_answer", null)
        .gt("expires_at", now).select("id, draft_updated_at").maybeSingle();
    } else {
      if (!canSaveDraft("understanding", attempt.status, attempt.expires_at, true)) {
        return Response.json({ error: "Understanding answer cannot be edited" }, { status: 409, headers });
      }
      save = await query.update({
        understanding_draft: input.data.understandingDraft,
        draft_updated_at: now,
      }).eq("id", attemptId).eq("student_id", actor.userId).eq("status", "awaiting_understanding")
        .is("understanding_answer", null)
        .gt("expires_at", now).select("id, draft_updated_at").maybeSingle();
    }
    if (save.error) {
      console.error("Draft persistence failed:", save.error);
      return Response.json({ error: "Unable to save draft" }, { status: 500, headers });
    }
    if (!save.data) return Response.json({ error: "Attempt changed or expired; draft not saved" }, { status: 409, headers });
    return Response.json({ saved: true, savedAt: save.data.draft_updated_at }, { headers });
  } catch (error) {
    if (error instanceof AccessError) return Response.json({ error: error.message }, { status: error.status, headers });
    console.error("Draft endpoint failed:", error);
    return Response.json({ error: "Unable to save draft" }, { status: 500, headers });
  }
}
