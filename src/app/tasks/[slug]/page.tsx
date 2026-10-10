import Link from "next/link";
import { notFound } from "next/navigation";
import { demoTasks } from "@/content/demo";
export default async function TaskPage({params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params;const task=demoTasks.find(t=>t.slug===slug);if(!task)notFound();
 return <section style={{paddingTop:42,maxWidth:820}}>
  <Link href="/tasks" className="muted" style={{fontSize:14}}>← All tasks</Link>
  <div className="eyebrow" style={{marginTop:22}}>{task.concept} / {task.difficulty}</div><h1 className="h2" style={{margin:"10px 0 20px"}}>{task.title}</h1>
  <div className="card" style={{display:"grid",gap:20}}>
   <div><b>Theory question</b><p className="muted">{task.theoryPrompt}</p></div>
   <div><b>Practical question</b><p className="muted">{task.practicalPrompt}</p></div>
   <div><b>Check your understanding</b><p className="muted">Generated based on your own submission (implementation pending).</p></div>
   <div><b>Judging weights</b><p className="muted">Theory {task.rubric.theoryWeight}% · Practical {task.rubric.practicalWeight}% · Understanding {task.rubric.understandingWeight}%</p></div>
   <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><Link href={`/assessment/${task.id}`} className="button">Open assessment prototype</Link><span className="muted" style={{fontSize:12,alignSelf:"center"}}>Proctoring and submission not yet enabled</span></div>
  </div>
 </section>
}
