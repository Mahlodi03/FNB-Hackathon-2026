import { DEMO_MODE } from "@/lib/flags";
import { demoTasks } from "@/content/demo";
import { serverSupabase } from "@/lib/supabase/server";
import { requireActor, AccessError } from "@/server/auth/actor";
import { TaskCreateSchema } from "@/contracts/domain";
import { serviceSupabase } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const adminView = searchParams.get("admin") === "1";
  if (adminView) {
    try {
      await requireActor(["admin"]);
    } catch (error) {
      if (error instanceof AccessError) {
        return Response.json({ error: error.message }, { status: error.status });
      }
      return Response.json({ error: "Access check failed" }, { status: 500 });
    }
    const { data, error } = await serviceSupabase()
      .from("tasks")
      .select("*")
      .order("title");
    if (error) return Response.json({ error: "Unable to load tasks" }, { status: 500 });
    return Response.json({ tasks: data, source: "database" }, { headers: { "Cache-Control": "private, no-store" } });
  }
  if (DEMO_MODE) {
    return Response.json({ tasks: demoTasks.map(t => ({
      id: t.id, slug: t.slug, title: t.title, concept: t.concept,
      difficulty: t.difficulty, duration_seconds: t.durationSeconds,
      pass_mark: t.passMark, skills: t.skills, status: t.status,
    })), source: "fictional_demo" });
  }

  const supabase = await serverSupabase();
  const concept = searchParams.get("concept");
  const difficulty = searchParams.get("difficulty");

  let query = supabase
    .from("tasks")
    .select("id,slug,title,concept,difficulty,duration_seconds,pass_mark,skills,status")
    .eq("status", "published");

  if (concept) query = query.eq("concept", concept);
  if (difficulty) query = query.eq("difficulty", difficulty);

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ tasks: data, source: "database" });
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(["admin"]);

    const body = await request.json();
    const parsed = TaskCreateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const t = parsed.data;
    const { data, error } = await serviceSupabase()
      .from("tasks")
      .insert({
        slug: t.slug,
        title: t.title,
        concept: t.concept,
        difficulty: t.difficulty,
        duration_seconds: t.durationSeconds,
        theory_prompt: t.theoryPrompt,
        practical_prompt: t.practicalPrompt,
        understanding_guidance: t.understandingGuidance,
        rubric: t.rubric,
        pass_mark: t.passMark,
        skills: t.skills,
        status: t.status,
        created_by: actor.userId,
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ task: data }, { status: 201 });

  } catch (err) {
    if (err instanceof AccessError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}