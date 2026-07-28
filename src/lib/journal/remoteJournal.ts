import { apiClient } from '@/lib/api/client';

export type RemoteJournalEntry = {
  content: string;
  created_at?: string;
  created_date?: string;
  id: string;
  mood?: string;
  title?: string;
};

type JournalListResponse = {
  entries?: RemoteJournalEntry[];
};

type JournalUpsertResponse = {
  entry?: RemoteJournalEntry | null;
};

export async function loadRemoteJournalEntries(): Promise<RemoteJournalEntry[]> {
  const response = await apiClient.post<JournalListResponse>('/api/journal', { action: 'list' });
  return Array.isArray(response.entries) ? response.entries : [];
}

export async function saveRemoteJournalEntry(
  entry: RemoteJournalEntry,
): Promise<RemoteJournalEntry | null> {
  const response = await apiClient.post<JournalUpsertResponse>('/api/journal', {
    action: 'upsert',
    entry,
  });
  return response.entry ?? null;
}

export async function deleteRemoteJournalEntry(id: string): Promise<void> {
  await apiClient.post('/api/journal', { action: 'delete', id });
}
