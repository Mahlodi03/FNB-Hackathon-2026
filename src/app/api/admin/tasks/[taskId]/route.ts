import { requireActor, AccessError } from "@/server/auth/actor";
import { serverSupabase } from "@/lib/supabase/server";
import { TaskSchema } from "@/contracts/domain";


const TaskUpdateSchema = TaskSchema.omit({ id: true }).partial();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    await requireActor(["admin"]);
    const { taskId } = await params;

    const body = await request.json();
    const parsed = TaskUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const t = parsed.data;
    const supabase = await serverSupabase();

    // Build the update object, only including fields that were actually provided
    const updateData: Record<string, unknown> = {};
    if (t.slug !== undefined) updateData.slug = t.slug;
    if (t.title !== undefined) updateData.title = t.title;
    if (t.concept !== undefined) updateData.concept = t.concept;
    if (t.difficulty !== undefined) updateData.difficulty = t.difficulty;
    if (t.durationSeconds !== undefined) updateData.duration_seconds = t.durationSeconds;
    if (t.theoryPrompt !== undefined) updateData.theory_prompt = t.theoryPrompt;
    if (t.practicalPrompt !== undefined) updateData.practical_prompt = t.practicalPrompt;
    if (t.understandingGuidance !== undefined) updateData.understanding_guidance = t.understandingGuidance;
    if (t.rubric !== undefined) updateData.rubric = t.rubric;
    if (t.passMark !== undefined) updateData.pass_mark = t.passMark;
    if (t.skills !== undefined) updateData.skills = t.skills;
    if (t.status !== undefined) updateData.status = t.status;

    if (Object.keys(updateData).length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", taskId)
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ task: data });

  } catch (err) {
    if (err instanceof AccessError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    await requireActor(["admin"]);
    const { taskId } = await params;

    const supabase = await serverSupabase();

    // Soft archive, not a real delete (per handoff doc: "Soft archive rather than delete")
    const { data, error } = await supabase
      .from("tasks")
      .update({ status: "draft" })
      .eq("id", taskId)
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ task: data, message: "Task archived (set to draft)" });

  } catch (err) {
    if (err instanceof AccessError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}