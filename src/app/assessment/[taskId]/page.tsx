
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { TaskSchema } from "@/contracts/domain";
import { AssessmentPreview } from "@/features/assessments/AssessmentPreview";
import { serverSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AssessmentPageProps = {
  params: Promise<{
    taskId: string;
  }>;
};

export default async function AssessmentPage({
  params,
}: AssessmentPageProps) {
  const { taskId } = await params;

  // Only valid task IDs may be used in database queries.
  if (!z.string().uuid().safeParse(taskId).success) {
    notFound();
  }

  const supabase = await serverSupabase();

  // Students must sign in before accessing the assessment.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(
      `/login?next=${encodeURIComponent(`/assessment/${taskId}`)}`
    );
  }

  // The API also enforces the student role.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Unable to verify assessment role:", profileError);
    throw new Error("Unable to verify account permissions");
  }

  if (profile?.role !== "student") {
    redirect("/tasks");
  }

  // Fetch the actual published assessment from Supabase.
  const { data: row, error: taskError } = await supabase
    .from("tasks")
    .select(
      "id, slug, title, concept, difficulty, duration_seconds, theory_prompt, practical_prompt, understanding_guidance, rubric, pass_mark, skills, status"
    )
    .eq("id", taskId)
    .eq("status", "published")
    .maybeSingle();

  if (taskError) {
    console.error("Unable to load assessment:", taskError);
    throw new Error("Unable to load assessment");
  }

  if (!row) {
    notFound();
  }

  // Convert database naming into the shared Task contract.
  const parsed = TaskSchema.safeParse({
    id: row.id,
    slug: row.slug,
    title: row.title,
    concept: row.concept,
    difficulty: row.difficulty,
    durationSeconds: row.duration_seconds,
    theoryPrompt: row.theory_prompt,
    practicalPrompt: row.practical_prompt,
    understandingGuidance: row.understanding_guidance,
    rubric: row.rubric,
    passMark: row.pass_mark,
    skills: row.skills,
    status: row.status,
  });

  if (!parsed.success) {
    console.error(
      "Invalid assessment configuration:",
      parsed.error.flatten()
    );

    throw new Error("Published assessment configuration is invalid");
  }

  const task = parsed.data;

  return (
    <section>
      <div className="rw-assessment-heading">
        <div>
          <div className="eyebrow">Challenge · {task.concept} · {task.difficulty}</div>
          <h1 className="h2">{task.title}</h1>
          <p className="muted" style={{fontSize:13}}>Complete all three stages to receive AI-assisted feedback. Preflight is required before starting.</p>
        </div>
        <span className="pill" style={{padding:"9px 13px"}}>Time limit: {Math.round(task.durationSeconds / 60)} minutes</span>
      </div>
      <AssessmentPreview task={task} />
    </section>
  );
}
