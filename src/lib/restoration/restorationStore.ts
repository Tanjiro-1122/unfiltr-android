import { useSyncExternalStore } from 'react';

import type { SyncedChatMessage } from '@/lib/chat/history';
import type { RemoteJournalEntry } from '@/lib/journal/remoteJournal';
import type { RemoteProfile } from '@/lib/profile/remoteProfile';
import {
  clearCurrentAccountCache,
  getCachedAccountJson,
  getCurrentAccountId,
  setCachedAccountJson,
} from '@/lib/restoration/accountCache';
import {
  restoreStartupAccountData,
  type RestorationData,
  type RestoredChatMessage,
  type RestoredJournalEntry,
  type StartupRestorationResult,
} from '@/lib/restoration/startupRestoration';

export type RestorationLoadStatus = 'idle' | 'loading' | 'ready';

export type RestorationState = {
  accountId: string | null;
  chatHistory: RestorationData<SyncedChatMessage[]>;
  companionMemory: RestorationData<Record<string, unknown>>;
  errorSummaries: string[];
  journalEntries: RestorationData<RemoteJournalEntry[]>;
  lastSuccessfulRemoteSyncAt: string | null;
  profile: RestorationData<RemoteProfile>;
  status: RestorationLoadStatus;
};

const emptyData = <T>(): RestorationData<T> => ({ data: null, source: 'unavailable' });

let state: RestorationState = {
  accountId: null,
  chatHistory: emptyData<SyncedChatMessage[]>(),
  companionMemory: emptyData<Record<string, unknown>>(),
  errorSummaries: [],
  journalEntries: emptyData<RemoteJournalEntry[]>(),
  lastSuccessfulRemoteSyncAt: null,
  profile: emptyData<RemoteProfile>(),
  status: 'idle',
};
let restorePromise: Promise<StartupRestorationResult | null> | null = null;
const listeners = new Set<() => void>();

export function useRestoration(): RestorationState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export async function refreshRestoration(): Promise<StartupRestorationResult | null> {
  if (restorePromise) return restorePromise;

  const accountId = await getCurrentAccountId();
  setState({ accountId, status: 'loading' });

  restorePromise = restoreStartupAccountData()
    .then(async (result) => {
      const next = normalizeRestorationResult(result, accountId);
      setState(next);
      await writeRemoteCaches(next);
      return result;
    })
    .catch(async (error: unknown) => {
      const cached = await readCachedState(
        accountId,
        summarizeError('Startup restoration failed', error),
      );
      setState(cached);
      return null;
    })
    .finally(() => {
      restorePromise = null;
    });

  return restorePromise;
}

export async function updateCachedChatHistory(messages: SyncedChatMessage[]): Promise<void> {
  const nextMessages = messages.slice(-60);
  if (areChatMessagesEqual(state.chatHistory.data, nextMessages)) return;

  const chatHistory: RestorationData<SyncedChatMessage[]> = {
    data: nextMessages,
    source: state.chatHistory.source === 'remote' ? 'remote' : 'cached',
  };
  setState({ chatHistory });
  await setCachedAccountJson('chat', chatHistory.data);
}

export async function updateCachedJournalEntries(entries: RemoteJournalEntry[]): Promise<void> {
  if (JSON.stringify(state.journalEntries.data ?? []) === JSON.stringify(entries)) return;

  const journalEntries: RestorationData<RemoteJournalEntry[]> = {
    data: entries,
    source: state.journalEntries.source === 'remote' ? 'remote' : 'cached',
  };
  setState({ journalEntries });
  await setCachedAccountJson('journal', journalEntries.data);
}

export async function clearRestorationForSignOut(): Promise<void> {
  await clearCurrentAccountCache();
  state = {
    accountId: null,
    chatHistory: emptyData<SyncedChatMessage[]>(),
    companionMemory: emptyData<Record<string, unknown>>(),
    errorSummaries: [],
    journalEntries: emptyData<RemoteJournalEntry[]>(),
    lastSuccessfulRemoteSyncAt: null,
    profile: emptyData<RemoteProfile>(),
    status: 'idle',
  };
  emit();
}

