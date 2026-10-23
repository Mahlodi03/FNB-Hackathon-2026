import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, ErrorNotice, ResultCardView, SetupNotice } from "@/features/identity/components/ui";
import { isSupabaseConfigured } from "@/features/identity/config";
import { getPublicResultCards, getPublicStudentByUsername } from "@/features/identity/queries";
import type { ResultCard } from "@/features/identity/mappers";

export default async function Student({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  if (!isSupabaseConfigured()) {
    return <section style={{ paddingTop: 42, maxWidth: 790 }}><SetupNotice /></section>;
  }
  const student = await getPublicStudentByUsername(username);
  if (!student) notFound();
  let cards: ResultCard[] = [];
  let failed = false;
  try {
    cards = await getPublicResultCards(student.id);
  } catch {
    failed = true;
  }
  return (
    <section style={{ paddingTop: 42, maxWidth: 860, display: "grid", gap: 24 }}>
      <Link href="/students" className="muted" style={{ fontSize: 13 }}>← All students</Link>
      <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
        <Avatar name={student.fullName} url={student.avatarUrl} size={72} />
        <div>
          <div className="eyebrow">Student profile</div>
          <h1 className="h2" style={{ margin: "6px 0" }}>{student.fullName}</h1>
          <p className="muted">{[student.fieldOfInterest, student.institution].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      {student.bio ? (
        <div className="card">
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>About</h2>
          <p style={{ lineHeight: 1.6, whiteSpace: "pre-line" }}>{student.bio}</p>
        </div>
      ) : null}
      <div style={{ display: "grid", gap: 14 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Completed tasks</h2>
        {failed ? <ErrorNotice message="We couldn't load this student's results right now." /> : null}
        {!failed && cards.length === 0 ? (
          <div className="card"><p className="muted">No published task results yet.</p></div>
        ) : null}
        <div className="grid-cards">
          {cards.map((card) => (
            <ResultCardView key={card.attemptId} card={card} href={`/students/${student.username}/submissions/${card.attemptId}`} />
          ))}
        </div>
        <p className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
          Results are graded by AI against each task&apos;s rubric. Code is reviewed, not executed. Scores show evidence of
          skill, not a guarantee of independent work.
        </p>
      </div>
    </section>
  );
}
