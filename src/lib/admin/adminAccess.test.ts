import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

const store = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'afterFirstUnlockThisDeviceOnly',
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    store.delete(key);
  }),
}));

class MockApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const post = vi.fn();

vi.mock('@/lib/api', () => ({
  apiClient: { post: (...args: unknown[]) => post(...args) },
  ApiError: MockApiError,
}));

describe('verifyAdminAccess', () => {
  beforeEach(() => {
    vi.resetModules();
    store.clear();
    post.mockReset();
  });

  it('rejects an empty code without calling the network', async () => {
    const { verifyAdminAccess } = await import('./adminAccess');

    const result = await verifyAdminAccess('   ');

    expect(result).toEqual({ ok: false, reason: 'invalid', message: 'Enter the owner code.' });
    expect(post).not.toHaveBeenCalled();
  });

  it('an owner-role-confirmed response unlocks admin access and persists the unlock', async () => {
    post.mockResolvedValueOnce({ type: 'admin' });
    const { verifyAdminAccess } = await import('./adminAccess');

    const result = await verifyAdminAccess('correct-code');

    expect(result).toEqual({ ok: true });
    expect(store.get('unfiltr_admin_unlocked')).toBe('true');
    expect(post).toHaveBeenCalledWith('/api/utils', {
      action: 'verifySpecialCode',
      code: 'correct-code',
    });
  });

  it('a response whose type is not "admin" is treated as an invalid code, not silently trusted', async () => {
    post.mockResolvedValueOnce({ type: 'family' });
    const { verifyAdminAccess } = await import('./adminAccess');

    const result = await verifyAdminAccess('some-code');

    expect(result).toEqual({
      ok: false,
      reason: 'invalid',
      message: 'The owner code was not accepted.',
    });
  });

  it('401 (session expired/unauthenticated) surfaces a re-auth message, not a silent failure', async () => {
    post.mockRejectedValueOnce(new MockApiError('unauthorized', 401));
    const { verifyAdminAccess } = await import('./adminAccess');

    const result = await verifyAdminAccess('some-code');

    expect(result).toEqual({
      ok: false,
      reason: 'unauthenticated',
      message: 'Sign in with Apple again before opening owner tools.',
    });
  });

  it('403 (owner role not granted / expired) is reported as an invalid code, never as success', async () => {
    post.mockRejectedValueOnce(new MockApiError('forbidden', 403));
    const { verifyAdminAccess } = await import('./adminAccess');

    const result = await verifyAdminAccess('some-code');

    expect(result).toEqual({
      ok: false,
      reason: 'invalid',
      message: 'The owner code was not accepted.',
    });
  });

  it('404 (route not deployed) is reported honestly as a missing route, not hidden behind a generic error', async () => {
    post.mockRejectedValueOnce(new MockApiError('not found', 404));
    const { verifyAdminAccess } = await import('./adminAccess');

    const result = await verifyAdminAccess('some-code');

    expect(result).toEqual({
      ok: false,
      reason: 'missing-route',
      message: 'The protected owner route is not available on the configured backend.',
    });
  });

  it('503 (server configuration incomplete, e.g. missing table/env var) maps to the same honest missing-route message as 404', async () => {
    post.mockRejectedValueOnce(new MockApiError('server not configured', 503));
    const { verifyAdminAccess } = await import('./adminAccess');

    const result = await verifyAdminAccess('some-code');

    expect(result).toEqual({
      ok: false,
      reason: 'missing-route',
      message: 'The protected owner route is not available on the configured backend.',
    });
  });

  it('an unrecognized ApiError status is reported as unknown, not silently swallowed', async () => {
    post.mockRejectedValueOnce(new MockApiError('teapot', 418));
    const { verifyAdminAccess } = await import('./adminAccess');

    const result = await verifyAdminAccess('some-code');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unknown');
  });

  it('a non-ApiError failure (network down) is reported as offline, distinct from a server-side rejection', async () => {
    post.mockRejectedValueOnce(new Error('fetch failed'));
    const { verifyAdminAccess } = await import('./adminAccess');

    const result = await verifyAdminAccess('some-code');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('offline');
  });

  it('any failed verification clears a previously stored unlock, so a stale unlock never survives a bad attempt', async () => {
    store.set('unfiltr_admin_unlocked', 'true');
    store.set('unfiltr_admin_unlocked_at', String(Date.now()));
    post.mockRejectedValueOnce(new MockApiError('forbidden', 403));
    const { verifyAdminAccess } = await import('./adminAccess');

    await verifyAdminAccess('wrong-code');

    expect(store.has('unfiltr_admin_unlocked')).toBe(false);
    expect(store.has('unfiltr_admin_unlocked_at')).toBe(false);
  });
});

describe('hasActiveAdminAccess', () => {
  beforeEach(() => {
    vi.resetModules();
    store.clear();
    post.mockReset();
  });

  it('an unlock older than the session max age is treated as expired and cleared', async () => {
    store.set('unfiltr_admin_unlocked', 'true');
    store.set('unfiltr_admin_unlocked_at', String(Date.now() - 31 * 60 * 1000));
    const { hasActiveAdminAccess } = await import('./adminAccess');

    const active = await hasActiveAdminAccess();

    expect(active).toBe(false);
    expect(store.has('unfiltr_admin_unlocked')).toBe(false);
  });

  it('a recent unlock within the session max age is still active', async () => {
    store.set('unfiltr_admin_unlocked', 'true');
    store.set('unfiltr_admin_unlocked_at', String(Date.now() - 1000));
    const { hasActiveAdminAccess } = await import('./adminAccess');

    const active = await hasActiveAdminAccess();

    expect(active).toBe(true);
  });

  it('no stored unlock at all is inactive', async () => {
    const { hasActiveAdminAccess } = await import('./adminAccess');

    const active = await hasActiveAdminAccess();

    expect(active).toBe(false);
  });
});
