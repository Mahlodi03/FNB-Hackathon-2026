import Link from "next/link";
import type { StudentAttemptView } from "./data";

export function StatusBadge({ activity }: { activity: StudentAttemptView }) {
  if (activity.visibility === "withheld") return <span className="rw-state warning">Private review</span>;
  if (activity.status === "graded") return <span className={`rw-state ${activity.passed ? "success" : "warning"}`}>{activity.passed ? "Passed" : "Needs improvement"}</span>;
  if (activity.status === "invalidated") return <span className="rw-state warning">Invalidated</span>;
  return <span className="rw-state muted">{activity.status.replaceAll("_", " ")}</span>;
}

export function ActivityTable({ attempts }: { attempts: StudentAttemptView[] }) {
  if (!attempts.length) return <div className="rw-empty">No assessment attempts yet. Browse Challenges to get started.</div>;
  return <div style={{overflowX:"auto"}}><table className="rw-table">
    <thead><tr><th>Assessment</th><th>Concept</th><th>Date</th><th>Score</th><th>Result</th></tr></thead>
    <tbody>{attempts.map(a => <tr key={a.id}>
      <td><strong>{a.title}</strong></td><td>{a.concept}</td>
      <td>{new Date(a.createdAt).toLocaleDateString("en-ZA",{year:"numeric",month:"short",day:"numeric"})}</td>
      <td>{a.score == null ? "—" : `${a.score.toFixed(1)}%`}</td>
      <td><StatusBadge activity={a}/></td>
    </tr>)}</tbody>
  </table></div>;
}

export function BrowsePrompt() {
  return <Link className="button" href="/tasks">Explore challenges →</Link>;
}
