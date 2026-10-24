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
    if (attempt.status === "graded") {
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

    // Call P3's evaluation FIRST, before touching the database.
    // If this fails, the attempt stays "awaiting_understanding" and can be retried.
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

    let integrity;
    try {
      integrity = await assessmentPolicy.checkSnapshot({ attemptId, taskRubric: task.rubric });
    } catch {
      return Response.json({ error: "Integrity check unavailable, please try again shortly" }, { status: 503 });
    }

    const overallScore = calculateOverallScore(evaluation.scores, task.rubric);
    const passed = calculatePass(evaluation.scores, task.rubric, task.pass_mark);
    const eligibleToPublish = passed && !integrity.disqualifyingTechnicalFailure && !integrity.reviewRecommended;

    // Single atomic update: this is both the result AND the lock.
    // The .eq("status", "awaiting_understanding") means a concurrent duplicate
    // request finds 0 matching rows and fails, no separate "submitted" lock needed.
    const { data: updatedAttempt, error: finalError } = await supabase
      .from("attempts")
      .update({
        status: "graded",
        understanding_answer: understandingAnswer,
        overall_score: overallScore,
        passed,
        feedback: evaluation.feedback,
        strengths: evaluation.strengths,
        improvements: evaluation.improvements,
        published: eligibleToPublish,
      })
      .eq("id", attemptId)
      .eq("status", "awaiting_understanding")
      .select()
      .single();

    if (finalError || !updatedAttempt) {
      return Response.json({ error: "Could not save result, it may have already been submitted" }, { status: 409 });
    }

    // Write to the public results table, only if eligible to publish.
    if (eligibleToPublish) {
      const { error: resultsError } = await supabase
        .from("results")
        .insert({
          attempt_id: attemptId,
          task_id: task.id,
          student_id: actor.userId,
          task_title: task.title,
          concept: task.concept,
          skills: task.skills,
          overall_score: overallScore,
          passed: true,
          visibility: "published",
          grader: "ai_assisted",
        });

      // Don't fail the whole submission if this secondary write fails,
      // the attempt is already correctly graded either way. Just log it.
      if (resultsError) {
        console.error("Failed to write to results table:", resultsError.message);
      }
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