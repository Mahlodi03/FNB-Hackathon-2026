export const FREE_CHALLENGE_LIMIT = 10;

/** Counts starts for distinct challenges. A student cannot start the same task twice. */
export function remainingFreeUnlocks(startedChallenges: number): number {
  return Math.max(0, FREE_CHALLENGE_LIMIT - Math.max(0, Math.floor(startedChallenges)));
}

export function planIsActive(expiresAt: string | null | undefined, now = Date.now()): boolean {
  if (!expiresAt) return false;
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry > now;
}

export function canUnlockNewChallenge(startedChallenges: number, premiumActive: boolean): boolean {
  return premiumActive || remainingFreeUnlocks(startedChallenges) > 0;
}
