import Link from "next/link";
import { getSessionProfile } from "@/features/identity/queries";
import { getPlanSummary } from "@/server/subscriptions/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plans | Ready For Work" };

export default async function Plans() {
  const profile = await getSessionProfile();
  let summary: Awaited<ReturnType<typeof getPlanSummary>> | null = null;
  if (profile && (profile.role === "student" || profile.role === "employer")) {
    try { summary = await getPlanSummary(profile.id, profile.role); } catch { /* Show neutral status until DB is ready. */ }
  }
  return <section>
    <div className="rw-page-heading"><span className="eyebrow">Ready For Work · Plans</span><h1 className="h2">Free and Premium</h1><p className="muted">Proposed hackathon plans. Payments and automatic subscriptions are not yet available.</p></div>
    {summary && <div className="rw-assessment-note" role="status" style={{ marginBottom: 20 }}>
      Your current access: <strong>{summary.plan === "premium" ? "Premium (admin demo)" : "Free"}</strong>.
      {summary.role === "student" && <> Lifetime challenge starts: {summary.usedUnlocks} · Free starts remaining: {summary.remainingUnlocks} of 10.</>}
      {summary.premiumUntil && <> Demo access ends {new Date(summary.premiumUntil).toLocaleDateString("en-ZA")}.</>}
    </div>}
    <div className="rw-task-grid">
      <article className="card"><span className="tag">Student Free</span><h2>R0</h2><p>10 lifetime challenge starts, one attempt per challenge, AI grading, recovery and existing results.</p></article>
      <article className="card"><span className="tag">Student Premium · proposal</span><h2>R39/month</h2><p>Unlimited available challenges (still one attempt per task). AI Career Coach is planned, not implemented.</p></article>
      <article className="card"><span className="tag">Employer Free</span><h2>R0</h2><p>Discover opted-in student profiles and eligible published assessment evidence.</p></article>
      <article className="card"><span className="tag">Employer Premium · proposal</span><h2>R299/month</h2><p>AI Talent Matching and shortlists are planned, not implemented.</p></article>
    </div>
    <div className="rw-assessment-note" style={{ marginTop: 18 }}>For hackathon testing, an administrator can temporarily grant demo Premium. No billing or payment credentials are collected. Existing results and assessments remain yours after demo access ends.</div>
    <p style={{ marginTop: 18 }}><Link className="button secondary" href="/dashboard">Back to dashboard</Link></p>
  </section>;
}
