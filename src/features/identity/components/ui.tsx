import Link from "next/link";
import { initials, formatDate, type ResultCard } from "../mappers";

export function SetupNotice({ title = "Supabase is not configured" }: { title?: string }) {
  return (
    <div className="card" role="status" style={{ display: "grid", gap: 10 }}>
      <h2 style={{ fontSize: 19, fontWeight: 800 }}>{title}</h2>
      <p className="muted" style={{ lineHeight: 1.6 }}>
        Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart the dev
        server. No sample accounts or results are shown in place of real data.
      </p>
    </div>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="card" role="alert" style={{ borderColor: "#7a3b3b" }}>
      <p style={{ color: "#ffc9c9" }}>{message}</p>
    </div>
  );
}

export function Avatar({ name, url, size = 50 }: { name: string; url: string | null; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: url ? `#205642 center / cover no-repeat url(${JSON.stringify(url)})` : "#205642",
        color: "#c7ffed",
        display: "grid",
        placeItems: "center",
        fontWeight: 900,
        fontSize: size * 0.34,
        flexShrink: 0,
      }}
    >
      {url ? null : initials(name)}
    </span>
  );
}

export function ResultCardView({ card, href, footer }: { card: ResultCard; href?: string; footer?: React.ReactNode }) {
  return (
    <article className="card" style={{ display: "grid", gap: 12, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
        <div>
          <div className="eyebrow" style={{ fontSize: 11 }}>{card.concept}</div>
          <h3 style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>{card.taskTitle}</h3>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 26, fontWeight: 850, color: "var(--brand)" }}>{card.overallScore}%</div>
          <div className="muted" style={{ fontSize: 11 }}>Overall rating</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {card.skills.map((skill) => <span key={skill} className="tag">{skill}</span>)}
      </div>
      <p className="muted" style={{ fontSize: 12 }}>
        Passed · AI-assisted rubric grading · {formatDate(card.gradedAt)}
      </p>
      {href ? <Link href={href} style={{ color: "#79ecc3", fontSize: 13, fontWeight: 700 }}>View submission details</Link> : null}
      {footer}
    </article>
  );
}
