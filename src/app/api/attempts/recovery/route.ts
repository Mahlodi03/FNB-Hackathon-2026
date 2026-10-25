import { z } from "zod";
import { AccessError, requireActor } from "@/server/auth/actor";
import { serverSupabase } from "@/lib/supabase/server";
import { deadlinePassed } from "@/features/assessments/recovery-rules";

const headers = { "Cache-Control": "private, no-store, max-age=0" };

/** Returns only the signed-in student's existing attempt; never creates another. */
export async function GET(request: Request) {
  try {
    const actor = await requireActor(["student"]);
    const url = new URL(request.url);
    const taskId = z.string().uuid().safeParse(url.searchParams.get("taskId"));
    if (!taskId.success) {
      return Response.json({ error: "Invalid task ID" }, { status: 400, headers });
    }

    const db = await serverSupabase();
    const { data: attempt, error } = await db.from("attempts")
      .select("id, student_id, task_id, status, expires_at, theory_draft, practical_draft, understanding_draft, theory_answer, practical_answer, understanding_question, understanding_answer")
      .eq("student_id", actor.userId)
      .eq("task_id", taskId.data)
      .maybeSingle();
    if (error) {
      console.error("Assessment recovery lookup failed:", error);
      return Response.json({ error: "Unable to check your existing attempt" }, { status: 500, headers });
    }
    if (!attempt) return Response.json({ attempt: null }, { headers });

    const expired = deadlinePassed(attempt.expires_at);
    const meta = {
      attemptId: attempt.id,
      status: attempt.status,
      expiresAt: attempt.expires_at,
      expired,
    };

    // Never release editable drafts, questions, or answers after an unfinished attempt expires.
    if ((attempt.status === "in_progress" || attempt.status === "awaiting_understanding") && expired) {
      return Response.json({ attempt: meta }, { headers });
    }

    if (attempt.status === "graded") {
      const { data: result, error: resultError } = await db.from("results")
        .select("overall_score, passed, feedback, strengths, improvements, visibility")
        .eq("attempt_id", attempt.id).maybeSingle();
      if (resultError) {
        console.error("Recovery grade lookup failed:", resultError);
        return Response.json({ error: "Unable to recover your grade" }, { status: 500, headers });
      }
      return Response.json({ attempt: meta, result: result ? {
        overallScore: Number(result.overall_score),
        passed: result.passed,
        feedback: result.feedback,
        strengths: result.strengths,
        improvements: result.improvements,
        published: result.visibility === "published",
        reviewRecommended: result.visibility === "withheld",
      } : null }, { headers });
    }
    if (attempt.status === "invalidated") {
      return Response.json({ attempt: meta }, { headers });
    }
    return Response.json({
      attempt: meta,
      // Do not return the sealed theory/practical prompts: preflight + an active
      // attempt still gate their retrieval through the challenge endpoint.
      theoryAnswer: attempt.theory_answer ?? attempt.theory_draft ?? "",
      practicalAnswer: attempt.practical_answer ?? attempt.practical_draft ?? "",
      understandingQuestion: attempt.understanding_question,
      understandingAnswer: attempt.understanding_answer ?? attempt.understanding_draft ?? "",
      answersLocked: attempt.theory_answer !== null || attempt.practical_answer !== null,
    }, { headers });
  } catch (error) {
    if (error instanceof AccessError) return Response.json({ error: error.message }, { status: error.status, headers });
    console.error("Assessment recovery failed:", error);
    return Response.json({ error: "Unable to check your existing attempt" }, { status: 500, headers });
  }
}
