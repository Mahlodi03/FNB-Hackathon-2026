import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { AccessError, requireActor } from "@/server/auth/actor";
import { serviceSupabase } from "@/lib/supabase/admin";
import { AttemptIdSchema, TECHNICAL_INTERRUPTION_TYPES } from "@/server/integrity/rules";
import { type ReviewDecision, reviewLabels } from "@/server/integrity/review/schema";
import { ReviewForm } from "./ReviewForm";

export const dynamic = "force-dynamic";

type ReviewRow = {
  id: string;
  reviewer_id: string;
  decision: ReviewDecision;
  reason: string;
  previous_visibility: string;
  new_visibility: string;
  reviewed_at: string;
};

type IntegrityRow = {
  id: string;
  event_type: string;
  recorded_at: string;
};

const displayDate = (value: string) => new Date(value).toLocaleString("en-ZA", {
  timeZone: "Africa/Johannesburg", timeZoneName: "short",
});

export default async function IntegrityAttemptDetail({
  params,
}: { params: Promise<{ attemptId: string }> }) {
  await connection();
  try {
    await requireActor(["admin"]);
  } catch (error) {
    if (error instanceof AccessError && error.status === 401) redirect("/login?next=/admin/integrity");
    if (error instanceof AccessError && error.status === 403) notFound();
    throw error;
  }
  const { attemptId } = await params;
  if (!AttemptIdSchema.safeParse(attemptId).success) notFound();

  const db = serviceSupabase();
  const [attemptResponse, resultResponse, signalsResponse, stateResponse, historyResponse] = await Promise.all([
    db.from("attempts").select("id,student_id,task_id,status,submitted_at").eq("id", attemptId).maybeSingle(),
    db.from("results").select("visibility,passed,overall_score,grading_source,graded_at").eq("attempt_id", attemptId).maybeSingle(),
    db.from("integrity_events").select("id,event_type,recorded_at").eq("attempt_id", attemptId).order("recorded_at", { ascending: false }).limit(100),
    db.from("integrity_review_state").select("decision,reviewed_at,reviewer_id").eq("attempt_id", attemptId).maybeSingle(),
    db.from("integrity_review_history").select("id,reviewer_id,decision,reason,previous_visibility,new_visibility,reviewed_at").eq("attempt_id", attemptId).order("reviewed_at", { ascending: false }).limit(100),
  ]);
  if (attemptResponse.error || resultResponse.error || signalsResponse.error || stateResponse.error || historyResponse.error) {
    throw new Error("Unable to retrieve private review data");
  }
  if (!attemptResponse.data) notFound();
  const attempt = attemptResponse.data;
  const result = resultResponse.data;
  const current = stateResponse.data;
  const signals = (signalsResponse.data ?? []) as IntegrityRow[];
  const history = (historyResponse.data ?? []) as ReviewRow[];

  return (
    <section style={{ paddingTop: 35, maxWidth: 960, marginInline: "auto", display: "grid", gap: 17 }}>
      <Link href="/admin/integrity" className="muted">← Back to private integrity dashboard</Link>
      <div className="rw-hero">
        <p className="eyebrow" style={{ color: "#e2d7ff" }}>Administrator access only</p>
        <h1>Human Integrity Review</h1>
        <p style={{ overflowWrap: "anywhere" }}>Assessment attempt {attempt.id}</p>
      </div>
      <div className="card" style={{ display: "grid", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Assessment status</h2>
        <p>Attempt: <strong>{attempt.status}</strong> · Result: <strong>{result?.visibility ?? "Not graded"}</strong></p>
        <p className="muted" style={{ fontSize: 13 }}>Student ID: {attempt.student_id}</p>
        <p className="muted" style={{ fontSize: 13 }}>Current human review: {current ? reviewLabels[current.decision as ReviewDecision] : "Pending review"}</p>
        {result && <p className="muted" style={{ fontSize: 13 }}>
          AI-assisted evaluation: {result.grading_source === "ai_assisted" ? "yes" : "no"} ·
          Passed: {result.passed ? "yes" : "no"} · Overall score: {result.overall_score}
        </p>}
      </div>
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Private integrity signals</h2>
        <p className="muted" style={{ fontSize: 13 }}>Up to 100 most recent server-received signals are shown. Camera and permission interruptions may be technical. Signals alone do not establish wrongdoing.</p>
        {signals.length === 0 ? <p>No integrity signals recorded for this attempt.</p> : (
          <ul style={{ display: "grid", gap: 8, paddingLeft: 20 }}>
            {signals.map((signal) => (
              <li key={signal.id}>
                <strong>{signal.event_type.replaceAll("_", " ")}</strong>{" "}
                {TECHNICAL_INTERRUPTION_TYPES.includes(signal.event_type as typeof TECHNICAL_INTERRUPTION_TYPES[number]) && <span className="pill">Technical interruption</span>}
                <span className="muted" style={{ fontSize: 12 }}> · Received {displayDate(signal.recorded_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {attempt.status === "graded" && result ? (
        <ReviewForm attemptId={attemptId} />
      ) : (
        <div className="card"><p>Review decisions can be saved once AI grading has completed. Existing events remain available for triage.</p></div>
      )}
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Review history</h2>
        <p className="muted" style={{ fontSize: 13 }}>Up to 100 latest decisions; previous decisions are retained and cannot be edited.</p>
        {history.length === 0 ? <p>No human decisions have been recorded.</p> : (
          <ol style={{ display: "grid", gap: 12, paddingLeft: 20 }}>
            {history.map((review) => (
              <li key={review.id}>
                <strong>{reviewLabels[review.decision]}</strong> · {displayDate(review.reviewed_at)}
                <p className="muted" style={{ fontSize: 12, overflowWrap: "anywhere" }}>Reviewer ID: {review.reviewer_id}</p>
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{review.reason}</p>
                <p className="muted" style={{ fontSize: 12 }}>
                  Evidence visibility: {review.previous_visibility} → {review.new_visibility}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
