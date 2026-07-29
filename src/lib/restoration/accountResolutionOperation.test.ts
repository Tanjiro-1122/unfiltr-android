import { describe, expect, it, vi } from 'vitest';

import type { ProfileDiagnosticResult } from '@/lib/accountDiagnostic';
import { createOperationGuard } from '@/lib/async/operationGuard';

import { runAccountResolutionOperation } from './accountResolutionOperation';

// @/lib/accountDiagnostic's barrel also exports runProfileDiagnostic, which
// transitively pulls in apiClient's full dependency chain (react-native
// itself among them) -- not needed here, and real react-native fails to
// parse under vitest without the project's native-module test setup.
// Re-implements classifyProfileDiagnostic/unavailableProfileDiagnostic's
// exact (simple, pure) logic rather than weakening what's under test --
// production code (accountResolutionOperation.ts) still imports the real
// functions; only this test's module resolution is mocked.
vi.mock('@/lib/accountDiagnostic', () => ({
  classifyProfileDiagnostic: (result: ProfileDiagnosticResult) => {
    if ((result.status === 'found' || result.status === 'ok') && result.profileCount === 1) {
      return 'allow';
    }
    if (result.status === 'not_found' || result.profileCount === 0) return 'not_found';
    if (result.status === 'unavailable') return 'unavailable';
    return 'ambiguous';
  },
  unavailableProfileDiagnostic: (): ProfileDiagnosticResult => ({
    chatHistoryCount: 0,
    identifierHash: null,
    journalCount: 0,
    memoryCount: 0,
    profileCount: 0,
    status: 'unavailable',
  }),
}));

function foundDiagnostic(): ProfileDiagnosticResult {
  return {
    chatHistoryCount: 0,
    identifierHash: 'hash',
    journalCount: 0,
    memoryCount: 0,
    profileCount: 1,
    status: 'found',
  };
}

function notFoundDiagnostic(): ProfileDiagnosticResult {
  return {
    chatHistoryCount: 0,
    identifierHash: 'hash',
    journalCount: 0,
    memoryCount: 0,
    profileCount: 0,
    status: 'not_found',
  };
}

function baseDeps(overrides: Partial<Parameters<typeof runAccountResolutionOperation>[0]> = {}) {
  return {
    isStale: () => false,
    onBlocked: vi.fn(),
    onNew: vi.fn(),
    onPending: vi.fn(),
    onReturning: vi.fn(),
    onSettled: vi.fn(),
    recordStage: vi.fn(),
    runDiagnostic: vi.fn(async () => foundDiagnostic()),
    startRestoration: vi.fn(),
    ...overrides,
  };
}

