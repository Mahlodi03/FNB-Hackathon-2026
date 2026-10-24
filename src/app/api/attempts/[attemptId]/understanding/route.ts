
import { z } from "zod";
import { TaskSchema } from "@/contracts/domain";
import { serverSupabase } from "@/lib/supabase/server";
import { serviceSupabase } from "@/lib/supabase/admin";
import { assessmentAi } from "@/server/ai";
import { AccessError, requireActor } from "@/server/auth/actor";

const AnswerSchema = (maxLength: number) =>
  z
    .string()
    .min(1)
    .max(maxLength)
    .refine((value) => value.trim().length > 0);

const UnderstandingRequestSchema = z.object({
  theoryAnswer: AnswerSchema(15_000),
  practicalAnswer: AnswerSchema(40_000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    // 1. Authenticate the student.
    const actor = await requireActor(["student"]);
    const { attemptId } = await params;

    if (!z.string().uuid().safeParse(attemptId).success) {
      return Response.json(
        { error: "Invalid attempt ID" },
        { status: 400 }
      );
    }

    // 2. Validate the student's submitted answers.
    const body = await request.json().catch(() => null);
    const parsed = UnderstandingRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid theory or practical answer" },
        { status: 400 }
      );
    }

    const { theoryAnswer, practicalAnswer } = parsed.data;

    // Use the authenticated session for ownership-protected reads.
    const supabase = await serverSupabase();

    const readAttempt = () =>
      supabase
        .from("attempts")
        .select("id, student_id, task_id, status, expires_at, theory_answer, practical_answer, understanding_question")
        .eq("id", attemptId)
        .maybeSingle();

    let { data: attempt, error: attemptError } =
      await readAttempt();

    if (attemptError) {
      console.error("Unable to read attempt:", attemptError);

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

    // 3. Verify ownership and the server-owned deadline.
    if (attempt.student_id !== actor.userId) {
      return Response.json(
        { error: "Not your attempt" },
        { status: 403 }
      );
    }

    if (new Date(attempt.expires_at).getTime() <= Date.now()) {
      return Response.json(
        { error: "Attempt has expired" },
        { status: 410 }
      );
    }

    // Return an existing question instead of regenerating it.
    if (
      attempt.status === "awaiting_understanding" &&
      attempt.understanding_question
    ) {
      return Response.json({
        question: attempt.understanding_question,
      });
    }

    if (
      attempt.status !== "in_progress" ||
      attempt.understanding_question
    ) {
      return Response.json(
        { error: "Attempt not ready for this step" },
        { status: 409 }
      );
    }

    // 4. Load the real published task from Supabase.
    const { data: task, error: taskError } = await serviceSupabase()
      .from("tasks")
      .select("id, slug, title, concept, difficulty, duration_seconds, theory_prompt, practical_prompt, understanding_guidance, rubric, pass_mark, skills, status")
      .eq("id", attempt.task_id)
      .eq("status", "published")
      .maybeSingle();

    if (taskError || !task) {
      return Response.json(
        { error: "Published task not found" },
        { status: 404 }
      );
    }

    // Convert database column names to the AI service's Task contract.
    const validatedTask = TaskSchema.safeParse({
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

    if (!validatedTask.success) {
      console.error(
        "Task has invalid assessment configuration:",
        task.id
      );

      return Response.json(
        { error: "Task is incorrectly configured" },
        { status: 500 }
      );
    }

    // 5. Save and lock the student's answers BEFORE calling OpenAI.
    //
    // This privileged client is used only after authentication,
    // ownership verification, and task validation.
    const privileged = serviceSupabase();

    if (
      attempt.theory_answer === null &&
      attempt.practical_answer === null
    ) {
      const { data: locked, error: lockError } = await privileged
        .from("attempts")
        .update({
          theory_answer: theoryAnswer,
          practical_answer: practicalAnswer,
        })
        .eq("id", attemptId)
        .eq("student_id", actor.userId)
        .eq("status", "in_progress")
        .is("theory_answer", null)
        .is("practical_answer", null)
        .gt("expires_at", new Date().toISOString())
        .select("id")
        .maybeSingle();

      if (lockError) {
        console.error(
          "Could not save assessment answers:",
          lockError
        );

        return Response.json(
          { error: "Unable to save answers" },
          { status: 500 }
        );
      }

      if (!locked) {
        // Another request may have locked the answers first.
        const latest = await readAttempt();

        if (latest.error || !latest.data) {
          return Response.json(
            { error: "Unable to reload assessment" },
            { status: 500 }
          );
        }

        attempt = latest.data;
      } else {
        attempt = {
          ...attempt,
          theory_answer: theoryAnswer,
          practical_answer: practicalAnswer,
        };
      }
    }

    // 6. Recheck state after locking, including concurrent requests.
    if (new Date(attempt.expires_at).getTime() <= Date.now()) {
      return Response.json(
        { error: "Attempt has expired" },
        { status: 410 }
      );
    }

    if (
      attempt.status === "awaiting_understanding" &&
      attempt.understanding_question
    ) {
      return Response.json({
        question: attempt.understanding_question,
      });
    }

    if (
      attempt.status !== "in_progress" ||
      attempt.understanding_question
    ) {
      return Response.json(
        { error: "Attempt not ready for this step" },
        { status: 409 }
      );
    }

    // Retried requests must use the originally locked answers.
    if (
      attempt.theory_answer !== theoryAnswer ||
      attempt.practical_answer !== practicalAnswer
    ) {
      return Response.json(
        {
          error:
            "Different answers are already locked for this attempt",
        },
        { status: 409 }
      );
    }

    // 7. Ask Person 3's AI service for one personalized question.
    let generated: { question: string };

    try {
      generated = await assessmentAi.generateUnderstanding({
        task: validatedTask.data,
        theoryAnswer: attempt.theory_answer,
        practicalAnswer: attempt.practical_answer,
      });
    } catch (error) {
      console.error(
        "Understanding question generation failed:",
        error
      );

      // The student's original answers remain safely stored.
      return Response.json(
        {
          error:
            "AI unavailable; your answers have been saved. Please retry shortly.",
        },
        { status: 503 }
      );
    }

    // 8. Save the question and advance the attempt.
    //
    // The conditional update ensures that overlapping requests
    // cannot replace an already saved question.
    const { data: updated, error: updateError } = await privileged
      .from("attempts")
      .update({
        understanding_question: generated.question,
        status: "awaiting_understanding",
      })
      .eq("id", attemptId)
      .eq("student_id", actor.userId)
      .eq("status", "in_progress")
      .is("understanding_question", null)
      .gt("expires_at", new Date().toISOString())
      .select("understanding_question")
      .maybeSingle();

    if (updateError) {
      console.error(
        "Unable to save understanding question:",
        updateError
      );

      return Response.json(
        { error: "Unable to save question; please retry" },
        { status: 500 }
      );
    }

    if (updated) {
      return Response.json({
        question: updated.understanding_question,
      });
    }

    // 9. If another request saved the question, return that one.
    const latest = await readAttempt();

    if (latest.error || !latest.data) {
      return Response.json(
        { error: "Unable to reload assessment" },
        { status: 500 }
      );
    }

    if (
      latest.data.status === "awaiting_understanding" &&
      latest.data.understanding_question
    ) {
      return Response.json({
        question: latest.data.understanding_question,
      });
    }

    if (
      new Date(latest.data.expires_at).getTime() <= Date.now()
    ) {
      return Response.json(
        { error: "Attempt has expired" },
        { status: 410 }
      );
    }

    return Response.json(
      { error: "Attempt changed; please reload" },
      { status: 409 }
    );
  } catch (error) {
    if (error instanceof AccessError) {
      return Response.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Understanding endpoint failed:", error);

    return Response.json(
      { error: "Unable to process assessment" },
      { status: 500 }
    );
  }
}
