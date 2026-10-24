import { requireActor, AccessError } from "@/server/auth/actor";
import { serverSupabase } from "@/lib/supabase/server";
import { assessmentAi } from "@/server/ai";
import { assessmentPolicy } from "@/server/integrity";
import { calculateOverallScore, calculatePass } from "@/contracts/scoring";
import { z } from "zod";

const SubmitRequestSchema = z.object({
  understandingAnswer: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const actor = await requireActor(["student"]);
    const { attemptId } = await params;

    const body = await request.json();
    const parsed = SubmitRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const supabase = await serverSupabase();

    const { data: attempt, error: attemptError } = await supabase
      .from("attempts")
      .select("id, student_id, task_id, status, expires_at, theory_answer, practical_answer, understanding_question")
      .eq("id", attemptId)
      .single();

    if (attemptError || !attempt) {
      return Response.json({ error: "Attempt not found" }, { status: 404 });
    }
    if (attempt.student_id !== actor.userId) {
      return Response.json({ error: "Not your attempt" }, { status: 403 });
    }
    // Idempotency: already submitted/graded? Don't double-grade.
    if (attempt.status === "submitted" || attempt.status === "graded") {
      return Response.json({ error: "Already submitted" }, { status: 409 });
    }
    if (attempt.status !== "awaiting_understanding") {
      return Response.json({ error: "Attempt not ready for submission" }, { status: 409 });
    }
    if (new Date(attempt.expires_at).getTime() < Date.now()) {
      return Response.json({ error: "Attempt has expired" }, { status: 410 });
    }

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", attempt.task_id)
      .single();

    if (taskError || !task) {
      return Response.json({ error: "Task not found" }, { status: 404 });
    }

    const { understandingAnswer } = parsed.data;
    const taskForAi = {
      id: task.id, slug: task.slug, title: task.title, concept: task.concept,
      difficulty: task.difficulty, durationSeconds: task.duration_seconds,
      theoryPrompt: task.theory_prompt, practicalPrompt: task.practical_prompt,
      understandingGuidance: task.understanding_guidance, rubric: task.rubric,
      passMark: task.pass_mark, skills: task.skills, status: task.status,
    };

    // Mark as submitted immediately (prevents double-grading race conditions)
    const { error: lockError } = await supabase
      .from("attempts")
      .update({ status: "submitted", understanding_answer: understandingAnswer })
      .eq("id", attemptId)
      .eq("status", "awaiting_understanding");

    if (lockError) {
      return Response.json({ error: lockError.message }, { status: 500 });
    }

    // Call P3's evaluation
    let evaluation;
    try {
      evaluation = await assessmentAi.evaluate({
        task: taskForAi,
        understandingQuestion: attempt.understanding_question,
        submission: {
          theoryAnswer: attempt.theory_answer,
          practicalAnswer: attempt.practical_answer,
          understandingAnswer,
        },
      });
    } catch {
      return Response.json({ error: "AI grading unavailable, please try again shortly" }, { status: 503 });
    }

    // Call P4's integrity check
    let integrity;
    try {
      integrity = await assessmentPolicy.checkSnapshot({ attemptId, taskRubric: task.rubric });
    } catch {
      return Response.json({ error: "Integrity check unavailable, please try again shortly" }, { status: 503 });
    }

    // Server calculates the real score, never trusts AI's own verdict
    const overallScore = calculateOverallScore(evaluation.scores, task.rubric);
    const passed = calculatePass(evaluation.scores, task.rubric, task.pass_mark);

    // Only publish if passed AND no disqualifying integrity issue AND no review needed
    const eligibleToPublish = passed && !integrity.disqualifyingTechnicalFailure && !integrity.reviewRecommended;

    const { error: finalError } = await supabase
      .from("attempts")
      .update({
        status: "graded",
        overall_score: overallScore,
        passed,
        feedback: evaluation.feedback,
        strengths: evaluation.strengths,
        improvements: evaluation.improvements,
        published: eligibleToPublish,
      })
      .eq("id", attemptId);

    if (finalError) {
      return Response.json({ error: finalError.message }, { status: 500 });
    }

    return Response.json({
      overallScore,
      passed,
      feedback: evaluation.feedback,
      strengths: evaluation.strengths,
      improvements: evaluation.improvements,
      published: eligibleToPublish,
      reviewRecommended: integrity.reviewRecommended,
    });

  } catch (err) {
    if (err instanceof AccessError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}