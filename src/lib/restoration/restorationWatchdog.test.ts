import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isStillResolving, scheduleRestorationWatchdog } from './restorationWatchdog';

describe('isStillResolving', () => {
  it('accountResolution is null (auth just completed, lookup has not started yet)', () => {
    expect(isStillResolving({ accountResolution: null, restorationStatus: 'idle' })).toBe(true);
  });

  it('accountResolution is pending (the account lookup is in flight)', () => {
    expect(isStillResolving({ accountResolution: 'pending', restorationStatus: 'idle' })).toBe(true);
  });

  it('accountResolution is returning but restoration has not reached ready', () => {
    expect(isStillResolving({ accountResolution: 'returning', restorationStatus: 'loading' })).toBe(
      true,
    );
    expect(isStillResolving({ accountResolution: 'returning', restorationStatus: 'idle' })).toBe(true);
  });

  it('accountResolution is returning and restoration is ready -- resolved, not stuck', () => {
    expect(isStillResolving({ accountResolution: 'returning', restorationStatus: 'ready' })).toBe(
      false,
    );
  });

  it('a genuinely new account is never considered "still resolving"', () => {
    expect(isStillResolving({ accountResolution: 'new', restorationStatus: 'idle' })).toBe(false);
  });

  it('an already-blocked account is never considered "still resolving"', () => {
    expect(isStillResolving({ accountResolution: 'blocked', restorationStatus: 'idle' })).toBe(false);
  });
});

describe('scheduleRestorationWatchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('the account lookup itself never resolving still fires the watchdog', async () => {
    const onTimeout = vi.fn();
    scheduleRestorationWatchdog({
      durationMs: 30000,
      getSnapshot: () => ({ accountResolution: null, restorationStatus: 'idle' }),
      onTimeout,
    });

    await vi.advanceTimersByTimeAsync(30000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('restoration (profile/chat/journal fetch) never resolving still fires the watchdog', async () => {
    const onTimeout = vi.fn();
    scheduleRestorationWatchdog({
      durationMs: 30000,
      getSnapshot: () => ({ accountResolution: 'returning', restorationStatus: 'loading' }),
      onTimeout,
    });

    await vi.advanceTimersByTimeAsync(30000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('a SecureStore/backend/RevenueCat dependency hanging looks identical to the watchdog -- it only observes accountResolution/restoration.status, not the cause', async () => {
    // Whatever hung -- a SecureStore read, the session-exchange fetch, the
    // profile-diagnostic fetch, restoreStartupAccountData, RevenueCat -- the
    // only way it can present to this snapshot is "accountResolution/status
    // never advanced." This test exists to make that assumption explicit.
    const onTimeout = vi.fn();
    scheduleRestorationWatchdog({
      durationMs: 30000,
      getSnapshot: () => ({ accountResolution: 'pending', restorationStatus: 'idle' }),
      onTimeout,
    });

    await vi.advanceTimersByTimeAsync(30000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('does not fire if resolution genuinely completed before the deadline', async () => {
    const onTimeout = vi.fn();
    let resolution: 'ready' | 'loading' = 'loading';
    scheduleRestorationWatchdog({
      durationMs: 30000,
      getSnapshot: () => ({ accountResolution: 'returning', restorationStatus: resolution }),
      onTimeout,
    });

    resolution = 'ready';
    await vi.advanceTimersByTimeAsync(30000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('does not fire before the deadline even if still resolving', async () => {
    const onTimeout = vi.fn();
    scheduleRestorationWatchdog({
      durationMs: 30000,
      getSnapshot: () => ({ accountResolution: 'pending', restorationStatus: 'idle' }),
      onTimeout,
    });

    await vi.advanceTimersByTimeAsync(29999);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('cancelling (component unmount / effect cleanup) prevents onTimeout from ever firing', async () => {
    const onTimeout = vi.fn();
    const cancel = scheduleRestorationWatchdog({
      durationMs: 30000,
      getSnapshot: () => ({ accountResolution: 'pending', restorationStatus: 'idle' }),
      onTimeout,
    });

    cancel();
    await vi.advanceTimersByTimeAsync(30000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('a genuinely new account never triggers the watchdog even if it fires', async () => {
    const onTimeout = vi.fn();
    scheduleRestorationWatchdog({
      durationMs: 30000,
      getSnapshot: () => ({ accountResolution: 'new', restorationStatus: 'idle' }),
      onTimeout,
    });

    await vi.advanceTimersByTimeAsync(30000);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
