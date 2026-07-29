export type RestorationStage =
  // Sign-in-screen stages: cover the part of the flow that happens BEFORE
  // any backend call (native provider SDK interaction), which none of the
  // stages below ever observed.
  | 'auth-started'
  | 'provider-token-received'
  // The native provider SDK step itself failed (not cancelled, not a known
  // Play Services issue) before any backend exchange was even attempted --
  // distinct from backend-exchange-failed below, which is a step later.
  | 'auth-failed'
  // Backend identity-exchange stages: recorded inside session.ts's
  // exchange functions, so they cover both a fresh sign-in AND the
  // auth-recovery path below (which also calls those same functions).
  | 'backend-exchange-started'
  | 'backend-exchange-succeeded'
  | 'backend-exchange-failed'
  | 'identity-found'
  | 'identity-not-found'
  | 'new-user-created'
  | 'auth-recovery-start'
  | 'auth-recovery-success'
  | 'auth-recovery-timeout'
  | 'auth-recovery-failed'
  | 'account-lookup-start'
  | 'account-lookup-success'
  | 'account-lookup-timeout'
  | 'account-lookup-failed'
  | 'restoration-start'
  | 'restoration-ready'
  | 'restoration-timeout'
  | 'restoration-failed'
  | 'revenuecat-sync-start'
  | 'revenuecat-sync-success'
  | 'revenuecat-sync-timeout'
  | 'revenuecat-sync-failed';

export type RestorationDiagnosticEntry = {
  detail?: string;
  stage: RestorationStage;
  timestamp: number;
};

const MAX_ENTRIES = 40;
const MAX_DETAIL_LENGTH = 120;

let entries: RestorationDiagnosticEntry[] = [];

const LOG_TAG = '[UnfiltrRestoration]';

/**
 * `detail` must never be a token, secret, or raw error/response object --
 * callers pass a short, human-safe label only (e.g. a stage outcome or a
 * generic error class name). The in-memory ring buffer is cleared on
 * sign-out along with everything else account-scoped; the console.warn
 * below is not persisted at all, but unlike the ring buffer it is visible
 * in `adb logcat` (filter for LOG_TAG) in a *release* build, since
 * console.* is not stripped by this project's Babel/Metro config -- the
 * ring buffer alone was reachable only from the in-app diagnostics screen,
 * which is unreachable if the account-restoration screen itself is the one
 * stuck.
 */
export function recordRestorationStage(stage: RestorationStage, detail?: string): void {
  entries = [
    ...entries,
    { stage, timestamp: Date.now(), ...(detail ? { detail: detail.slice(0, MAX_DETAIL_LENGTH) } : {}) },
  ].slice(-MAX_ENTRIES);

  console.warn(`${LOG_TAG} ${stage}${detail ? ` (${detail})` : ''}`);
}

export function getRestorationDiagnostics(): RestorationDiagnosticEntry[] {
  return entries;
}

export function clearRestorationDiagnostics(): void {
  entries = [];
}
