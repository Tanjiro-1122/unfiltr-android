export type WatchdogAccountResolution = 'blocked' | 'new' | 'pending' | 'returning' | null;
export type WatchdogRestorationStatus = 'idle' | 'loading' | 'ready';

export type ResolvingSnapshot = {
  accountResolution: WatchdogAccountResolution;
  restorationStatus: WatchdogRestorationStatus;
};

/**
 * True whenever the UI is (or would be) showing "Loading your Unfiltr account.",
 * under the exact same two conditions app/index.tsx renders that screen.
 * Used both to render the screen and to decide whether the watchdog below
 * needs to intervene -- kept as its own pure function so it's one thing to
 * get right, not two copies that can drift out of sync.
 */
export function isStillResolving(snapshot: ResolvingSnapshot): boolean {
  if (snapshot.accountResolution === null || snapshot.accountResolution === 'pending') return true;
  if (snapshot.accountResolution === 'returning' && snapshot.restorationStatus !== 'ready') {
    return true;
  }
  return false;
}

/**
 * The single outer backstop around the entire post-auth resolve+restore
 * operation. Deliberately independent of every inner timeout
 * (ACCOUNT_LOOKUP_TIMEOUT_MS, RESTORATION_HARD_TIMEOUT_MS,
 * RESTORATION_WAIT_TIMEOUT_MS): it does not await, wrap, or race any of
 * their promises, and does not care why the UI might still be resolving --
 * only that this snapshot says so once the deadline passes. If every one of
 * those finer-grained timeouts has a bug (or a request they don't cover at
 * all hangs), this still fires.
 *
 * getSnapshot is read at fire time, not capture time, so a genuinely
 * completed resolution (or a timer that outlived the screen and was never
 * cancelled) is a correctly-observed no-op rather than a stale forced
 * transition.
 */
export function scheduleRestorationWatchdog(options: {
  durationMs: number;
  getSnapshot: () => ResolvingSnapshot;
  onTimeout: () => void;
}): () => void {
  const timer = setTimeout(() => {
    if (isStillResolving(options.getSnapshot())) {
      options.onTimeout();
    }
  }, options.durationMs);

  return () => clearTimeout(timer);
}
