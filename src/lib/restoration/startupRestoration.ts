import { apiClient } from '@/lib/api';
import { getCachedAccountJson } from '@/lib/restoration/accountCache';
import { getJsonItem } from '@/lib/storage/appStorage';
import { getSecureItem } from '@/lib/storage/secureStorage';

export type RestorationSourceStatus = 'cached' | 'remote' | 'unavailable';

export type RestorationData<T> = {
  data: T | null;
  error?: string | undefined;
  source: RestorationSourceStatus;
};

export type StartupRestorationResult = {
  authenticationStatus: 'authenticated';
  chatHistory: RestorationData<RestoredChatMessage[]>;
  companionMemory: RestorationData<Record<string, unknown>>;
  errorSummaries: string[];
  journalEntries: RestorationData<RestoredJournalEntry[]>;
  profile: RestorationData<RestoredProfile>;
};

export type RestoredProfile = Record<string, unknown>;

export type RestoredChatMessage = {
  content: string;
  createdAt?: string;
  id?: string;
  role: 'assistant' | 'user';
};

export type RestoredJournalEntry = Record<string, unknown> & {
  id?: string;
};

type ProfileResponse = {
  memory?: Record<string, unknown>;
  profile?: RestoredProfile | null;
};

type LegacyProfileResponse = {
  data?: RestoredProfile | null;
  found?: boolean;
};

type LegacyDataResponse = {
  chatHistory?: unknown;
  journalEntries?: unknown;
};

type ChatHistoryResponse = {
  session?: {
    messages?: unknown;
  } | null;
};

type JournalResponse = {
  entries?: unknown;
};

let legacyDataPromise: Promise<LegacyDataResponse | null> | null = null;

export async function restoreStartupAccountData(): Promise<StartupRestorationResult> {
  legacyDataPromise = null;
  const [profileResult, chatHistoryResult, journalResult] = await Promise.all([
    restoreProfileAndMemory(),
    restoreChatHistory(),
    restoreJournalEntries(),
  ]);
  legacyDataPromise = null;

  const errorSummaries = [
    profileResult.profile.error,
    profileResult.companionMemory.error,
    chatHistoryResult.error,
    journalResult.error,
  ].filter((error): error is string => !!error);

  return {
    authenticationStatus: 'authenticated',
    chatHistory: chatHistoryResult,
    companionMemory: profileResult.companionMemory,
    errorSummaries,
    journalEntries: journalResult,
    profile: profileResult.profile,
  };
}

async function restoreProfileAndMemory(): Promise<{
  companionMemory: RestorationData<Record<string, unknown>>;
  profile: RestorationData<RestoredProfile>;
}> {
  try {
    const response = await apiClient.post<ProfileResponse>('/api/profile', { action: 'get' });
    if (response.profile) return remoteProfileResult(response.profile, response.memory);

    const legacy = await restoreLegacyAppleProfile();
    if (legacy) return legacy;

    return remoteProfileResult(null, response.memory);
  } catch (primaryError) {
    try {
      const legacy = await restoreLegacyAppleProfile();
      if (legacy) return legacy;
    } catch {
      // The cached account fallback below remains the final recovery path.
    }

    const [cachedProfile, cachedMemory] = await Promise.all([
      getCachedAccountJson<RestoredProfile>('profile'),
      getCachedAccountJson<Record<string, unknown>>('memory'),
    ]);
    const summary = summarizeError('Profile restoration failed', primaryError);
    return {
      companionMemory: {
        data: cachedMemory,
        error: summary,
        source: cachedMemory ? 'cached' : 'unavailable',
      },
      profile: {
        data: cachedProfile,
        error: summary,
        source: cachedProfile ? 'cached' : 'unavailable',
      },
    };
  }
}

async function restoreLegacyAppleProfile(): Promise<{
  companionMemory: RestorationData<Record<string, unknown>>;
  profile: RestorationData<RestoredProfile>;
} | null> {
  const appleUserId =
    (await getSecureItem('auth.appleUserId')) || (await getSecureItem('auth.userId'));
  if (!appleUserId) return null;

  const response = await apiClient.post<LegacyProfileResponse>(
    '/api/syncProfile',
    { action: 'lookup', appleUserId },
    { authenticated: false },
  );
  if (response.found === false || !response.data) return null;

  const profile = normalizeLegacyProfile(response.data);
  return remoteProfileResult(profile, extractLegacyMemory(profile));
}

function remoteProfileResult(
  profile: RestoredProfile | null,
  memory?: Record<string, unknown>,
): {
  companionMemory: RestorationData<Record<string, unknown>>;
  profile: RestorationData<RestoredProfile>;
} {
  return {
    companionMemory: {
      data: memory ?? {},
      source: 'remote',
    },
    profile: {
      data: profile,
      source: 'remote',
    },
  };
}

