import { describe, expect, it } from 'vitest';

import { createOperationGuard } from './operationGuard';

describe('createOperationGuard', () => {
  it('an operation is never stale relative to itself, even after other state changes', () => {
    const guard = createOperationGuard();
    const id = guard.begin();

    // Simulates the exact former bug's shape: something else happens (a
    // re-render, a state update) between begin() and the check, but no
    // NEW operation begins and no invalidate() happens. The operation
    // must still see itself as current.
    expect(guard.isStale(id)).toBe(false);
    expect(guard.isStale(id)).toBe(false);
  });

  it('a second begin() makes the first operation stale (Retry / a genuine new attempt)', () => {
    const guard = createOperationGuard();
    const first = guard.begin();
    expect(guard.isStale(first)).toBe(false);

    const second = guard.begin();
    expect(guard.isStale(first)).toBe(true);
    expect(guard.isStale(second)).toBe(false);
  });

  it('invalidate() makes the current operation stale (a genuine unmount)', () => {
    const guard = createOperationGuard();
    const id = guard.begin();
    expect(guard.isStale(id)).toBe(false);

    guard.invalidate();
    expect(guard.isStale(id)).toBe(true);
  });

  it('an operation that begins before invalidate() is called stays stale for any later stale check, even across further begins', () => {
    const guard = createOperationGuard();
    const first = guard.begin();
    guard.invalidate();
    const second = guard.begin();

    expect(guard.isStale(first)).toBe(true);
    expect(guard.isStale(second)).toBe(false);
  });
});
