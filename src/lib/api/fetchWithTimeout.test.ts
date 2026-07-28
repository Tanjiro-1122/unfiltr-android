import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FetchTimeoutError, fetchWithTimeout } from './fetchWithTimeout';

describe('fetchWithTimeout', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it('resolves normally when the network responds before the timeout', async () => {
    const response = new Response('ok', { status: 200 });
    globalThis.fetch = vi.fn().mockResolvedValue(response);

    await expect(fetchWithTimeout('https://example.test/api', {}, 5000)).resolves.toBe(response);
  });

  it('a request that never responds is aborted and rejects with FetchTimeoutError, not left hanging', async () => {
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

    const promise = fetchWithTimeout('https://example.test/api', {}, 5000);
    const assertion = expect(promise).rejects.toBeInstanceOf(FetchTimeoutError);
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  it('passes through a genuine network error (e.g. DNS/connection failure) unchanged', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Network request failed'));

    await expect(fetchWithTimeout('https://example.test/api', {}, 5000)).rejects.toThrow(
      'Network request failed',
    );
  });
});
