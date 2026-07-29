/**
 * Fixes the exact bug found in app/index.tsx's resolveAccount effect: that
 * code used a per-invocation `cancelled` flag set by the effect's own
 * cleanup, with `accountResolution` in the effect's dependency array. Since
 * the very first thing the effect's async body did was
 * `setAccountResolution('pending')` -- a write to that same dependency --
 * React saw the dependency change, ran the OLD invocation's cleanup
 * (`cancelled = true`), and only THEN did the real network round-trip to
 * profile-diagnostic resolve. Every single resolution attempt therefore
 * cancelled itself within milliseconds of starting, silently skipping
 * classification/restoration entirely and leaving accountResolution stuck
 * at 'pending' until the 30s outer watchdog forced it to 'blocked'.
 *
 * This guard is a plain counter with no React dependency-array involvement
 * at all: `begin()` is called ONCE, synchronously, before starting an
 * operation, and returns that operation's id. `isStale(id)` is only ever
 * true once a DIFFERENT operation has begun (a genuine new attempt -- Retry,
 * or a different account after sign-out/sign-in) or `invalidate()` has been
 * called (a genuine unmount). Setting state inside the operation itself
 * never touches this counter, so it can never go stale relative to itself.
 */
export type OperationGuard = {
  begin(): number;
  isStale(operationId: number): boolean;
  invalidate(): void;
};

export function createOperationGuard(): OperationGuard {
  let current = 0;

  return {
    begin(): number {
      current += 1;
      return current;
    },
    isStale(operationId: number): boolean {
      return current !== operationId;
    },
    invalidate(): void {
      current += 1;
    },
  };
}
