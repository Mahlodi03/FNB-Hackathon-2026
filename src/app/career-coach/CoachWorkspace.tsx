"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight, BookOpen, CheckCircle2, Clock3, Lightbulb,
  LoaderCircle, Sparkles, Target, TrendingUp,
} from "lucide-react";
import { CAREER_GOALS, type CareerGoal, type RecommendedChallenge } from "@/server/career-coach/rules";

type Guidance = {
  headline: string; overview: string; demonstratedStrengths: string[];
  growthAreas: string[]; nextSteps: string[];
};
type CoachResponse = {
  goal: CareerGoal; guidance: Guidance;
  recommendedChallenges: RecommendedChallenge[];
  evidenceCount: number; usage:{used:number;limit:number} | null;
};

export function CoachWorkspace({initialUsed,limit}:{initialUsed:number;limit:number}) {
  const [goal,setGoal] = useState<CareerGoal>("software_engineer");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState<string | null>(null);
  const [result,setResult] = useState<CoachResponse | null>(null);
  const [used,setUsed] = useState(initialUsed);
  const left = Math.max(0,limit-used);

  async function requestGuidance() {
    if (busy || left === 0) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const response = await fetch("/api/career-coach",{
        method:"POST",headers:{"Content-Type":"application/json"},
        cache:"no-store", body:JSON.stringify({goal}),
      });
      const json: unknown = await response.json();
      if (!response.ok) {
        const info = json as {error?:string;code?:string};
        throw new Error(info.error || "Unable to generate career guidance");
      }
      const data = json as CoachResponse;
      setResult(data);
      if (data.usage) setUsed(data.usage.used);
    } catch(e) {
      setError(e instanceof Error ? e.message : "Unable to generate guidance");
      // Request may have been reserved before an AI failure. Refresh the daily quota.
      try {
        const r = await fetch("/api/career-coach",{cache:"no-store"});
        if(r.ok) {const u = await r.json() as {used:number}; setUsed(u.used);}
      } catch { /* Show original error. */ }
    } finally { setBusy(false); }
  }

  return <div className="rw-coach-workspace">
    <div className="card rw-coach-setup">
      <div className="rw-section-head">
        <h2><Target size={19} aria-hidden="true"/> Your career direction</h2>
        <span className="pill"><Sparkles size={12}/> {left} of {limit} requests left today</span>
      </div>
      <p className="muted" style={{fontSize:13}}>Choose a role to receive a learning pathway, grounded in your published results and real Ready For Work challenges.</p>
      <label htmlFor="coach-goal">Target role</label>
      <select id="coach-goal" value={goal} disabled={busy} onChange={event=>setGoal(event.target.value as CareerGoal)}>
        {(Object.keys(CAREER_GOALS) as CareerGoal[]).map(key=><option key={key} value={key}>{CAREER_GOALS[key].label}</option>)}
      </select>
      <div className="rw-coach-controls">
        <button type="button" className="button" disabled={busy || left===0} onClick={requestGuidance}>
          {busy?<><LoaderCircle size={17} className="rw-coach-spin"/> Preparing your plan…</>:<><Sparkles size={17}/> Generate my career plan <ArrowRight size={16}/></>}
        </button>
        <small className="muted">Max {limit} requests per UTC day · 60-second cooldown · AI-assisted guidance</small>
      </div>
      {left===0 && <p className="rw-assessment-note" role="status">Your daily request limit is reached. You can request another plan after 00:00 UTC.</p>}
      {error && <p className="rw-assessment-note" role="alert">{error}</p>}
    </div>

    {!result && <div className="rw-coach-placeholder card">
      <div className="rw-coach-placeholder-icon"><Lightbulb size={26}/></div>
      <h2>A practical next step, tailored to you</h2>
      <p className="muted">Your personalized pathway will appear here with strengths supported by published evidence, growth opportunities, and real challenges to explore.</p>
      <div className="rw-coach-preview"><span>01 · Evidence-informed guidance</span><span>02 · Skill-building actions</span><span>03 · Real published challenges</span></div>
    </div>}

    {result && <div className="rw-coach-output" aria-live="polite">
      <section className="rw-coach-result-header">
        <span className="eyebrow">Your AI career pathway</span>
        <h2>{result.guidance.headline}</h2>
        <p>{result.guidance.overview}</p>
        <small>Based on {result.evidenceCount} published passing assessment{result.evidenceCount===1?"":"s"}. Not a hiring decision or a complete assessment of your abilities.</small>
      </section>
      <div className="rw-task-grid">
        <article className="card rw-coach-panel">
          <div className="rw-coach-panel-heading"><CheckCircle2 size={18}/><h3>Demonstrated strengths</h3></div>
          {result.guidance.demonstratedStrengths.length ? <ul>{result.guidance.demonstratedStrengths.map((text,i)=><li key={i}>{text}</li>)}</ul> : <p className="muted">No eligible published passing results yet. Once an authorized review publishes an eligible passing result, it can support verified strengths here.</p>}
        </article>
        <article className="card rw-coach-panel">
          <div className="rw-coach-panel-heading"><TrendingUp size={18}/><h3>Growth opportunities</h3></div>
          <ul>{result.guidance.growthAreas.map((text,i)=><li key={i}>{text}</li>)}</ul>
        </article>
      </div>
      <section className="card rw-coach-panel">
        <div className="rw-coach-panel-heading"><Target size={18}/><h3>Your next steps</h3></div>
        <ol className="rw-coach-steps">{result.guidance.nextSteps.map((step,i)=><li key={i}>{step}</li>)}</ol>
      </section>
      <section className="card rw-coach-panel">
        <div className="rw-section-head"><div className="rw-coach-panel-heading"><BookOpen size={18}/><h3>Practice on Ready For Work</h3></div><Link className="rw-text-link" href="/tasks">Browse all challenges →</Link></div>
        {result.recommendedChallenges.length ? <div className="rw-coach-challenges">{result.recommendedChallenges.map(t=><article key={t.id} className="rw-coach-challenge">
          <span className="tag">{t.concept}</span><h4>{t.title}</h4>
          <p className="muted">{t.difficulty} · <Clock3 size={12} style={{display:"inline"}}/> {Math.round(t.durationSeconds/60)} min</p>
          <Link className="rw-text-link" href={`/assessment/${encodeURIComponent(t.id)}`}>
            {t.alreadyStarted?"View existing attempt":"Explore challenge"} <ArrowRight size={13} style={{display:"inline"}}/>
          </Link>
        </article>)}</div> : <div className="rw-empty">No published challenges available to recommend right now.</div>}
        <small className="muted">Challenge access follows your current plan, preflight and one-attempt-per-task policy. Questions are never revealed here.</small>
      </section>
    </div>}
  </div>;
}
