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
