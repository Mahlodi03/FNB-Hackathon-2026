"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrainCircuit, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import Editor from "@monaco-editor/react";
import { useIntegrityMonitor } from "@/features/integrity/useIntegrityMonitor";

type Session = { attemptId: string; expiresAt: string };
type TaskSummary = {
  id: string;
  title: string;
  concept: string;
  difficulty: string;
  durationSeconds: number;
};
type ChallengePrompts = { theoryPrompt: string; practicalPrompt: string };
type GradeResult = {
  overallScore: number;
  passed: boolean;
  feedback: string;
  strengths: string[];
  improvements: string[];
  published: boolean;
  reviewRecommended?: boolean;
};

type ApiReply = {
  error?: string;
  theoryPrompt?: string;
  practicalPrompt?: string;
  attemptId?: string;
  expiresAt?: string;
  question?: string;
  overallScore?: number;
  passed?: boolean;
  feedback?: string;
  strengths?: string[];
  improvements?: string[];
  published?: boolean;
  reviewRecommended?: boolean;
};

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

async function readReply(response: Response): Promise<ApiReply> {
  const value: unknown = await response.json().catch(() => null);
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ApiReply)
    : {};
}

function message(reply: ApiReply, fallback: string) {
  return typeof reply.error === "string" ? reply.error : fallback;
}

