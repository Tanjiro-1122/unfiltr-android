import { getAppStorageItem, getJsonItem, setJsonItem } from '@/lib/storage/appStorage';

const STORAGE_KEY = 'unfiltr_saved_moments_v1';
const CHAT_MESSAGES_KEY = 'unfiltr_chat_messages';
const MAX_SAVED_MOMENTS = 50;

export type SavedMoment = {
  id: string;
  content: string;
  companionName: string;
  savedAt: string;
  sourceMessageId?: string;
};

type StoredChatMessage = {
  id?: string;
  content?: string;
  role?: 'assistant' | 'user';
};

function validMoment(value: unknown): value is SavedMoment {
  if (!value || typeof value !== 'object') return false;
  const moment = value as Partial<SavedMoment>;
  return (
    typeof moment.id === 'string' &&
    typeof moment.content === 'string' &&
    typeof moment.companionName === 'string' &&
    typeof moment.savedAt === 'string'
  );
}

export async function loadSavedMoments(): Promise<SavedMoment[]> {
  const stored = await getJsonItem<unknown>(STORAGE_KEY, []);
  if (!Array.isArray(stored)) return [];
  return stored.filter(validMoment).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function saveMoment(
  content: string,
  companionName: string,
  sourceMessageId?: string,
): Promise<SavedMoment[]> {
  const text = content.trim();
  if (!text) throw new Error('A saved moment needs message content.');

  const current = await loadSavedMoments();
  const duplicate = current.find(
    (item) =>
      (sourceMessageId && item.sourceMessageId === sourceMessageId) ||
      (!sourceMessageId && item.content === text),
  );
  if (duplicate) return current;

  const entry: SavedMoment = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    content: text,
    companionName: companionName.trim() || 'Companion',
    savedAt: new Date().toISOString(),
    ...(sourceMessageId ? { sourceMessageId } : {}),
  };

  const next = [entry, ...current].slice(0, MAX_SAVED_MOMENTS);
  await setJsonItem(STORAGE_KEY, next);
  return next;
}

export async function removeSavedMoment(id: string): Promise<SavedMoment[]> {
  const current = await loadSavedMoments();
  const next = current.filter((item) => item.id !== id);
  await setJsonItem(STORAGE_KEY, next);
  return next;
}

export async function isMessageSaved(sourceMessageId: string): Promise<boolean> {
  if (!sourceMessageId.trim()) return false;
  const moments = await loadSavedMoments();
  return moments.some((moment) => moment.sourceMessageId === sourceMessageId);
}

export async function toggleSavedMoment(
  content: string,
  companionName: string,
  sourceMessageId: string,
): Promise<{ moments: SavedMoment[]; saved: boolean }> {
  const current = await loadSavedMoments();
  const existing = current.find((moment) => moment.sourceMessageId === sourceMessageId);
  if (existing) {
    return {
      moments: await removeSavedMoment(existing.id),
      saved: false,
    };
  }

  return {
    moments: await saveMoment(content, companionName, sourceMessageId),
    saved: true,
  };
}

export async function saveLatestAssistantMessage(
  companionName: string,
): Promise<{ moments: SavedMoment[]; saved: boolean }> {
  const raw = await getAppStorageItem(CHAT_MESSAGES_KEY);
  if (!raw) return { moments: await loadSavedMoments(), saved: false };

  let messages: StoredChatMessage[] = [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) messages = parsed as StoredChatMessage[];
  } catch {
    return { moments: await loadSavedMoments(), saved: false };
  }

  const latest = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.content?.trim());
  if (!latest?.content) return { moments: await loadSavedMoments(), saved: false };

  const before = await loadSavedMoments();
  const moments = await saveMoment(latest.content, companionName, latest.id);
  const existedBefore = before.some(
    (moment) =>
      (latest.id && moment.sourceMessageId === latest.id) ||
      (!latest.id && moment.content === latest.content),
  );
  return { moments, saved: !existedBefore };
}
