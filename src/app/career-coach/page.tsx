import Link from "next/link";
import { redirect } from "next/navigation";
import { LockKeyhole, Sparkles } from "lucide-react";
import { getSessionProfile } from "@/features/identity/queries";
import { getPlanSummary } from "@/server/subscriptions/queries";
import { getCareerCoachUsage } from "@/server/career-coach/usage";
import { CoachWorkspace } from "./CoachWorkspace";

export const dynamic = "force-dynamic";
export const metadata = {title:"AI Career Coach | Ready For Work"};

export default async function CareerCoachPage() {
  const profile = await getSessionProfile();
  if(!profile) redirect("/login?next=/career-coach");
  if(profile.role!=="student") redirect("/dashboard");
  let plan: Awaited<ReturnType<typeof getPlanSummary>> | null = null;
  try { plan = await getPlanSummary(profile.id,"student"); } catch { /* Fail closed on entitlement lookup. */ }
  return <section>
    <div className="rw-hero rw-coach-hero">
      <span className="eyebrow" style={{color:"#e5dfff"}}>Premium student tools · AI-powered</span>
      <h1><Sparkles size={25} style={{display:"inline",marginRight:10,verticalAlign:"-3px"}}/>AI Career Coach</h1>
      <p>Turn your work-readiness evidence into a clear plan for the career you want.</p>
    </div>
    {plan?.plan !== "premium" ? <div className="card rw-coach-locked">
      <span className="rw-coach-lock-icon"><LockKeyhole size={24}/></span>
      <h2>{plan ? "A Student Premium feature" : "Subscription status unavailable"}</h2>
      <p className="muted">{plan ? "Explore your strengths, choose a career direction and find real practice challenges with your AI Career Coach. Premium demo access is granted by an administrator; no payment is processed." : "We couldn't verify your plan. Please try again when subscription service is available."}</p>
      <Link href="/plans" className="button">See subscription plans</Link>
      <Link href="/tasks" className="rw-text-link">Continue with challenges</Link>
    </div> : <CoachArea studentId={profile.id}/>}
  </section>;
}

async function CoachArea({studentId}:{studentId:string}) {
  let usage: Awaited<ReturnType<typeof getCareerCoachUsage>> | null = null;

  try {
    usage = await getCareerCoachUsage(studentId);
  } catch {
    // Keep the fallback outside try/catch so React rendering is not caught here.
  }

  if (!usage) {
    return <div className="rw-assessment-note" role="alert">Career Coach is temporarily unavailable. Check that the development migration has been applied, then try again.</div>;
  }

  return <CoachWorkspace initialUsed={usage.used} limit={usage.limit}/>;
}
