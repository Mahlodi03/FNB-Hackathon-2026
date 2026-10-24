import Link from "next/link";
import { redirect } from "next/navigation";
import { Award, CheckCircle2, ShieldCheck } from "lucide-react";
import { getSessionProfile, getOwnPublishedResults } from "@/features/identity/queries";
import { ResultCardView } from "@/features/identity/components/ui";
import { ShareToggle } from "@/features/identity/components/ProfileForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Evidence | Ready For Work" };
export default async function Evidence() {
  const user = await getSessionProfile();
  if (!user) redirect("/login?next=/evidence");
  if (user.role!=="student") redirect("/dashboard");
  let results: Awaited<ReturnType<typeof getOwnPublishedResults>> = [];
  let error=false;
  try{results=await getOwnPublishedResults(user.id);}catch{error=true;}
  const concepts = new Set(results.map(r=>r.concept));
  return <section>
    <div className="rw-page-heading"><span className="eyebrow">Student · My Evidence</span><h1 className="h2">My Verified Evidence</h1><p className="muted">Your passed, published tasks and the skills they demonstrate.</p></div>
    <div className="rw-kpi-grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))"}}>
      <div className="rw-kpi"><div><span>Published tasks</span><strong>{error?"—":results.length}</strong></div><CheckCircle2/></div>
      <div className="rw-kpi"><div><span>Concepts demonstrated</span><strong>{error?"—":concepts.size}</strong></div><Award/></div>
      <div className="rw-kpi"><div><span>Privacy</span><strong style={{fontSize:15}}>Opt-in</strong></div><ShieldCheck/></div>
    </div>
    {error?<div className="rw-empty">Your published evidence is temporarily unavailable.</div>:
      results.length?<div className="grid-cards">{results.map(r=><ResultCardView key={r.attemptId} card={r} footer={<ShareToggle attemptId={r.attemptId} initialShared={r.shareSubmission}/>}/>)}</div>:
      <div className="card"><div className="rw-empty">No passed, published assessments yet. Results withheld for private review are excluded.</div><Link className="button" href="/tasks" style={{marginTop:15}}>Browse challenges →</Link></div>}
    <p className="muted" style={{marginTop:16,fontSize:11}}>Employers see only your public profile and eligible published evidence. Sharing full answers is a separate choice.</p>
  </section>;
}
