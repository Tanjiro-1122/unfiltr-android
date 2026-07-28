import {
  deleteAppStorageItem,
  getAppStorageItem,
  setAppStorageItem,
} from '@/lib/storage/appStorage';
import { deleteSecureItem, getSecureItem } from '@/lib/storage/secureStorage';

export type AccountCacheArea = 'chat' | 'journal' | 'memory' | 'profile' | 'restorationMeta';

const CACHE_PREFIX = 'unfiltr.account';

export async function getCurrentAccountId(): Promise<string | null> {
  const [appleUserId, userId, profileId] = await Promise.all([
    getSecureItem('auth.userId'),
    getSecureItem('auth.appleUserId'),
    getSecureItem('auth.profileId'),
  ]);
  return normalizeAccountId(appleUserId || userId || profileId);
}

export async function getCachedAccountJson<T>(area: AccountCacheArea): Promise<T | null> {
  const accountId = await getCurrentAccountId();
  if (!accountId) return null;

  const raw = await getAppStorageItem(accountCacheKey(accountId, area));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCachedAccountJson<T>(area: AccountCacheArea, value: T): Promise<void> {
  const accountId = await getCurrentAccountId();
  if (!accountId) return;
  await setAppStorageItem(accountCacheKey(accountId, area), JSON.stringify(value));
}

export async function clearCurrentAccountCache(): Promise<void> {
  const accountId = await getCurrentAccountId();
  await clearLegacyLocalRestorationArtifacts();
  if (!accountId) return;

  await Promise.all(
    (['chat', 'journal', 'memory', 'profile', 'restorationMeta'] as const).map((area) =>
      deleteAppStorageItem(accountCacheKey(accountId, area)),
    ),
  );
}

async function clearLegacyLocalRestorationArtifacts(): Promise<void> {
  await Promise.all([
    deleteSecureItem('chat.currentSessionId'),
    deleteSecureItem('chat.draft'),
    deleteSecureItem('chat.messages'),
    deleteSecureItem('chat.privateSession'),
    deleteAppStorageItem('unfiltr_chat_history'),
    deleteAppStorageItem('unfiltr_chat_messages'),
    deleteAppStorageItem('unfiltr_chat_sessions'),
    deleteAppStorageItem('unfiltr_current_chat_db_id'),
    deleteAppStorageItem('unfiltr_journal_entries'),
    deleteAppStorageItem('unfiltr_memory'),
    deleteAppStorageItem('unfiltr_memory_summary'),
    deleteAppStorageItem('unfiltr_profile_snapshot'),
  ]);
}

function accountCacheKey(accountId: string, area: AccountCacheArea): string {
  return `${CACHE_PREFIX}.${encodeURIComponent(accountId)}.${area}`;
}

function normalizeAccountId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}
