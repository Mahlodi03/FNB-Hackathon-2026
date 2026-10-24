import Link from "next/link";
import { ArrowRight, Award, BookOpen, BrainCircuit, ShieldCheck } from "lucide-react";
export default function Home() {
  return <section>
    <div className="rw-hero" style={{padding:"46px 38px"}}><span className="eyebrow" style={{color:"#ded3ff"}}>Your skills. Your future.</span><h1 style={{fontSize:"clamp(30px,4vw,48px)",maxWidth:740}}>Show what you can do, not just what you can say.</h1><p style={{maxWidth:620,fontSize:15,lineHeight:1.7,margin:"17px 0 21px"}}>Complete real technical challenges, demonstrate your understanding and build a work-readiness profile supported by assessed evidence.</p><div style={{display:"flex",gap:12,flexWrap:"wrap"}}><Link href="/tasks" className="button" style={{background:"white",color:"#5c3bc8"}}>Explore challenges <ArrowRight size={16}/></Link><Link href="/signup" className="button secondary" style={{borderColor:"#ffffff55",background:"#ffffff24",color:"white"}}>Create account</Link></div></div>
    <div className="rw-section-head" style={{marginTop:30}}><h2>How Ready For Work works</h2></div>
    <div className="grid-cards">
      {[{icon:BookOpen,title:"Take a challenge",text:"Complete timed theory and practical tasks covering IT fundamentals."},{icon:BrainCircuit,title:"Explain your thinking",text:"Respond to an AI-generated question about your own answers."},{icon:Award,title:"Build evidence",text:"Show eligible passed, published results to employers through your profile."},{icon:ShieldCheck,title:"Assess responsibly",text:"Disclosed browser integrity signals support private human review."}].map(({icon:Icon,title,text})=><div className="card" key={title}><Icon size={28} color="#6940d2"/><h3 style={{fontWeight:800,margin:"12px 0 7px"}}>{title}</h3><p className="muted" style={{fontSize:12,lineHeight:1.7,margin:0}}>{text}</p></div>)}
    </div>
    <p className="muted" style={{fontSize:11,marginTop:22}}>AI grading is provisional. Browser signals are not conclusive proof of misconduct.</p>
  </section>;
}
