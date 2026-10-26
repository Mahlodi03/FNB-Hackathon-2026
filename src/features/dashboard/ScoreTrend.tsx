import type { StudentAttemptView } from "./data";

/** Presentation-only chart of genuine grading history; no new data requests or scoring. */
export function ScoreTrend({ attempts }: { attempts: StudentAttemptView[] }) {
  const graded = attempts
    .filter((attempt) => attempt.status === "graded" && attempt.score !== null && attempt.gradedAt !== null)
    .sort((a, b) => Date.parse(a.gradedAt ?? "") - Date.parse(b.gradedAt ?? ""));

  if (graded.length < 2) return null;

  const history = graded.map((attempt, index) => {
    const total = graded
      .slice(0, index + 1)
      .reduce((sum, item) => sum + Number(item.score), 0);

    return {
      average: total / (index + 1),
      title: attempt.title,
      date: attempt.gradedAt ?? "",
    };
  });
  const visible = history.slice(-8);
  const width = 680;
  const left = 44;
  const top = 18;
  const bottom = 184;
  const right = width - 18;
  const y = (value: number) => bottom - (value / 100) * (bottom - top);
  const x = (index: number) => left + index * ((right - left) / (visible.length - 1));
  const points = visible.map((item, index) => `${x(index)},${y(item.average)}`).join(" ");
  const latest = history[history.length - 1].average;

  return (
    <section className="card rw-trend-card" aria-label="Average score across graded assessments">
      <div className="rw-section-head">
        <div><h2>Average score over time</h2><p className="muted">Cumulative average across graded assessments, oldest to newest</p></div>
        <strong className="rw-trend-score">{latest.toFixed(1)}%</strong>
      </div>
      <div className="rw-trend-chart">
        <svg viewBox="0 0 680 209" role="img" aria-label={`Your average across ${graded.length} graded assessments is ${latest.toFixed(1)} percent. The line shows the most recent ${visible.length} averages.`}>
          {[0, 25, 50, 75, 100].map((value) => (
            <g key={value}>
              <line x1={left} x2={right} y1={y(value)} y2={y(value)} className="rw-trend-guide" />
              <text x={left - 11} y={y(value) + 4} textAnchor="end" className="rw-trend-tick">{value}%</text>
            </g>
          ))}
          <polyline fill="none" points={points} className="rw-trend-line" />
          {visible.map((item, index) => (
            <circle key={`${item.date}-${index}`} cx={x(index)} cy={y(item.average)} r="4.5" className="rw-trend-point">
              <title>{`${item.title} — cumulative average ${item.average.toFixed(1)}%`}</title>
            </circle>
          ))}
          <text x={left} y="206" textAnchor="start" className="rw-trend-tick">Earlier</text>
          <text x={right} y="206" textAnchor="end" className="rw-trend-tick">Latest</text>
        </svg>
      </div>
      <p className="muted rw-trend-caption">Based on {graded.length} actual graded assessments. An average is not a prediction of future performance.</p>
    </section>
  );
}
