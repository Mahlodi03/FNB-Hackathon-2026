
import { z } from "zod";
import { TaskSchema } from "@/contracts/domain";
import { calculateOverallScore, calculatePass } from "@/contracts/scoring";
import { serverSupabase } from "@/lib/supabase/server";
import { serviceSupabase } from "@/lib/supabase/admin";
import { requireActor, AccessError } from "@/server/auth/actor";
import { assessmentAi } from "@/server/ai";
import { assessmentPolicy } from "@/server/integrity";

const SubmitRequestSchema = z.object({
  understandingAnswer: z
    .string()
    .min(1)
    .max(15_000)
    .refine((value) => value.trim().length > 0),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const actor = await requireActor(["student"]);
    const { attemptId } = await params;

    if (!z.string().uuid().safeParse(attemptId).success) {
      return Response.json(
        { error: "Invalid attempt ID" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = SubmitRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid understanding answer" },
        { status: 400 }
      );
    }

    const { understandingAnswer } = parsed.data;

    // Read through the authenticated student's session.
    const supabase = await serverSupabase();

    const { data: attempt, error: attemptError } = await supabase
      .from("attempts")
      .select("id, student_id, task_id, status, expires_at, theory_answer, practical_answer, understanding_question, understanding_answer")
      .eq("id", attemptId)
      .maybeSingle();

    if (attemptError) {
      console.error("Submission attempt lookup failed:", attemptError);
      return Response.json(
        { error: "Unable to load assessment" },
        { status: 500 }
      );
    }

    if (!attempt) {
      return Response.json(
        { error: "Attempt not found" },
        { status: 404 }
      );
    }

    if (attempt.student_id !== actor.userId) {
      return Response.json(
        { error: "Not your assessment" },
        { status: 403 }
      );
    }

    const db = serviceSupabase();

    // Retrieve an already saved result, if one exists.
    // The results table has a UNIQUE constraint on attempt_id.
    const savedResultResponse = async (): Promise<Response | null> => {
      const { data: saved, error: readError } = await db
        .from("results")
        .select("overall_score, passed, feedback, strengths, improvements, visibility")
        .eq("attempt_id", attemptId)
        .maybeSingle();

      if (readError) {
        console.error("Result lookup failed:", readError);
        return Response.json(
          { error: "Unable to retrieve saved grade" },
          { status: 500 }
        );
      }

      if (!saved) return null;

      // Complete a previously interrupted transition.
      const { data: completed, error: completionError } = await db
        .from("attempts")
        .update({ status: "graded" })
        .eq("id", attemptId)
        .eq("student_id", actor.userId)
        .eq("status", "submitted")
        .select("id")
        .maybeSingle();

      if (completionError) {
        console.error("Unable to finalize attempt:", completionError);
        return Response.json(
          { error: "Grade saved; finalization pending. Please retry." },
          { status: 503 }
        );
      }

      if (!completed) {
        const { data: latest, error: latestError } = await db
          .from("attempts")
          .select("status")
          .eq("id", attemptId)
          .eq("student_id", actor.userId)
          .maybeSingle();

        if (latestError || latest?.status !== "graded") {
          return Response.json(
            { error: "Attempt changed during grading" },
            { status: 409 }
          );
        }
      }

      return Response.json({
        overallScore: saved.overall_score,
        passed: saved.passed,
        feedback: saved.feedback,
        strengths: saved.strengths,
        improvements: saved.improvements,
        published: saved.visibility === "published",
        reviewRecommended: saved.visibility === "withheld",
      });
    };

    // Return the saved grade without calling OpenAI again.
    if (attempt.status === "graded") {
      const existing = await savedResultResponse();

      return existing ?? Response.json(
        { error: "Grade not available; contact support" },
        { status: 503 }
      );
    }

    if (
      attempt.status !== "awaiting_understanding" &&
      attempt.status !== "submitted"
    ) {
      return Response.json(
        { error: "Attempt not ready for submission" },
        { status: 409 }
      );
    }

    if (
      !attempt.theory_answer ||
      !attempt.practical_answer ||
      !attempt.understanding_question
    ) {
      return Response.json(
        { error: "Assessment answers are incomplete" },
        { status: 409 }
      );
    }

    // A submitted attempt may be retried, but its answer is immutable.
    if (attempt.status === "submitted") {
      if (attempt.understanding_answer !== understandingAnswer) {
        return Response.json(
          { error: "A different answer was already submitted" },
          { status: 409 }
        );
      }

      const existing = await savedResultResponse();
      if (existing) return existing;
    } else {
      // The original submission must happen before the deadline.
      if (
        !Number.isFinite(Date.parse(attempt.expires_at)) ||
        Date.parse(attempt.expires_at) <= Date.now()
      ) {
        return Response.json(
          { error: "Assessment has expired" },
          { status: 410 }
        );
      }

      // Save and lock the understanding answer before grading.
      const { data: locked, error: lockError } = await db
        .from("attempts")
        .update({
          understanding_answer: understandingAnswer,
          status: "submitted",
          submitted_at: new Date().toISOString(),
        })
        .eq("id", attemptId)
        .eq("student_id", actor.userId)
        .eq("status", "awaiting_understanding")
        .is("understanding_answer", null)
        .gt("expires_at", new Date().toISOString())
        .select("id")
        .maybeSingle();

      if (lockError) {
        console.error("Submission lock failed:", lockError);
        return Response.json(
          { error: "Unable to save submission" },
          { status: 500 }
        );
      }

      if (!locked) {
        // Handle a competing request safely.
        const { data: latest, error: latestError } = await db
          .from("attempts")
          .select("status, understanding_answer")
          .eq("id", attemptId)
          .eq("student_id", actor.userId)
          .maybeSingle();

        if (
          latestError ||
          !latest ||
          !["submitted", "graded"].includes(latest.status) ||
          latest.understanding_answer !== understandingAnswer
        ) {
          return Response.json(
            { error: "Submission state changed; please reload" },
            { status: 409 }
          );
        }

        const existing = await savedResultResponse();
        if (existing) return existing;
      }
    }

    // Ownership has been checked; this server-only client
    // can read the task even if its publication status changes.
    const { data: task, error: taskError } = await db
      .from("tasks")
      .select("id, slug, title, concept, difficulty, duration_seconds, theory_prompt, practical_prompt, understanding_guidance, rubric, pass_mark, skills, status")
      .eq("id", attempt.task_id)
      .maybeSingle();

    if (taskError || !task) {
      return Response.json(
        { error: "Assessment task unavailable" },
        { status: 500 }
      );
    }

    const taskParsed = TaskSchema.safeParse({
      id: task.id,
      slug: task.slug,
      title: task.title,
      concept: task.concept,
      difficulty: task.difficulty,
      durationSeconds: task.duration_seconds,
      theoryPrompt: task.theory_prompt,
      practicalPrompt: task.practical_prompt,
      understandingGuidance: task.understanding_guidance,
      rubric: task.rubric,
      passMark: task.pass_mark,
      skills: task.skills,
      status: task.status,
    });

    if (!taskParsed.success) {
      console.error("Invalid task configuration:", taskParsed.error);
      return Response.json(
        { error: "Assessment configuration is invalid" },
        { status: 500 }
      );
    }

    const taskForAi = taskParsed.data;

    // Generate section scores and feedback.
    // A failure leaves the submission saved for a safe retry.
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
    } catch (error) {
      console.error("AI grading failed:", error);

      return Response.json(
        {
          error:
            "Your submission is saved, but AI grading is temporarily unavailable. Please retry.",
        },
        { status: 503 }
      );
    }

    // Retrieve integrity signals without treating individual
    // browser events as proof of misconduct.
    let integrity;

    try {
      integrity = await assessmentPolicy.checkSnapshot({
        attemptId,
        taskRubric: taskForAi.rubric,
      });
    } catch (error) {
      console.error("Integrity review failed:", error);

      return Response.json(
        {
          error:
            "Your submission is saved, but integrity review is temporarily unavailable. Please retry.",
        },
        { status: 503 }
      );
    }

    // Calculate the actual outcome on the server.
    const overallScore = calculateOverallScore(
      evaluation.scores,
      taskForAi.rubric
    );

    const passed = calculatePass(
      evaluation.scores,
      taskForAi.rubric,
      taskForAi.passMark
    );

    const reviewRecommended =
      integrity.reviewRecommended ||
      integrity.disqualifyingTechnicalFailure;

    const visibility = reviewRecommended
      ? "withheld"
      : passed
        ? "published"
        : "provisional";

    // Store scores in RESULTS, never in ATTEMPTS.
    const { error: resultError } = await db
      .from("results")
      .insert({
        attempt_id: attemptId,
        theory_score: evaluation.scores.theory,
        practical_score: evaluation.scores.practical,
        understanding_score: evaluation.scores.understanding,
        overall_score: overallScore,
        passed,
        feedback: evaluation.feedback,
        strengths: evaluation.strengths,
        improvements: evaluation.improvements,
        grading_source: "ai_assisted",
        visibility,
      });

    if (resultError && resultError.code !== "23505") {
      console.error("Result persistence failed:", resultError);

      return Response.json(
        {
          error:
            "Your submission is saved, but the grade could not be stored. Please retry.",
        },
        { status: 503 }
      );
    }

    // A concurrent request may have inserted the result first.
    // Read the stored winner instead of overwriting it.
    const saved = await savedResultResponse();

    if (saved) return saved;

    return Response.json(
      { error: "Unable to retrieve completed result" },
      { status: 503 }
    );
  } catch (error) {
    if (error instanceof AccessError) {
      return Response.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Assessment submission failed:", error);

    return Response.json(
      { error: "Unable to process submission" },
      { status: 500 }
    );
  }
}
