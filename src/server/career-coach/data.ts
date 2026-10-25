import "server-only";
import { serverSupabase } from "@/lib/supabase/server";
import { getOwnPublishedResults } from "@/features/identity/queries";
import {
  safeEvidence, type PublishedChallenge, type PublishedEvidence,
} from "./rules";

type TaskRow = {
  id:string; slug:string; title:string; concept:string;
  difficulty:string; skills:string[] | null; duration_seconds:number;
};

/** Query only published task METADATA; never select sealed assessment columns. */
export async function loadCareerCoachContext(studentId: string): Promise<{
  challenges: PublishedChallenge[];
  startedTaskIds: Set<string>;
  evidence: PublishedEvidence[];
}> {
  const db = await serverSupabase();
  const [tasks, starts, results] = await Promise.all([
    db.from("tasks")
      .select("id,slug,title,concept,difficulty,skills,duration_seconds")
      .eq("status", "published").order("title").limit(150).returns<TaskRow[]>(),
    db.from("attempts").select("task_id").eq("student_id", studentId).limit(1000),
    getOwnPublishedResults(studentId),
  ]);
  if (tasks.error || starts.error) throw new Error("Career coach catalog or history unavailable");
  return {
    challenges: (tasks.data ?? []).map(t=>({
      id:t.id, slug:t.slug, title:t.title, concept:t.concept,
      difficulty:t.difficulty, skills:t.skills ?? [], durationSeconds:t.duration_seconds,
    })),
    startedTaskIds: new Set((starts.data ?? []).map(a=>a.task_id)),
    // Only the signed-in student's AI-assisted, passed, *published* assessment summaries.
    // Never load withheld/provisional grades, submissions, integrity events or sealed prompts.
    evidence: safeEvidence(results.map(r=>({
      title:r.taskTitle, concept:r.concept, skills:r.skills, score:r.overallScore,
    }))),
  };
}
