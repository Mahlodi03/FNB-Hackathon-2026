import Link from "next/link";
import { BookOpen, Clock3, ArrowRight } from "lucide-react";
import { serverSupabase } from "@/lib/supabase/server";
import { DEMO_MODE } from "@/lib/flags";
import { demoTasks } from "@/content/demo";
import { getSessionProfile } from "@/features/identity/queries";
import { getPlanSummary, type PlanSummary } from "@/server/subscriptions/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Challenges | Ready For Work" };

type TaskListing = { id: string; slug: string; title: string; concept: string; difficulty: string; duration_seconds: number; pass_mark: number };

// Reuse the existing URL filters. No new data or client-side assessment state.
function filterHref(concept?: string, difficulty?: string) {
  const params = new URLSearchParams();
  if (concept) params.set("concept", concept);
  if (difficulty) params.set("difficulty", difficulty);
  const suffix = params.toString();
  return suffix ? `/tasks?${suffix}` : "/tasks";
}
async function getTasks(): Promise<TaskListing[]> {
  if (DEMO_MODE) return demoTasks.map(t=>({
    id:t.id,slug:t.slug,title:t.title,concept:t.concept,difficulty:t.difficulty,
    duration_seconds:t.durationSeconds,pass_mark:t.passMark,
  }));
  // Direct server query: no hardcoded localhost URL, works on production deployments.
  const db = await serverSupabase();
  const {data,error} = await db.from("tasks")
    .select("id,slug,title,concept,difficulty,duration_seconds,pass_mark")
    .eq("status","published").order("title").returns<TaskListing[]>();
  if (error) throw new Error("Published challenges are temporarily unavailable");
  return data ?? [];
}

export default async function Challenges({searchParams}:{searchParams:Promise<{concept?:string;difficulty?:string}>}) {
  const query = await searchParams;
  const profile = await getSessionProfile();
  let plan: PlanSummary | null = null;
  const startedTaskIds = new Set<string>();
  if (profile?.role === "student") {
    try {
      plan = await getPlanSummary(profile.id, "student");
      const db = await serverSupabase();
      const { data, error } = await db.from("attempts")
        .select("task_id").eq("student_id", profile.id);
      if (error) throw error;
      for (const row of data ?? []) startedTaskIds.add(row.task_id);
    } catch { /* The start API still enforces allowances. Avoid false lock UI. */ plan = null; }
  }
  const limitReached = plan?.plan === "free" && plan.remainingUnlocks === 0;
  const allTasks = await getTasks();
  const concepts = [...new Set(allTasks.map(t=>t.concept))].sort();
  const filtered = allTasks.filter(t=>(!query.concept||query.concept===t.concept)&&(!query.difficulty||query.difficulty===t.difficulty));
  return <section>
    <div className="rw-page-heading rw-challenges-heading"><span className="eyebrow">Explore your skills</span><h1 className="h2">Challenges</h1><p className="muted">Choose a topic and put your skills into practice. Your assessment questions appear after you start.</p></div>
    {plan && <div className="rw-assessment-note" role="status" style={{marginBottom:18}}>
      <strong>{plan.plan === "premium" ? "Premium demo" : "Free plan"}</strong>
      {plan.plan === "free" ? ` · ${plan.usedUnlocks} of 10 lifetime starts used · ${plan.remainingUnlocks} remaining` : " · Unlimited available challenges"}.
      <Link className="rw-text-link" href="/plans" style={{marginLeft:8}}>See plans →</Link>
    </div>}
    <div className="rw-challenge-filter-panel">
      <div className="rw-challenge-filter-heading"><strong>Browse by topic</strong><span className="muted">{filtered.length} {filtered.length === 1 ? "challenge" : "challenges"} shown</span></div>
      <nav className="rw-topic-scroll" aria-label="Challenge topics">
        <Link href={filterHref(undefined,query.difficulty)} className={`rw-topic-chip ${!query.concept ? "selected" : ""}`} aria-current={!query.concept ? "page" : undefined}>All topics</Link>
        {concepts.map((concept) => <Link key={concept} href={filterHref(concept,query.difficulty)} className={`rw-topic-chip ${query.concept === concept ? "selected" : ""}`} aria-current={query.concept === concept ? "page" : undefined}>{concept}</Link>)}
      </nav>
      <form className="rw-challenge-filter-actions" action="/tasks">
        {query.concept ? <input type="hidden" name="concept" value={query.concept} /> : null}
        <label htmlFor="challenge-difficulty">Difficulty
          <select id="challenge-difficulty" name="difficulty" defaultValue={query.difficulty??""}><option value="">All difficulties</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select>
        </label>
        <button className="button secondary" type="submit">Apply</button>
        {(query.concept || query.difficulty) ? <Link href="/tasks" className="rw-text-link">Clear filters</Link> : null}
      </form>
    </div>
    <div className="rw-task-grid rw-challenge-grid">{filtered.map(t=><article className="card rw-task-card rw-challenge-card" key={t.id}>
      <div className="rw-task-card-head"><span className="tag">{t.concept}</span><span className="pill">{t.difficulty}</span></div>
      <h2>{t.title}</h2><p className="muted">A timed theory, practical and follow-up assessment.</p>
      <div className="rw-task-meta"><span style={{display:"inline-flex",alignItems:"center",gap:5}}><Clock3 size={13}/>{Math.round(t.duration_seconds/60)} min</span><span>Pass mark {t.pass_mark}%</span><span>3 sections</span></div>
      {profile?.role === "student" ? <div className="rw-challenge-availability"><span className={`rw-challenge-state ${startedTaskIds.has(t.id) ? "existing" : ""}`}>{startedTaskIds.has(t.id) ? "Existing attempt" : "Not started"}</span></div> : null}
      <div className="rw-task-card-foot">{limitReached && !startedTaskIds.has(t.id)
        ? <Link className="button secondary" href="/plans">New challenge locked · See plans</Link>
        : <Link className="button" href={`/assessment/${encodeURIComponent(t.id)}`}>
            {startedTaskIds.has(t.id) ? "View existing attempt" : "Start challenge"} <ArrowRight size={14}/>
          </Link>}</div>
    </article>)}</div>
    {!filtered.length?<div className="rw-empty"><BookOpen size={23} style={{margin:"0 auto 10px"}}/><p>No published challenges match these filters.</p></div>:null}
<p className="muted" style={{marginTop:17,fontSize:12}}>You will review the assessment rules before starting. Questions remain hidden until your timed attempt begins.</p>
  </section>;
}