function normalizeLegacyProfile(profile: RestoredProfile): RestoredProfile {
  const companion =
    profile.companion && typeof profile.companion === 'object'
      ? (profile.companion as Record<string, unknown>)
      : null;
  return {
    ...profile,
    avatar_id:
      profile.avatar_id || companion?.avatar_id || profile.companion_id || profile.avatarId || null,
    companion_name:
      profile.companion_name ||
      profile.companion_nickname ||
      companion?.nickname ||
      companion?.name ||
      null,
    profile_id: profile.profile_id || profile.profileId || profile.id || null,
  };
}

function extractLegacyMemory(profile: RestoredProfile): Record<string, unknown> {
  return {
    emotional_timeline: profile.emotional_timeline ?? [],
    memory_summary: profile.memory_summary ?? '',
    relationship_milestones: profile.relationship_milestones ?? [],
    session_memory: profile.session_memory ?? [],
    structured_memory: profile.structured_memory ?? [],
    user_facts: profile.user_facts ?? {},
  };
}

async function restoreChatHistory(): Promise<RestorationData<RestoredChatMessage[]>> {
  let primaryError: unknown = null;
  try {
    const response = await apiClient.post<ChatHistoryResponse>('/api/chat-history', {
      action: 'loadLatest',
    });
    const messages = normalizeChatMessages(response.session?.messages);
    if (messages.length) return { data: messages, source: 'remote' };
  } catch (error) {
    primaryError = error;
  }

  try {
    const legacy = await restoreLegacyAccountData();
    const messages = normalizeChatMessages(legacy?.chatHistory);
    if (messages.length) return { data: messages, source: 'remote' };
  } catch (error) {
    primaryError ??= error;
  }

  const accountCached = normalizeChatMessages(
    await getCachedAccountJson<RestoredChatMessage[]>('chat'),
  );
  const cached = accountCached.length
    ? accountCached
    : normalizeChatMessages(await readCachedSecureJson('chat.messages'));
  return {
    data: cached.length ? cached : null,
    error: primaryError ? summarizeError('Chat history restoration failed', primaryError) : undefined,
    source: cached.length ? 'cached' : 'unavailable',
  };
}

async function restoreJournalEntries(): Promise<RestorationData<RestoredJournalEntry[]>> {
  let primaryError: unknown = null;
  try {
    const response = await apiClient.post<JournalResponse>('/api/journal', { action: 'list' });
    const entries = normalizeJournalEntries(response.entries);
    if (entries.length) return { data: entries, source: 'remote' };
  } catch (error) {
    primaryError = error;
  }

  try {
    const legacy = await restoreLegacyAccountData();
    const entries = normalizeJournalEntries(legacy?.journalEntries);
    if (entries.length) return { data: entries, source: 'remote' };
  } catch (error) {
    primaryError ??= error;
  }

  const cached =
    (await getCachedAccountJson<RestoredJournalEntry[]>('journal')) ||
    (await getJsonItem<RestoredJournalEntry[]>('unfiltr_journal_entries', []));
  return {
    data: cached.length ? cached : null,
    error: primaryError ? summarizeError('Journal restoration failed', primaryError) : undefined,
    source: cached.length ? 'cached' : 'unavailable',
  };
}

async function restoreLegacyAccountData(): Promise<LegacyDataResponse | null> {
  if (legacyDataPromise) return legacyDataPromise;

  legacyDataPromise = (async () => {
    const [appleUserId, identityToken] = await Promise.all([
      getSecureItem('auth.appleUserId').then((value) => value || getSecureItem('auth.userId')),
      getSecureItem('auth.appleIdentityToken'),
    ]);
    if (!appleUserId || !identityToken) return null;

    return apiClient.post<LegacyDataResponse>(
      '/api/restoreLegacyData',
      { appleUserId, identityToken },
      { authenticated: false },
    );
  })();

  return legacyDataPromise;
}

async function readCachedSecureJson(key: Parameters<typeof getSecureItem>[0]): Promise<unknown> {
  const raw = await getSecureItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function normalizeChatMessages(value: unknown): RestoredChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): RestoredChatMessage | null => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Partial<RestoredChatMessage> & { created_at?: unknown };
      if (
        (candidate.role !== 'assistant' && candidate.role !== 'user') ||
        typeof candidate.content !== 'string'
      ) {
        return null;
      }
      const message: RestoredChatMessage = {
        content: candidate.content,
        role: candidate.role,
      };
      const createdAt =
        typeof candidate.createdAt === 'string'
          ? candidate.createdAt
          : typeof candidate.created_at === 'string'
            ? candidate.created_at
            : null;
      if (createdAt) message.createdAt = createdAt;
      if (typeof candidate.id === 'string') message.id = candidate.id;
      return message;
    })
    .filter((item): item is RestoredChatMessage => !!item);
}

function normalizeJournalEntries(value: unknown): RestoredJournalEntry[] {
  return Array.isArray(value)
    ? value.filter((item): item is RestoredJournalEntry => !!item && typeof item === 'object')
    : [];
}

function summarizeError(prefix: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `${prefix}: ${message}`;
}
