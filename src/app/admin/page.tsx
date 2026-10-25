import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookOpen, ShieldAlert, ShieldCheck } from "lucide-react";
import { AccessError, requireActor } from "@/server/auth/actor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin dashboard | Ready For Work" };
export default async function AdminDashboard() {
  try { await requireActor(["admin"]); }
  catch(error){
    if(error instanceof AccessError && error.status===401)redirect("/login?next=/admin");
    if(error instanceof AccessError && error.status===403)notFound();
    throw error;
  }
  return <section>
    <div className="rw-hero"><span className="eyebrow" style={{color:"#e2d7ff"}}>Restricted administration</span><h1>Admin dashboard</h1><p>Manage assessment tasks and privately inspect integrity events.</p></div>
    <div className="rw-task-grid">
      <article className="card" style={{display:"grid",gap:12}}><BookOpen size={28} color="#7044da"/><h2 style={{fontSize:18,fontWeight:800,margin:0}}>Assessment tasks</h2><p className="muted">Access the existing task-management interface. Publishing and editing require authorized server-side writes.</p><Link href="/admin/tasks" className="button">Manage tasks →</Link></article>
      <article className="card" style={{display:"grid",gap:12}}><ShieldAlert size={28} color="#7044da"/><h2 style={{fontSize:18,fontWeight:800,margin:0}}>Private integrity events</h2><p className="muted">Inspect recorded signals, save human decisions and review their audit history. Signals are not proof of misconduct.</p><Link href="/admin/integrity" className="button">Review flagged attempts →</Link></article>
    </div>
    <div className="rw-assessment-note" style={{marginTop:21,display:"flex",gap:10,alignItems:"center"}}><ShieldCheck size={17}/>Admin access is controlled by your authenticated Supabase role. Figma-only user management and analytics are not enabled.</div>
  </section>;
}
