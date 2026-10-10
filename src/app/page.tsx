import Link from "next/link";
import { ArrowRight, BadgeCheck, BrainCircuit, ClipboardList, ShieldCheck } from "lucide-react";
const features = [
 {icon:ClipboardList,title:"Do the work",description:"Solve practical, timed tasks that reflect foundational IT skills."},
 {icon:BrainCircuit,title:"Explain your thinking",description:"Answer a follow-up question based on your own work."},
 {icon:BadgeCheck,title:"Show your evidence",description:"Display assessment results and let employers inspect opted-in submissions."},
 {icon:ShieldCheck,title:"Build trust fairly",description:"Use disclosed browser integrity signals without claiming perfect anti-cheating."}
];
export default function Home() {return <>
 <section style={{padding:"75px 0 70px",maxWidth:850}}>
  <div className="eyebrow" style={{marginBottom:18}}>Youth employment • Work readiness • FNB Hackathon</div>
  <h1 className="title">Your skills deserve <span style={{color:"var(--brand)"}}>evidence.</span></h1>
  <p className="muted" style={{maxWidth:670,fontSize:19,lineHeight:1.6,margin:"24px 0 28px"}}>Ready For Work helps emerging IT talent demonstrate what they know through practical assessments and transparent results.</p>
  <div style={{display:"flex",gap:12,flexWrap:"wrap"}}><Link className="button" href="/tasks">Explore sample tasks <ArrowRight size={17}/></Link><Link className="button secondary" href="/students">Explore profiles</Link></div>
 </section>
 <section><div className="eyebrow">How it works</div><h2 className="h2" style={{margin:"12px 0 22px"}}>More than a line on a CV</h2><div className="grid-cards">
  {features.map(({icon:Icon,title,description})=><article className="card" key={title}>
   <Icon color="#38d6a6" size={26}/><h3 style={{fontSize:19,fontWeight:800,margin:"17px 0 9px"}}>{title}</h3><p className="muted" style={{lineHeight:1.55,fontSize:14}}>{description}</p>
  </article>)}
 </div></section>
 </>}
