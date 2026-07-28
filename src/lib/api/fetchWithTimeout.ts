export const DEFAULT_FETCH_TIMEOUT_MS = 15000;

export class FetchTimeoutError extends Error {
  constructor(message = 'Request timed out.') {
    super(message);
    this.name = 'FetchTimeoutError';
  }
}

/**
 * A plain `fetch()` with no signal never settles if the network stalls (no
 * TCP response, dead proxy, etc.) -- every caller ends up depending entirely
 * on some outer, independently-coded timer to notice and move on. Aborting
 * here means the request itself always settles, so a hung network can never
 * wedge a promise chain (e.g. restorePromise in restorationStore.ts) open
 * forever.
 */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new FetchTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
