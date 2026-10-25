
import { requireActor, AccessError } from "@/server/auth/actor";
import { serverSupabase } from "@/lib/supabase/server";
import { serviceSupabase } from "@/lib/supabase/admin";
import { z } from "zod";

const StartAttemptSchema = z.object({
  taskId: z.string().uuid(),
  rulesAccepted: z.literal(true),
});

export async function POST(request: Request) {
  try {
    // 1. Only authenticated students can start assessments.
    const actor = await requireActor(["student"]);

    // 2. Validate the request and explicit rules acceptance.
    const body = await request.json().catch(() => null);
    const parsed = StartAttemptSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request or assessment rules not accepted" },
        { status: 400 }
      );
    }

    const { taskId } = parsed.data;

    // 3. Read the task using the authenticated student's session.
    const supabase = await serverSupabase();

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, duration_seconds, status")
      .eq("id", taskId)
      .eq("status", "published")
      .single();

    if (taskError || !task) {
      return Response.json(
        { error: "Task not found or not available" },
        { status: 404 }
      );
    }

    // 4. Validate the task duration.
    const durationSeconds = task.duration_seconds;

    if (
      !Number.isInteger(durationSeconds) ||
      durationSeconds < 300 ||
      durationSeconds > 14400
    ) {
      return Response.json(
        { error: "Invalid task duration" },
        { status: 500 }
      );
    }

    // 5. Both the Free allowance AND attempt creation happen inside one
    // database transaction. The RPC locks the student's profile row, preventing
    // concurrent requests for different challenges from exceeding ten starts.
    // Existing attempts are examined first: recovery never consumes a credit.
    const { data, error: startError } = await serviceSupabase().rpc(
      "start_student_attempt",
      { p_student_id: actor.userId, p_task_id: taskId }
    );
    if (startError) {
      console.error("Atomic assessment start failed:", startError);
      return Response.json(
        { error: "Unable to start assessment. Please retry or contact the assessor." },
        { status: 503 }
      );
    }
    const outcome = z.discriminatedUnion("status", [
      z.object({ status: z.literal("created"), attemptId: z.string().uuid(), expiresAt: z.string() }),
      z.object({ status: z.literal("resumed"), attemptId: z.string().uuid(), expiresAt: z.string() }),
      z.object({ status: z.literal("already_attempted") }),
      z.object({ status: z.literal("limit_reached") }),
      z.object({ status: z.literal("not_available") }),
    ]).safeParse(data);
    if (!outcome.success) {
      console.error("Unexpected atomic assessment start response");
      return Response.json({ error: "Assessment start could not be confirmed. Reload to check recovery." }, { status: 503 });
    }
    if (outcome.data.status === "limit_reached") {
      return Response.json({
        error: "Free challenge limit reached (10 lifetime starts). Existing assessments and results remain accessible. See Plans for demo Premium access.",
        code: "FREE_CHALLENGE_LIMIT_REACHED",
      }, { status: 403 });
    }
    if (outcome.data.status === "already_attempted") {
      return Response.json({ error: "This task has already been attempted. View your progress instead." }, { status: 409 });
    }
    if (outcome.data.status === "not_available") {
      return Response.json({ error: "Task not found or not available" }, { status: 404 });
    }
    return Response.json({
      attemptId: outcome.data.attemptId,
      expiresAt: outcome.data.expiresAt,
      resumed: outcome.data.status === "resumed",
    });
  } catch (err) {
    if (err instanceof AccessError) {
      return Response.json(
        { error: err.message },
        { status: err.status }
      );
    }

    console.error("Assessment start failed:", err);

    return Response.json(
      { error: "Something went wrong while starting the assessment" },
      { status: 500 }
    );
  }
}
