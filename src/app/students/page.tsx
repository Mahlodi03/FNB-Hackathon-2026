import Link from "next/link";
import { demoStudents } from "@/content/demo";
export default function StudentDirectory(){return <section style={{paddingTop:42}}>
 <div className="eyebrow">Talent discovery</div><h1 className="h2" style={{margin:"10px 0 13px"}}>Explore student profiles</h1>
 <p className="muted" style={{marginBottom:24}}>Sample profiles only. Search and account-level visibility arrive with Person 1.</p>
 <div className="grid-cards">{demoStudents.map(s=><div key={s.id} className="card">
  <div style={{width:50,height:50,borderRadius:14,background:"#205642",color:"#c7ffed",display:"grid",placeItems:"center",fontWeight:900,marginBottom:14}}>{s.fullName.split(" ").map(p=>p[0]).join("")}</div>
  <h2 style={{fontSize:20,fontWeight:800}}>{s.fullName}</h2><p className="muted" style={{margin:"8px 0 14px"}}>{s.institution}<br/>{s.fieldOfInterest}</p>
  <Link className="button secondary" href={`/students/${s.username}`}>View sample profile</Link>
 </div>)}</div>
 </section>}
