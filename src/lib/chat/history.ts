import { apiClient } from '@/lib/api/client';
import { saveHistorySession } from '@/lib/history/preferences';
import { getSecureItem, setSecureItem } from '@/lib/storage';

export type SyncedChatMessage = {
  content: string;
  createdAt: string;
  id: string;
  role: 'assistant' | 'user';
};

type ChatHistoryResponse = {
  session?: {
    client_id?: string;
    messages?: unknown;
  } | null;
};

const SESSION_ID_KEY = 'chat.currentSessionId';

export async function loadLatestChatHistory(): Promise<SyncedChatMessage[]> {
  try {
    const response = await apiClient.post<ChatHistoryResponse>('/api/chat-history', {
      action: 'loadLatest',
    });
    const messages = normalizeMessages(response.session?.messages);
    if (response.session?.client_id) {
      await setSecureItem(SESSION_ID_KEY, response.session.client_id);
    }
    return messages;
  } catch {
    return [];
  }
}

export async function saveChatHistory(messages: SyncedChatMessage[]): Promise<void> {
  if (messages.length < 2) return;
  const clientId = (await getSecureItem(SESSION_ID_KEY)) || createSessionId();
  await setSecureItem(SESSION_ID_KEY, clientId);

  const normalizedMessages = messages.slice(-60);
  const firstUserMessage = normalizedMessages.find((message) => message.role === 'user');
  const lastAssistantMessage = [...normalizedMessages]
    .reverse()
    .find((message) => message.role === 'assistant');
  const createdAt = normalizedMessages[0]?.createdAt || new Date().toISOString();
  const updatedAt = normalizedMessages.at(-1)?.createdAt || new Date().toISOString();

  await saveHistorySession({
    createdAt,
    id: clientId,
    messages: normalizedMessages,
    preview:
      lastAssistantMessage?.content.trim().slice(0, 120) ||
      firstUserMessage?.content.trim().slice(0, 120) ||
      'Conversation',
    title: firstUserMessage?.content.trim().slice(0, 48) || 'Conversation',
    updatedAt,
  });

  try {
    await apiClient.post('/api/chat-history', {
      action: 'save',
      session: {
        clientId,
        messages: normalizedMessages,
        tier: (await getSecureItem('unfiltr_revenuecat_tier')) || 'free',
      },
    });
  } catch {
    // Local history remains available while the remote sync retries on later messages.
  }
}

function createSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeMessages(value: unknown): SyncedChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): SyncedChatMessage | null => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Partial<SyncedChatMessage>;
      if (
        (candidate.role !== 'assistant' && candidate.role !== 'user') ||
        typeof candidate.content !== 'string'
      ) {
        return null;
      }
      return {
        content: candidate.content,
        createdAt: candidate.createdAt || new Date().toISOString(),
        id: candidate.id || createSessionId(),
        role: candidate.role,
      };
    })
    .filter((item): item is SyncedChatMessage => !!item)
    .slice(-60);
}
