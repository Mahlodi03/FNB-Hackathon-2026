import { deadlinePassed } from "../assessments/recovery-rules";

export type ProgressState = {
  label: string;
  tone: "success" | "warning" | "muted";
};

type StatusInput = {
  status: string;
  expiresAt: string;
  passed: boolean | null;
  visibility: string | null;
};

/**
 * Student-facing state, not a database transition or integrity judgment.
 * In particular, expiry does not imply cheating, automatic failure, or a retake.
 */
export function getAssessmentProgressState(
  attempt: StatusInput,
  viewedAt: number,
): ProgressState {
  if (attempt.status === "invalidated") {
    return { label: "Invalidated", tone: "warning" };
  }
  // A withheld result stays private, including during an interrupted grading finalization.
  if (attempt.visibility === "withheld") {
    return { label: "Private review", tone: "warning" };
  }
  if (attempt.status === "graded") {
    if (attempt.passed === true) {
      return { label: "Passed", tone: "success" };
    }
    if (attempt.passed === false) {
      return { label: "Needs improvement", tone: "warning" };
    }
    return { label: "Result unavailable", tone: "muted" };
  }
  // A submission locked before expiry can legitimately finish grading afterward.
  if (attempt.status === "submitted") {
    return { label: "Awaiting result", tone: "muted" };
  }
  if (attempt.status === "in_progress" || attempt.status === "awaiting_understanding") {
    if (deadlinePassed(attempt.expiresAt, viewedAt)) {
      return { label: "Time expired — not submitted", tone: "warning" };
    }
    return { label: "In progress", tone: "muted" };
  }
  return { label: "Status unavailable", tone: "muted" };
}
