import {
  classifyProfileDiagnostic,
  unavailableProfileDiagnostic,
  type ProfileDiagnosticResult,
} from '@/lib/accountDiagnostic';
import { TimeoutError } from '@/lib/async/withTimeout';
import { recordRestorationStage } from '@/lib/diagnostics/restorationDiagnostics';

/**
 * One attempt at resolving the signed-in account (new / returning / blocked),
 * extracted out of app/index.tsx's effect so it can be unit tested directly
 * -- see accountResolutionOperation.test.ts for the exact former failure
 * this reproduces and fixes (a self-cancelling operation that silently
 * skipped classification/restoration on every attempt).
 *
 * `isStale` is expected to be backed by an OperationGuard (see
 * operationGuard.ts) keyed on a stable ref in the caller, NOT on React
 * state this function itself sets -- that decoupling is the actual fix.
 */
export type AccountIntent = 'createAccount' | 'signIn';

export type ResolveAccountOperationDeps = {
  classify?: typeof classifyProfileDiagnostic;
  // Which button the user pressed on AccountChoiceScreen. Undefined only
  // for capture/preview screens that skip account resolution entirely --
  // every real resolution attempt has one. Governs ONLY the 'not_found'
  // branch below: 'allow' always restores the existing account regardless
  // of intent (an exact provider-identity match is never treated as an
  // error), and intent never affects 'ambiguous'/'unavailable' (-> blocked).
  intent?: AccountIntent;
  isStale: () => boolean;
  onBlocked: () => void;
  onNew: () => void;
  onPending: () => void;
  onReturning: () => void;
  // Called once the operation is fully done (success or failure) and only
  // if it is not stale -- the equivalent of the old `finally` block's
  // `setIsRestoreRetrying(false)`.
  onSettled: () => void;
  // 'not_found' while intent === 'signIn': Sign In must never silently
  // create a new account, so this is called instead of onNew.
  onSignInNotFound: () => void;
  recordStage?: typeof recordRestorationStage;
  runDiagnostic: () => Promise<ProfileDiagnosticResult>;
  // Triggers refreshRestoration() (or an injected stand-in for tests) --
  // fire-and-forget, matching the existing `void refreshRestoration()` call.
  startRestoration: () => void;
};

export async function runAccountResolutionOperation(
  deps: ResolveAccountOperationDeps,
): Promise<void> {
  const classify = deps.classify ?? classifyProfileDiagnostic;
  const recordStage = deps.recordStage ?? recordRestorationStage;

  deps.onPending();
  recordStage('account-lookup-start');

  try {
    let diagnostic: ProfileDiagnosticResult;
    try {
      diagnostic = await deps.runDiagnostic();
      recordStage('account-lookup-success', diagnostic.status);
    } catch (error) {
      recordStage(
        error instanceof TimeoutError ? 'account-lookup-timeout' : 'account-lookup-failed',
        error instanceof Error ? error.name : undefined,
      );
      diagnostic = unavailableProfileDiagnostic();
    }
    // The core fix: staleness is checked against a guard that is NEVER
    // touched by onPending/onReturning/onNew/onBlocked above or below --
    // only a genuinely new operation (Retry, a different account) or a
    // real unmount can make this true.
    if (deps.isStale()) return;

    const decision = classify(diagnostic);
    if (decision === 'allow') {
      // An exact existing provider identity always restores the existing
      // account -- deliberately ignores intent. Create Account against an
      // identity that already has an account is not an error; Sign In
      // against one is exactly the success case.
      deps.onReturning();
      deps.startRestoration();
    } else if (decision === 'not_found') {
      if (deps.intent === 'signIn') {
        deps.onSignInNotFound();
      } else {
        deps.onNew();
      }
    } else {
      deps.onBlocked();
    }
  } catch (error) {
    // classify (or anything else here) throwing unexpectedly must still
    // resolve to an explicit error state, not leave the caller stuck at
    // 'pending' with nothing watching it.
    recordStage('account-lookup-failed', error instanceof Error ? error.name : undefined);
    if (!deps.isStale()) deps.onBlocked();
  } finally {
    if (!deps.isStale()) deps.onSettled();
  }
}
