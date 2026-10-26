import Link from "next/link";
import { notFound } from "next/navigation";
import { ErrorNotice, SetupNotice } from "@/features/identity/components/ui";
import { isSupabaseConfigured } from "@/features/identity/config";
import { formatDate, type SubmissionDetail } from "@/features/identity/mappers";
import { getPublicResultCards, getPublicSubmissionDetail, getPublicStudentByUsername, getSessionProfile } from "@/features/identity/queries";
import { requireDirectoryAccess } from "@/features/identity/requireDirectoryAccess";

function Answer({ title, text, code = false }: { title: string; text: string | null; code?: boolean }) {
  return (
    <div className="card" style={{ display: "grid", gap: 10 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800 }}>{title}</h2>
      {text ? (
        code ? (
          <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto", background: "#071923", color: "#e8f1ff", border: "1px solid var(--line)", borderRadius: 10, padding: 14, fontSize: 13, lineHeight: 1.5 }}>{text}</pre>
        ) : (
          <p style={{ lineHeight: 1.6, whiteSpace: "pre-line" }}>{text}</p>
        )
      ) : (
        <p className="muted">No answer recorded.</p>
      )}
    </div>
  );
}

export default async function SubmissionPage({ params }: { params: Promise<{ username: string; attemptId: string }> }) {
  const { username, attemptId } = await params;
  await requireDirectoryAccess(`/students/${encodeURIComponent(username)}/submissions/${encodeURIComponent(attemptId)}`);
  if (!isSupabaseConfigured()) {
    return <section style={{ paddingTop: 42, maxWidth: 790 }}><SetupNotice /></section>;
  }
  const viewer = await getSessionProfile();
  const student = await getPublicStudentByUsername(username);
  if (!student || !viewer) notFound();
  if (viewer.role === "student" && viewer.id !== student.id) notFound();
  let detail: SubmissionDetail | null = null;
  let failed = false;
  // The attempt must be among this student's visible result cards; never
  // attribute a different student's submission to the profile in the URL.
  let cardIds: string[] = [];
  try {
    cardIds = (await getPublicResultCards(student.id)).map((card) => card.attemptId);
  } catch {
    failed = true;
  }
  if (!failed && !cardIds.includes(attemptId)) notFound();
  if (!failed) {
    try {
      detail = await getPublicSubmissionDetail(attemptId);
    } catch {
      failed = true;
    }
  }
  return (
    <section style={{ paddingTop: 42, maxWidth: 860, display: "grid", gap: 18 }}>
      <Link href={`/students/${student.username}`} className="muted" style={{ fontSize: 13 }}>← Back to {student.fullName}</Link>
      {failed ? <ErrorNotice message="We couldn't load this submission right now." /> : null}
      {!failed && !detail ? (
        <div className="card">
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>Answers not shared</h1>
          <p className="muted" style={{ lineHeight: 1.6 }}>
            {student.fullName} has chosen to show only the result summary for this task.
          </p>
        </div>
      ) : null}
      {detail ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div className="eyebrow">Shared submission · {student.fullName}</div>
              <h1 className="h2" style={{ marginTop: 6 }}>{detail.taskTitle}</h1>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Graded {formatDate(detail.gradedAt)}</p>
            </div>
            <div style={{ fontSize: 34, fontWeight: 850, color: "var(--brand)" }}>{detail.overallScore}%</div>
          </div>
          <Answer title="Theory answer" text={detail.theoryAnswer} />
          <Answer title="Practical answer" text={detail.practicalAnswer} code />
          <Answer title={detail.understandingQuestion ? `Follow-up: ${detail.understandingQuestion}` : "Follow-up answer"} text={detail.understandingAnswer} />
          <Answer title="Feedback" text={detail.feedback} />
        </>
      ) : null}
    </section>
  );
}
