import Link from "next/link";
import { Check } from "lucide-react";
import { getSessionProfile } from "@/features/identity/queries";
import { getPlanSummary } from "@/server/subscriptions/queries";
import styles from "./plans.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plans | Ready For Work" };

type PlanCardProps = {
  name: string;
  price: string;
  description: string;
  features: string[];
  premium?: boolean;
  current?: boolean;
};

function PlanCard({ name, price, description, features, premium = false, current = false }: PlanCardProps) {
  return (
    <article className={`${styles.planCard} ${premium ? styles.premium : ""}`}>
      <div className={styles.planHeader}>
        <div className={styles.planName}>{name}</div>
        {current ? <span className={styles.currentBadge}>Your current access</span> : null}
      </div>
      <div className={styles.priceRow}>
        <strong className={styles.price}>{price}</strong>
        {premium ? <span className={styles.pricePeriod}>/ month · proposed</span> : <span className={styles.pricePeriod}>free</span>}
      </div>
      <p className={styles.planDescription}>{description}</p>
      <div className={styles.featuresTitle}>Included</div>
      <ul className={styles.featureList}>
        {features.map((feature) => (
          <li key={feature}>
            <Check size={16} strokeWidth={2.25} aria-hidden="true" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export default async function Plans() {
  const profile = await getSessionProfile();
  let summary: Awaited<ReturnType<typeof getPlanSummary>> | null = null;
  if (profile && (profile.role === "student" || profile.role === "employer")) {
    try { summary = await getPlanSummary(profile.id, profile.role); } catch { /* Display plans without guessing access. */ }
  }

  return (
    <section className={styles.page}>
      <header className={styles.heading}>
        <span className="eyebrow">Ready For Work · Plans</span>
        <h1>Simple plans for practical skills</h1>
        <p>Start for free. Premium features are available through temporary demo access during the hackathon.</p>
      </header>

      {summary ? (
        <div className={styles.accountStatus} role="status">
          <div>
            <span className={styles.statusLabel}>Your current access</span>
            <strong>{summary.role === "student" ? "Student" : "Employer"} {summary.plan === "premium" ? "Premium demo" : "Free"}</strong>
            {summary.role === "student" && summary.plan === "free" ? (
              <span>{summary.usedUnlocks} of 10 Free challenge starts used · {summary.remainingUnlocks} remaining</span>
            ) : null}
            {summary.role === "student" && summary.plan === "premium" ? (
              <span>Unlimited available challenges · one attempt per challenge</span>
            ) : null}
            {summary.premiumUntil ? (
              <span>Demo access ends {new Date(summary.premiumUntil).toLocaleDateString("en-ZA")}.</span>
            ) : null}
          </div>
          {summary.role === "student" && summary.plan === "premium" ? (
            <Link className="button secondary" href="/career-coach">Open Career Coach</Link>
          ) : null}
          {summary.role === "employer" && summary.plan === "premium" ? (
            <Link className="button secondary" href="/talent-matching">Open Talent Matching</Link>
          ) : null}
        </div>
      ) : null}

      <section className={styles.audience} aria-labelledby="student-plans">
        <div className={styles.sectionHeading}>
          <h2 id="student-plans">For students</h2>
          <p>Build evidence of what you can do.</p>
        </div>
        <div className={styles.planGrid}>
          <PlanCard
            name="Free" price="R0" current={summary?.role === "student" && summary.plan === "free"}
            description="Practice your skills and build a record of completed assessments."
            features={[
              "10 lifetime challenge starts",
              "One attempt per challenge",
              "AI-assisted grading and feedback",
              "Resume an active attempt within its original deadline",
            ]}
          />
          <PlanCard
            name="Premium" price="R39" premium current={summary?.role === "student" && summary.plan === "premium"}
            description="For students who want more practice and guided career direction."
            features={[
              "Unlimited available challenges",
              "One attempt per challenge",
              "AI-assisted grading and feedback",
              "AI Career Coach with daily usage limits",
            ]}
          />
        </div>
      </section>

      <section className={styles.audience} aria-labelledby="employer-plans">
        <div className={styles.sectionHeading}>
          <h2 id="employer-plans">For employers</h2>
          <p>Find talent through work-readiness evidence.</p>
        </div>
        <div className={styles.planGrid}>
          <PlanCard
            name="Free" price="R0" current={summary?.role === "employer" && summary.plan === "free"}
            description="Explore students who have chosen to make their profiles discoverable."
            features={[
              "Search opted-in student profiles",
              "View eligible published assessment results",
              "Review demonstrated skills",
            ]}
          />
          <PlanCard
            name="Premium" price="R299" premium current={summary?.role === "employer" && summary.plan === "premium"}
            description="Shortlist candidates using evidence-informed matching."
            features={[
              "Everything in Employer Free",
              "AI Talent Matching",
              "Up to 3 active job briefs",
              "20 matching runs per month and private shortlists",
            ]}
          />
        </div>
      </section>

      <div className={styles.disclaimer}>
        <strong>Hackathon demonstration</strong>
        <p>Premium prices are proposals, not active subscriptions. No payments or billing details are collected. An administrator can grant temporary Premium demo access. Your existing assessments and results remain available after demo access expires.</p>
      </div>
      <Link className={styles.backLink} href={profile?.role === "admin" ? "/admin" : "/dashboard"}>← Back to dashboard</Link>
    </section>
  );
}
