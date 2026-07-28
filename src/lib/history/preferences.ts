import { getJsonItem, setJsonItem } from '@/lib/storage/appStorage';

const HISTORY_STORAGE_KEY = 'unfiltr.chat-history.v1';
const HISTORY_LIMIT = 50;

export type HistoryMessage = {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: string;
};

export type HistorySession = {
  id: string;
  title: string;
  preview: string;
  messages: HistoryMessage[];
  createdAt: string;
  updatedAt: string;
};

function normalizeSession(value: unknown): HistorySession | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<HistorySession>;
  if (typeof item.id !== 'string' || !item.id) return null;

  const messages = Array.isArray(item.messages)
    ? item.messages.filter(
        (message): message is HistoryMessage =>
          Boolean(
            message &&
              typeof message === 'object' &&
              typeof message.content === 'string' &&
              (message.role === 'user' || message.role === 'assistant' || message.role === 'system'),
          ),
      )
    : [];

  const createdAt = typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString();
  const updatedAt = typeof item.updatedAt === 'string' ? item.updatedAt : createdAt;
  const firstUserMessage = messages.find((message) => message.role === 'user')?.content.trim();
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant')
    ?.content.trim();

  return {
    id: item.id,
    title:
      typeof item.title === 'string' && item.title.trim()
        ? item.title.trim()
        : firstUserMessage?.slice(0, 48) || 'Conversation',
    preview:
      typeof item.preview === 'string' && item.preview.trim()
        ? item.preview.trim()
        : lastAssistantMessage?.slice(0, 120) || firstUserMessage?.slice(0, 120) || 'No messages',
    messages,
    createdAt,
    updatedAt,
  };
}

export async function loadHistorySessions(): Promise<HistorySession[]> {
  const stored = await getJsonItem<unknown[]>(HISTORY_STORAGE_KEY, []);
  if (!Array.isArray(stored)) return [];

  return stored
    .map(normalizeSession)
    .filter((session): session is HistorySession => session !== null)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function saveHistorySession(session: HistorySession): Promise<HistorySession[]> {
  const current = await loadHistorySessions();
  const normalized = normalizeSession(session);
  if (!normalized) return current;

  const next = [normalized, ...current.filter((item) => item.id !== normalized.id)]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, HISTORY_LIMIT);

  await setJsonItem(HISTORY_STORAGE_KEY, next);
  return next;
}

export async function deleteHistorySession(id: string): Promise<HistorySession[]> {
  const current = await loadHistorySessions();
  const next = current.filter((session) => session.id !== id);
  await setJsonItem(HISTORY_STORAGE_KEY, next);
  return next;
}

export function searchHistorySessions(
  sessions: HistorySession[],
  query: string,
): HistorySession[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return sessions;

  return sessions.filter((session) => {
    if (session.title.toLowerCase().includes(normalizedQuery)) return true;
    if (session.preview.toLowerCase().includes(normalizedQuery)) return true;
    return session.messages.some((message) => message.content.toLowerCase().includes(normalizedQuery));
  });
}
