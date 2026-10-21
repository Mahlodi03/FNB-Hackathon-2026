import { requireActor, AccessError } from "@/server/auth/actor";
import { serverSupabase } from "@/lib/supabase/server";
import { assessmentAi } from "@/server/ai";
import { z } from "zod";

const UnderstandingRequestSchema = z.object({
  theoryAnswer: z.string().min(1),
  practicalAnswer: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const actor = await requireActor(["student"]);
    const { attemptId } = await params;

    const body = await request.json();
    const parsed = UnderstandingRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const supabase = await serverSupabase();

    // Fetch the attempt and confirm ownership + status + expiry
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
    if (new Date(attempt.expires_at).getTime() < Date.now()) {
      return Response.json({ error: "Attempt has expired" }, { status: 410 });
    }

    // Idempotency: if a question already exists, just return it again (don't regenerate)
    if (attempt.status === "awaiting_understanding" && attempt.understanding_question) {
      return Response.json({ question: attempt.understanding_question });
    }
    if (attempt.status !== "in_progress") {
      return Response.json({ error: "Attempt not in a startable state" }, { status: 409 });
    }

    // Get the task for context
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", attempt.task_id)
      .single();

    if (taskError || !task) {
      return Response.json({ error: "Task not found" }, { status: 404 });
    }

    // Lock the answers + call AI, atomically-ish (lock first, then call AI)
    const { theoryAnswer, practicalAnswer } = parsed.data;

    let aiResult;
    try {
      aiResult = await assessmentAi.generateUnderstanding({
        task: {
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
        },
        theoryAnswer,
        practicalAnswer,
      });
    } catch {
      return Response.json({ error: "AI service unavailable, please try again shortly" }, { status: 503 });
    }

    const { error: updateError } = await supabase
      .from("attempts")
      .update({
        theory_answer: theoryAnswer,
        practical_answer: practicalAnswer,
        understanding_question: aiResult.question,
        status: "awaiting_understanding",
      })
      .eq("id", attemptId)
      .eq("status", "in_progress"); // only update if still in_progress, prevents double-locking

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500 });
    }

    return Response.json({ question: aiResult.question });

  } catch (err) {
    if (err instanceof AccessError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}