function normalizeRestorationResult(
  result: StartupRestorationResult,
  accountId: string | null,
): Partial<RestorationState> {
  const remoteOk =
    result.profile.source === 'remote' ||
    result.chatHistory.source === 'remote' ||
    result.journalEntries.source === 'remote';
  return {
    accountId,
    chatHistory: {
      ...result.chatHistory,
      data: normalizeChatMessages(result.chatHistory.data),
    },
    companionMemory: result.companionMemory,
    errorSummaries: result.errorSummaries,
    journalEntries: {
      ...result.journalEntries,
      data: normalizeJournalEntries(result.journalEntries.data),
    },
    lastSuccessfulRemoteSyncAt: remoteOk
      ? new Date().toISOString()
      : state.lastSuccessfulRemoteSyncAt,
    profile: result.profile as RestorationData<RemoteProfile>,
    status: 'ready',
  };
}

async function readCachedState(
  accountId: string | null,
  error: string,
): Promise<Partial<RestorationState>> {
  const [profile, memory, chatHistory, journalEntries] = await Promise.all([
    getCachedAccountJson<RemoteProfile>('profile'),
    getCachedAccountJson<Record<string, unknown>>('memory'),
    getCachedAccountJson<SyncedChatMessage[]>('chat'),
    getCachedAccountJson<RemoteJournalEntry[]>('journal'),
  ]);

  return {
    accountId,
    chatHistory: {
      data: chatHistory?.length ? chatHistory : null,
      error,
      source: chatHistory?.length ? 'cached' : 'unavailable',
    },
    companionMemory: {
      data: memory,
      error,
      source: memory ? 'cached' : 'unavailable',
    },
    errorSummaries: [error],
    journalEntries: {
      data: journalEntries?.length ? journalEntries : null,
      error,
      source: journalEntries?.length ? 'cached' : 'unavailable',
    },
    profile: {
      data: profile,
      error,
      source: profile ? 'cached' : 'unavailable',
    },
    status: 'ready',
  };
}

async function writeRemoteCaches(next: Partial<RestorationState>) {
  await Promise.all([
    next.profile?.source === 'remote' && next.profile.data
      ? setCachedAccountJson('profile', next.profile.data)
      : Promise.resolve(),
    next.companionMemory?.source === 'remote' && next.companionMemory.data
      ? setCachedAccountJson('memory', next.companionMemory.data)
      : Promise.resolve(),
    next.chatHistory?.source === 'remote' && next.chatHistory.data
      ? setCachedAccountJson('chat', next.chatHistory.data)
      : Promise.resolve(),
    next.journalEntries?.source === 'remote' && next.journalEntries.data
      ? setCachedAccountJson('journal', next.journalEntries.data)
      : Promise.resolve(),
  ]);
}

function normalizeChatMessages(value: RestoredChatMessage[] | null): SyncedChatMessage[] | null {
  if (!Array.isArray(value)) return null;
  return value.map((message) => ({
    content: message.content,
    createdAt: message.createdAt || new Date().toISOString(),
    id: message.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: message.role,
  }));
}

function normalizeJournalEntries(
  value: RestoredJournalEntry[] | null,
): RemoteJournalEntry[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .map((entry): RemoteJournalEntry | null => {
      const id = typeof entry.id === 'string' ? entry.id : null;
      const content = typeof entry.content === 'string' ? entry.content : '';
      if (!id || !content) return null;
      const normalized: RemoteJournalEntry = {
        content,
        id,
      };
      if (typeof entry.created_at === 'string') normalized.created_at = entry.created_at;
      if (typeof entry.created_date === 'string') normalized.created_date = entry.created_date;
      else if (typeof entry.created_at === 'string') normalized.created_date = entry.created_at;
      if (typeof entry.mood === 'string') normalized.mood = entry.mood;
      if (typeof entry.title === 'string') normalized.title = entry.title;
      return normalized;
    })
    .filter((entry): entry is RemoteJournalEntry => !!entry);
}

function setState(next: Partial<RestorationState>) {
  state = { ...state, ...next };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): RestorationState {
  return state;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function summarizeError(prefix: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `${prefix}: ${message}`;
}

function areChatMessagesEqual(
  left: SyncedChatMessage[] | null,
  right: SyncedChatMessage[],
): boolean {
  if (!left || left.length !== right.length) return false;
  return left.every((message, index) => {
    const other = right[index];
    return (
      !!other &&
      message.id === other.id &&
      message.role === other.role &&
      message.content === other.content &&
      message.createdAt === other.createdAt
    );
  });
}
