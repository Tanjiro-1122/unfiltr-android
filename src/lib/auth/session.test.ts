import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

const secureStore = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'afterFirstUnlockThisDeviceOnly',
  getItemAsync: vi.fn(async (key: string) => secureStore.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secureStore.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    secureStore.delete(key);
  }),
}));

vi.mock('@/config', () => ({
  env: { apiBaseUrl: 'https://api.example.test' },
}));

function jwtWithExpiry(expiresAt: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp: expiresAt })).toString('base64url');
  return `${header}.${payload}.sig`;
}

describe('session restoration', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    secureStore.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('a valid, unexpired session is reused without re-exchanging the identity token', async () => {
    const { recoverBackendSession } = await import('./session');
    const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
    secureStore.set('auth.accessToken', jwtWithExpiry(futureExpiry));

    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const result = await recoverBackendSession();

    expect(result).toMatchObject({ authenticated: true, recovered: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('an expired token is discarded and re-exchanged using the stored identity token', async () => {
    const { recoverBackendSession } = await import('./session');
    const pastExpiry = Math.floor(Date.now() / 1000) - 10;
    secureStore.set('auth.accessToken', jwtWithExpiry(pastExpiry));
    secureStore.set('auth.appleIdentityToken', 'stored-identity-token');

    const freshExpiry = Math.floor(Date.now() / 1000) + 3600;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ accessToken: 'fresh-token', appleUserId: 'user_1', expiresAt: freshExpiry }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const result = await recoverBackendSession();

    expect(result).toMatchObject({ authenticated: true, recovered: true, accessToken: 'fresh-token' });
  });

  it('no session and no stored identity token resolves unauthenticated without any network call', async () => {
    const { recoverBackendSession } = await import('./session');

    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const result = await recoverBackendSession();

    expect(result).toMatchObject({ authenticated: false, status: 'unauthenticated' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('a network that never responds to the exchange still resolves (bounded by fetchWithTimeout), not hangs', async () => {
    vi.useFakeTimers();
    const { recoverBackendSession } = await import('./session');
    secureStore.set('auth.appleIdentityToken', 'stored-identity-token');

    globalThis.fetch = vi.fn(
      (_input: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    ) as unknown as typeof fetch;

    const resultPromise = recoverBackendSession();
    await vi.advanceTimersByTimeAsync(20000);
    const result = await resultPromise;

    expect(result).toMatchObject({ authenticated: false, status: 'unauthenticated' });
  });

  it('a malformed exchange response (no accessToken) is treated as a failed recovery, not a crash', async () => {
    const { recoverBackendSession } = await import('./session');
    secureStore.set('auth.appleIdentityToken', 'stored-identity-token');

    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ unexpected: true }), { status: 200 })) as unknown as typeof fetch;

    const result = await recoverBackendSession();

    expect(result).toMatchObject({ authenticated: false, status: 'unauthenticated' });
  });
});

describe('exchangeGoogleIdentityToken', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    secureStore.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('a successful exchange returns the session and persists it under the shared identity keys', async () => {
    const { exchangeGoogleIdentityToken } = await import('./session');
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ accessToken: 'google-access-token', googleUserId: 'g_user_1', expiresAt }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const session = await exchangeGoogleIdentityToken('id-token');

    expect(session).toMatchObject({ accessToken: 'google-access-token', appleUserId: 'g_user_1', expiresAt });
    expect(secureStore.get('auth.userId')).toBe('g_user_1');
    expect(secureStore.get('auth.appleUserId')).toBe('g_user_1');
  });

  it('threads the status field through, and records identity-found/identity-not-found/new-user-created accordingly', async () => {
    const { exchangeGoogleIdentityToken } = await import('./session');
    const { clearRestorationDiagnostics, getRestorationDiagnostics } = await import(
      '@/lib/diagnostics/restorationDiagnostics'
    );
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;

    clearRestorationDiagnostics();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ accessToken: 'tok', googleUserId: 'new-user-1', expiresAt, status: 'new_user' }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;
    const newUserSession = await exchangeGoogleIdentityToken('id-token');
    expect(newUserSession.status).toBe('new_user');
    const newUserStages = getRestorationDiagnostics().map((entry) => entry.stage);
    expect(newUserStages).toContain('identity-not-found');
    expect(newUserStages).toContain('new-user-created');

    clearRestorationDiagnostics();
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: 'tok',
          googleUserId: 'returning-user-1',
          expiresAt,
          status: 'existing_user_restored',
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;
    const returningSession = await exchangeGoogleIdentityToken('id-token');
    expect(returningSession.status).toBe('existing_user_restored');
    const returningStages = getRestorationDiagnostics().map((entry) => entry.stage);
    expect(returningStages).toContain('identity-found');
    expect(returningStages).not.toContain('new-user-created');
  });

  it('an existing account (same googleUserId as a previous sign-in) resolves to the same identity keys', async () => {
    const { exchangeGoogleIdentityToken } = await import('./session');
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ accessToken: 'token-a', googleUserId: 'returning_user', expiresAt }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    await exchangeGoogleIdentityToken('id-token-first-sign-in');
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ accessToken: 'token-b', googleUserId: 'returning_user', expiresAt }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;
    const second = await exchangeGoogleIdentityToken('id-token-second-sign-in');

    expect(second.appleUserId).toBe('returning_user');
    expect(secureStore.get('auth.userId')).toBe('returning_user');
  });

  it('an invalid-audience rejection from the backend surfaces the INVALID_AUDIENCE code, not a generic message', async () => {
    const { exchangeGoogleIdentityToken, GoogleSessionExchangeError } = await import('./session');
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: 'Google identity token was issued for a different client.', code: 'INVALID_AUDIENCE' }),
        { status: 401 },
      ),
    ) as unknown as typeof fetch;

    await expect(exchangeGoogleIdentityToken('id-token')).rejects.toMatchObject(
      new GoogleSessionExchangeError('INVALID_AUDIENCE', 'Google identity token was issued for a different client.'),
    );
  });

  it('an expired-token rejection surfaces the TOKEN_EXPIRED code', async () => {
    const { exchangeGoogleIdentityToken, GoogleSessionExchangeError } = await import('./session');
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: 'Google identity token has expired.', code: 'TOKEN_EXPIRED' }),
        { status: 401 },
      ),
    ) as unknown as typeof fetch;

    try {
      await exchangeGoogleIdentityToken('id-token');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(GoogleSessionExchangeError);
      expect((error as InstanceType<typeof GoogleSessionExchangeError>).code).toBe('TOKEN_EXPIRED');
    }
  });

  it('the route not existing (a 404 with an HTML body, not JSON) is surfaced as UNKNOWN_ERROR rather than crashing on JSON parsing', async () => {
    const { exchangeGoogleIdentityToken, GoogleSessionExchangeError } = await import('./session');
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('<html>404</html>', { status: 404 })) as unknown as typeof fetch;

    await expect(exchangeGoogleIdentityToken('id-token')).rejects.toMatchObject(
      new GoogleSessionExchangeError('UNKNOWN_ERROR', 'Google session exchange failed.'),
    );
  });

  it('a 200 response with no accessToken (malformed) is rejected as MALFORMED_RESPONSE', async () => {
    const { exchangeGoogleIdentityToken, GoogleSessionExchangeError } = await import('./session');
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ unexpected: true }), { status: 200 })) as unknown as typeof fetch;

    await expect(exchangeGoogleIdentityToken('id-token')).rejects.toMatchObject(
      new GoogleSessionExchangeError('MALFORMED_RESPONSE', 'Google session exchange failed.'),
    );
  });
});
