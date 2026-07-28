import { apiClient, ApiError } from '@/lib/api';
import {
  deleteAppStorageItem,
  getAppStorageItem,
  setAppStorageItem,
} from '@/lib/storage/appStorage';

const ADMIN_UNLOCK_KEY = 'unfiltr_admin_unlocked';
const ADMIN_UNLOCKED_AT_KEY = 'unfiltr_admin_unlocked_at';
const ADMIN_SESSION_MAX_AGE_MS = 30 * 60 * 1000;

type SpecialCodeResponse = {
  type?: 'admin' | 'family' | null;
};

export type AdminAccessResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'invalid' | 'missing-route' | 'offline' | 'unauthenticated' | 'unknown';
      message: string;
    };

export async function verifyAdminAccess(code: string): Promise<AdminAccessResult> {
  const normalizedCode = code.trim();
  if (!normalizedCode) {
    return { ok: false, reason: 'invalid', message: 'Enter the owner code.' };
  }

  try {
    const response = await apiClient.post<SpecialCodeResponse>('/api/utils', {
      action: 'verifySpecialCode',
      code: normalizedCode,
    });

    if (response.type !== 'admin') {
      await clearAdminAccess();
      return { ok: false, reason: 'invalid', message: 'The owner code was not accepted.' };
    }

    await Promise.all([
      setAppStorageItem(ADMIN_UNLOCK_KEY, 'true'),
      setAppStorageItem(ADMIN_UNLOCKED_AT_KEY, String(Date.now())),
    ]);
    return { ok: true };
  } catch (error) {
    await clearAdminAccess();
    if (error instanceof ApiError && error.status === 401) {
      return {
        ok: false,
        reason: 'unauthenticated',
        message: 'Sign in with Apple again before opening owner tools.',
      };
    }
    if (error instanceof ApiError && (error.status === 404 || error.status === 503)) {
      return {
        ok: false,
        reason: 'missing-route',
        message: 'The protected owner route is not available on the configured backend.',
      };
    }
    if (error instanceof ApiError && error.status === 403) {
      return { ok: false, reason: 'invalid', message: 'The owner code was not accepted.' };
    }
    return {
      ok: false,
      reason: error instanceof ApiError ? 'unknown' : 'offline',
      message: 'Could not verify owner access. Check the backend connection and try again.',
    };
  }
}

export async function hasActiveAdminAccess(): Promise<boolean> {
  const [unlocked, unlockedAt] = await Promise.all([
    getAppStorageItem(ADMIN_UNLOCK_KEY),
    getAppStorageItem(ADMIN_UNLOCKED_AT_KEY),
  ]);
  const timestamp = Number(unlockedAt || 0);
  const active = unlocked === 'true' && timestamp > 0 && Date.now() - timestamp < ADMIN_SESSION_MAX_AGE_MS;
  if (!active) await clearAdminAccess();
  return active;
}

export async function clearAdminAccess(): Promise<void> {
  await Promise.all([
    deleteAppStorageItem(ADMIN_UNLOCK_KEY),
    deleteAppStorageItem(ADMIN_UNLOCKED_AT_KEY),
  ]);
}
