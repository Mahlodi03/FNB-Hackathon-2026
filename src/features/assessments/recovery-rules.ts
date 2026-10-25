/** Pure assessment state rules. Database writes repeat these constraints atomically. */
export function deadlinePassed(expiresAt: string, now = Date.now()): boolean {
  const deadline = Date.parse(expiresAt);
  return !Number.isFinite(deadline) || deadline <= now;
}

export function canResumeTimedAttempt(status: string, expiresAt: string, now = Date.now()): boolean {
  return (status === "in_progress" || status === "awaiting_understanding") && !deadlinePassed(expiresAt, now);
}

export function canSaveDraft(
  stage: "initial" | "understanding",
  status: string,
  expiresAt: string,
  originalAnswersLocked: boolean,
  now = Date.now(),
): boolean {
  if (deadlinePassed(expiresAt, now)) return false;
  if (stage === "initial") return status === "in_progress" && !originalAnswersLocked;
  return status === "awaiting_understanding";
}
