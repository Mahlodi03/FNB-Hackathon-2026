import { requireActor, AccessError } from "@/server/auth/actor";
import { serverSupabase } from "@/lib/supabase/server";
import { z } from "zod";

const StartAttemptSchema = z.object({
  taskId: z.string().uuid(),
  rulesAccepted: z.literal(true),
});

export async function POST(request: Request) {
  try {
    const actor = await requireActor(["student"]);

    const body = await request.json();
    const parsed = StartAttemptSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
    const { taskId } = parsed.data;

    const supabase = await serverSupabase();

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("duration_seconds, status")
      .eq("id", taskId)
      .single();

    if (taskError || !task || task.status !== "published") {
      return Response.json({ error: "Task not found" }, { status: 404 });
    }

    const expiresAt = new Date(Date.now() + task.duration_seconds * 1000).toISOString();

    const { data: attempt, error: insertError } = await supabase
      .from("attempts")
      .insert({
        student_id: actor.userId,
        task_id: taskId,
        status: "in_progress",
        expires_at: expiresAt,
      })
      .select("id, expires_at")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return Response.json({ error: "You've already attempted this task" }, { status: 409 });
      }
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    return Response.json({ attemptId: attempt.id, expiresAt: attempt.expires_at });

  } catch (err) {
    if (err instanceof AccessError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}