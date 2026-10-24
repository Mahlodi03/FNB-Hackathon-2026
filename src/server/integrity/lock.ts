/** Local concurrency guard for a single server instance.
 * Does not provide cross-instance atomicity. Production needs an approved DB RPC/constraint.
 */
const tails = new Map<string, Promise<void>>();
export async function withAttemptAdmissionLock<T>(attemptId: string, action: () => Promise<T>): Promise<T> {
  const prior = tails.get(attemptId) ?? Promise.resolve();
  let release!: () => void;
  const finished = new Promise<void>((resolve) => { release = resolve; });
  const tail = prior.then(() => finished);
  tails.set(attemptId, tail);
  await prior;
  try { return await action(); }
  finally {
    release();
    if (tails.get(attemptId) === tail) tails.delete(attemptId);
  }
}
