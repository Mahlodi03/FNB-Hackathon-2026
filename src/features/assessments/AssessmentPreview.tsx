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
  resumed?: boolean;
  question?: string;
  overallScore?: number;
  passed?: boolean;
  feedback?: string;
  strengths?: string[];
  improvements?: string[];
  published?: boolean;
  reviewRecommended?: boolean;
};
type RecoveryReply = {
  error?: string;
  attempt?: {
    attemptId: string;
    status: string;
    expiresAt: string;
    expired: boolean;
  } | null;
  theoryAnswer?: string;
  practicalAnswer?: string;
  understandingQuestion?: string | null;
  understandingAnswer?: string;
  answersLocked?: boolean;
  result?: GradeResult | null;
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
  const [recoveryChecking, setRecoveryChecking] = useState(true);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveredActive, setRecoveredActive] = useState(false);
  const [recoveryExpired, setRecoveryExpired] = useState(false);
  const [recoveryInvalidated, setRecoveryInvalidated] = useState(false);
  const [recoverySubmitted, setRecoverySubmitted] = useState(false);
  const [connectionEpoch, setConnectionEpoch] = useState(0);
  const [draftStatus, setDraftStatus] = useState<string | null>(null);

  // Person 4's actual monitoring implementation, not a mock.
  // The attempt ID comes only from our authenticated start endpoint.
  const monitor = useIntegrityMonitor({
    attemptId: session?.attemptId,
    strictScreenMode: false,
  });
  const preflightReady = monitor.status === "ready";
  const secondsLeft = session
    ? Math.max(0, Math.ceil((Date.parse(session.expiresAt) - now) / 1000))
    : task.durationSeconds;
  const expired = !!session && secondsLeft === 0;

  async function checkRecovery() {
    setRecoveryChecking(true);
    setRecoveryError(null);
    try {
      const response = await fetch(`/api/attempts/recovery?taskId=${encodeURIComponent(task.id)}`, {
        credentials: "same-origin", cache: "no-store",
      });
      const reply: RecoveryReply = await response.json();
      if (!response.ok) throw new Error(reply.error || "Unable to look up your saved attempt");
      const prior = reply.attempt;
      if (!prior) return;
      if (!Number.isFinite(Date.parse(prior.expiresAt))) {
        throw new Error("Your saved attempt has an invalid deadline. Contact the assessor.");
      }
      setNow(Date.now());
      setSession({ attemptId: prior.attemptId, expiresAt: prior.expiresAt });
      setTheory(reply.theoryAnswer ?? "");
      setCode(reply.practicalAnswer ?? "");
      setUnderstandingAnswer(reply.understandingAnswer ?? "");
      setAnswersRequested(Boolean(reply.answersLocked));
      setQuestion(reply.understandingQuestion ?? null);
      setRecoveredActive(prior.status === "in_progress" || prior.status === "awaiting_understanding");
      setRecoveryExpired(prior.expired && (prior.status === "in_progress" || prior.status === "awaiting_understanding"));
      setRecoveryInvalidated(prior.status === "invalidated");
      setRecoverySubmitted(prior.status === "submitted");
      if (prior.status === "submitted") {
        setSubmissionStarted(true);
        setRecoveredActive(false);
      }
      if (prior.status === "graded") {
        setRecoveredActive(false);
        if (reply.result) setResult(reply.result);
        else setRecoveryError("Your attempt was graded, but the result could not be loaded. Contact your assessor.");
      }
    } catch (error) {
      setRecoveryError(error instanceof Error ? error.message : "Unable to check for an existing attempt");
    } finally {
      setRecoveryChecking(false);
    }
  }

  // On each page load, check the server before showing any Start button.
  // A missing/failed response never authorizes a new attempt.
  useEffect(() => { void checkRecovery(); }, [task.id]);

  // Recovery requires the student to re-establish camera/fullscreen before
  // obtaining sealed prompts. No new assessment is created or timer restarted.
  useEffect(() => {
    if (!recoveredActive || recoveryChecking || !session || !preflightReady ||
        recoveryExpired || recoveryInvalidated || question || prompts || revealing || revealError) return;
    void loadStartedChallenge(session.attemptId);
  }, [recoveredActive, recoveryChecking, session?.attemptId, preflightReady,
      recoveryExpired, recoveryInvalidated, question, prompts, revealing, revealError]);

  // A tab that stays open through a connection outage retries its current draft
  // after the browser reports that connectivity has returned.
  useEffect(() => {
    const onOnline = () => setConnectionEpoch(value => value + 1);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  // Only autosave *editable drafts*. Original answers remain immutable once locked.
  // Brief changes immediately before a crash might not reach the server.
  useEffect(() => {
    if (!session || !preflightReady || expired || result || recoveryChecking ||
        recoveryExpired || recoveryInvalidated) return;
    let payload: object;
    if (question && !submissionStarted) {
      payload = { stage: "understanding", understandingDraft: understandingAnswer };
    } else if (!question && !answersRequested) {
      // Save empty strings too: deleting all text must clear an older saved draft.
      payload = { stage: "initial", theoryDraft: theory, practicalDraft: code };
    } else return;
    let active = true;
    setDraftStatus("Saving draft…");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/attempts/${encodeURIComponent(session.attemptId)}/draft`, {
          method: "PATCH", credentials: "same-origin", cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Save rejected");
        if (active) setDraftStatus("Draft saved to Supabase");
      } catch {
        if (active) setDraftStatus("Draft not saved — check connection before continuing");
      }
    }, 1200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [session?.attemptId, theory, code, understandingAnswer, question,
      answersRequested, submissionStarted, preflightReady, expired, result,
      recoveryChecking, recoveryExpired, recoveryInvalidated, connectionEpoch]);

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
      if (reply.resumed) {
        await checkRecovery();
      } else {
        await loadStartedChallenge(reply.attemptId);
      }
    } catch {
      setStartError("Network error. Checking whether your assessment was already started…");
      await checkRecovery();
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
          {recoveryChecking && <section className="card" role="status">
            <h2>Checking for an existing attempt…</h2>
            <p className="muted">We will not start a second timer.</p>
          </section>}
          {recoveryError && <section className="card" role="alert">
            <h2>Unable to check your assessment</h2>
            <p className="rw-alert">{recoveryError}</p>
            <button className="button" type="button" onClick={() => void checkRecovery()}>Retry recovery check</button>
          </section>}
          {!recoveryChecking && !recoveryError && recoveryExpired && <section className="card" role="alert">
            <h2>Your timed attempt has expired</h2>
            <p className="muted">Your original deadline cannot be restarted or extended by refreshing.</p>
            <Link href="/progress" className="button secondary">View my progress</Link>
          </section>}
          {!recoveryChecking && !recoveryError && recoveryInvalidated && <section className="card" role="alert">
            <h2>This attempt is closed</h2><p className="muted">Contact the assessment organizer if you need assistance.</p>
          </section>}
          {!recoveryChecking && !recoveryError && !recoveryExpired && !recoveryInvalidated &&
           (!session || (recoveredActive && !preflightReady)) && (
            <section className="card" aria-labelledby="preflight-title">
              <span className="rw-question-number">{session ? "RESUME EXISTING ATTEMPT" : "BEFORE YOU BEGIN"}</span>
              <h2 id="preflight-title">{session ? "Restore camera and fullscreen" : "Camera and browser preflight"}</h2>
              <p className="muted" style={{fontSize:13,lineHeight:1.7}}>
                A desktop or laptop, camera permission, a secure connection and fullscreen are required.
                {session ? "Your original timer continues while you restore preflight. No new attempt will be created."
                  : `You'll have ${Math.round(task.durationSeconds / 60)} minutes once your attempt is created.`}
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
                <div className="rw-status-banner" style={{marginBottom:16}}><CheckCircle2 size={19}/><div><strong>Preflight ready</strong><div style={{fontSize:12,marginTop:4}}>{session ? "Restoring saved answers and questions now." : "The timer begins when your attempt is created."}</div></div></div>
                {!session && <button className="button" disabled={starting} onClick={()=>void handleStart()} type="button">
                  {starting ? "Creating assessment…" : "Start assessment →"}
                </button>}
              </>}
              {startError && <p role="alert" className="rw-alert" style={{marginTop:12}}>{startError}</p>}
              <p className="muted" style={{fontSize:11,margin:"16px 0 0"}}>Each task has one attempt per student. After a refresh, recovery uses the original attempt and deadline.</p>
            </section>
          )}

          {session && !result && !recoveryExpired && !recoveryInvalidated &&
           !recoveryChecking && !recoveryError && preflightReady && !prompts && !question && <section className="card" aria-live="polite">
            <span className="rw-question-number">ATTEMPT STARTED</span>
            <h2>Loading your sealed questions</h2>
            <p className="muted">Your timer is running. Your questions are being retrieved for this authenticated attempt.</p>
            {revealError && <p role="alert" className="rw-alert">{revealError}</p>}
            <button className="button" type="button" disabled={revealing || expired}
              onClick={() => void loadStartedChallenge(session.attemptId)}>
              {revealing ? "Loading questions…" : "Retry loading questions"}
            </button>
          </section>}

          {session && recoveredActive && preflightReady && !recoveryExpired && !result && <div className="rw-status-banner" role="status" style={{marginBottom:14}}>
            Existing assessment restored. The original deadline is unchanged; please continue where you left off.
          </div>}

          {session && preflightReady && prompts && !result && !question && !recoveryExpired && <>
            <section className="card">
              <span className="rw-question-number">SECTION 01 · THEORY</span>
              <h2>Explain your understanding</h2>
              <p className="rw-question-prompt">{prompts.theoryPrompt}</p>
              <label htmlFor="theory-answer" style={{marginTop:17,marginBottom:7}}>Your explanation</label>
              <textarea id="theory-answer" rows={7} maxLength={15_000} value={theory}
                onChange={event=>setTheory(event.target.value)} disabled={answersRequested || expired}
                placeholder="Explain the core concept and the reasoning behind your approach…"/>
              <div className="muted" style={{fontSize:11,textAlign:"right",marginTop:5}}>{theory.length.toLocaleString()} / 15,000</div>
              {draftStatus && <p role="status" className="muted" style={{fontSize:12,marginTop:7}}>{draftStatus}</p>}
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

          {/* An active assessment must restore preflight before showing its follow-up.
              A server-confirmed submitted attempt can retry grading after expiry. */}
          {session && !result && question && !recoveryExpired && !recoveryInvalidated &&
           !recoveryChecking && !recoveryError && (preflightReady || recoverySubmitted) && <section className="card">
            {submissionStarted && <div className="rw-status-banner" role="status" style={{marginBottom:12}}>
              Your answer was already submitted. You can retry grading without changing it, even if the timer has expired.
            </div>}
            <span className="rw-question-number">SECTION 03 · UNDERSTANDING</span>
            <h2>Explain your decision</h2>
            <div className="rw-status-banner" style={{marginBottom:17}}><BrainCircuit size={20}/><div><strong>Personalized follow-up</strong><div style={{fontSize:12,marginTop:4}}>This question is based on your saved theory and practical answers.</div></div></div>
            <p className="rw-question-prompt">{question}</p>
            <label htmlFor="understanding-answer" style={{margin:"17px 0 7px"}}>Your answer</label>
            <textarea id="understanding-answer" rows={8} maxLength={15_000} value={understandingAnswer}
              onChange={event=>setUnderstandingAnswer(event.target.value)} disabled={submissionStarted || expired}
              placeholder="Describe the choices you made and explain your reasoning…"/>
            <div className="muted" style={{fontSize:11,textAlign:"right",marginTop:5}}>{understandingAnswer.length.toLocaleString()} / 15,000</div>
            {draftStatus && !submissionStarted && <p role="status" className="muted" style={{fontSize:12,marginTop:7}}>{draftStatus}</p>}
            <button className="button" type="button" style={{marginTop:15}}
              disabled={submitting || !understandingAnswer.trim() || (expired && !submissionStarted)}
              onClick={()=>void handleSubmit()}>
              {submitting ? "Saving submission and grading…" : submissionStarted ? "Retry grading / retrieve result" : "Submit assessment for grading →"}
            </button>
            {submitError && <p role="alert" className="rw-alert" style={{marginTop:12}}>{submitError}</p>}
          </section>}

          {session && expired && !result && !submissionStarted && !recoveryExpired && <div className="rw-alert" role="alert">
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
              {!preflightReady && !submissionStarted && <div className="rw-assessment-note">Run preflight to enable the local camera preview. Video and audio are not uploaded.</div>}
              {!preflightReady && submissionStarted && <div className="rw-assessment-note">Your submission was already saved. You can retry grading without reopening camera monitoring.</div>}
              <p className="rw-status-line" role="status" style={{margin:"11px 0"}}>
                <span className="rw-dot" style={{background:preflightReady ? "#1eaa7b" : "#e8a648"}}/>
                Monitoring: {monitor.status}{session && preflightReady ? " · Active attempt" : ""}
              </p>
              {monitor.eventCount != null && <p className="muted" style={{fontSize:11}}>{monitor.eventCount} browser signal(s) stored for private review.</p>}
              {preflightReady && <button className="button secondary" style={{width:"100%"}} type="button" onClick={()=>void handleStopMonitoring()}>Stop camera and monitoring</button>}
              {monitor.notice && <p className="rw-alert" role="alert" style={{marginTop:11}}>{monitor.notice}</p>}
              {monitorNotice && <p className="rw-alert" role="alert" style={{marginTop:11}}>{monitorNotice}</p>}
              {session && !preflightReady && !submissionStarted && !result && !recoveryExpired && <p className="rw-alert" role="alert" style={{marginTop:11}}>Monitoring is not active. Restore preflight if possible and inform the assessor. Saved answers remain available.</p>}
            </>}
            {result && <p className="muted" style={{fontSize:12}}>Camera monitoring has ended with your grading result.</p>}
          </div>
          <div className="card">
            <h2>Assessment guidance</h2>
            <div className="rw-assessment-note">
              <strong>Privacy-first monitoring</strong><div style={{marginTop:6}}>Browser events may be logged privately. No camera footage or microphone recordings are uploaded.</div>
            </div>
            <p className="muted" style={{fontSize:11,margin:"13px 0 0"}}>Second-screen detection is experimental and optional. Screen capability: {monitor.screenCapability}.</p>
            <p className="muted" style={{fontSize:11,margin:"8px 0 0"}}>Draft answers autosave while you work. After a refresh, sign in to the same account and repeat camera/fullscreen preflight. The original countdown continues.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
