import Link from "next/link";
import {redirect} from "next/navigation";
import {BriefcaseBusiness,LockKeyhole} from "lucide-react";
import {getSessionProfile} from "@/features/identity/queries";
import {getPlanSummary} from "@/server/subscriptions/queries";
import {loadTalentWorkspace} from "@/server/talent-matching/data";
import {TalentWorkspace} from "./TalentWorkspace";

export const dynamic="force-dynamic";
export const metadata={title:"AI Talent Matching | Ready For Work"};

export default async function TalentMatchingPage(){
  const profile=await getSessionProfile();
  if(!profile)redirect("/login?next=/talent-matching");
  if(profile.role!=="employer")redirect("/dashboard");
  let plan:Awaited<ReturnType<typeof getPlanSummary>>|null=null;
  try{plan=await getPlanSummary(profile.id,"employer");}catch{/* Fail closed */}
  let workspace:Awaited<ReturnType<typeof loadTalentWorkspace>>|null=null;
  if(plan?.plan==="premium"){
    try{workspace=await loadTalentWorkspace(profile.id);}catch{/* No data on failure */}
  }
  return <section className="rw-talent-page">
    <div className="rw-hero rw-talent-hero">
      <span className="eyebrow" style={{color:"#ede6ff"}}>Employer Premium · Evidence-first recommendations</span>
      <h1><BriefcaseBusiness size={27} style={{display:"inline",verticalAlign:"-4px",marginRight:9}}/>AI Talent Matching</h1>
      <p>Turn a job brief into grounded recommendations from students who have chosen to share published work-readiness evidence.</p>
    </div>
    {plan?.plan!=="premium"?<section className="card rw-talent-locked">
      <LockKeyhole size={26}/><h2>{plan?"Employer Premium feature":"Subscription status unavailable"}</h2>
      <p className="muted">Browse public student profiles for free. Active demo Employer Premium unlocks AI job brief matching and private shortlists. No payment is processed.</p>
      <Link className="button" href="/plans">Explore employer plans</Link>
      <Link className="rw-text-link" href="/students">Continue with student discovery →</Link>
    </section>:workspace?<TalentWorkspace initial={workspace}/>:<div className="rw-assessment-note" role="alert">Matching is temporarily unavailable. Check the development migration and try again.</div>}
    <div className="rw-assessment-note">Only opted-in students with published passing AI-assisted evidence are eligible for these recommendations. Neither the employer brief analysis nor candidate ranking uses withheld results, private submissions, integrity signals or student payment status. AI matching supports human review; it is not an automatic hiring decision.</div>
  </section>;
}
