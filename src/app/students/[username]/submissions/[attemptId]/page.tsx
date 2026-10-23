import Link from "next/link";
import { notFound } from "next/navigation";
import { ErrorNotice, SetupNotice } from "@/features/identity/components/ui";
import { isSupabaseConfigured } from "@/features/identity/config";
import { formatDate, type SubmissionDetail } from "@/features/identity/mappers";
import { getPublicSubmissionDetail, getPublicStudentByUsername } from "@/features/identity/queries";

function Answer({ title, text, code = false }: { title: string; text: string | null; code?: boolean }) {
  return (
    <div className="card" style={{ display: "grid", gap: 10 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800 }}>{title}</h2>
      {text ? (
        code ? (
          <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto", background: "#071923", border: "1px solid var(--line)", borderRadius: 10, padding: 14, fontSize: 13, lineHeight: 1.5 }}>{text}</pre>
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
  if (!isSupabaseConfigured()) {
    return <section style={{ paddingTop: 42, maxWidth: 790 }}><SetupNotice /></section>;
  }
  const student = await getPublicStudentByUsername(username);
  if (!student) notFound();
  let detail: SubmissionDetail | null = null;
  let failed = false;
  try {
    detail = await getPublicSubmissionDetail(attemptId);
  } catch {
    failed = true;
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
