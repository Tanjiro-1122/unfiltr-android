import { apiClient, ApiError } from '@/lib/api';

export type FamilyActivationResponse = {
  activated?: boolean;
  tier?: string;
  profile?: {
    id?: string | null;
    is_family?: boolean | null;
    is_premium?: boolean | null;
    tier?: string | null;
  } | null;
};

export type FamilyAccessResult =
  | { ok: true; response: FamilyActivationResponse }
  | {
      ok: false;
      reason: 'invalid' | 'missing-route' | 'offline' | 'unauthenticated' | 'unconfirmed' | 'unknown';
      message: string;
    };

/**
 * Mirrors adminAccess.ts's verifyAdminAccess shape deliberately: a result
 * object the caller switches on, never a thrown error, so the UI can never
 * accidentally treat "the server rejected this" as success by forgetting a
 * catch block. Extracted out of SettingsScreen.tsx's inline try/catch so
 * this mapping (which HTTP status means what to the user) is unit-testable
 * on its own -- see familyAccess.test.ts.
 */
export async function verifyFamilyAccess(code: string): Promise<FamilyAccessResult> {
  const normalizedCode = code.trim();
  if (!normalizedCode) {
    return { ok: false, reason: 'invalid', message: 'Enter a valid code.' };
  }

  try {
    const response = await apiClient.post<FamilyActivationResponse>('/api/profile', {
      action: 'activateFamily',
      code: normalizedCode,
    });

    if (!isVerifiedFamilyActivation(response)) {
      return {
        ok: false,
        reason: 'unconfirmed',
        message: 'Family access was not confirmed by the server.',
      };
    }

    return { ok: true, response };
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      return { ok: false, reason: 'invalid', message: 'Enter a valid code.' };
    }
    if (error instanceof ApiError && error.status === 401) {
      return {
        ok: false,
        reason: 'unauthenticated',
        message: 'Sign in with Apple again before activating family access.',
      };
    }
    if (error instanceof ApiError && error.status === 403) {
      return { ok: false, reason: 'invalid', message: 'Invalid code.' };
    }
    // 404 (route not deployed) and 503 (server configuration incomplete --
    // e.g. a missing table/env var) are both reported honestly as "not
    // configured yet", matching adminAccess.ts's 404/503 -> 'missing-route'
    // mapping. Never silently retried or replaced with fake success.
    if (error instanceof ApiError && (error.status === 404 || error.status === 503)) {
      return {
        ok: false,
        reason: 'missing-route',
        message: 'Family access is not configured on the server yet.',
      };
    }
    return {
      ok: false,
      reason: error instanceof ApiError ? 'unknown' : 'offline',
      message: 'Could not reach the access server. Check the API URL and try again.',
    };
  }
}

function isVerifiedFamilyActivation(response: FamilyActivationResponse): boolean {
  return (
    response.activated === true &&
    response.tier === 'family' &&
    response.profile?.is_family === true &&
    response.profile?.is_premium === true
  );
}
