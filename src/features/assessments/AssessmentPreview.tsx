"use client";
import { useState } from "react";
import type { Task } from "@/contracts/domain";
/** Person 2 owns this component. Preview mode intentionally DOES NOT submit or score anything. */
export function AssessmentPreview({task}:{task:Task}) {
 const [theory,setTheory]=useState("");const [code,setCode]=useState("");const [consented,setConsented]=useState(false);
 return <div className="card" style={{display:"grid",gap:22}}>
  <div className="tag" style={{width:"fit-content"}}>Prototype only · not a real assessment</div>
  <label><span>1. Theory: {task.theoryPrompt}</span><textarea rows={6} value={theory} onChange={e=>setTheory(e.target.value)} placeholder="Explain your approach"/></label>
  <label><span>2. Practical: {task.practicalPrompt}</span><textarea rows={9} value={code} onChange={e=>setCode(e.target.value)} placeholder="Code editor goes here (Person 2 adds Monaco)" style={{fontFamily:"monospace"}}/></label>
  <label style={{display:"flex",alignItems:"center",gap:10}}><input style={{width:18}} type="checkbox" checked={consented} onChange={e=>setConsented(e.target.checked)}/> I understand this is sample UI; no assessment data is saved.</label>
  <button className="button" disabled type="button">Continue to AI-generated question (not connected)</button>
  <p className="muted" style={{fontSize:12}}>The real flow must require sign-in, explicit assessment rules consent, supported browser checks, camera permission and a server-owned timer. Draft text stays in this browser component only.</p>
 </div>;
}
