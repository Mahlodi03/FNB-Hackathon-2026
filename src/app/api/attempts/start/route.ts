
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

    // 5. Calculate the server-owned assessment deadline.
    const startedAt = new Date();
    const expiresAt = new Date(
      startedAt.getTime() + durationSeconds * 1000
    ).toISOString();

    // 6. Create the attempt using the server-only service client.
    //
    // Authentication and student role have already been verified.
    // The task has also been confirmed as published.
    //
    // The service client is needed because the original database
    // migration does not grant direct student INSERT access
    // to the attempts table.
    const adminSupabase = serviceSupabase();

    const { data: attempt, error: insertError } = await adminSupabase
      .from("attempts")
      .insert({
        student_id: actor.userId,
        task_id: task.id,
        status: "in_progress",
        rules_accepted_at: startedAt.toISOString(),
        started_at: startedAt.toISOString(),
        expires_at: expiresAt,
      })
      .select("id, expires_at")
      .single();

    // 7. Handle duplicate attempts and database errors.
    if (insertError) {
      if (insertError.code === "23505") {
        return Response.json(
          {
            error: "You've already attempted this task",
          },
          { status: 409 }
        );
      }

      console.error("Failed to create assessment attempt:", insertError);

      return Response.json(
        { error: "Unable to start assessment. Please try again." },
        { status: 500 }
      );
    }

    if (!attempt) {
      return Response.json(
        { error: "Assessment could not be created" },
        { status: 500 }
      );
    }

    // 8. Return the real database attempt ID and deadline.
    return Response.json({
      attemptId: attempt.id,
      expiresAt: attempt.expires_at,
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
