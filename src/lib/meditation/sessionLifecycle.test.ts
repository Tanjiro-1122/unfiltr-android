import { describe, expect, it, vi } from 'vitest';

import { createMeditationCleanupGuard, runMeditationExit } from './sessionLifecycle';

function makeDeps(overrides: Partial<Parameters<typeof runMeditationExit>[1]> = {}) {
  const guard = overrides.guard ?? createMeditationCleanupGuard();
  guard.markMounted();
  return {
    clearSessionTimers: vi.fn(),
    guard,
    onBack: vi.fn(),
    saveCompletionSnapshot: vi.fn().mockResolvedValue(undefined),
    setPaused: vi.fn(),
    setPhase: vi.fn(),
    setSessionExiting: vi.fn(),
    stopPlayer: vi.fn(),
    ...overrides,
  };
}

describe('runMeditationExit', () => {
  it('End while audio is playing: stops the player, clears timers, and completes the session', async () => {
    const deps = makeDeps();

    const result = await runMeditationExit({ complete: true, navigateBack: false }, deps);

    expect(result).toBe('completed');
    expect(deps.setSessionExiting).toHaveBeenNthCalledWith(1, true);
    expect(deps.clearSessionTimers).toHaveBeenCalledTimes(1);
    expect(deps.stopPlayer).toHaveBeenCalledTimes(1);
    expect(deps.setPhase).toHaveBeenCalledWith('done');
    expect(deps.setPaused).toHaveBeenCalledWith(false);
    expect(deps.setSessionExiting).toHaveBeenNthCalledWith(2, false);
  });

  it('End after Pause: still transitions to done and clears the paused flag', async () => {
    const deps = makeDeps();

    await runMeditationExit({ complete: true, navigateBack: false }, deps);

    expect(deps.setPaused).toHaveBeenCalledWith(false);
    expect(deps.setPhase).toHaveBeenCalledWith('done');
  });

  it('back-navigation out of an active session: never awaits anything, calls onBack synchronously', async () => {
    const deps = makeDeps();

    const result = await runMeditationExit({ complete: false, navigateBack: true }, deps);

    expect(result).toBe('navigated-back');
    expect(deps.onBack).toHaveBeenCalledTimes(1);
    expect(deps.saveCompletionSnapshot).not.toHaveBeenCalled();
    expect(deps.setPhase).not.toHaveBeenCalled();
  });

  it('repeated End taps: the second call is rejected by the guard and never re-runs side effects', async () => {
    const deps = makeDeps();

    const [first, second] = await Promise.all([
      runMeditationExit({ complete: true, navigateBack: false }, deps),
      runMeditationExit({ complete: true, navigateBack: false }, deps),
    ]);

    // Exactly one of the two calls proceeds; the other bails immediately.
    expect([first, second].sort()).toEqual(['already-exiting', 'completed']);
    expect(deps.stopPlayer).toHaveBeenCalledTimes(1);
    expect(deps.clearSessionTimers).toHaveBeenCalledTimes(1);
    expect(deps.saveCompletionSnapshot).toHaveBeenCalledTimes(1);
    expect(deps.setPhase).toHaveBeenCalledTimes(1);
  });

  it('a third End tap after the first has already finished is also rejected until a new session starts', async () => {
    const deps = makeDeps();

    await runMeditationExit({ complete: true, navigateBack: false }, deps);
    // The real screen calls guard.resetExit() as part of completing, mirrored here.
    const secondResult = await runMeditationExit({ complete: true, navigateBack: false }, deps);

    // resetExit() ran inside the first call (guard.isMounted() was true), so
    // the guard is open again -- this exercises that a *second*, later tap
    // (not a racing one) is legitimately allowed to run once more, rather
    // than being permanently locked out after the first End Session ever
    // happened.
    expect(secondResult).toBe('completed');
    expect(deps.saveCompletionSnapshot).toHaveBeenCalledTimes(2);
  });

  it('a hung completion-snapshot write must never block leaving the active session (the TestFlight freeze hypothesis)', async () => {
    let releaseSnapshotWrite: (() => void) | undefined;
    const hungWrite = new Promise<void>((resolve) => {
      releaseSnapshotWrite = resolve;
    });
    const deps = makeDeps({ saveCompletionSnapshot: vi.fn().mockReturnValue(hungWrite) });

    const result = await runMeditationExit({ complete: true, navigateBack: false }, deps);

    // The exit call itself resolves without ever waiting on the snapshot
    // write -- setPhase('done') already ran.
    expect(result).toBe('completed');
    expect(deps.setPhase).toHaveBeenCalledWith('done');
    expect(deps.setSessionExiting).toHaveBeenLastCalledWith(false);

    // Cleanup: release the still-pending write so it doesn't leak into
    // another test as an unhandled rejection/timer.
    releaseSnapshotWrite?.();
    await hungWrite;
  });

  it('a rejected completion-snapshot write is swallowed and still completes the session', async () => {
    const deps = makeDeps({
      saveCompletionSnapshot: vi.fn().mockRejectedValue(new Error('storage unavailable')),
    });

    const result = await runMeditationExit({ complete: true, navigateBack: false }, deps);

    expect(result).toBe('completed');
    expect(deps.setPhase).toHaveBeenCalledWith('done');
  });

  it('component unmount cleanup: setPhase/setPaused/resetExit are never called once unmounted', async () => {
    const guard = createMeditationCleanupGuard();
    guard.markMounted();
    guard.markUnmounted();
    const deps = makeDeps({ guard });

    const result = await runMeditationExit({ complete: true, navigateBack: false }, deps);

    // markUnmounted() also marks the guard as exiting, so a post-unmount
    // exit call is rejected outright -- nothing it would have done (stop
    // the player again, flip phase/paused state) can fire on a dead screen.
    expect(result).toBe('already-exiting');
    expect(deps.setPhase).not.toHaveBeenCalled();
    expect(deps.setPaused).not.toHaveBeenCalled();
    expect(deps.stopPlayer).not.toHaveBeenCalled();
  });

  it('unmount racing a still-in-flight snapshot write: state setters are not called after the write resolves', async () => {
    let resolveSnapshotWrite: (() => void) | undefined;
    const guard = createMeditationCleanupGuard();
    guard.markMounted();
    const deps = makeDeps({
      guard,
      saveCompletionSnapshot: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveSnapshotWrite = resolve;
          }),
      ),
    });

    const exitPromise = runMeditationExit({ complete: true, navigateBack: false }, deps);

    // The screen unmounts between the initial synchronous setup (which
    // already ran: setSessionExiting(true), clearSessionTimers, stopPlayer)
    // and the microtask-later guarded state update -- this models a
    // navigation/unmount landing in that single-tick window while the
    // (fire-and-forget) snapshot write is still pending.
    guard.markUnmounted();
    resolveSnapshotWrite?.();
    await exitPromise;

    // The guarded block must be skipped entirely once unmounted: no
    // setPhase/setPaused, and setSessionExiting was only ever called once
    // (the initial `true`) -- never a stray `false` against a dead screen.
    expect(deps.setPhase).not.toHaveBeenCalled();
    expect(deps.setPaused).not.toHaveBeenCalled();
    expect(deps.setSessionExiting).toHaveBeenCalledTimes(1);
    expect(deps.setSessionExiting).toHaveBeenCalledWith(true);
  });

  it('timer callback racing with End: shouldUpdateState() reports false for callbacks still in flight once exit begins', async () => {
    const guard = createMeditationCleanupGuard();
    guard.markMounted();
    const deps = makeDeps({ guard });

    const exitPromise = runMeditationExit({ complete: true, navigateBack: false }, deps);

    // A timer callback that fires between beginExit() and completion (e.g.
    // one MeditationScreen's startTimers() scheduled just before End was
    // tapped) must see itself as no longer safe to update state.
    expect(guard.shouldUpdateState()).toBe(false);

    await exitPromise;
  });

  it('audio completion callback racing with navigation: a source-change check made during exit is rejected', async () => {
    const guard = createMeditationCleanupGuard();
    guard.markMounted();
    const token = guard.beginSourceChange();
    const deps = makeDeps({ guard });

    const exitPromise = runMeditationExit({ complete: false, navigateBack: true }, deps);

    // An in-flight audio start() completion callback checking whether its
    // source token is still current must see false once exit has begun.
    expect(guard.isActiveSourceChange(token)).toBe(false);

    await exitPromise;
  });

  it('never requires a force close: exit always resolves even when every dependency is slow', async () => {
    const deps = makeDeps({
      saveCompletionSnapshot: () => new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
    });

    const result = await Promise.race([
      runMeditationExit({ complete: true, navigateBack: false }, deps),
      new Promise<'timed-out'>((resolve) => setTimeout(() => resolve('timed-out'), 200)),
    ]);

    expect(result).toBe('completed');
  });
});
