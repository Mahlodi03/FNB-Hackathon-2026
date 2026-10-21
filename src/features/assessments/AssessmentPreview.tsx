"use client";
import { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import type { Task } from "@/contracts/domain";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AssessmentPreview({task}:{task:Task}) {
 const [theory,setTheory]=useState("");
 const [code,setCode]=useState("");
 const [consented,setConsented]=useState(false);
 const [timeLeft, setTimeLeft] = useState(task.durationSeconds);
 const [attemptId, setAttemptId] = useState<string | null>(null);
 const [starting, setStarting] = useState(false);
 const [startError, setStartError] = useState<string | null>(null);

 const [understandingQuestion, setUnderstandingQuestion] = useState<string | null>(null);
 const [understandingAnswer, setUnderstandingAnswer] = useState("");
 const [lockingAnswers, setLockingAnswers] = useState(false);
 const [lockError, setLockError] = useState<string | null>(null);

 const [submitting, setSubmitting] = useState(false);
 const [submitError, setSubmitError] = useState<string | null>(null);
 const [result, setResult] = useState<{
   overallScore: number; passed: boolean; feedback: string;
   strengths: string[]; improvements: string[]; published: boolean;
 } | null>(null);

 useEffect(() => {
  const interval = setInterval(() => {
    setTimeLeft((t) => (t <= 0 ? 0 : t - 1));
  }, 1000);
  return () => clearInterval(interval);
}, []);

 async function handleStart() {
   setStarting(true);
   setStartError(null);
   try {
     const res = await fetch("/api/attempts/start", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ taskId: task.id, rulesAccepted: true }),
     });
     const data = await res.json();
     if (!res.ok) {
       setStartError(data.error ?? "Something went wrong");
       return;
     }
     setAttemptId(data.attemptId);
     const secondsLeft = Math.max(0, Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000));
     setTimeLeft(secondsLeft);
   } catch {
     setStartError("Network error, please try again");
   } finally {
     setStarting(false);
   }
 }

 async function handleLockAnswers() {
   if (!attemptId) return;
   setLockingAnswers(true);
   setLockError(null);
   try {
     const res = await fetch(`/api/attempts/${attemptId}/understanding`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ theoryAnswer: theory, practicalAnswer: code }),
     });
     const data = await res.json();
     if (!res.ok) {
       setLockError(data.error ?? "Something went wrong");
       return;
     }
     setUnderstandingQuestion(data.question);
   } catch {
     setLockError("Network error, please try again");
   } finally {
     setLockingAnswers(false);
   }
 }

 async function handleSubmit() {
   if (!attemptId) return;
   setSubmitting(true);
   setSubmitError(null);
   try {
     const res = await fetch(`/api/attempts/${attemptId}/submit`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ understandingAnswer }),
     });
     const data = await res.json();
     if (!res.ok) {
       setSubmitError(data.error ?? "Something went wrong");
       return;
     }
     setResult(data);
   } catch {
     setSubmitError("Network error, please try again");
   } finally {
     setSubmitting(false);
   }
 }

 return <div className="card" style={{display:"grid",gap:22}}>
  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
   <div className="tag" style={{width:"fit-content"}}>Prototype only · not a real assessment</div>
   <div style={{fontWeight:700, fontSize:18, color: timeLeft < 60 ? "#ef4444" : "inherit"}}>
     ⏱ {formatTime(timeLeft)}
   </div>
  </div>

  {result ? (
    <div style={{display:"grid", gap:12}}>
      <h2 style={{fontSize:22, fontWeight:800}}>{result.passed ? "Passed ✅" : "Not yet passed"}</h2>
      <p>Overall score: <b>{result.overallScore}%</b></p>
      <p className="muted">{result.feedback}</p>
      {result.strengths?.length > 0 && <div><b>Strengths</b><ul>{result.strengths.map((s,i)=><li key={i}>{s}</li>)}</ul></div>}
      {result.improvements?.length > 0 && <div><b>Areas to improve</b><ul>{result.improvements.map((s,i)=><li key={i}>{s}</li>)}</ul></div>}
      {!result.published && <p className="muted" style={{fontSize:13}}>This result is not yet published to employers, pending review.</p>}
    </div>
  ) : understandingQuestion ? (
    <div style={{display:"grid", gap:14}}>
      <div><b>3. Check your understanding</b><p className="muted">{understandingQuestion}</p></div>
      <textarea rows={5} value={understandingAnswer} onChange={e=>setUnderstandingAnswer(e.target.value)} placeholder="Your answer"/>
      <button className="button" type="button" disabled={!understandingAnswer.trim() || submitting} onClick={handleSubmit}>
        {submitting ? "Submitting..." : "Submit assessment"}
      </button>
      {submitError && <p style={{color:"#ef4444", fontSize:13}}>{submitError}</p>}
    </div>
  ) : (
    <>
      <label><span>1. Theory: {task.theoryPrompt}</span><textarea rows={6} value={theory} onChange={e=>setTheory(e.target.value)} placeholder="Explain your approach" disabled={!!attemptId}/></label>
      <div>
       <span>2. Practical: {task.practicalPrompt}</span>
       <div style={{border:"1px solid #333", borderRadius:8, overflow:"hidden", marginTop:8}}>
        <Editor
         height="300px"
         defaultLanguage="javascript"
         value={code}
         onChange={(value) => setCode(value ?? "")}
         theme="vs-dark"
         options={{ minimap: { enabled: false }, fontSize: 14, readOnly: !!attemptId && lockingAnswers }}
        />
       </div>
      </div>

      {attemptId ? (
        <>
          <button className="button" type="button" disabled={!theory.trim() || !code.trim() || lockingAnswers} onClick={handleLockAnswers}>
            {lockingAnswers ? "Locking answers..." : "Continue to understanding question"}
          </button>
          {lockError && <p style={{color:"#ef4444", fontSize:13}}>{lockError}</p>}
        </>
      ) : (
        <>
          <label style={{display:"flex",alignItems:"center",gap:10}}><input style={{width:18}} type="checkbox" checked={consented} onChange={e=>setConsented(e.target.checked)}/> I understand this is sample UI; no assessment data is saved.</label>
          <button className="button" type="button" disabled={!consented || starting} onClick={handleStart}>
            {starting ? "Starting..." : "Start assessment"}
          </button>
          {startError && <p style={{color:"#ef4444", fontSize:13}}>{startError}</p>}
        </>
      )}
    </>
  )}

  <p className="muted" style={{fontSize:12}}>The real flow must require sign-in, explicit assessment rules consent, supported browser checks, camera permission and a server-owned timer. Draft text stays in this browser component only.</p>
 </div>;
}