describe('runAccountResolutionOperation', () => {
  it('setting pending does not cancel the same operation -- this is the exact former bug: onPending used to be a state write that was ALSO one of the effect\'s own dependencies, so React treated it as a reason to cancel the very operation that just started', async () => {
    const deps = baseDeps();

    await runAccountResolutionOperation(deps);

    // onPending fired (equivalent of setAccountResolution('pending')), and
    // the operation still ran to completion afterward -- proving that
    // firing onPending is not itself treated as cancellation.
    expect(deps.onPending).toHaveBeenCalledTimes(1);
    expect(deps.onReturning).toHaveBeenCalledTimes(1);
    expect(deps.onSettled).toHaveBeenCalledTimes(1);
  });

  it('a successful diagnostic with status "found" classifies as returning and calls startRestoration -- the step that never happened under the old bug', async () => {
    const deps = baseDeps({ runDiagnostic: vi.fn(async () => foundDiagnostic()) });

    await runAccountResolutionOperation(deps);

    expect(deps.onReturning).toHaveBeenCalledTimes(1);
    expect(deps.startRestoration).toHaveBeenCalledTimes(1);
    expect(deps.onNew).not.toHaveBeenCalled();
    expect(deps.onBlocked).not.toHaveBeenCalled();
  });

  it('a successful diagnostic with status "not_found" classifies as new and never calls startRestoration', async () => {
    const deps = baseDeps({ runDiagnostic: vi.fn(async () => notFoundDiagnostic()) });

    await runAccountResolutionOperation(deps);

    expect(deps.onNew).toHaveBeenCalledTimes(1);
    expect(deps.startRestoration).not.toHaveBeenCalled();
    expect(deps.onReturning).not.toHaveBeenCalled();
  });

  it('stale/old operation results are ignored: a slow operation superseded by a newer one never fires any of its callbacks', async () => {
    const guard = createOperationGuard();
    const staleId = guard.begin();

    let resolveDiagnostic!: (value: ProfileDiagnosticResult) => void;
    const slowDiagnostic = new Promise<ProfileDiagnosticResult>((resolve) => {
      resolveDiagnostic = resolve;
    });

    const deps = baseDeps({
      isStale: () => guard.isStale(staleId),
      runDiagnostic: () => slowDiagnostic,
    });

    const operation = runAccountResolutionOperation(deps);

    // A newer operation begins before the slow diagnostic resolves --
    // simulating Retry (or a fresh sign-in) superseding this attempt.
    guard.begin();

    resolveDiagnostic(foundDiagnostic());
    await operation;

    // onPending already fired before staleness could be known (matching
    // the real effect, which sets 'pending' synchronously up front), but
    // nothing that depends on the (now-stale) diagnostic result should
    // ever fire.
    expect(deps.onPending).toHaveBeenCalledTimes(1);
    expect(deps.onReturning).not.toHaveBeenCalled();
    expect(deps.onNew).not.toHaveBeenCalled();
    expect(deps.onBlocked).not.toHaveBeenCalled();
    expect(deps.onSettled).not.toHaveBeenCalled();
    expect(deps.startRestoration).not.toHaveBeenCalled();
  });

  it('a genuine unmount (guard invalidated) after the operation begins also suppresses its callbacks', async () => {
    const guard = createOperationGuard();
    const id = guard.begin();

    let resolveDiagnostic!: (value: ProfileDiagnosticResult) => void;
    const slowDiagnostic = new Promise<ProfileDiagnosticResult>((resolve) => {
      resolveDiagnostic = resolve;
    });

    const deps = baseDeps({
      isStale: () => guard.isStale(id),
      runDiagnostic: () => slowDiagnostic,
    });

    const operation = runAccountResolutionOperation(deps);
    guard.invalidate();
    resolveDiagnostic(foundDiagnostic());
    await operation;

    expect(deps.onReturning).not.toHaveBeenCalled();
    expect(deps.onSettled).not.toHaveBeenCalled();
  });

  it('a diagnostic rejection (timeout or network failure) still resolves to an explicit state, not a silent hang', async () => {
    const deps = baseDeps({
      runDiagnostic: vi.fn(async () => {
        throw new Error('network down');
      }),
    });

    await runAccountResolutionOperation(deps);

    // unavailableProfileDiagnostic() -> { profileCount: 0, status:
    // 'unavailable' }. classifyProfileDiagnostic (untouched by this fix,
    // pre-existing behavior, not something this round changes) checks
    // profileCount === 0 before status === 'unavailable', so this lands on
    // 'not_found' -> onNew, not onBlocked. Whether that bucket ordering is
    // itself right is a separate question from the bug this file fixes;
    // what matters here is that SOME explicit terminal state is always
    // reached -- never a silent hang at 'pending'.
    expect(deps.onNew).toHaveBeenCalledTimes(1);
    expect(deps.onBlocked).not.toHaveBeenCalled();
    expect(deps.onSettled).toHaveBeenCalledTimes(1);
  });

  it('classify throwing unexpectedly still settles to blocked rather than leaving the operation stuck', async () => {
    const deps = baseDeps({
      classify: vi.fn(() => {
        throw new Error('boom');
      }),
    });

    await runAccountResolutionOperation(deps);

    expect(deps.onBlocked).toHaveBeenCalledTimes(1);
    expect(deps.onSettled).toHaveBeenCalledTimes(1);
  });
});
