import { demoStudents } from "@/content/demo";
import { notFound } from "next/navigation";
export default async function Student({params}:{params:Promise<{username:string}>}) {
 const {username}=await params; const s=demoStudents.find(s=>s.username===username);if(!s)notFound();
 return <section style={{paddingTop:42,maxWidth:790}}>
  <div className="eyebrow">Sample public profile</div><h1 className="h2" style={{margin:"10px 0"}}>{s.fullName}</h1>
  <p className="muted">{s.fieldOfInterest} · {s.institution}</p><div className="card" style={{marginTop:26}}>
   <h2 style={{fontSize:20,fontWeight:800,marginBottom:14}}>About</h2><p>{s.bio}</p><hr style={{borderColor:"#294453",margin:"22px 0"}}/>
   <h2 style={{fontSize:20,fontWeight:800,marginBottom:9}}>Published assessment evidence</h2>
   <p className="muted">None shown in the starter. Never display fictional scores as genuine verified results.</p>
  </div>
 </section>
}
