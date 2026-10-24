"use client";

import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import type { Task } from "@/contracts/domain";
import { useIntegrityMonitor } from "@/features/integrity/useIntegrityMonitor";

type Session = { attemptId: string; expiresAt: string };
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

export function AssessmentPreview({ task }: { task: Task }) {
  const [session, setSession] = useState<Session | null>(null);
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

  return (
    <div className="card" style={{ display: "grid", gap: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span className="tag">{result ? "Assessment graded" : session ? "Assessment in progress" : "Preflight required"}</span>
        <strong aria-live="off" style={{ fontSize: 18, color: expired ? "#ef4444" : "inherit" }}>
          {session ? "Time remaining" : "Time limit"}: {formatTime(secondsLeft)}
        </strong>
      </div>

      {!result && (
        <section aria-label="Assessment integrity" style={{ display: "grid", gap: 12 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Camera and browser preflight</h2>
          <p className="muted">
            Desktop or laptop, HTTPS/localhost, camera permission and full-screen are required.
            The camera preview stays on this device: no video, frames, audio or microphone data
            are uploaded. Tab hiding, window changes, copy/paste and camera interruptions may be
            logged for private review. These signals do not prove misconduct.
          </p>
          <p className="muted" style={{ fontSize: 13 }}>
            Second-screen detection is limited and experimental. Screen permission is optional.
            Screen capability: {monitor.screenCapability}.
          </p>
          {!session && (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <input
                type="checkbox"
                checked={monitor.rulesAccepted}
                onChange={(event) => monitor.setRulesAccepted(event.target.checked)}
                disabled={monitor.status === "checking" || preflightReady}
              />
              <span>I accept the assessment rules, camera-only preflight and privacy notice.</span>
            </label>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {!preflightReady && monitor.status !== "checking" && (
              <button className="button" type="button" disabled={!monitor.rulesAccepted} onClick={() => void monitor.startPreflight()}>
                Run camera and full-screen preflight
              </button>
            )}
            {preflightReady && (
              <button className="button secondary" type="button" onClick={() => void handleStopMonitoring()}>
                Stop camera and monitoring
              </button>
            )}
          </div>
          <video
            ref={monitor.videoRef}
            autoPlay
            muted
            playsInline
            aria-label="Local camera preview"
            style={{ width: "100%", maxWidth: 340, aspectRatio: "4 / 3", objectFit: "cover", background: "#04131d", borderRadius: 10, display: preflightReady ? "block" : "none" }}
          />
          <p className="muted" role="status">
            Preflight: {monitor.status}.
            {preflightReady && session ? " Monitoring is active for this attempt." : ""}
            {monitor.eventCount !== null ? ` ${monitor.eventCount} event(s) stored.` : ""}
          </p>
          {monitor.notice && <p role="alert">{monitor.notice}</p>}
          {monitorNotice && <p role="alert">{monitorNotice}</p>}
          {session && !preflightReady && (
            <p role="alert" style={{ color: "#ef4444" }}>
              Monitoring is not active. Restore preflight if possible and inform the assessor of any interruption.
              Your saved assessment answers remain yours to submit.
            </p>
          )}
        </section>
      )}

      {!session && (
        <section style={{ display: "grid", gap: 12 }}>
          <p className="muted">The timer starts only after the server creates your attempt. You can attempt each task only once. Keep this page open during your assessment.</p>
          <button className="button" type="button" disabled={!preflightReady || starting} onClick={() => void handleStart()}>
            {starting ? "Starting assessment..." : "Start assessment"}
          </button>
          {startError && <p role="alert" style={{ color: "#ef4444" }}>{startError}</p>}
        </section>
      )}

      {session && !result && !question && (
        <section style={{ display: "grid", gap: 16 }}>
          <label style={{ display: "grid", gap: 8 }}>
            <strong>1. Theory: {task.theoryPrompt}</strong>
            <textarea
              rows={6}
              maxLength={15_000}
              value={theory}
              onChange={(event) => setTheory(event.target.value)}
              disabled={answersRequested || expired}
              placeholder="Explain your approach"
            />
          </label>
          <div style={{ display: "grid", gap: 8 }}>
            <strong>2. Practical: {task.practicalPrompt}</strong>
            <div style={{ border: "1px solid #334155", borderRadius: 8, overflow: "hidden" }}>
              <Editor
                height="320px"
                language={editorLanguage}
                theme="vs-dark"
                value={code}
                onChange={(value) => setCode((value ?? "").slice(0, 40_000))}
                options={{ minimap: { enabled: false }, fontSize: 14, readOnly: answersRequested || expired }}
              />
            </div>
          </div>
          <button
            className="button"
            type="button"
            disabled={expired || generating || !theory.trim() || !code.trim()}
            onClick={() => void handleQuestion()}
          >
            {generating ? "Saving answers and generating question..." : answersRequested ? "Retry understanding question" : "Lock answers and continue"}
          </button>
          {questionError && <p role="alert" style={{ color: "#ef4444" }}>{questionError}</p>}
        </section>
      )}

      {session && !result && question && (
        <section style={{ display: "grid", gap: 12 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>3. Understanding question</h2>
          <p>{question}</p>
          <textarea
            rows={6}
            maxLength={15_000}
            value={understandingAnswer}
            onChange={(event) => setUnderstandingAnswer(event.target.value)}
            disabled={submissionStarted || expired}
            placeholder="Write your final answer"
          />
          <button
            className="button"
            type="button"
            disabled={submitting || !understandingAnswer.trim() || (expired && !submissionStarted)}
            onClick={() => void handleSubmit()}
          >
            {submitting ? "Submitting and grading..." : submissionStarted ? "Retry grading / retrieve result" : "Submit final assessment"}
          </button>
          {submitError && <p role="alert" style={{ color: "#ef4444" }}>{submitError}</p>}
        </section>
      )}

      {session && expired && !result && !submissionStarted && (
        <p role="alert" style={{ color: "#ef4444" }}>
          Your assessment time has expired. New submissions are no longer accepted by the server.
        </p>
      )}

      {result && (
        <section style={{ display: "grid", gap: 12 }} aria-live="polite">
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>{result.passed ? "Passed" : "Not yet passed"}</h2>
          <p>Overall score: <strong>{result.overallScore}%</strong></p>
          <p>{result.feedback}</p>
          {!!result.strengths.length && <div><strong>Strengths</strong><ul>{result.strengths.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
          {!!result.improvements.length && <div><strong>Areas to improve</strong><ul>{result.improvements.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
          <p className="muted">
            {result.published
              ? "This result is published according to the assessment visibility rules."
              : "This result is not currently visible to employers and may require review."}
          </p>
          {result.reviewRecommended && <p className="muted">Technical signals have been referred for private review; they are not proof of misconduct.</p>}
          <p className="muted">AI-assisted feedback is provisional and may be reviewed by an authorized assessor.</p>
        </section>
      )}
    </div>
  );
}
