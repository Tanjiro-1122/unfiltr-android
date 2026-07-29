import { beforeEach, describe, expect, it, vi } from 'vitest';

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

function confirmedActivation() {
  return {
    activated: true,
    tier: 'family',
    profile: { id: 'profile-1', is_family: true, is_premium: true, tier: 'family' },
  };
}

describe('verifyFamilyAccess', () => {
  beforeEach(() => {
    vi.resetModules();
    post.mockReset();
  });

  it('rejects an empty code without calling the network', async () => {
    const { verifyFamilyAccess } = await import('./familyAccess');

    const result = await verifyFamilyAccess('   ');

    expect(result).toEqual({ ok: false, reason: 'invalid', message: 'Enter a valid code.' });
    expect(post).not.toHaveBeenCalled();
  });

  it('a fully confirmed activation (activated + family tier + is_family + is_premium) succeeds', async () => {
    post.mockResolvedValueOnce(confirmedActivation());
    const { verifyFamilyAccess } = await import('./familyAccess');

    const result = await verifyFamilyAccess('valid-code');

    expect(result.ok).toBe(true);
    expect(post).toHaveBeenCalledWith('/api/profile', {
      action: 'activateFamily',
      code: 'valid-code',
    });
  });

  it('a response missing any of the four confirmation fields is never treated as success', async () => {
    post.mockResolvedValueOnce({ activated: true, tier: 'family', profile: { is_family: true, is_premium: false } });
    const { verifyFamilyAccess } = await import('./familyAccess');

    const result = await verifyFamilyAccess('valid-code');

    expect(result).toEqual({
      ok: false,
      reason: 'unconfirmed',
      message: 'Family access was not confirmed by the server.',
    });
  });

  it('400 (malformed code) is reported as invalid', async () => {
    post.mockRejectedValueOnce(new MockApiError('bad request', 400));
    const { verifyFamilyAccess } = await import('./familyAccess');

    const result = await verifyFamilyAccess('some-code');

    expect(result).toEqual({ ok: false, reason: 'invalid', message: 'Enter a valid code.' });
  });

  it('401 (session expired) asks the user to sign in again rather than failing silently', async () => {
    post.mockRejectedValueOnce(new MockApiError('unauthorized', 401));
    const { verifyFamilyAccess } = await import('./familyAccess');

    const result = await verifyFamilyAccess('some-code');

    expect(result).toEqual({
      ok: false,
      reason: 'unauthenticated',
      message: 'Sign in with Apple again before activating family access.',
    });
  });

  it('403 (wrong/expired code) is reported as an invalid code, never as success', async () => {
    post.mockRejectedValueOnce(new MockApiError('forbidden', 403));
    const { verifyFamilyAccess } = await import('./familyAccess');

    const result = await verifyFamilyAccess('some-code');

    expect(result).toEqual({ ok: false, reason: 'invalid', message: 'Invalid code.' });
  });

  it('404 (route not deployed) is reported honestly as not configured, not hidden behind a generic error', async () => {
    post.mockRejectedValueOnce(new MockApiError('not found', 404));
    const { verifyFamilyAccess } = await import('./familyAccess');

    const result = await verifyFamilyAccess('some-code');

    expect(result).toEqual({
      ok: false,
      reason: 'missing-route',
      message: 'Family access is not configured on the server yet.',
    });
  });

  it('503 (server configuration incomplete, e.g. missing Supabase table or env var) is reported honestly, not replaced with fake success', async () => {
    post.mockRejectedValueOnce(new MockApiError('server not configured', 503));
    const { verifyFamilyAccess } = await import('./familyAccess');

    const result = await verifyFamilyAccess('some-code');

    expect(result).toEqual({
      ok: false,
      reason: 'missing-route',
      message: 'Family access is not configured on the server yet.',
    });
  });

  it('an unrecognized ApiError status is reported as unknown, not silently swallowed', async () => {
    post.mockRejectedValueOnce(new MockApiError('teapot', 418));
    const { verifyFamilyAccess } = await import('./familyAccess');

    const result = await verifyFamilyAccess('some-code');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unknown');
  });

  it('a non-ApiError failure (network down) is reported as offline, distinct from a server-side rejection', async () => {
    post.mockRejectedValueOnce(new Error('fetch failed'));
    const { verifyFamilyAccess } = await import('./familyAccess');

    const result = await verifyFamilyAccess('some-code');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('offline');
  });
});
