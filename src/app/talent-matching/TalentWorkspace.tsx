"use client";
import {useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ArrowRight,Bookmark,BriefcaseBusiness,Plus,Sparkles,Trash2} from "lucide-react";
import type {TalentCandidate} from "@/server/talent-matching/rules";
import {ACTIVE_BRIEF_LIMIT} from "@/server/talent-matching/rules";
import type {TalentWorkspaceData} from "@/server/talent-matching/data";

type MatchResponse={
  briefId:string;analysis:{summary:string;focusSkills:string[]};
  candidates:TalentCandidate[];runId:string;note:string;
};
const START_DESC="We are looking for an early-career developer who can work with APIs, SQL databases, Git, and testing. The role involves solving practical problems, documenting solutions, and collaborating with other engineers.";

export function TalentWorkspace({initial}:{initial:TalentWorkspaceData}){
  const router=useRouter();
  const [title,setTitle]=useState("");
  const [description,setDescription]=useState(START_DESC);
  const [skills,setSkills]=useState("SQL, API, Testing");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const [result,setResult]=useState<MatchResponse|null>(null);
  const used=initial.used;
  const saved=initial.shortlists;
  const active=initial.briefs.filter(b=>b.status==="active");
  const remaining=Math.max(0,initial.limit-used);
  async function post(url:string,body:object):Promise<Record<string,unknown>>{
    const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
    const data=await response.json() as Record<string,unknown>;
    if(!response.ok)throw new Error(typeof data.error==="string"?data.error:
      typeof data.status==="string"?data.status.replaceAll("_"," "):"Action could not be completed");
    return data;
  }
  async function execute(operation:()=>Promise<void>){
    if(busy)return;setBusy(true);setError(null);setMessage(null);
    try{await operation();}catch(e){setError(e instanceof Error?e.message:"Request failed");}
    finally{setBusy(false);}
  }
  function createBrief(){void execute(async()=>{
    const requiredSkills=skills.split(",").map(s=>s.trim()).filter(Boolean);
    const response=await post("/api/talent-matching/briefs",{
      action:"create",brief:{title,description,requiredSkills},
    });
    if(response.status!=="created")throw new Error("Brief creation failed");
    setTitle("");setResult(null);setMessage("Job brief created.");router.refresh();
  });}
  function archiveBrief(briefId:string){void execute(async()=>{
    const response=await post("/api/talent-matching/briefs",{action:"archive",briefId});
    if(response.status!=="archived")throw new Error("Could not archive the brief");
    setResult(null);setMessage("Brief archived. A new active brief slot is available.");router.refresh();
  });}
  function runMatching(briefId:string){if(remaining===0)return;void execute(async()=>{
    setResult(null);
    try {
      const response=await post("/api/talent-matching/runs",{briefId}) as unknown as MatchResponse;
      setResult(response);setMessage("New evidence-based recommendations generated.");
    } finally {
      // A failed AI run also counts toward monthly cost protection.
      router.refresh();
    }
  });}
  function toggleShortlist(briefId:string,studentId:string,save:boolean){void execute(async()=>{
    const response=await post("/api/talent-matching/shortlists",{briefId,studentId,save});
    if(response.status!==(save?"saved":"removed"))throw new Error("Could not update shortlist");
    setMessage(save?"Candidate saved to your shortlist.":"Candidate removed from shortlist.");router.refresh();
  });}
  return <div className="rw-talent-stack">
    <section className="rw-talent-stats">
      <div className="card"><small>Active job briefs</small><strong>{active.length} / {ACTIVE_BRIEF_LIMIT}</strong><span>Archive a brief to free a slot</span></div>
      <div className="card"><small>Matching runs this month (UTC)</small><strong>{used} / {initial.limit}</strong><span>{remaining} remaining · Includes failed runs</span></div>
      <div className="card"><small>Saved candidates</small><strong>{saved.length}</strong><span>Only currently discoverable candidates shown</span></div>
    </section>
    <section className="card rw-talent-form">
      <div className="rw-section-head"><h2><Plus size={20}/> Create a job brief</h2><span className="pill">{Math.max(0,ACTIVE_BRIEF_LIMIT-active.length)} slots available</span></div>
      <p className="muted">Describe a role and list the must-have skills. We send only this employer-provided brief to OpenAI, not candidate profiles. Do not include personal information about applicants.</p>
      <label htmlFor="talent-title">Role title</label>
      <input id="talent-title" className="input" value={title} maxLength={100} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Junior Data Analyst" disabled={busy||active.length>=ACTIVE_BRIEF_LIMIT}/>
      <label htmlFor="talent-skills">Required skills (comma separated, maximum 8)</label>
      <input id="talent-skills" className="input" value={skills} onChange={e=>setSkills(e.target.value)} disabled={busy||active.length>=ACTIVE_BRIEF_LIMIT}/>
      <label htmlFor="talent-description">Job description (50–1600 characters)</label>
      <textarea id="talent-description" className="input" value={description} maxLength={1600} rows={5} onChange={e=>setDescription(e.target.value)} disabled={busy||active.length>=ACTIVE_BRIEF_LIMIT}/>
      <button type="button" className="button" disabled={busy||active.length>=ACTIVE_BRIEF_LIMIT||title.trim().length<5} onClick={createBrief}><Plus size={16}/> Save job brief</button>
    </section>
    {(error||message)&&<div className="rw-assessment-note" role={error?"alert":"status"}>{error??message}</div>}
    <section className="card rw-talent-briefs">
      <div className="rw-section-head"><h2><BriefcaseBusiness size={20}/> Your job briefs</h2><span className="muted">Monthly limit resets at 00:00 UTC on the first day of each month</span></div>
      {!initial.briefs.length?<div className="rw-empty">Create your first job brief to generate explainable talent recommendations.</div>:<div className="rw-talent-brief-list">{initial.briefs.map(brief=><article className="rw-talent-brief" key={brief.id}>
        <div><span className="tag">{brief.status}</span><h3>{brief.title}</h3><p className="muted">{brief.required_skills.join(" · ")}</p></div>
        <div className="rw-talent-actions">{brief.status==="active"&&<>
          <button type="button" className="button" disabled={busy||remaining===0} onClick={()=>runMatching(brief.id)}><Sparkles size={15}/>{busy?"Working…":"Find matches"}</button>
          <button type="button" className="button secondary" disabled={busy} onClick={()=>archiveBrief(brief.id)}>Archive</button>
        </>}</div>
      </article>)}</div>}
    </section>
    {result&&<section className="rw-talent-results" aria-live="polite">
      <div className="rw-talent-result-intro"><span className="eyebrow">AI-interpreted job brief</span><h2>Evidence-based candidates</h2><p>{result.analysis.summary}</p>
        <div className="rw-talent-tags">{result.analysis.focusSkills.map(s=><span key={s} className="tag">{s}</span>)}</div>
        <small>Skill coverage is calculated from published passing evidence, not whether a student has a paid plan, their identity, or a probability of hiring success.</small>
      </div>
      {result.candidates.length===0?<div className="card rw-empty">No opted-in students currently have published passing evidence supporting the selected skills. Try a different brief or review the free student directory.</div>:<div className="rw-talent-candidates">{result.candidates.map(c=>{
        const isSaved=saved.some(s=>s.brief_id===result.briefId&&s.student_id===c.studentId);
        return <article className="card rw-talent-candidate" key={c.studentId}>
          <div className="rw-section-head"><h3>{c.fullName}</h3><span className="pill">{c.coveragePercent}% evidence coverage</span></div>
          <p className="muted">{c.explanation}</p>
          <strong>Skills with supporting evidence</strong><p>{c.matchedSkills.join(", ")||"None"}</p>
          <strong>Not evidenced here</strong><p className="muted">{c.missingSkills.join(", ")||"All selected skills have some evidence"}</p>
          <strong>Published challenges</strong><ul>{c.evidence.map(e=><li key={e}>{e}</li>)}</ul>
          <div className="rw-talent-actions"><Link className="button secondary" href={`/students/${encodeURIComponent(c.username)}`}>View public profile <ArrowRight size={14}/></Link>
            <button type="button" className="button" disabled={busy} onClick={()=>toggleShortlist(result.briefId,c.studentId,!isSaved)}><Bookmark size={15}/>{isSaved?"Remove shortlist":"Save candidate"}</button></div>
        </article>;
      })}</div>}
    </section>}
    <section className="card rw-talent-saved"><div className="rw-section-head"><h2><Bookmark size={19}/> Your shortlists</h2><Link className="rw-text-link" href="/students">Browse student directory →</Link></div>
      {!saved.length?<p className="muted">No candidates saved yet. Saved profiles disappear here if a student opts out or their eligible published evidence is withdrawn.</p>:<div className="rw-talent-brief-list">{saved.map(s=><div className="rw-talent-saved-row" key={`${s.brief_id}:${s.student_id}`}>
        <Link href={`/students/${encodeURIComponent(s.username)}`}>{s.full_name||s.username}</Link>
        <button type="button" className="button secondary" disabled={busy} onClick={()=>toggleShortlist(s.brief_id,s.student_id,false)}><Trash2 size={14}/> Remove</button>
      </div>)}</div>}
    </section>
  </div>;
}
