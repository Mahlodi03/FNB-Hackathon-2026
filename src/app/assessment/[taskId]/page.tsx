import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AssessmentPreview } from "@/features/assessments/AssessmentPreview";
import { serverSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  if (!z.string().uuid().safeParse(taskId).success) notFound();

  const supabase = await serverSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect(`/login?next=${encodeURIComponent(`/assessment/${taskId}`)}`);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw new Error("Unable to verify account permissions");
  if (profile?.role !== "student") redirect("/tasks");

  // This server-rendered page MUST NOT load the prompts or rubric.
  // These would be embedded in Next.js page data even if visually hidden.
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, title, concept, difficulty, duration_seconds")
    .eq("id", taskId)
    .eq("status", "published")
    .maybeSingle();

  if (taskError) throw new Error("Unable to load challenge");
  if (!task) notFound();

  return (
    <section>
      <div className="rw-assessment-heading">
        <div>
          <div className="eyebrow">Challenge · {task.concept} · {task.difficulty}</div>
          <h1 className="h2">{task.title}</h1>
          <p className="muted" style={{ fontSize: 13 }}>
            Your questions remain sealed until you accept the rules, pass preflight
            and start your timed attempt.
          </p>
        </div>
        <span className="pill" style={{ padding: "9px 13px" }}>
          Time limit: {Math.round(task.duration_seconds / 60)} minutes
        </span>
      </div>
      <AssessmentPreview task={{
        id: task.id,
        title: task.title,
        concept: task.concept,
        difficulty: task.difficulty,
        durationSeconds: task.duration_seconds,
      }} />
    </section>
  );
}
