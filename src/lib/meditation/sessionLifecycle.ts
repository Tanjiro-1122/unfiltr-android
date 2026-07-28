export type MeditationCleanupGuard = {
  beginExit: () => boolean;
  beginSourceChange: () => number;
  isActiveSourceChange: (token: number) => boolean;
  isMounted: () => boolean;
  markMounted: () => void;
  markUnmounted: () => void;
  resetExit: () => void;
  shouldUpdateState: (token?: number) => boolean;
};

export type MeditationExitArgs = {
  complete: boolean;
  navigateBack: boolean;
};

export type MeditationExitDeps = {
  clearSessionTimers: () => void;
  guard: MeditationCleanupGuard;
  onBack?: () => void;
  saveCompletionSnapshot: () => Promise<void>;
  setPaused: (value: boolean) => void;
  setPhase: (value: 'setup' | 'active' | 'done') => void;
  setSessionExiting: (value: boolean) => void;
  stopPlayer: () => void;
};

export type MeditationExitResult = 'already-exiting' | 'completed' | 'navigated-back';

/**
 * The single, testable orchestration for "End Session" (and back-navigation
 * out of an active session). This exists as a pure function, independent of
 * React state/refs, specifically so the race conditions a physical device
 * can hit -- but static review can't prove or disprove -- have real,
 * executable test coverage: repeated End taps, a timer callback firing
 * mid-exit, a hung completion-snapshot write, and unmount happening while
 * that write is still in flight.
 *
 * The critical property: the completion snapshot write is fire-and-forget.
 * It must NEVER be awaited before leaving the active session -- if it hangs
 * (storage lock, slow device, anything), the old code (`await
 * setJsonItem(...)` before `setPhase('done')`) would leave the user staring
 * at a disabled "Ending..." button forever, with no way out but a force
 * quit. That is the leading hypothesis for the TestFlight freeze report.
 */
export async function runMeditationExit(
  { complete, navigateBack }: MeditationExitArgs,
  deps: MeditationExitDeps,
): Promise<MeditationExitResult> {
  if (!deps.guard.beginExit()) return 'already-exiting';

  deps.setSessionExiting(true);
  deps.clearSessionTimers();
  deps.stopPlayer();

  if (complete) {
    void deps.saveCompletionSnapshot().catch(() => {
      // Best-effort only. A failed or hung snapshot write must never block
      // leaving the active session -- see the function doc comment.
    });

    // Yield exactly one microtask (never I/O, cannot hang) so a genuinely
    // concurrent second exit call -- two calls dispatched in the same tick,
    // e.g. two fast taps landing before React re-renders the disabled
    // button -- still observes `exiting` as true and is correctly rejected
    // by beginExit() above, before this call's guard.resetExit() reopens
    // it. Without this yield the whole complete-branch would run fully
    // synchronously (no await left in it), letting resetExit() run before
    // a second call could even be dispatched.
    await Promise.resolve();

    if (deps.guard.isMounted()) {
      deps.setPaused(false);
      deps.setPhase('done');
      deps.setSessionExiting(false);
      deps.guard.resetExit();
    }
    return 'completed';
  }

  if (navigateBack) deps.onBack?.();
  return 'navigated-back';
}

export function createMeditationCleanupGuard(): MeditationCleanupGuard {
  let mounted = true;
  let exiting = false;
  let sourceToken = 0;

  return {
    beginExit() {
      if (exiting) return false;
      exiting = true;
      sourceToken += 1;
      return true;
    },
    beginSourceChange() {
      sourceToken += 1;
      return sourceToken;
    },
    isActiveSourceChange(token: number) {
      return mounted && !exiting && token === sourceToken;
    },
    isMounted() {
      return mounted;
    },
    markMounted() {
      mounted = true;
    },
    markUnmounted() {
      mounted = false;
      exiting = true;
      sourceToken += 1;
    },
    resetExit() {
      if (mounted) exiting = false;
    },
    shouldUpdateState(token?: number) {
      return mounted && !exiting && (token == null || token === sourceToken);
    },
  };
}
