export class TimeoutError extends Error {
  constructor(message = 'Request timed out.') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Races `promise` against a timer so the caller always gets a settled
 * result within `ms`, regardless of whether `promise` itself ever settles.
 * This does not cancel `promise` -- pair it with an AbortController-based
 * request (see fetchWithTimeout) wherever the hung work should also stop
 * running in the background, not just stop blocking the caller.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