export function AssessmentPreview({ task }: { task: TaskSummary }) {
  const [session, setSession] = useState<Session | null>(null);
  const [prompts, setPrompts] = useState<ChallengePrompts | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [now, setNow] = useState(0);
  const [theory, setTheory] = useState("");
  const [code, setCode] = useState("");
  const [answersRequested, setAnswersRequested] = useState(false);
  const [question, setQuestion] = useState<string | null>(null);
  const [understandingAnswer, setUnderstandingAnswer] = useState("");
  const [submissionStarted, setSubmissionStarted] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [starting, setStarting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [monitorNotice, setMonitorNotice] = useState<string | null>(null);

  // Person 4's actual monitoring implementation, not a mock.
  // The attempt ID comes only from our authenticated start endpoint.
  const monitor = useIntegrityMonitor({
    attemptId: session?.attemptId,
    strictScreenMode: false,
  });

  useEffect(() => {
    if (!session || result) return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [session, result]);

  // A successful grade ends local camera monitoring.
  useEffect(() => {
    if (result) monitor.stop();
  }, [result, monitor.stop]);

  const secondsLeft = session
    ? Math.max(0, Math.ceil((Date.parse(session.expiresAt) - now) / 1000))
    : task.durationSeconds;
  const expired = !!session && secondsLeft === 0;
  const preflightReady = monitor.status === "ready";
  const editorLanguage = /\bsql\b|database/i.test(`${task.concept} ${task.title}`)
    ? "sql"
    : /python/i.test(`${task.concept} ${task.title}`)
      ? "python"
      : "javascript";

  async function loadStartedChallenge(attemptId: string) {
    setRevealing(true);
    setRevealError(null);
    try {
      const response = await fetch(
        `/api/attempts/${encodeURIComponent(attemptId)}/challenge`,
        { credentials: "same-origin", cache: "no-store" }
      );
      const reply = await readReply(response);
      if (!response.ok) {
        setRevealError(message(reply, "Unable to load your started challenge. Retry while your timer runs."));
        return;
      }
      if (
        typeof reply.theoryPrompt !== "string" || !reply.theoryPrompt.trim() ||
        typeof reply.practicalPrompt !== "string" || !reply.practicalPrompt.trim()
      ) {
        setRevealError("The challenge was started, but its questions could not be loaded.");
        return;
      }
      setPrompts({ theoryPrompt: reply.theoryPrompt, practicalPrompt: reply.practicalPrompt });
    } catch {
      setRevealError("Connection interrupted. Your timer is running; retry loading the questions.");
    } finally {
      setRevealing(false);
    }
  }

  async function handleStart() {
    if (session || !preflightReady || !monitor.rulesAccepted || starting) return;
    setStarting(true);
    setStartError(null);
    try {
      const response = await fetch("/api/attempts/start", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, rulesAccepted: true }),
      });
      const reply = await readReply(response);
      if (!response.ok) {
        setStartError(message(reply, "Unable to start assessment"));
        return;
      }
      if (
        typeof reply.attemptId !== "string" ||
        typeof reply.expiresAt !== "string" ||
        !Number.isFinite(Date.parse(reply.expiresAt))
      ) {
        setStartError("Unexpected start response. Do not try another task attempt; contact the assessor.");
        return;
      }
      setNow(Date.now());
      setSession({ attemptId: reply.attemptId, expiresAt: reply.expiresAt });
      // Reveal prompts only after the database confirms an active timed attempt.
      await loadStartedChallenge(reply.attemptId);
    } catch {
      setStartError("Network error. Your attempt may have started; contact the assessor before retrying.");
    } finally {
      setStarting(false);
    }
  }

  async function handleQuestion() {
    if (!session || generating || question || expired || !theory.trim() || !code.trim()) return;
    // The server locks the answers on first request. Freeze the local inputs too,
    // including when a network error makes the outcome uncertain.
    setAnswersRequested(true);
    setGenerating(true);
    setQuestionError(null);
    try {
      const response = await fetch(
        `/api/attempts/${encodeURIComponent(session.attemptId)}/understanding`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theoryAnswer: theory, practicalAnswer: code }),
        }
      );
      const reply = await readReply(response);
      if (!response.ok) {
        setQuestionError(message(reply, "Unable to generate question; retry with the saved answers"));
        return;
      }
      if (typeof reply.question !== "string" || !reply.question.trim()) {
        setQuestionError("Question response missing; please retry.");
        return;
      }
      setQuestion(reply.question);
    } catch {
      setQuestionError("Connection interrupted. Your answers may be saved; retry without editing them.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit() {
    if (!session || !question || submitting || !understandingAnswer.trim()) return;
    if (expired && !submissionStarted) return;
    // Once submitted, the student's answer must not change between retries.
    setSubmissionStarted(true);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch(
        `/api/attempts/${encodeURIComponent(session.attemptId)}/submit`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ understandingAnswer }),
        }
      );
      const reply = await readReply(response);
      if (!response.ok) {
        setSubmitError(message(reply, "Submission saved or pending; retry grading with the same answer"));
        return;
      }
      if (
        typeof reply.overallScore !== "number" ||
        typeof reply.passed !== "boolean" ||
        typeof reply.feedback !== "string" ||
        typeof reply.published !== "boolean"
      ) {
        setSubmitError("Unexpected grade response. Please retry to retrieve your saved result.");
        return;
      }
      setResult({
        overallScore: reply.overallScore,
        passed: reply.passed,
        feedback: reply.feedback,
        strengths: Array.isArray(reply.strengths) ? reply.strengths : [],
        improvements: Array.isArray(reply.improvements) ? reply.improvements : [],
        published: reply.published,
        reviewRecommended: reply.reviewRecommended,
      });
    } catch {
      setSubmitError("Connection interrupted. Retry using your original submitted answer.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStopMonitoring() {
    // Voluntarily stopping during an attempt is reported as a technical
    // permission interruption for private review, never an accusation.
    if (session && monitor.status === "ready") {
      try {
        const response = await fetch(
          `/api/attempts/${encodeURIComponent(session.attemptId)}/events`,
          {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventType: "permission_lost",
              occurredAt: new Date().toISOString(),
            }),
          }
        );
        if (!response.ok) throw new Error("Event not saved");
      } catch {
        setMonitorNotice("Monitoring stopped, but the interruption could not be reported. Contact your assessor.");
      }
    }
    monitor.stop();
  }

  const step = result ? 3 : !session ? 0 : question ? 2 : 1;
  return (
    <div className="rw-assessment-frame">
      <div className="rw-assessment-bar">
        <div className="rw-steps" aria-label="Assessment progress">
          {[
            "Preflight", "Theory & practical", "AI follow-up", "Your result",
          ].map((name, index) => (
            <span key={name} className={`rw-step ${index === step ? "current" : index < step ? "done" : ""}`}
              aria-current={index === step ? "step" : undefined}>
              {index < step ? "✓ " : `${index + 1}. `}{name}
            </span>
          ))}
        </div>
        <div className={`rw-timer ${expired ? "expired" : ""}`} aria-live="off">
          <Clock3 size={18}/>
          <span>{session ? "Time left" : "Time limit"}: {formatTime(secondsLeft)}</span>
        </div>
      </div>

      <div className="rw-assessment-columns">
        <div className="rw-assessment-main">
          {!session && (
            <section className="card" aria-labelledby="preflight-title">
              <span className="rw-question-number">BEFORE YOU BEGIN</span>
              <h2 id="preflight-title">Camera and browser preflight</h2>
              <p className="muted" style={{fontSize:13,lineHeight:1.7}}>
                A desktop or laptop, camera permission, a secure connection and fullscreen are required.
                You'll have {Math.round(task.durationSeconds / 60)} minutes once your attempt is created.
              </p>
              <div className="rw-assessment-note" style={{marginBottom:17}}>
                The camera preview stays on your device. No video, frames, audio or microphone recordings
                are uploaded. Tab changes, focus changes, copy/paste and interruptions may be recorded
                for private review. These signals do not establish misconduct.
              </div>
              <label style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:19}}>
                <input type="checkbox" style={{width:16,marginTop:3}} checked={monitor.rulesAccepted}
                  onChange={event=>monitor.setRulesAccepted(event.target.checked)}
                  disabled={monitor.status === "checking" || preflightReady}/>
                <span>I accept the assessment rules and privacy notice.</span>
              </label>
              {!preflightReady && <button className="button" type="button"
                disabled={!monitor.rulesAccepted || monitor.status === "checking"}
                onClick={()=>void monitor.startPreflight()}>
                {monitor.status === "checking" ? "Checking camera and fullscreen…" : "Run camera and fullscreen preflight"}
              </button>}
              {preflightReady && <>
                <div className="rw-status-banner" style={{marginBottom:16}}><CheckCircle2 size={19}/><div><strong>Preflight ready</strong><div style={{fontSize:12,marginTop:4}}>You can start your assessment. The timer starts only when your attempt is created.</div></div></div>
                <button className="button" disabled={starting} onClick={()=>void handleStart()} type="button">
                  {starting ? "Creating assessment…" : "Start assessment →"}
                </button>
              </>}
              {startError && <p role="alert" className="rw-alert" style={{marginTop:12}}>{startError}</p>}
              <p className="muted" style={{fontSize:11,margin:"16px 0 0"}}>Each student may attempt a task only once. Keep this page open until grading finishes.</p>
            </section>
          )}

          {session && !result && !prompts && <section className="card" aria-live="polite">
            <span className="rw-question-number">ATTEMPT STARTED</span>
            <h2>Loading your sealed questions</h2>
            <p className="muted">Your timer is running. Your questions are being retrieved for this authenticated attempt.</p>
            {revealError && <p role="alert" className="rw-alert">{revealError}</p>}
            <button className="button" type="button" disabled={revealing || expired}
              onClick={() => void loadStartedChallenge(session.attemptId)}>
              {revealing ? "Loading questions…" : "Retry loading questions"}
            </button>
          </section>}

          {session && prompts && !result && !question && <>
            <section className="card">
              <span className="rw-question-number">SECTION 01 · THEORY</span>
              <h2>Explain your understanding</h2>
              <p className="rw-question-prompt">{prompts.theoryPrompt}</p>
              <label htmlFor="theory-answer" style={{marginTop:17,marginBottom:7}}>Your explanation</label>
              <textarea id="theory-answer" rows={7} maxLength={15_000} value={theory}
                onChange={event=>setTheory(event.target.value)} disabled={answersRequested || expired}
                placeholder="Explain the core concept and the reasoning behind your approach…"/>
              <div className="muted" style={{fontSize:11,textAlign:"right",marginTop:5}}>{theory.length.toLocaleString()} / 15,000</div>
            </section>
            <section className="card">
              <span className="rw-question-number">SECTION 02 · PRACTICAL</span>
              <h2>Put your skills into practice</h2>
              <p className="rw-question-prompt">{prompts.practicalPrompt}</p>
              <div className="rw-practical-editor" style={{marginTop:17}}>
                <div className="rw-editor-heading"><span>Code editor</span><span>{editorLanguage.toUpperCase()} · Not executed</span></div>
                <Editor height="360px" language={editorLanguage} theme="vs" value={code}
                  onChange={value=>setCode((value??"").slice(0,40_000))}
                  options={{minimap:{enabled:false},fontSize:14,readOnly:answersRequested || expired,scrollBeyondLastLine:false,automaticLayout:true}}/>
              </div>
              <p className="muted" style={{fontSize:11,margin:"9px 0 16px"}}>Your code is evaluated by the rubric and AI-assisted grader; this editor does not run or compile code.</p>
              <button className="button" type="button" disabled={expired || generating || !theory.trim() || !code.trim()}
                onClick={()=>void handleQuestion()}>
                {generating ? "Saving answers and generating follow-up…" : answersRequested ? "Retry generating follow-up" : "Lock answers and continue →"}
              </button>
              {answersRequested && <p className="muted" style={{fontSize:11,marginTop:9}}>Your original answers are locked. Retrying uses the saved answers.</p>}
              {questionError && <p role="alert" className="rw-alert" style={{marginTop:12}}>{questionError}</p>}
            </section>
          </>}

          {session && !result && question && <section className="card">
            <span className="rw-question-number">SECTION 03 · UNDERSTANDING</span>
            <h2>Explain your decision</h2>
            <div className="rw-status-banner" style={{marginBottom:17}}><BrainCircuit size={20}/><div><strong>Personalized follow-up</strong><div style={{fontSize:12,marginTop:4}}>This question is based on your saved theory and practical answers.</div></div></div>
            <p className="rw-question-prompt">{question}</p>
            <label htmlFor="understanding-answer" style={{margin:"17px 0 7px"}}>Your answer</label>
            <textarea id="understanding-answer" rows={8} maxLength={15_000} value={understandingAnswer}
              onChange={event=>setUnderstandingAnswer(event.target.value)} disabled={submissionStarted || expired}
              placeholder="Describe the choices you made and explain your reasoning…"/>
            <div className="muted" style={{fontSize:11,textAlign:"right",marginTop:5}}>{understandingAnswer.length.toLocaleString()} / 15,000</div>
            <button className="button" type="button" style={{marginTop:15}}
              disabled={submitting || !understandingAnswer.trim() || (expired && !submissionStarted)}
              onClick={()=>void handleSubmit()}>
              {submitting ? "Saving submission and grading…" : submissionStarted ? "Retry grading / retrieve result" : "Submit assessment for grading →"}
            </button>
            {submitError && <p role="alert" className="rw-alert" style={{marginTop:12}}>{submitError}</p>}
          </section>}

          {session && expired && !result && !submissionStarted && <div className="rw-alert" role="alert">
            The assessment deadline has passed. New submissions cannot be accepted by the server.
          </div>}

          {result && <section className="card" aria-live="polite">
            <span className="rw-question-number">YOUR ASSESSMENT RESULT</span>
            <h2 style={{fontSize:22,marginBottom:17}}>{result.passed ? "Assessment passed" : "Keep practicing"}</h2>
            <div className="rw-score">{result.overallScore.toFixed(1)}%</div>
            <p className="rw-score-sub">AI-assisted overall score · {result.passed ? "Pass mark achieved" : "Pass mark not achieved"}</p>
            <div className="rw-status-banner" style={{margin:"22px 0"}}><ShieldCheck size={20}/><div>
              <strong>{result.published ? "Published result" : result.reviewRecommended ? "Pending private integrity review" : "Not currently published"}</strong>
              <div style={{fontSize:12,marginTop:5}}>{result.published
                ? "This eligible result can appear on your public profile, subject to your privacy settings."
                : "This result is not visible to employers. Browser signals are not proof of misconduct."}</div>
            </div></div>
            <h3>Feedback</h3><p className="muted" style={{lineHeight:1.7}}>{result.feedback}</p>
            {!!result.strengths.length && <div style={{marginTop:16}}><h3>What went well</h3><ul>{result.strengths.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
            {!!result.improvements.length && <div style={{marginTop:16}}><h3>Areas to improve</h3><ul>{result.improvements.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
            <p className="muted" style={{fontSize:11,marginTop:20}}>Grades are AI-assisted and provisional. An authorized assessor may review them.</p>
            <Link href="/progress" className="button secondary">View my progress</Link>
          </section>}
        </div>

        <aside className="rw-assessment-aside" aria-label="Assessment monitoring and information">
          <div className="card">
            <div className="rw-section-head"><h2>Assessment integrity</h2><ShieldCheck size={19} color="#623bd5"/></div>
            {!result && <>
              <video ref={monitor.videoRef} autoPlay muted playsInline aria-label="Local-only live camera preview"
                className="rw-monitor-video" style={{display:preflightReady ? "block" : "none"}}/>
              {!preflightReady && <div className="rw-assessment-note">Run preflight to enable the local camera preview. Video and audio are not uploaded.</div>}
              <p className="rw-status-line" role="status" style={{margin:"11px 0"}}>
                <span className="rw-dot" style={{background:preflightReady ? "#1eaa7b" : "#e8a648"}}/>
                Monitoring: {monitor.status}{session && preflightReady ? " · Active attempt" : ""}
              </p>
              {monitor.eventCount != null && <p className="muted" style={{fontSize:11}}>{monitor.eventCount} browser signal(s) stored for private review.</p>}
              {preflightReady && <button className="button secondary" style={{width:"100%"}} type="button" onClick={()=>void handleStopMonitoring()}>Stop camera and monitoring</button>}
              {monitor.notice && <p className="rw-alert" role="alert" style={{marginTop:11}}>{monitor.notice}</p>}
              {monitorNotice && <p className="rw-alert" role="alert" style={{marginTop:11}}>{monitorNotice}</p>}
              {session && !preflightReady && <p className="rw-alert" role="alert" style={{marginTop:11}}>Monitoring is not active. Restore preflight if possible and inform the assessor. Saved answers remain available.</p>}
            </>}
            {result && <p className="muted" style={{fontSize:12}}>Camera monitoring has ended with your grading result.</p>}
          </div>
          <div className="card">
            <h2>Assessment guidance</h2>
            <div className="rw-assessment-note">
              <strong>Privacy-first monitoring</strong><div style={{marginTop:6}}>Browser events may be logged privately. No camera footage or microphone recordings are uploaded.</div>
            </div>
            <p className="muted" style={{fontSize:11,margin:"13px 0 0"}}>Second-screen detection is experimental and optional. Screen capability: {monitor.screenCapability}.</p>
            <p className="muted" style={{fontSize:11,margin:"8px 0 0"}}>Keep this page open until your result is saved. Refresh recovery is not supported yet.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
