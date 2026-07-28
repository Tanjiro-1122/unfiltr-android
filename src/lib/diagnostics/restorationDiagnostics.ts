export type RestorationStage =
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

/**
 * `detail` must never be a token, secret, or raw error/response object --
 * callers pass a short, human-safe label only (e.g. a stage outcome or a
 * generic error class name). This is a small in-memory ring buffer, not
 * persisted, and is cleared on sign-out along with everything else
 * account-scoped.
 */
export function recordRestorationStage(stage: RestorationStage, detail?: string): void {
  entries = [
    ...entries,
    { stage, timestamp: Date.now(), ...(detail ? { detail: detail.slice(0, MAX_DETAIL_LENGTH) } : {}) },
  ].slice(-MAX_ENTRIES);
}

export function getRestorationDiagnostics(): RestorationDiagnosticEntry[] {
  return entries;
}

export function clearRestorationDiagnostics(): void {
  entries = [];
}
