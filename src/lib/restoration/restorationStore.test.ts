import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentAccountId = vi.fn();
const getCachedAccountJson = vi.fn();
const setCachedAccountJson = vi.fn();
const clearCurrentAccountCache = vi.fn();

vi.mock('@/lib/restoration/accountCache', () => ({
  getCurrentAccountId: (...args: unknown[]) => getCurrentAccountId(...args),
  getCachedAccountJson: (...args: unknown[]) => getCachedAccountJson(...args),
  setCachedAccountJson: (...args: unknown[]) => setCachedAccountJson(...args),
  clearCurrentAccountCache: (...args: unknown[]) => clearCurrentAccountCache(...args),
}));

const restoreStartupAccountData = vi.fn();

vi.mock('@/lib/restoration/startupRestoration', () => ({
  restoreStartupAccountData: (...args: unknown[]) => restoreStartupAccountData(...args),
}));

const emptyRemoteData = { data: null, source: 'unavailable' as const };

function fakeStartupResult(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    authenticationStatus: 'authenticated' as const,
    chatHistory: emptyRemoteData,
    companionMemory: emptyRemoteData,
    errorSummaries: [],
    journalEntries: emptyRemoteData,
    profile: { data: { id: 'profile_1' }, source: 'remote' as const },
    ...overrides,
  };
}

describe('refreshRestoration', () => {
  beforeEach(() => {
    vi.resetModules();
    getCurrentAccountId.mockReset().mockResolvedValue('account_1');
    getCachedAccountJson.mockReset().mockResolvedValue(null);
    setCachedAccountJson.mockReset().mockResolvedValue(undefined);
    clearCurrentAccountCache.mockReset().mockResolvedValue(undefined);
    restoreStartupAccountData.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a valid returning session with a real profile settles status to ready with remote data', async () => {
    restoreStartupAccountData.mockResolvedValue(fakeStartupResult());

    const { refreshRestoration, getRestorationSnapshot } = await import('./restorationStore');
    await refreshRestoration();

    const snapshot = getRestorationSnapshot();
    expect(snapshot.status).toBe('ready');
    expect(snapshot.profile.data).toEqual({ id: 'profile_1' });
    expect(snapshot.profile.source).toBe('remote');
  });

  it('a profile request that never settles is bounded by RESTORATION_HARD_TIMEOUT_MS -- never leaves status stuck at loading', async () => {
    vi.useFakeTimers();
    restoreStartupAccountData.mockReturnValue(new Promise(() => {}));

    const { refreshRestoration, getRestorationSnapshot, RESTORATION_HARD_TIMEOUT_MS } =
      await import('./restorationStore');

    const resultPromise = refreshRestoration();
    await vi.advanceTimersByTimeAsync(RESTORATION_HARD_TIMEOUT_MS);
    await resultPromise;

    const snapshot = getRestorationSnapshot();
    expect(snapshot.status).toBe('ready');
  });

  it('a network failure falls back to cached profile data instead of leaving the account unresolved', async () => {
    restoreStartupAccountData.mockRejectedValue(new TypeError('Network request failed'));
    getCachedAccountJson.mockImplementation(async (area: string) =>
      area === 'profile' ? { id: 'cached_profile' } : null,
    );

    const { refreshRestoration, getRestorationSnapshot } = await import('./restorationStore');
    await refreshRestoration();

    const snapshot = getRestorationSnapshot();
    expect(snapshot.status).toBe('ready');
    expect(snapshot.profile.data).toEqual({ id: 'cached_profile' });
    expect(snapshot.profile.source).toBe('cached');
  });

  it('a malformed response with no profile settles to ready with an unavailable profile, not a crash', async () => {
    restoreStartupAccountData.mockResolvedValue(
      fakeStartupResult({ profile: { data: null, source: 'unavailable' } }),
    );

    const { refreshRestoration, getRestorationSnapshot } = await import('./restorationStore');
    await refreshRestoration();

    const snapshot = getRestorationSnapshot();
    expect(snapshot.status).toBe('ready');
    expect(snapshot.profile.data).toBeNull();
    expect(snapshot.profile.source).toBe('unavailable');
  });

  it('a second call while the first is still in flight reuses the same in-flight promise', async () => {
    let resolveFirst: (value: ReturnType<typeof fakeStartupResult>) => void = () => {};
    restoreStartupAccountData.mockReturnValue(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );

    const { refreshRestoration } = await import('./restorationStore');
    const first = refreshRestoration();
    // Let the first call's pre-restoreStartupAccountData awaits (account ID
    // lookup) settle so restorePromise is actually assigned before the
    // second call checks it -- otherwise both calls race the same guard.
    await Promise.resolve();
    await Promise.resolve();
    const second = refreshRestoration();

    resolveFirst(fakeStartupResult());
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(restoreStartupAccountData).toHaveBeenCalledTimes(1);
    expect(firstResult).toBe(secondResult);
  });

  it('after a timeout settles the in-flight promise, a later retry starts a genuinely new attempt', async () => {
    vi.useFakeTimers();
    restoreStartupAccountData.mockReturnValueOnce(new Promise(() => {}));

    const { refreshRestoration, RESTORATION_HARD_TIMEOUT_MS } = await import('./restorationStore');
    const first = refreshRestoration();
    await vi.advanceTimersByTimeAsync(RESTORATION_HARD_TIMEOUT_MS);
    await first;

    restoreStartupAccountData.mockResolvedValueOnce(fakeStartupResult());
    await refreshRestoration();

    expect(restoreStartupAccountData).toHaveBeenCalledTimes(2);
  });
});
