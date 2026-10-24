import "server-only";
import { serverSupabase } from "@/lib/supabase/server";

type AttemptRow = { id: string; task_id: string; status: string; created_at: string };
type TaskRow = { id: string; title: string; slug: string; concept: string; difficulty: string };
type ResultRow = { attempt_id: string; overall_score: number; passed: boolean; visibility: string; graded_at: string };
export type StudentAttemptView = {
  id: string; title: string; slug: string; concept: string; difficulty: string;
  status: string; createdAt: string; score: number | null;
  passed: boolean | null; visibility: string | null; gradedAt: string | null;
};

/** Real RLS-protected records for the signed-in student. Never constructs demo scores. */
export async function getStudentActivity(studentId: string): Promise<StudentAttemptView[]> {
  const db = await serverSupabase();
  const attemptsRes = await db.from("attempts")
    .select("id,task_id,status,created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(80)
    .returns<AttemptRow[]>();
  if (attemptsRes.error) throw new Error("Assessment activity is unavailable");
  const attempts = attemptsRes.data ?? [];
  if (!attempts.length) return [];
  const ids = attempts.map(x => x.id);
  const taskIds = [...new Set(attempts.map(x => x.task_id))];
  const [tasksRes, resultsRes] = await Promise.all([
    db.from("tasks").select("id,title,slug,concept,difficulty").in("id", taskIds).returns<TaskRow[]>(),
    db.from("results").select("attempt_id,overall_score,passed,visibility,graded_at").in("attempt_id", ids).returns<ResultRow[]>(),
  ]);
  if (tasksRes.error || resultsRes.error) throw new Error("Assessment results are unavailable");
  const tasks = new Map((tasksRes.data ?? []).map(x => [x.id, x]));
  const grades = new Map((resultsRes.data ?? []).map(x => [x.attempt_id, x]));
  return attempts.map(a => {
    const t = tasks.get(a.task_id);
    const r = grades.get(a.id);
    return {
      id: a.id,
      title: t?.title ?? "Assessment task",
      slug: t?.slug ?? "",
      concept: t?.concept ?? "Unspecified",
      difficulty: t?.difficulty ?? "",
      status: a.status,
      createdAt: a.created_at,
      score: r?.overall_score == null ? null : Number(r.overall_score),
      passed: r?.passed ?? null,
      visibility: r?.visibility ?? null,
      gradedAt: r?.graded_at ?? null,
    };
  });
}
