import Link from "next/link";
import { redirect } from "next/navigation";
import { Award, BookOpen, CheckCircle2, ClipboardList } from "lucide-react";
import { ActivityTable } from "@/features/dashboard/ActivityTable";
import { getStudentActivity } from "@/features/dashboard/data";
import { getSessionProfile } from "@/features/identity/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Progress | Ready For Work" };

export default async function Progress() {
  const user = await getSessionProfile();
  if (!user) redirect("/login?next=/progress");
  if (user.role !== "student") redirect("/dashboard");
  let attempts: Awaited<ReturnType<typeof getStudentActivity>> = [];
  let failed = false;
  try { attempts = await getStudentActivity(user.id); } catch { failed = true; }
  const graded = attempts.filter(x=>x.status==="graded");
  const passed = graded.filter(x=>x.passed);
  const published = passed.filter(x=>x.visibility==="published");
  return <section>
    <div className="rw-page-heading"><span className="eyebrow">Student · My Progress</span><h1 className="h2">My Progress</h1><p className="muted">Track your real assessment activity and AI-assisted results.</p></div>
    <div className="rw-kpi-grid">
      <div className="rw-kpi"><div><span>Tasks attempted</span><strong>{failed?"—":attempts.length}</strong></div><ClipboardList/></div>
      <div className="rw-kpi"><div><span>Tasks graded</span><strong>{failed?"—":graded.length}</strong></div><CheckCircle2/></div>
      <div className="rw-kpi"><div><span>Passed assessments</span><strong>{failed?"—":passed.length}</strong></div><Award/></div>
      <div className="rw-kpi"><div><span>Published evidence</span><strong>{failed?"—":published.length}</strong></div><BookOpen/></div>
    </div>
    <div className="card"><div className="rw-section-head"><h2>Recent results and attempts</h2><Link href="/tasks" className="rw-text-link">Browse challenges →</Link></div>
      {failed?<div className="rw-empty">Your progress could not be loaded. Please try again.</div>:<ActivityTable attempts={attempts}/>}</div>
    <p className="muted" style={{fontSize:11,marginTop:15}}>Grades are AI-assisted and provisional. Private review signals never appear on public profiles.</p>
  </section>;
}
