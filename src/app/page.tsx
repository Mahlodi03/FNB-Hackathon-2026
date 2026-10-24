import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Award, BookOpen, BrainCircuit, ShieldCheck, Sparkles, Code2, CheckCircle2 } from "lucide-react";
import { getSessionProfile } from "@/features/identity/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  // The public homepage is for visitors. The logo links here for everyone,
  // and signed-in members are redirected to the right workspace on the server.
  const profile = await getSessionProfile();
  if (profile) redirect(profile.role === "admin" ? "/admin" : "/dashboard");

  return (
    <div className="rw-landing">
      <section className="rw-landing-hero" aria-labelledby="rw-home-title">
        <div className="rw-landing-copy">
          <span className="rw-landing-kicker"><Sparkles size={15}/> Your skills. Your future.</span>
          <h1 id="rw-home-title">Let your <span>skills</span> speak for themselves.</h1>
          <p>Complete real technical challenges, explain how you think, and build a work-readiness profile supported by assessed evidence.</p>
          <div className="rw-landing-actions">
            <Link href="/tasks" className="button rw-hero-primary">Explore challenges <ArrowRight size={17}/></Link>
            <Link href="/signup" className="button rw-hero-secondary">Create your account</Link>
          </div>
          <div className="rw-landing-trust"><ShieldCheck size={17}/> Your submissions are yours. Only eligible published evidence is shared.</div>
        </div>
        <div className="rw-landing-preview" aria-hidden="true">
          <div className="rw-preview-top"><span className="rw-preview-live"/> Skill assessment <span className="rw-preview-muted">Ready For Work</span></div>
          <div className="rw-preview-body">
            <div className="rw-preview-icon"><Code2 size={25}/></div>
            <span className="rw-preview-caption">IT challenge</span>
            <strong>Show your approach, not just the answer.</strong>
            <div className="rw-preview-code"><span>01</span> <b>function</b> solve(problem) &#123;<br/><span>02</span> &nbsp;&nbsp;<i>// Explain your approach</i><br/><span>03</span> &nbsp;&nbsp;<b>return</b> solution;<br/><span>04</span> &#125;</div>
            <div className="rw-preview-bottom"><CheckCircle2 size={16}/> Theory · Practical · Understanding</div>
          </div>
        </div>
      </section>
      <section className="rw-how" aria-labelledby="rw-how-heading">
        <div className="rw-how-intro"><span className="eyebrow">A clearer path from learning to opportunity</span><h2 id="rw-how-heading">How Ready For Work works</h2><p>From a technical challenge to evidence you can choose to share.</p></div>
        <div className="rw-how-grid">
          {[{icon:BookOpen,num:"01",title:"Take a challenge",text:"Complete real timed theory and practical tasks."},{icon:BrainCircuit,num:"02",title:"Explain your thinking",text:"Answer a personalized follow-up about your solution."},{icon:Award,num:"03",title:"Build real evidence",text:"Display eligible, passed and published results on your profile."},{icon:ShieldCheck,num:"04",title:"Assess responsibly",text:"Disclosed browser signals help inform private human review."}].map(({icon:Icon,num,title,text})=>(
            <article className="rw-how-card" key={title}><span className="rw-how-number">{num}</span><div className="rw-how-icon"><Icon size={24}/></div><h3>{title}</h3><p>{text}</p></article>
          ))}
        </div>
        <p className="rw-disclaimer">AI grading is provisional; browser signals are not conclusive proof of misconduct.</p>
      </section>
    </div>
  );
}
