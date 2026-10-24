import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, ShieldCheck } from "lucide-react";
import { serverSupabase } from "@/lib/supabase/server";
import { DEMO_MODE } from "@/lib/flags";
import { demoTasks } from "@/content/demo";

type TaskDetail = {
  id: string; slug:string; title:string; concept:string; difficulty:string;
  duration_seconds:number; theory_prompt:string; practical_prompt:string;
  rubric: { theoryWeight:number; practicalWeight:number; understandingWeight:number };
};
async function getTask(slug: string): Promise<TaskDetail|null> {
  if (DEMO_MODE){const t=demoTasks.find(t=>t.slug===slug);return t?{
    id:t.id,slug:t.slug,title:t.title,concept:t.concept,difficulty:t.difficulty,
    duration_seconds:t.durationSeconds,theory_prompt:t.theoryPrompt,practical_prompt:t.practicalPrompt,rubric:t.rubric}:null;}
  const db=await serverSupabase();
  const {data,error}=await db.from("tasks")
    .select("id,slug,title,concept,difficulty,duration_seconds,theory_prompt,practical_prompt,rubric")
    .eq("slug",slug).eq("status","published").maybeSingle<TaskDetail>();
  if(error)throw new Error("Unable to load challenge");return data;
}
export default async function TaskDetailPage({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;
  const task=await getTask(slug);if(!task)notFound();
  return <section style={{maxWidth:1050}}>
    <Link href="/tasks" className="rw-text-link" style={{display:"inline-flex",gap:6,alignItems:"center",marginBottom:20}}><ArrowLeft size={15}/> All challenges</Link>
    <div className="rw-page-heading"><span className="eyebrow">{task.concept} · {task.difficulty}</span><h1 className="h2">{task.title}</h1><p className="muted">An assessed technical challenge in three stages.</p></div>
    <div className="rw-split"><div className="card" style={{display:"grid",gap:18}}>
      <div><span className="rw-question-number">01 · THEORY</span><h2 style={{fontSize:16,marginBottom:6}}>Explain the concept</h2><p className="muted">{task.theory_prompt}</p></div>
      <div style={{borderTop:"1px solid var(--line)",paddingTop:18}}><span className="rw-question-number">02 · PRACTICAL</span><h2 style={{fontSize:16,marginBottom:6}}>Demonstrate your skills</h2><p className="muted">{task.practical_prompt}</p></div>
      <div style={{borderTop:"1px solid var(--line)",paddingTop:18}}><span className="rw-question-number">03 · UNDERSTANDING</span><h2 style={{fontSize:16,marginBottom:6}}>Explain your decisions</h2><p className="muted">After saving the first two sections, our AI service asks a follow-up based on your submission.</p></div>
    </div><aside className="card" style={{display:"grid",gap:14}}>
      <div style={{display:"flex",gap:7,alignItems:"center",fontWeight:800}}><Clock3 size={17} color="#6942d1"/> Assessment details</div>
      <p className="muted" style={{fontSize:12,margin:0}}>Time limit: <strong>{Math.round(task.duration_seconds/60)} minutes</strong></p>
      <p className="muted" style={{fontSize:12,margin:0}}>Grading weights: theory {task.rubric.theoryWeight}%, practical {task.rubric.practicalWeight}%, understanding {task.rubric.understandingWeight}%</p>
      <div className="rw-assessment-note"><ShieldCheck size={15} style={{display:"inline",verticalAlign:"middle",marginRight:6}}/>Camera and fullscreen preflight, rules acceptance and privacy notice are required. Browser signals support private review, not automatic accusations.</div>
      {DEMO_MODE?<p className="muted">Demo mode: starting live assessments is disabled.</p>:<Link className="button" href={`/assessment/${task.id}`}>Prepare assessment →</Link>}
    </aside></div>
  </section>;
}
