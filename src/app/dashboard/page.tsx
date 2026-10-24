import Link from "next/link";
import { redirect } from "next/navigation";
import { Award, BookOpen, CheckCircle2, ClipboardList, Users } from "lucide-react";
import { getSessionProfile } from "@/features/identity/queries";
import { searchPublicStudents } from "@/features/identity/queries";
import { ActivityTable } from "@/features/dashboard/ActivityTable";
import { getStudentActivity } from "@/features/dashboard/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard | Ready For Work" };

export default async function Dashboard() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?next=/dashboard");
  if (profile.role === "admin") redirect("/admin");
  if (profile.role === "employer") {
    let directory = null;
    try { directory = await searchPublicStudents("", 1); } catch { /* Show a safe unavailable state. */ }
    return <section>
      <div className="rw-hero"><span className="eyebrow" style={{color:"#e1d4ff"}}>Employer workspace</span><h1>Welcome back, {profile.fullName.split(" ")[0]}</h1><p>Discover students who have chosen to share their work-readiness evidence.</p></div>
      <div className="rw-kpi-grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))"}}>
        <div className="rw-kpi"><div><span>Public student profiles</span><strong>{directory ? directory.total : "—"}</strong></div><Users/></div>
      </div>
      <div className="card"><div className="rw-section-head"><h2>Candidate discovery</h2><Link className="rw-text-link" href="/students">Search all candidates →</Link></div>
      <p className="muted">Review opt-in student profiles and published assessment evidence. Private and withheld results are never included.</p>
      {directory?.students.length ? <div className="rw-task-grid">{directory.students.slice(0,4).map(s=><Link className="card" style={{boxShadow:"none"}} href={`/students/${s.username}`} key={s.id}><strong>{s.fullName}</strong><p className="muted" style={{margin:"7px 0 0"}}>{s.institution || s.fieldOfInterest || "Student profile"}</p></Link>)}</div> : <div className="rw-empty">{directory ? "No public profiles available yet." : "Candidate directory is temporarily unavailable."}</div>}
      </div>
    </section>;
  }
  let attempts: Awaited<ReturnType<typeof getStudentActivity>> = [];
  let error = false;
  try { attempts = await getStudentActivity(profile.id); } catch { error = true; }
  const graded = attempts.filter(a=>a.status === "graded");
  const published = graded.filter(a=>a.visibility === "published" && a.passed);
  const pending = graded.filter(a=>a.visibility === "withheld");
  const uniqueConcepts = new Set(published.map(a=>a.concept));
  return <section>
    <div className="rw-hero"><span className="eyebrow" style={{color:"#e0e9ff"}}>Student dashboard</span><h1>Good afternoon, {profile.fullName.split(" ")[0] || "student"}</h1><p>Build evidence of your skills through real, graded assessments.</p></div>
    <div className="rw-kpi-grid">
      <div className="rw-kpi"><div><span>Tasks attempted</span><strong>{error ? "—" : attempts.length}</strong></div><ClipboardList/></div>
      <div className="rw-kpi"><div><span>Published passes</span><strong>{error ? "—" : published.length}</strong></div><CheckCircle2/></div>
      <div className="rw-kpi"><div><span>Verified concepts</span><strong>{error ? "—" : uniqueConcepts.size}</strong></div><BookOpen/></div>
      <div className="rw-kpi"><div><span>Results under review</span><strong>{error ? "—" : pending.length}</strong></div><Award/></div>
    </div>
    <div className="rw-split">
      <div className="card"><div className="rw-section-head"><h2>Your recent assessments</h2><Link className="rw-text-link" href="/progress">View progress →</Link></div>
      {error ? <div className="rw-empty">Unable to load assessment activity.</div> : <ActivityTable attempts={attempts.slice(0,6)}/>}
      </div>
      <aside className="card"><div className="rw-section-head"><h2>Your work-readiness evidence</h2><Link className="rw-text-link" href="/evidence">View all →</Link></div>
      {published.length ? <div style={{display:"grid",gap:11}}>{published.slice(0,4).map(a=><div key={a.id} style={{borderBottom:"1px solid var(--line)",paddingBottom:10}}><strong style={{fontSize:12}}>{a.title}</strong><div className="muted" style={{fontSize:11}}>{a.concept} · {a.score?.toFixed(1)}% · Published</div></div>)}</div> : <div className="rw-empty">Passed and published results will appear here. Attempts awaiting review stay private.</div>}
      <Link className="button" href="/tasks" style={{width:"100%",marginTop:17}}>Explore challenges →</Link>
      </aside>
    </div>
  </section>;
}
