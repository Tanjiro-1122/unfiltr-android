import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TimeoutError, withTimeout } from './withTimeout';

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the underlying value when it settles before the timeout', async () => {
    const promise = withTimeout(Promise.resolve('ok'), 1000);
    await expect(promise).resolves.toBe('ok');
  });

  it('rejects with the underlying error when it rejects before the timeout', async () => {
    const promise = withTimeout(Promise.reject(new Error('boom')), 1000);
    await expect(promise).rejects.toThrow('boom');
  });

  it('a promise that never settles is still rejected with TimeoutError once the timer elapses', async () => {
    const neverSettles = new Promise(() => {});
    const promise = withTimeout(neverSettles, 5000);

    const assertion = expect(promise).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  it('does not fire the timeout once the underlying promise has already resolved', async () => {
    const promise = withTimeout(Promise.resolve('fast'), 5000);
    await expect(promise).resolves.toBe('fast');

    // If the timer were not cleared this would throw an unhandled rejection.
    await vi.advanceTimersByTimeAsync(5000);
  });
});
