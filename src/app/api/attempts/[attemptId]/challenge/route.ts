import { z } from "zod";
import { AccessError, requireActor } from "@/server/auth/actor";
import { serverSupabase } from "@/lib/supabase/server";
import { serviceSupabase } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store, max-age=0" };

// Questions are delivered only for the caller's already-started, unexpired attempt.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const actor = await requireActor(["student"]);
    const { attemptId } = await params;
    if (!z.string().uuid().safeParse(attemptId).success) {
      return Response.json({ error: "Invalid attempt ID" }, { status: 400, headers });
    }

    const supabase = await serverSupabase();
    const { data: attempt, error: attemptError } = await supabase
      .from("attempts")
      .select("task_id, status, expires_at")
      .eq("id", attemptId)
      .eq("student_id", actor.userId)
      .maybeSingle();

    if (attemptError) {
      console.error("Unable to authorize challenge read:", attemptError);
      return Response.json({ error: "Unable to load challenge" }, { status: 500, headers });
    }
    if (!attempt) return Response.json({ error: "Attempt not found" }, { status: 404, headers });
    if (!Number.isFinite(Date.parse(attempt.expires_at)) || Date.parse(attempt.expires_at) <= Date.now()) {
      return Response.json({ error: "Assessment deadline has passed" }, { status: 410, headers });
    }
    if (attempt.status !== "in_progress" && attempt.status !== "awaiting_understanding") {
      return Response.json({ error: "This attempt is no longer active" }, { status: 409, headers });
    }

    // Service role never reaches the browser. Only the two prompts are projected;
    // grading guidance and rubric are not returned, even after starting.
    const { data: task, error: taskError } = await serviceSupabase()
      .from("tasks")
      .select("theory_prompt, practical_prompt")
      .eq("id", attempt.task_id)
      .single();
    if (taskError || !task) {
      console.error("Unable to load started challenge:", taskError);
      return Response.json({ error: "Challenge unavailable" }, { status: 500, headers });
    }
    return Response.json({
      theoryPrompt: task.theory_prompt,
      practicalPrompt: task.practical_prompt,
      expiresAt: attempt.expires_at,
    }, { headers });
  } catch (error) {
    if (error instanceof AccessError) {
      return Response.json({ error: error.message }, { status: error.status, headers });
    }
    console.error("Challenge reveal failed:", error);
    return Response.json({ error: "Unable to load challenge" }, { status: 500, headers });
  }
}
